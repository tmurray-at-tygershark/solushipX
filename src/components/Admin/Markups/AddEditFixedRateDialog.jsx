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
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Divider,
    Paper,
    FormHelperText,
    InputAdornment
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Info as InfoIcon,
    Business as BusinessIcon,
    LocalShipping as LocalShippingIcon,
    Public as PublicIcon,
    Scale as ScaleIcon,
    Schedule as ScheduleIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

// Enhanced markup types with better descriptions
const markupTypes = [
    {
        value: 'FLAT_FEE_SHIPMENT',
        label: 'Flat Fee per Shipment',
        description: 'Fixed amount charged once per shipment regardless of packages or weight',
        icon: '📦',
        examples: '$25.00 per shipment'
    },
    {
        value: 'FLAT_FEE_PACKAGE',
        label: 'Flat Fee per Package',
        description: 'Fixed amount charged for each package in the shipment',
        icon: '📋',
        examples: '$5.00 per package'
    },
    {
        value: 'FLAT_FEE_POUND',
        label: 'Flat Fee per Pound/Kg',
        description: 'Fixed amount charged per pound or kilogram of total weight',
        icon: '⚖️',
        examples: '$0.50 per pound'
    },
    {
        value: 'PERCENTAGE',
        label: 'Percentage of Base Rate',
        description: 'Percentage markup applied to the carrier\'s base rate',
        icon: '📊',
        examples: '15% of base rate'
    },
];

// Service types - Combined courier and freight from CreateShipmentX.jsx and ShipmentInfo.jsx
const serviceTypes = [
    { value: 'ANY', label: 'Any Service', description: 'Applies to all service levels' },

    // Courier Services
    { value: 'economy', label: 'Economy', description: 'Cost-effective courier delivery' },
    { value: 'express', label: 'Express', description: 'Fast courier delivery' },
    { value: 'priority', label: 'Priority', description: 'Premium courier service' },

    // LTL Freight Services
    { value: 'ltl_standard_sk', label: 'LTL Standard - SK', description: 'Less than truckload standard service - Skid' },
    { value: 'ltl_economy_lb', label: 'LTL Economy - LB', description: 'Less than truckload economy service - per pound' },
    { value: 'ltl_economy_sk', label: 'LTL Economy - SK', description: 'Less than truckload economy service - Skid' },
    { value: 'ltl_expedited_lb', label: 'LTL Expedited - LB', description: 'Expedited LTL service - per pound' },
    { value: 'ltl_expedited_sk', label: 'LTL Expedited - SK', description: 'Expedited LTL service - Skid' },
    { value: 'ltl_economy_skid', label: 'LTL Economy Skid', description: 'Economy skid-based LTL service' },
    { value: 'ltl_skid_sk', label: 'LTL Skid - SK', description: 'Skid-based LTL service - Skid' },
    { value: 'ltl_customer_specific', label: 'LTL Customer Specific', description: 'Custom LTL arrangements' },
    { value: 'ltl_standard_class', label: 'LTL Standard - Class', description: 'Class-based LTL standard service' },

    // Same Day Services
    { value: 'same_day_regular', label: 'Same Day Regular', description: 'Same day delivery (booked before 11:00 AM)' },
    { value: 'same_day_rush', label: 'Same Day Rush', description: '2-4 hours delivery (booked after 11:00 AM or downtown)' },
    { value: 'same_day_direct', label: 'Same Day Direct', description: 'Door-to-door same day service' },
    { value: 'same_day_after_hours', label: 'Same Day After Hours', description: 'After hours delivery (6:00 PM to 6:00 AM)' },
    { value: 'same_day_direct_weekends', label: 'Same Day Direct [Weekends]', description: 'Weekend same day service' },

    // Next Day Services
    { value: 'next_day_regular', label: 'Next Day Regular', description: 'Next business day delivery (booked after 11:00 AM)' },
    { value: 'next_day_rush', label: 'Next Day Rush', description: 'Priority next day delivery (downtown area)' },

    // Dedicated Services
    { value: 'dedicated_truck_hourly', label: 'Dedicated Truck - Hourly', description: 'Hourly dedicated truck service' },

    // FTL Services
    { value: 'ftl_53_dry_van', label: 'FTL - 53\' Dry Van', description: 'Full truckload 53-foot dry van' },
    { value: 'ftl_24_straight_truck', label: 'FTL - 24\' Straight Truck', description: 'Full truckload 24-foot straight truck' },
    { value: 'ftl_sprinter_van', label: 'FTL - Sprinter Van', description: 'Full truckload sprinter van' },
    { value: 'ftl_expedited', label: 'FTL Expedited', description: 'Expedited full truckload service' },
    { value: 'ftl_standard', label: 'FTL Standard', description: 'Standard full truckload service' },
    { value: 'ftl_economy', label: 'FTL Economy', description: 'Economy full truckload service' },
    { value: 'ftl_flatbed', label: 'FTL Flatbed', description: 'Full truckload flatbed service' },
];

// Countries with proper codes
const countries = [
    { value: 'ANY', label: 'Any Country' },
    { value: 'CA', label: 'Canada' },
    { value: 'US', label: 'United States' },
    { value: 'MX', label: 'Mexico' },
];

const AddEditFixedRateDialog = ({
    open,
    onClose,
    onSave,
    initialData,
    companiesList = [],
    carriersList = []
}) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [expandedSections, setExpandedSections] = useState({
        basic: true,
        geography: false,
        conditions: false,
        timing: false
    });

    const initializeState = () => ({
        // Company & Carrier
        companyId: initialData?.companyId || 'ANY',
        carrierId: initialData?.carrierId || 'ANY',

        // Service Details
        service: initialData?.service || 'ANY',
        type: initialData?.type || markupTypes[0].value,
        value: initialData?.value || 0,

        // Geographic Conditions
        fromCity: initialData?.fromCity || '',
        fromStateProv: initialData?.fromStateProv || '',
        fromCountry: initialData?.fromCountry || 'ANY',
        fromPostalCode: initialData?.fromPostalCode || '',
        toCity: initialData?.toCity || '',
        toStateProv: initialData?.toStateProv || '',
        toCountry: initialData?.toCountry || 'ANY',
        toPostalCode: initialData?.toPostalCode || '',

        // Weight & Package Conditions
        fromWeight: initialData?.fromWeight || 0,
        toWeight: initialData?.toWeight || 0,
        minQuantity: initialData?.minQuantity || 0,
        maxQuantity: initialData?.maxQuantity || 0,

        // Dimensional Constraints
        maxLength: initialData?.maxLength || 0,
        maxWidth: initialData?.maxWidth || 0,
        maxHeight: initialData?.maxHeight || 0,

        // Additional Conditions
        requiresSignature: initialData?.requiresSignature || false,
        isDangerous: initialData?.isDangerous || false,
        isInternational: initialData?.isInternational || false,

        // Timing
        effectiveDate: initialData?.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
        expiryDate: initialData?.expiryDate ? dayjs(initialData.expiryDate) : null,

        // Priority
        priority: initialData?.priority || 1,

        // Notes
        description: initialData?.description || '',
        internalNotes: initialData?.internalNotes || '',

        id: initialData?.id || null,
    });

    useEffect(() => {
        if (open) {
            setFormData(initializeState());
            setValidationErrors({});
            setExpandedSections({
                basic: true,
                geography: false,
                conditions: false,
                timing: false
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, open]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        const newValue = type === 'checkbox' ? checked : value;

        setFormData(prev => ({ ...prev, [name]: newValue }));

        // Clear validation error when user starts typing
        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleDateChange = (name, date) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };

    const handleAccordionChange = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const validateForm = () => {
        const errors = {};

        // Required field validation
        if (!formData.type) {
            errors.type = 'Rate type is required';
        }

        if (!formData.value || formData.value <= 0) {
            errors.value = 'Value must be greater than 0';
        }

        if (formData.type === 'PERCENTAGE' && formData.value > 100) {
            errors.value = 'Percentage cannot exceed 100%';
        }

        // Weight range validation
        if (formData.fromWeight && formData.toWeight && parseFloat(formData.fromWeight) >= parseFloat(formData.toWeight)) {
            errors.toWeight = 'Max weight must be greater than min weight';
        }

        // Quantity range validation
        if (formData.minQuantity && formData.maxQuantity && parseInt(formData.minQuantity) >= parseInt(formData.maxQuantity)) {
            errors.maxQuantity = 'Max quantity must be greater than min quantity';
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

        const saveData = {
            ...formData,
            effectiveDate: formData.effectiveDate ? formData.effectiveDate.toISOString() : null,
            expiryDate: formData.expiryDate ? formData.expiryDate.toISOString() : null,
            value: parseFloat(formData.value) || 0,
            fromWeight: parseFloat(formData.fromWeight) || 0,
            toWeight: parseFloat(formData.toWeight) || 0,
            minQuantity: parseInt(formData.minQuantity) || 0,
            maxQuantity: parseInt(formData.maxQuantity) || 0,
            maxLength: parseFloat(formData.maxLength) || 0,
            maxWidth: parseFloat(formData.maxWidth) || 0,
            maxHeight: parseFloat(formData.maxHeight) || 0,
            priority: parseInt(formData.priority) || 1,
        };

        await onSave(saveData);
        setLoading(false);
        onClose();
    };

    const getSelectedMarkupType = () => {
        return markupTypes.find(type => type.value === formData.type) || markupTypes[0];
    };

    const dialogTitle = formData.id ? 'Edit Fixed Rate Rule' : 'Add New Fixed Rate Rule';

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    pb: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalShippingIcon sx={{ color: '#059669' }} />
                        {dialogTitle}
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    {/* Rate Type Preview Card */}
                    <Paper sx={{ m: 3, p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ fontSize: '24px' }}>{getSelectedMarkupType().icon}</Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    {getSelectedMarkupType().label}
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    {getSelectedMarkupType().description}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                    Example: {getSelectedMarkupType().examples}
                                </Typography>
                            </Box>
                            {formData.value > 0 && (
                                <Chip
                                    label={`${formData.value}${formData.type === 'PERCENTAGE' ? '%' : ''}`}
                                    sx={{
                                        bgcolor: '#059669',
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '12px'
                                    }}
                                />
                            )}
                        </Box>
                    </Paper>

                    {/* Form Sections */}
                    <Box sx={{ px: 3, pb: 3 }}>
                        {/* Basic Configuration */}
                        <Accordion expanded={expandedSections.basic} onChange={() => handleAccordionChange('basic')}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BusinessIcon sx={{ color: '#059669', fontSize: '20px' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Basic Configuration
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small" error={!!validationErrors.companyId}>
                                            <InputLabel sx={{ fontSize: '12px' }}>Target Company</InputLabel>
                                            <Select
                                                name="companyId"
                                                value={formData.companyId || 'ANY'}
                                                label="Target Company"
                                                onChange={handleChange}
                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                            >
                                                <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any Company</MenuItem>
                                                {companiesList.map(company => (
                                                    <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>
                                                        {company.name}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            <FormHelperText sx={{ fontSize: '11px' }}>
                                                Which company this rate applies to
                                            </FormHelperText>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small" error={!!validationErrors.carrierId}>
                                            <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                                            <Select
                                                name="carrierId"
                                                value={formData.carrierId || 'ANY'}
                                                label="Carrier"
                                                onChange={handleChange}
                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                            >
                                                <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any Carrier</MenuItem>
                                                {carriersList.map(carrier => (
                                                    <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>
                                                        {carrier.name}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            <FormHelperText sx={{ fontSize: '11px' }}>
                                                Which carrier this rate applies to
                                            </FormHelperText>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <FormControl fullWidth size="small" error={!!validationErrors.service}>
                                            <InputLabel sx={{ fontSize: '12px' }}>Service Level</InputLabel>
                                            <Select
                                                name="service"
                                                value={formData.service || 'ANY'}
                                                label="Service Level"
                                                onChange={handleChange}
                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                            >
                                                {serviceTypes.map(service => (
                                                    <MenuItem key={service.value} value={service.value} sx={{ fontSize: '12px' }}>
                                                        <Box>
                                                            <Typography sx={{ fontSize: '12px' }}>{service.label}</Typography>
                                                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                {service.description}
                                                            </Typography>
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <FormControl fullWidth size="small" error={!!validationErrors.type} required>
                                            <InputLabel sx={{ fontSize: '12px' }}>Rate Type</InputLabel>
                                            <Select
                                                name="type"
                                                value={formData.type || ''}
                                                label="Rate Type"
                                                onChange={handleChange}
                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                            >
                                                {markupTypes.map(type => (
                                                    <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <span>{type.icon}</span>
                                                            <Box>
                                                                <Typography sx={{ fontSize: '12px' }}>{type.label}</Typography>
                                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                    {type.description}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {validationErrors.type && (
                                                <FormHelperText>{validationErrors.type}</FormHelperText>
                                            )}
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            label="Rate Value"
                                            name="value"
                                            type="number"
                                            value={formData.value || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            required
                                            size="small"
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
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Description"
                                            name="description"
                                            value={formData.description || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            placeholder="Brief description of this rate rule"
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Priority"
                                            name="priority"
                                            type="number"
                                            value={formData.priority || 1}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            helperText="Lower numbers = higher priority"
                                        />
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        {/* Geographic Conditions */}
                        <Accordion expanded={expandedSections.geography} onChange={() => handleAccordionChange('geography')}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PublicIcon sx={{ color: '#0ea5e9', fontSize: '20px' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Geographic Conditions
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                            Origin (Ship From)
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="From City"
                                            name="fromCity"
                                            value={formData.fromCity || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            placeholder="Any city"
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="From State/Province"
                                            name="fromStateProv"
                                            value={formData.fromStateProv || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            placeholder="ON, NY, etc."
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>From Country</InputLabel>
                                            <Select
                                                name="fromCountry"
                                                value={formData.fromCountry || 'ANY'}
                                                label="From Country"
                                                onChange={handleChange}
                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                            >
                                                {countries.map(country => (
                                                    <MenuItem key={country.value} value={country.value} sx={{ fontSize: '12px' }}>
                                                        {country.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="From Postal Code"
                                            name="fromPostalCode"
                                            value={formData.fromPostalCode || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            placeholder="K1A 0A6"
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Divider sx={{ my: 2 }} />
                                        <Typography sx={{ fontSize: '13px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                            Destination (Ship To)
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="To City"
                                            name="toCity"
                                            value={formData.toCity || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            placeholder="Any city"
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="To State/Province"
                                            name="toStateProv"
                                            value={formData.toStateProv || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            placeholder="ON, NY, etc."
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>To Country</InputLabel>
                                            <Select
                                                name="toCountry"
                                                value={formData.toCountry || 'ANY'}
                                                label="To Country"
                                                onChange={handleChange}
                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                            >
                                                {countries.map(country => (
                                                    <MenuItem key={country.value} value={country.value} sx={{ fontSize: '12px' }}>
                                                        {country.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="To Postal Code"
                                            name="toPostalCode"
                                            value={formData.toPostalCode || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            placeholder="90210"
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        {/* Weight & Package Conditions */}
                        <Accordion expanded={expandedSections.conditions} onChange={() => handleAccordionChange('conditions')}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ScaleIcon sx={{ color: '#f59e0b', fontSize: '20px' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Weight & Package Conditions
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="Min Weight (lbs)"
                                            name="fromWeight"
                                            type="number"
                                            value={formData.fromWeight || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            helperText="0 = no minimum"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="Max Weight (lbs)"
                                            name="toWeight"
                                            type="number"
                                            value={formData.toWeight || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            error={!!validationErrors.toWeight}
                                            helperText={validationErrors.toWeight || "0 = no maximum"}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="Min Packages"
                                            name="minQuantity"
                                            type="number"
                                            value={formData.minQuantity || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            helperText="0 = no minimum"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            label="Max Packages"
                                            name="maxQuantity"
                                            type="number"
                                            value={formData.maxQuantity || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            error={!!validationErrors.maxQuantity}
                                            helperText={validationErrors.maxQuantity || "0 = no maximum"}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Divider sx={{ my: 2 }} />
                                        <Typography sx={{ fontSize: '13px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                            Dimensional Constraints (inches)
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            label="Max Length (in)"
                                            name="maxLength"
                                            type="number"
                                            value={formData.maxLength || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            helperText="0 = no limit"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            label="Max Width (in)"
                                            name="maxWidth"
                                            type="number"
                                            value={formData.maxWidth || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            helperText="0 = no limit"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            label="Max Height (in)"
                                            name="maxHeight"
                                            type="number"
                                            value={formData.maxHeight || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            helperText="0 = no limit"
                                        />
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        {/* Timing & Notes */}
                        <Accordion expanded={expandedSections.timing} onChange={() => handleAccordionChange('timing')}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ScheduleIcon sx={{ color: '#8b5cf6', fontSize: '20px' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Timing & Notes
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <DatePicker
                                            label="Effective Date"
                                            value={formData.effectiveDate}
                                            onChange={(date) => handleDateChange('effectiveDate', date)}
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    size: "small",
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
                                                    size: "small",
                                                    error: !!validationErrors.expiryDate,
                                                    helperText: validationErrors.expiryDate || "Leave empty for no expiry",
                                                    InputLabelProps: { sx: { fontSize: '12px' } },
                                                    InputProps: { sx: { fontSize: '12px' } }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Internal Notes"
                                            name="internalNotes"
                                            value={formData.internalNotes || ''}
                                            onChange={handleChange}
                                            fullWidth
                                            multiline
                                            rows={3}
                                            size="small"
                                            placeholder="Internal notes for this rate rule (not visible to customers)"
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        {/* Information Alert */}
                        <Alert severity="info" sx={{ mt: 2, fontSize: '12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <InfoIcon sx={{ fontSize: '16px' }} />
                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                    Fixed Rate Rules Override Dynamic Pricing
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: '11px', mt: 1 }}>
                                When a shipment matches the conditions of this rule, the fixed rate will be applied instead of
                                the normal carrier markup percentages. Use priority to control which rule applies when multiple
                                rules match the same shipment.
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
                            formData.id ? 'Update Rate Rule' : 'Create Rate Rule'
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default AddEditFixedRateDialog; 