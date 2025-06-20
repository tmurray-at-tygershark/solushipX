import React, { useCallback } from 'react';
import {
    Box,
    Typography,
    FormControl,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Paper,
    Grid,
    TextField,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    IconButton,
    Chip,
    Alert,
    Divider
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    LocalShipping as CourierIcon,
    LocalShipping as FreightIcon,
    CheckCircle as CheckCircleIcon,
    Info as InfoIcon
} from '@mui/icons-material';

// Service options from ShipmentInfo.jsx (removed "Any" options per user feedback)
const courierServices = [
    { value: 'economy', label: 'Economy', description: 'Cost-effective courier delivery' },
    { value: 'express', label: 'Express', description: 'Fast courier delivery' },
    { value: 'priority', label: 'Priority', description: 'Premium courier service' }
];

const freightServices = [
    { value: 'ltl_standard_sk', label: 'LTL Standard - SK', description: 'Less than truckload standard service - Skid' },
    { value: 'ltl_economy_lb', label: 'LTL Economy - LB', description: 'Less than truckload economy service - per pound' },
    { value: 'ltl_economy_sk', label: 'LTL Economy - SK', description: 'Less than truckload economy service - Skid' },
    { value: 'ltl_expedited_lb', label: 'LTL Expedited - LB', description: 'Expedited LTL service - per pound' },
    { value: 'ltl_expedited_sk', label: 'LTL Expedited - SK', description: 'Expedited LTL service - Skid' },
    { value: 'ltl_economy_skid', label: 'LTL Economy Skid', description: 'Economy skid-based LTL service' },
    { value: 'ltl_skid_sk', label: 'LTL Skid - SK', description: 'Skid-based LTL service - Skid' },
    { value: 'ltl_customer_specific', label: 'LTL Customer Specific', description: 'Custom LTL arrangements' },
    { value: 'ltl_standard_class', label: 'LTL Standard - Class', description: 'Class-based LTL standard service' },
    { value: 'same_day_regular', label: 'Same Day Regular', description: 'Same day delivery (booked before 11:00 AM)' },
    { value: 'same_day_rush', label: 'Same Day Rush', description: '2-4 hours delivery (booked after 11:00 AM or downtown)' },
    { value: 'same_day_direct', label: 'Same Day Direct', description: 'Door-to-door same day service' },
    { value: 'same_day_after_hours', label: 'Same Day After Hours', description: 'After hours delivery (6:00 PM to 6:00 AM)' },
    { value: 'same_day_direct_weekends', label: 'Same Day Direct [Weekends]', description: 'Weekend same day service' },
    { value: 'next_day_regular', label: 'Next Day Regular', description: 'Next business day delivery' },
    { value: 'next_day_rush', label: 'Next Day Rush', description: 'Priority next day delivery' },
    { value: 'dedicated_truck_hourly', label: 'Dedicated Truck Hourly', description: 'Hourly dedicated truck service' },
    { value: 'ftl_53_dry_van', label: 'FTL - 53\' Dry Van', description: 'Full truckload 53-foot dry van' },
    { value: 'ftl_24_straight_truck', label: 'FTL - 24\' Straight Truck', description: 'Full truckload 24-foot straight truck' },
    { value: 'ftl_sprinter_van', label: 'FTL - Sprinter Van', description: 'Full truckload sprinter van service' },
    { value: 'ftl_expedited', label: 'FTL Expedited', description: 'Expedited full truckload service' },
    { value: 'ftl_standard', label: 'FTL Standard', description: 'Standard full truckload service' },
    { value: 'ftl_economy', label: 'FTL Economy', description: 'Economy full truckload service' },
    { value: 'ftl_flatbed', label: 'FTL Flatbed', description: 'Full truckload flatbed service' }
];

// Geographic data for province-state mapping
const canadianProvinces = [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'YT', name: 'Yukon' }
];

const usStates = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

const WeightRangeComponent = ({ weightRanges, onUpdate, errors }) => {
    const handleAddWeightRange = () => {
        const newRanges = [...weightRanges, { minWeight: 0, maxWeight: 100, unit: 'kg' }];
        onUpdate(newRanges);
    };

    const handleRemoveWeightRange = (index) => {
        const newRanges = weightRanges.filter((_, i) => i !== index);
        onUpdate(newRanges);
    };

    const handleWeightRangeChange = (index, field, value) => {
        const newRanges = [...weightRanges];
        newRanges[index] = { ...newRanges[index], [field]: value };
        onUpdate(newRanges);
    };

    return (
        <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, mb: 2 }}>
                Weight Restrictions
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                Define weight ranges this carrier can handle. Leave empty if no weight restrictions apply.
            </Typography>

            {weightRanges.map((range, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <TextField
                            size="small"
                            label="Min Weight"
                            type="number"
                            value={range.minWeight}
                            onChange={(e) => handleWeightRangeChange(index, 'minWeight', parseFloat(e.target.value) || 0)}
                            sx={{
                                width: 120,
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>to</Typography>
                        <TextField
                            size="small"
                            label="Max Weight"
                            type="number"
                            value={range.maxWeight}
                            onChange={(e) => handleWeightRangeChange(index, 'maxWeight', parseFloat(e.target.value) || 0)}
                            sx={{
                                width: 120,
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <TextField
                                select
                                size="small"
                                value={range.unit}
                                onChange={(e) => handleWeightRangeChange(index, 'unit', e.target.value)}
                                SelectProps={{ native: true }}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                }}
                            >
                                <option value="kg">kg</option>
                                <option value="lb">lb</option>
                            </TextField>
                        </FormControl>
                        <IconButton
                            size="small"
                            onClick={() => handleRemoveWeightRange(index)}
                            sx={{ color: '#d32f2f' }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                        Range {index + 1}: {range.minWeight} {range.unit} - {range.maxWeight} {range.unit}
                    </Typography>
                </Paper>
            ))}

            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddWeightRange}
                variant="outlined"
                sx={{ fontSize: '11px', mb: 2 }}
            >
                Add Weight Range
            </Button>

            {errors?.weightRanges && (
                <Alert severity="error" sx={{ fontSize: '12px', mt: 1 }}>
                    {errors.weightRanges}
                </Alert>
            )}
        </Box>
    );
};

const DimensionRestrictionsComponent = ({ dimensionRestrictions, onUpdate, errors }) => {
    const handleAddDimensionRestriction = () => {
        const newRestrictions = [...dimensionRestrictions, { maxLength: 100, maxWidth: 100, maxHeight: 100, unit: 'in' }];
        onUpdate(newRestrictions);
    };

    const handleRemoveDimensionRestriction = (index) => {
        const newRestrictions = dimensionRestrictions.filter((_, i) => i !== index);
        onUpdate(newRestrictions);
    };

    const handleDimensionRestrictionChange = (index, field, value) => {
        const newRestrictions = [...dimensionRestrictions];
        newRestrictions[index] = { ...newRestrictions[index], [field]: value };
        onUpdate(newRestrictions);
    };

    return (
        <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, mb: 2 }}>
                Maximum Dimension Restrictions
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                Define maximum package dimensions this carrier can handle due to truck space limitations. Measurements default to inches. Leave empty if no dimension restrictions apply.
            </Typography>

            {dimensionRestrictions.map((restriction, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            label="Max Length"
                            type="number"
                            value={restriction.maxLength}
                            onChange={(e) => handleDimensionRestrictionChange(index, 'maxLength', parseFloat(e.target.value) || 0)}
                            sx={{
                                width: 110,
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>×</Typography>
                        <TextField
                            size="small"
                            label="Max Width"
                            type="number"
                            value={restriction.maxWidth}
                            onChange={(e) => handleDimensionRestrictionChange(index, 'maxWidth', parseFloat(e.target.value) || 0)}
                            sx={{
                                width: 110,
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>×</Typography>
                        <TextField
                            size="small"
                            label="Max Height"
                            type="number"
                            value={restriction.maxHeight}
                            onChange={(e) => handleDimensionRestrictionChange(index, 'maxHeight', parseFloat(e.target.value) || 0)}
                            sx={{
                                width: 110,
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <TextField
                                select
                                size="small"
                                value={restriction.unit}
                                onChange={(e) => handleDimensionRestrictionChange(index, 'unit', e.target.value)}
                                SelectProps={{ native: true }}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                }}
                            >
                                <option value="in">in</option>
                                <option value="cm">cm</option>
                            </TextField>
                        </FormControl>
                        <IconButton
                            size="small"
                            onClick={() => handleRemoveDimensionRestriction(index)}
                            sx={{ color: '#d32f2f' }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Typography sx={{ fontSize: '10px', color: '#c2410c' }}>
                        Restriction {index + 1}: Max {restriction.maxLength} × {restriction.maxWidth} × {restriction.maxHeight} {restriction.unit} (L × W × H)
                    </Typography>
                </Paper>
            ))}

            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddDimensionRestriction}
                variant="outlined"
                sx={{ fontSize: '11px', mb: 2 }}
            >
                Add Dimension Restriction
            </Button>

            {errors?.dimensionRestrictions && (
                <Alert severity="error" sx={{ fontSize: '12px', mt: 1 }}>
                    {errors.dimensionRestrictions}
                </Alert>
            )}
        </Box>
    );
};

const ServicesEligibilityStep = ({ data, onUpdate, errors, setErrors, isEdit = false }) => {
    // Handle service selection
    const handleServiceToggle = useCallback((serviceType, serviceValue) => {
        const currentServices = data.supportedServices[serviceType] || [];
        let newServices;

        if (currentServices.includes(serviceValue)) {
            newServices = currentServices.filter(s => s !== serviceValue);
        } else {
            newServices = [...currentServices, serviceValue];
        }

        onUpdate({
            supportedServices: {
                ...data.supportedServices,
                [serviceType]: newServices
            }
        });

        // Clear services error
        if (errors.services) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.services;
                return newErrors;
            });
        }
    }, [data.supportedServices, onUpdate, errors, setErrors]);

    // Handle select/deselect all for service type
    const handleSelectAllServices = useCallback((serviceType) => {
        const allServices = serviceType === 'courier' ? courierServices : freightServices;
        const allServiceValues = allServices.map(s => s.value);

        onUpdate({
            supportedServices: {
                ...data.supportedServices,
                [serviceType]: allServiceValues
            }
        });
    }, [data.supportedServices, onUpdate]);

    const handleDeselectAllServices = useCallback((serviceType) => {
        onUpdate({
            supportedServices: {
                ...data.supportedServices,
                [serviceType]: []
            }
        });
    }, [data.supportedServices, onUpdate]);

    // Handle eligibility rule changes
    const handleEligibilityChange = useCallback((section, field, value) => {
        if (section === 'root') {
            onUpdate({
                eligibilityRules: {
                    ...data.eligibilityRules,
                    [field]: value
                }
            });
        } else {
            onUpdate({
                eligibilityRules: {
                    ...data.eligibilityRules,
                    [section]: {
                        ...data.eligibilityRules[section],
                        [field]: value
                    }
                }
            });
        }
    }, [data.eligibilityRules, onUpdate]);

    // Handle weight ranges update
    const handleWeightRangesUpdate = useCallback((newWeightRanges) => {
        onUpdate({
            eligibilityRules: {
                ...data.eligibilityRules,
                weightRanges: newWeightRanges
            }
        });
    }, [data.eligibilityRules, onUpdate]);

    // Handle dimension restrictions update
    const handleDimensionRestrictionsUpdate = useCallback((newDimensionRestrictions) => {
        onUpdate({
            eligibilityRules: {
                ...data.eligibilityRules,
                dimensionRestrictions: newDimensionRestrictions
            }
        });
    }, [data.eligibilityRules, onUpdate]);

    // Determine which service types to show based on carrier type
    const showCourierServices = data.type === 'courier' || data.type === 'hybrid';
    const showFreightServices = data.type === 'freight' || data.type === 'hybrid';

    // Calculate service statistics
    const courierCount = showCourierServices ? (data.supportedServices?.courier?.length || 0) : 0;
    const freightCount = showFreightServices ? (data.supportedServices?.freight?.length || 0) : 0;
    const totalServices = courierCount + freightCount;

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Services & Eligibility Configuration
            </Typography>

            {/* Carrier Type Info */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#f0f9ff', border: '1px solid #bfdbfe' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#1e40af', mb: 1 }}>
                    Carrier Type: {data.type === 'courier' ? 'Courier' : data.type === 'freight' ? 'Freight' : 'Hybrid'}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#1e40af' }}>
                    {data.type === 'courier' && 'This carrier supports courier services only (small packages, documents)'}
                    {data.type === 'freight' && 'This carrier supports freight services only (LTL, FTL, heavy cargo)'}
                    {data.type === 'hybrid' && 'This carrier supports both courier and freight services'}
                </Typography>
            </Paper>

            {/* Quick Stats */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: '16px', color: totalServices > 0 ? '#10b981' : '#d1d5db' }} />
                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                            {totalServices} Service{totalServices !== 1 ? 's' : ''} Selected
                        </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                        {showCourierServices && `Courier: ${courierCount}`}
                        {showCourierServices && showFreightServices && ' • '}
                        {showFreightServices && `Freight: ${freightCount}`}
                    </Typography>
                </Box>
            </Paper>

            {/* Error Alert */}
            {errors.services && (
                <Alert severity="error" sx={{ fontSize: '12px', mb: 3 }}>
                    {errors.services}
                </Alert>
            )}

            {/* Supported Services */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <InfoIcon sx={{ fontSize: '18px', color: '#3b82f6' }} />
                    <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                        Supported Services
                    </Typography>
                </Box>
                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                    Select all service types this carrier can handle. You can choose from both courier and freight categories.
                </Typography>

                <Grid container spacing={3}>
                    {/* Courier Services - Only show for courier or hybrid carriers */}
                    {showCourierServices && (
                        <Grid item xs={12} md={showFreightServices ? 6 : 12}>
                            <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
                                <Box sx={{ p: 2, bgcolor: '#eff6ff', borderBottom: '1px solid #e5e7eb' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CourierIcon sx={{ fontSize: '18px', color: '#2563eb' }} />
                                            <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
                                                Courier Services
                                            </Typography>
                                            <Chip
                                                label={courierCount}
                                                size="small"
                                                sx={{ fontSize: '10px', height: '18px' }}
                                                color={courierCount > 0 ? 'primary' : 'default'}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                onClick={() => handleSelectAllServices('courier')}
                                                sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                            >
                                                All
                                            </Button>
                                            <Button
                                                size="small"
                                                onClick={() => handleDeselectAllServices('courier')}
                                                sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                            >
                                                None
                                            </Button>
                                        </Box>
                                    </Box>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Small package and document delivery services
                                    </Typography>
                                </Box>

                                <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                                    <FormGroup>
                                        {courierServices.map((service) => (
                                            <FormControlLabel
                                                key={service.value}
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={(data.supportedServices.courier || []).includes(service.value)}
                                                        onChange={() => handleServiceToggle('courier', service.value)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {service.label}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            {service.description}
                                                        </Typography>
                                                    </Box>
                                                }
                                                sx={{ mb: 1, alignItems: 'flex-start' }}
                                            />
                                        ))}
                                    </FormGroup>
                                </Box>
                            </Paper>
                        </Grid>
                    )}

                    {/* Freight Services - Only show for freight or hybrid carriers */}
                    {showFreightServices && (
                        <Grid item xs={12} md={showCourierServices ? 6 : 12}>
                            <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
                                <Box sx={{ p: 2, bgcolor: '#fef3ff', borderBottom: '1px solid #e5e7eb' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <FreightIcon sx={{ fontSize: '18px', color: '#7c3aed' }} />
                                            <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
                                                Freight Services
                                            </Typography>
                                            <Chip
                                                label={freightCount}
                                                size="small"
                                                sx={{ fontSize: '10px', height: '18px' }}
                                                color={freightCount > 0 ? 'secondary' : 'default'}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                onClick={() => handleSelectAllServices('freight')}
                                                sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                            >
                                                All
                                            </Button>
                                            <Button
                                                size="small"
                                                onClick={() => handleDeselectAllServices('freight')}
                                                sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                            >
                                                None
                                            </Button>
                                        </Box>
                                    </Box>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        LTL, FTL, and specialized freight services
                                    </Typography>
                                </Box>

                                <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                                    <FormGroup>
                                        {freightServices.map((service) => (
                                            <FormControlLabel
                                                key={service.value}
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={(data.supportedServices.freight || []).includes(service.value)}
                                                        onChange={() => handleServiceToggle('freight', service.value)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {service.label}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            {service.description}
                                                        </Typography>
                                                    </Box>
                                                }
                                                sx={{ mb: 1, alignItems: 'flex-start' }}
                                            />
                                        ))}
                                    </FormGroup>
                                </Box>
                            </Paper>
                        </Grid>
                    )}
                </Grid>

                {/* Selected Services Summary */}
                {totalServices > 0 && (
                    <Box sx={{ mt: 3, p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#065f46' }}>
                            Selected Services Summary ({totalServices} total)
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {showCourierServices && (data.supportedServices.courier || []).map((service) => (
                                <Chip
                                    key={`courier-${service}`}
                                    label={courierServices.find(s => s.value === service)?.label}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ fontSize: '10px' }}
                                />
                            ))}
                            {showFreightServices && (data.supportedServices.freight || []).map((service) => (
                                <Chip
                                    key={`freight-${service}`}
                                    label={freightServices.find(s => s.value === service)?.label}
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                    sx={{ fontSize: '10px' }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}
            </Paper>

            {/* Eligibility Rules */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 3 }}>
                    Eligibility Rules
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                    Configure when this carrier should be offered to customers based on shipment characteristics.
                </Typography>

                <Grid container spacing={3}>
                    {/* Geographic Routing */}
                    <Grid item xs={12}>
                        <Accordion>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{ bgcolor: '#f8fafc' }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                        Geographic Routing Options
                                    </Typography>
                                    <Chip
                                        label={Object.values(data.eligibilityRules?.geographicRouting || {}).filter(Boolean).length}
                                        size="small"
                                        sx={{ fontSize: '10px', height: '18px' }}
                                        color="default"
                                    />
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                    Select the geographic routing types this carrier supports.
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={data.eligibilityRules?.geographicRouting?.provinceToProvince || false}
                                                    onChange={(e) => handleEligibilityChange('geographicRouting', 'provinceToProvince', e.target.checked)}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        Province-to-Province (CA)
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        Canadian interprovincial shipping
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={data.eligibilityRules?.geographicRouting?.stateToState || false}
                                                    onChange={(e) => handleEligibilityChange('geographicRouting', 'stateToState', e.target.checked)}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        State-to-State (US)
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        US interstate shipping
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={data.eligibilityRules?.geographicRouting?.provinceToState || false}
                                                    onChange={(e) => handleEligibilityChange('geographicRouting', 'provinceToState', e.target.checked)}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        Province-to-State (CA ↔ US)
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        Canada ↔ US cross-border (both directions)
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={data.eligibilityRules?.geographicRouting?.cityToCity || false}
                                                    onChange={(e) => handleEligibilityChange('geographicRouting', 'cityToCity', e.target.checked)}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        City-to-City (Local)
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        Local metropolitan shipping
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Grid>
                                </Grid>

                                {/* Province-to-Province Pair Routing */}
                                {data.eligibilityRules?.geographicRouting?.provinceToProvince && (
                                    <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bfdbfe' }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#1e40af' }}>
                                            Province-to-Province Pair Routing
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#1e40af', mb: 3 }}>
                                            Define specific province-to-province routes this carrier supports within Canada
                                        </Typography>

                                        {(data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || []).map((routePair, index) => (
                                            <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        label="From Province"
                                                        value={routePair.from || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], from: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                                        }}
                                                        placeholder="e.g., ON, BC, AB, QC"
                                                        sx={{
                                                            width: 150,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                    <TextField
                                                        size="small"
                                                        label="To Province"
                                                        value={routePair.to || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], to: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                                        }}
                                                        placeholder="e.g., ON, BC, AB, QC"
                                                        sx={{
                                                            width: 150,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                            const updated = current.filter((_, i) => i !== index);
                                                            handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                                        }}
                                                        sx={{ color: '#d32f2f' }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Route {index + 1}: {routePair.from || 'From province'} → {routePair.to || 'To province'}
                                                </Typography>
                                            </Paper>
                                        ))}

                                        <Button
                                            size="small"
                                            startIcon={<AddIcon />}
                                            onClick={() => {
                                                const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                const updated = [...current, { from: '', to: '' }];
                                                handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                            }}
                                            variant="outlined"
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add Province Route
                                        </Button>
                                    </Box>
                                )}

                                {/* State-to-State Pair Routing */}
                                {data.eligibilityRules?.geographicRouting?.stateToState && (
                                    <Box sx={{ mt: 3, p: 2, bgcolor: '#fef3ff', borderRadius: 1, border: '1px solid #e9d5ff' }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#7c3aed' }}>
                                            State-to-State Pair Routing
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#7c3aed', mb: 3 }}>
                                            Define specific state-to-state routes this carrier supports within US
                                        </Typography>

                                        {(data.eligibilityRules?.geographicRouting?.stateStateRouting || []).map((routePair, index) => (
                                            <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        label="From State"
                                                        value={routePair.from || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], from: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                                        }}
                                                        placeholder="e.g., NY, CA, TX, FL"
                                                        sx={{
                                                            width: 150,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                    <TextField
                                                        size="small"
                                                        label="To State"
                                                        value={routePair.to || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], to: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                                        }}
                                                        placeholder="e.g., NY, CA, TX, FL"
                                                        sx={{
                                                            width: 150,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                            const updated = current.filter((_, i) => i !== index);
                                                            handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                                        }}
                                                        sx={{ color: '#d32f2f' }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Route {index + 1}: {routePair.from || 'From state'} → {routePair.to || 'To state'}
                                                </Typography>
                                            </Paper>
                                        ))}

                                        <Button
                                            size="small"
                                            startIcon={<AddIcon />}
                                            onClick={() => {
                                                const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                const updated = [...current, { from: '', to: '' }];
                                                handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                            }}
                                            variant="outlined"
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add State Route
                                        </Button>
                                    </Box>
                                )}

                                {/* Province-to-State Pair Routing */}
                                {data.eligibilityRules?.geographicRouting?.provinceToState && (
                                    <Box sx={{ mt: 3, p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#065f46' }}>
                                            Province-to-State Pair Routing
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#065f46', mb: 3 }}>
                                            Define specific province ↔ state routes this carrier supports (both directions)
                                        </Typography>

                                        {(data.eligibilityRules?.geographicRouting?.provinceStateRouting || []).map((routePair, index) => (
                                            <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        label="From Location"
                                                        value={routePair.from || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], from: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                                        }}
                                                        placeholder="e.g., ON, BC, NY, CA"
                                                        sx={{
                                                            width: 150,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>↔</Typography>
                                                    <TextField
                                                        size="small"
                                                        label="To Location"
                                                        value={routePair.to || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], to: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                                        }}
                                                        placeholder="e.g., NY, CA, ON, BC"
                                                        sx={{
                                                            width: 150,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                            const updated = current.filter((_, i) => i !== index);
                                                            handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                                        }}
                                                        sx={{ color: '#d32f2f' }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Route {index + 1}: {routePair.from || 'From location'} ↔ {routePair.to || 'To location'}
                                                </Typography>
                                            </Paper>
                                        ))}

                                        <Button
                                            size="small"
                                            startIcon={<AddIcon />}
                                            onClick={() => {
                                                const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                const updated = [...current, { from: '', to: '' }];
                                                handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                            }}
                                            variant="outlined"
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add Cross-Border Route
                                        </Button>
                                    </Box>
                                )}

                                {/* City-to-City Routing */}
                                {data.eligibilityRules?.geographicRouting?.cityToCity && (
                                    <Box sx={{ mt: 3, p: 2, bgcolor: '#fff7ed', borderRadius: 1, border: '1px solid #fed7aa' }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#c2410c' }}>
                                            City Pair Routing
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#c2410c', mb: 3 }}>
                                            Define specific city-to-city routes this carrier supports
                                        </Typography>

                                        {(data.eligibilityRules?.geographicRouting?.cityPairRouting || []).map((cityPair, index) => (
                                            <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        label="From City"
                                                        value={cityPair.from || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], from: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                        }}
                                                        placeholder="e.g., Toronto, ON"
                                                        sx={{
                                                            width: 200,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                    <TextField
                                                        size="small"
                                                        label="To City"
                                                        value={cityPair.to || ''}
                                                        onChange={(e) => {
                                                            const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                            const updated = [...current];
                                                            updated[index] = { ...updated[index], to: e.target.value };
                                                            handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                        }}
                                                        placeholder="e.g., New York, NY"
                                                        sx={{
                                                            width: 200,
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                            const updated = current.filter((_, i) => i !== index);
                                                            handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                        }}
                                                        sx={{ color: '#d32f2f' }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Route {index + 1}: {cityPair.from || 'From city'} → {cityPair.to || 'To city'}
                                                </Typography>
                                            </Paper>
                                        ))}

                                        <Button
                                            size="small"
                                            startIcon={<AddIcon />}
                                            onClick={() => {
                                                const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                const updated = [...current, { from: '', to: '' }];
                                                handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                            }}
                                            variant="outlined"
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add City Pair
                                        </Button>
                                    </Box>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </Grid>

                    {/* Weight Ranges */}
                    <Grid item xs={12}>
                        <Accordion>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{ bgcolor: '#f8fafc' }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                        Weight Range Restrictions
                                    </Typography>
                                    <Chip
                                        label={data.eligibilityRules?.weightRanges?.length || 0}
                                        size="small"
                                        sx={{ fontSize: '10px', height: '18px' }}
                                        color="default"
                                    />
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <WeightRangeComponent
                                    weightRanges={data.eligibilityRules?.weightRanges || []}
                                    onUpdate={handleWeightRangesUpdate}
                                    errors={errors}
                                />
                            </AccordionDetails>
                        </Accordion>
                    </Grid>

                    {/* Dimension Restrictions */}
                    <Grid item xs={12}>
                        <Accordion>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{ bgcolor: '#f8fafc' }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                        Maximum Dimension Restrictions
                                    </Typography>
                                    <Chip
                                        label={data.eligibilityRules?.dimensionRestrictions?.length || 0}
                                        size="small"
                                        sx={{ fontSize: '10px', height: '18px' }}
                                        color="default"
                                    />
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <DimensionRestrictionsComponent
                                    dimensionRestrictions={data.eligibilityRules?.dimensionRestrictions || []}
                                    onUpdate={handleDimensionRestrictionsUpdate}
                                    errors={errors}
                                />
                            </AccordionDetails>
                        </Accordion>
                    </Grid>
                </Grid>
            </Paper>

            {/* Step Description */}
            <Box sx={{ mt: 4, p: 2, backgroundColor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    <strong>Step 3:</strong> Define which services this carrier supports and configure
                    eligibility rules. Select all service types the carrier can handle from both courier
                    and freight categories. Eligibility rules help determine when this carrier should
                    be offered as an option for specific shipments based on weight, package dimensions, geography, and cross-border requirements.
                </Typography>
            </Box>
        </Box>
    );
};

export default ServicesEligibilityStep; 