import React, { useCallback, useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    TextField,
    Switch,
    FormControlLabel,
    Button,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tabs,
    Tab,
    Divider,
    Card,
    CardContent,
    CardHeader,
    Tooltip,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    AttachMoney as MoneyIcon,
    LocalShipping as ShippingIcon,
    Info as InfoIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Scale as ScaleIcon,
    Inventory as InventoryIcon,
    Route as RouteIcon,
    LocationCity as LocationCityIcon,
    ExpandMore as ExpandMoreIcon,
    ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';

// Rate type options
const RATE_TYPES = [
    { value: 'pound', label: 'Pound Rate', icon: ScaleIcon, description: 'Price based on weight of shipment' },
    { value: 'skid', label: 'Skid Rate', icon: InventoryIcon, description: 'Price per skid/pallet in shipment' }
];

// Rate structure options  
const RATE_STRUCTURES = [
    { value: 'flat', label: 'Flat Rate', icon: MoneyIcon, description: 'Single rate applies everywhere' },
    { value: 'freight_lanes', label: 'Freight Lanes', icon: RouteIcon, description: 'Route-specific rates (city, province, state level)' }
];

// Route type options for freight lanes
const ROUTE_TYPES = [
    { value: 'city_to_city', label: 'City to City', originLabel: 'Origin City', destinationLabel: 'Destination City', showCountry: true },
    { value: 'province_to_province', label: 'Province to Province', originLabel: 'Origin Province', destinationLabel: 'Destination Province', showCountry: false },
    { value: 'state_to_state', label: 'State to State', originLabel: 'Origin State', destinationLabel: 'Destination State', showCountry: false },
    { value: 'province_to_state', label: 'Province to State', originLabel: 'Origin Province (CA)', destinationLabel: 'Destination State (US)', showCountry: false },
    { value: 'state_to_province', label: 'State to Province', originLabel: 'Origin State (US)', destinationLabel: 'Destination Province (CA)', showCountry: false },
    { value: 'province_to_city', label: 'Province to City', originLabel: 'Origin Province', destinationLabel: 'Destination City', showCountry: true },
    { value: 'state_to_city', label: 'State to City', originLabel: 'Origin State', destinationLabel: 'Destination City', showCountry: true },
];

// Helper function for placeholder text
const getPlaceholderText = (routeType, field) => {
    const examples = {
        city_to_city: { origin: 'e.g., Toronto, ON', destination: 'e.g., Vancouver, BC' },
        province_to_province: { origin: 'e.g., ON', destination: 'e.g., BC' },
        state_to_state: { origin: 'e.g., NY', destination: 'e.g., CA' },
        province_to_state: { origin: 'e.g., ON', destination: 'e.g., NY' },
        state_to_province: { origin: 'e.g., NY', destination: 'e.g., ON' },
        province_to_city: { origin: 'e.g., ON', destination: 'e.g., New York, NY' },
        state_to_city: { origin: 'e.g., NY', destination: 'e.g., Toronto, ON' },
    };
    return examples[routeType]?.[field] || '';
};

// Freight Lane Dialog Component - Enhanced with Multiple Route Types
const FreightLaneDialog = ({ open, onClose, lane, onSave, isEdit = false, rateType }) => {
    const [formData, setFormData] = useState(lane || {
        routeType: 'city_to_city',
        origin: '',
        destination: '',
        originStateProvince: '',
        destinationStateProvince: '',
        originCountry: 'CA',
        destinationCountry: 'CA',
        country: 'CA', // Keep for backward compatibility with non-city routes
        rateType: rateType,
        poundRate: {
            perPoundRate: 0,
            minimumCharge: 0
        },
        skidRate: {
            skidPricing: Array.from({ length: 26 }, (_, i) => ({
                skidCount: i + 1,
                rate: 0
            }))
        }
    });

    const [errors, setErrors] = useState({});

    // Reset form data when dialog opens or lane changes
    React.useEffect(() => {
        if (open) {
            setFormData(lane || {
                routeType: 'city_to_city',
                origin: '',
                destination: '',
                originStateProvince: '',
                destinationStateProvince: '',
                originCountry: 'CA',
                destinationCountry: 'CA',
                country: 'CA', // Keep for backward compatibility with non-city routes
                rateType: rateType,
                poundRate: {
                    perPoundRate: 0,
                    minimumCharge: 0
                },
                skidRate: {
                    skidPricing: Array.from({ length: 26 }, (_, i) => ({
                        skidCount: i + 1,
                        rate: 0
                    }))
                }
            });
            setErrors({});
        }
    }, [open, lane, rateType]);

    const handleSubmit = () => {
        const newErrors = {};

        if (!formData.origin.trim()) newErrors.origin = 'Origin is required';
        if (!formData.destination.trim()) newErrors.destination = 'Destination is required';
        if (!formData.routeType) newErrors.routeType = 'Route type is required';

        if (rateType === 'pound') {
            if (!formData.poundRate.minimumCharge || formData.poundRate.minimumCharge <= 0) {
                newErrors.minimumCharge = 'Minimum charge is required';
            }
        } else if (rateType === 'skid') {
            const hasValidSkidRate = formData.skidRate.skidPricing.some(skid => skid.rate > 0);
            if (!hasValidSkidRate) {
                newErrors.skidRates = 'At least one skid rate must be greater than 0';
            }
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
            onSave(formData);
            onClose();
        }
    };

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleNestedFieldChange = (category, field, value) => {
        setFormData(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSkidRateChange = (index, rate) => {
        setFormData(prev => ({
            ...prev,
            skidRate: {
                ...prev.skidRate,
                skidPricing: prev.skidRate.skidPricing.map((skid, i) =>
                    i === index ? { ...skid, rate: parseFloat(rate) || 0 } : skid
                )
            }
        }));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle sx={{
                fontSize: '16px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                pb: 1
            }}>
                <RouteIcon sx={{ fontSize: '20px', color: '#3b82f6' }} />
                {isEdit ? 'Edit Freight Lane' : 'Add Freight Lane'}
                <Chip
                    label={rateType === 'pound' ? 'Weight-Based' : 'Skid-Based'}
                    size="small"
                    color={rateType === 'pound' ? 'primary' : 'secondary'}
                    sx={{ fontSize: '10px', ml: 1 }}
                />
            </DialogTitle>
            <DialogContent sx={{ pb: 1 }}>
                <Box sx={{ mt: 1 }}>
                    {/* Route Type Selection */}
                    <Box sx={{ mb: 3 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2 }}>
                            Route Type
                        </Typography>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Select Route Type</InputLabel>
                            <Select
                                value={formData.routeType}
                                onChange={(e) => handleFieldChange('routeType', e.target.value)}
                                label="Select Route Type"
                                error={!!errors.routeType}
                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                            >
                                {ROUTE_TYPES.map((type) => (
                                    <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                        {type.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.routeType && (
                                <Typography sx={{ fontSize: '10px', color: '#d32f2f', mt: 0.5 }}>
                                    {errors.routeType}
                                </Typography>
                            )}
                        </FormControl>
                    </Box>

                    {/* Route Input */}
                    <Box sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2 }}>
                            Route Details
                        </Typography>

                        <Paper sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            {formData.routeType === 'city_to_city' ? (
                                <Grid container spacing={2} alignItems="stretch">
                                    {/* Origin Section */}
                                    <Grid item xs={12} sm={5}>
                                        <Box sx={{
                                            p: 1.5,
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            bgcolor: 'white',
                                            height: '100%'
                                        }}>
                                            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', mb: 1.5 }}>
                                                Origin
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="City"
                                                    value={formData.origin}
                                                    onChange={(e) => handleFieldChange('origin', e.target.value)}
                                                    error={!!errors.origin}
                                                    placeholder="e.g., Toronto"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                                <FormControl fullWidth size="small">
                                                    <InputLabel sx={{ fontSize: '12px' }}>State/Province</InputLabel>
                                                    <Select
                                                        value={formData.originStateProvince || ''}
                                                        onChange={(e) => handleFieldChange('originStateProvince', e.target.value)}
                                                        label="State/Province"
                                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                    >
                                                        <MenuItem value="AB" sx={{ fontSize: '12px' }}>Alberta</MenuItem>
                                                        <MenuItem value="BC" sx={{ fontSize: '12px' }}>British Columbia</MenuItem>
                                                        <MenuItem value="MB" sx={{ fontSize: '12px' }}>Manitoba</MenuItem>
                                                        <MenuItem value="NB" sx={{ fontSize: '12px' }}>New Brunswick</MenuItem>
                                                        <MenuItem value="NL" sx={{ fontSize: '12px' }}>Newfoundland and Labrador</MenuItem>
                                                        <MenuItem value="NS" sx={{ fontSize: '12px' }}>Nova Scotia</MenuItem>
                                                        <MenuItem value="ON" sx={{ fontSize: '12px' }}>Ontario</MenuItem>
                                                        <MenuItem value="PE" sx={{ fontSize: '12px' }}>Prince Edward Island</MenuItem>
                                                        <MenuItem value="QC" sx={{ fontSize: '12px' }}>Quebec</MenuItem>
                                                        <MenuItem value="SK" sx={{ fontSize: '12px' }}>Saskatchewan</MenuItem>
                                                        <MenuItem value="NT" sx={{ fontSize: '12px' }}>Northwest Territories</MenuItem>
                                                        <MenuItem value="NU" sx={{ fontSize: '12px' }}>Nunavut</MenuItem>
                                                        <MenuItem value="YT" sx={{ fontSize: '12px' }}>Yukon</MenuItem>
                                                        <MenuItem value="AL" sx={{ fontSize: '12px' }}>Alabama</MenuItem>
                                                        <MenuItem value="AK" sx={{ fontSize: '12px' }}>Alaska</MenuItem>
                                                        <MenuItem value="AZ" sx={{ fontSize: '12px' }}>Arizona</MenuItem>
                                                        <MenuItem value="AR" sx={{ fontSize: '12px' }}>Arkansas</MenuItem>
                                                        <MenuItem value="CA" sx={{ fontSize: '12px' }}>California</MenuItem>
                                                        <MenuItem value="CO" sx={{ fontSize: '12px' }}>Colorado</MenuItem>
                                                        <MenuItem value="CT" sx={{ fontSize: '12px' }}>Connecticut</MenuItem>
                                                        <MenuItem value="DE" sx={{ fontSize: '12px' }}>Delaware</MenuItem>
                                                        <MenuItem value="FL" sx={{ fontSize: '12px' }}>Florida</MenuItem>
                                                        <MenuItem value="GA" sx={{ fontSize: '12px' }}>Georgia</MenuItem>
                                                        <MenuItem value="HI" sx={{ fontSize: '12px' }}>Hawaii</MenuItem>
                                                        <MenuItem value="ID" sx={{ fontSize: '12px' }}>Idaho</MenuItem>
                                                        <MenuItem value="IL" sx={{ fontSize: '12px' }}>Illinois</MenuItem>
                                                        <MenuItem value="IN" sx={{ fontSize: '12px' }}>Indiana</MenuItem>
                                                        <MenuItem value="IA" sx={{ fontSize: '12px' }}>Iowa</MenuItem>
                                                        <MenuItem value="KS" sx={{ fontSize: '12px' }}>Kansas</MenuItem>
                                                        <MenuItem value="KY" sx={{ fontSize: '12px' }}>Kentucky</MenuItem>
                                                        <MenuItem value="LA" sx={{ fontSize: '12px' }}>Louisiana</MenuItem>
                                                        <MenuItem value="ME" sx={{ fontSize: '12px' }}>Maine</MenuItem>
                                                        <MenuItem value="MD" sx={{ fontSize: '12px' }}>Maryland</MenuItem>
                                                        <MenuItem value="MA" sx={{ fontSize: '12px' }}>Massachusetts</MenuItem>
                                                        <MenuItem value="MI" sx={{ fontSize: '12px' }}>Michigan</MenuItem>
                                                        <MenuItem value="MN" sx={{ fontSize: '12px' }}>Minnesota</MenuItem>
                                                        <MenuItem value="MS" sx={{ fontSize: '12px' }}>Mississippi</MenuItem>
                                                        <MenuItem value="MO" sx={{ fontSize: '12px' }}>Missouri</MenuItem>
                                                        <MenuItem value="MT" sx={{ fontSize: '12px' }}>Montana</MenuItem>
                                                        <MenuItem value="NE" sx={{ fontSize: '12px' }}>Nebraska</MenuItem>
                                                        <MenuItem value="NV" sx={{ fontSize: '12px' }}>Nevada</MenuItem>
                                                        <MenuItem value="NH" sx={{ fontSize: '12px' }}>New Hampshire</MenuItem>
                                                        <MenuItem value="NJ" sx={{ fontSize: '12px' }}>New Jersey</MenuItem>
                                                        <MenuItem value="NM" sx={{ fontSize: '12px' }}>New Mexico</MenuItem>
                                                        <MenuItem value="NY" sx={{ fontSize: '12px' }}>New York</MenuItem>
                                                        <MenuItem value="NC" sx={{ fontSize: '12px' }}>North Carolina</MenuItem>
                                                        <MenuItem value="ND" sx={{ fontSize: '12px' }}>North Dakota</MenuItem>
                                                        <MenuItem value="OH" sx={{ fontSize: '12px' }}>Ohio</MenuItem>
                                                        <MenuItem value="OK" sx={{ fontSize: '12px' }}>Oklahoma</MenuItem>
                                                        <MenuItem value="OR" sx={{ fontSize: '12px' }}>Oregon</MenuItem>
                                                        <MenuItem value="PA" sx={{ fontSize: '12px' }}>Pennsylvania</MenuItem>
                                                        <MenuItem value="RI" sx={{ fontSize: '12px' }}>Rhode Island</MenuItem>
                                                        <MenuItem value="SC" sx={{ fontSize: '12px' }}>South Carolina</MenuItem>
                                                        <MenuItem value="SD" sx={{ fontSize: '12px' }}>South Dakota</MenuItem>
                                                        <MenuItem value="TN" sx={{ fontSize: '12px' }}>Tennessee</MenuItem>
                                                        <MenuItem value="TX" sx={{ fontSize: '12px' }}>Texas</MenuItem>
                                                        <MenuItem value="UT" sx={{ fontSize: '12px' }}>Utah</MenuItem>
                                                        <MenuItem value="VT" sx={{ fontSize: '12px' }}>Vermont</MenuItem>
                                                        <MenuItem value="VA" sx={{ fontSize: '12px' }}>Virginia</MenuItem>
                                                        <MenuItem value="WA" sx={{ fontSize: '12px' }}>Washington</MenuItem>
                                                        <MenuItem value="WV" sx={{ fontSize: '12px' }}>West Virginia</MenuItem>
                                                        <MenuItem value="WI" sx={{ fontSize: '12px' }}>Wisconsin</MenuItem>
                                                        <MenuItem value="WY" sx={{ fontSize: '12px' }}>Wyoming</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                    <Select
                                                        value={formData.originCountry || 'CA'}
                                                        onChange={(e) => handleFieldChange('originCountry', e.target.value)}
                                                        label="Country"
                                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                    >
                                                        <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                                        <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                        </Box>
                                    </Grid>

                                    {/* Arrow */}
                                    <Grid item xs={12} sm={2} sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: { xs: '60px', sm: '160px' }
                                    }}>
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            bgcolor: '#e0f2fe',
                                            border: '2px solid #0ea5e9'
                                        }}>
                                            <ArrowForwardIcon sx={{ fontSize: '18px', color: '#0ea5e9' }} />
                                        </Box>
                                    </Grid>

                                    {/* Destination Section */}
                                    <Grid item xs={12} sm={5}>
                                        <Box sx={{
                                            p: 1.5,
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            bgcolor: 'white',
                                            height: '100%'
                                        }}>
                                            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', mb: 1.5 }}>
                                                Destination
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="City"
                                                    value={formData.destination}
                                                    onChange={(e) => handleFieldChange('destination', e.target.value)}
                                                    error={!!errors.destination}
                                                    placeholder="e.g., Vancouver"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                                <FormControl fullWidth size="small">
                                                    <InputLabel sx={{ fontSize: '12px' }}>State/Province</InputLabel>
                                                    <Select
                                                        value={formData.destinationStateProvince || ''}
                                                        onChange={(e) => handleFieldChange('destinationStateProvince', e.target.value)}
                                                        label="State/Province"
                                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                    >
                                                        <MenuItem value="AB" sx={{ fontSize: '12px' }}>Alberta</MenuItem>
                                                        <MenuItem value="BC" sx={{ fontSize: '12px' }}>British Columbia</MenuItem>
                                                        <MenuItem value="MB" sx={{ fontSize: '12px' }}>Manitoba</MenuItem>
                                                        <MenuItem value="NB" sx={{ fontSize: '12px' }}>New Brunswick</MenuItem>
                                                        <MenuItem value="NL" sx={{ fontSize: '12px' }}>Newfoundland and Labrador</MenuItem>
                                                        <MenuItem value="NS" sx={{ fontSize: '12px' }}>Nova Scotia</MenuItem>
                                                        <MenuItem value="ON" sx={{ fontSize: '12px' }}>Ontario</MenuItem>
                                                        <MenuItem value="PE" sx={{ fontSize: '12px' }}>Prince Edward Island</MenuItem>
                                                        <MenuItem value="QC" sx={{ fontSize: '12px' }}>Quebec</MenuItem>
                                                        <MenuItem value="SK" sx={{ fontSize: '12px' }}>Saskatchewan</MenuItem>
                                                        <MenuItem value="NT" sx={{ fontSize: '12px' }}>Northwest Territories</MenuItem>
                                                        <MenuItem value="NU" sx={{ fontSize: '12px' }}>Nunavut</MenuItem>
                                                        <MenuItem value="YT" sx={{ fontSize: '12px' }}>Yukon</MenuItem>
                                                        <MenuItem value="AL" sx={{ fontSize: '12px' }}>Alabama</MenuItem>
                                                        <MenuItem value="AK" sx={{ fontSize: '12px' }}>Alaska</MenuItem>
                                                        <MenuItem value="AZ" sx={{ fontSize: '12px' }}>Arizona</MenuItem>
                                                        <MenuItem value="AR" sx={{ fontSize: '12px' }}>Arkansas</MenuItem>
                                                        <MenuItem value="CA" sx={{ fontSize: '12px' }}>California</MenuItem>
                                                        <MenuItem value="CO" sx={{ fontSize: '12px' }}>Colorado</MenuItem>
                                                        <MenuItem value="CT" sx={{ fontSize: '12px' }}>Connecticut</MenuItem>
                                                        <MenuItem value="DE" sx={{ fontSize: '12px' }}>Delaware</MenuItem>
                                                        <MenuItem value="FL" sx={{ fontSize: '12px' }}>Florida</MenuItem>
                                                        <MenuItem value="GA" sx={{ fontSize: '12px' }}>Georgia</MenuItem>
                                                        <MenuItem value="HI" sx={{ fontSize: '12px' }}>Hawaii</MenuItem>
                                                        <MenuItem value="ID" sx={{ fontSize: '12px' }}>Idaho</MenuItem>
                                                        <MenuItem value="IL" sx={{ fontSize: '12px' }}>Illinois</MenuItem>
                                                        <MenuItem value="IN" sx={{ fontSize: '12px' }}>Indiana</MenuItem>
                                                        <MenuItem value="IA" sx={{ fontSize: '12px' }}>Iowa</MenuItem>
                                                        <MenuItem value="KS" sx={{ fontSize: '12px' }}>Kansas</MenuItem>
                                                        <MenuItem value="KY" sx={{ fontSize: '12px' }}>Kentucky</MenuItem>
                                                        <MenuItem value="LA" sx={{ fontSize: '12px' }}>Louisiana</MenuItem>
                                                        <MenuItem value="ME" sx={{ fontSize: '12px' }}>Maine</MenuItem>
                                                        <MenuItem value="MD" sx={{ fontSize: '12px' }}>Maryland</MenuItem>
                                                        <MenuItem value="MA" sx={{ fontSize: '12px' }}>Massachusetts</MenuItem>
                                                        <MenuItem value="MI" sx={{ fontSize: '12px' }}>Michigan</MenuItem>
                                                        <MenuItem value="MN" sx={{ fontSize: '12px' }}>Minnesota</MenuItem>
                                                        <MenuItem value="MS" sx={{ fontSize: '12px' }}>Mississippi</MenuItem>
                                                        <MenuItem value="MO" sx={{ fontSize: '12px' }}>Missouri</MenuItem>
                                                        <MenuItem value="MT" sx={{ fontSize: '12px' }}>Montana</MenuItem>
                                                        <MenuItem value="NE" sx={{ fontSize: '12px' }}>Nebraska</MenuItem>
                                                        <MenuItem value="NV" sx={{ fontSize: '12px' }}>Nevada</MenuItem>
                                                        <MenuItem value="NH" sx={{ fontSize: '12px' }}>New Hampshire</MenuItem>
                                                        <MenuItem value="NJ" sx={{ fontSize: '12px' }}>New Jersey</MenuItem>
                                                        <MenuItem value="NM" sx={{ fontSize: '12px' }}>New Mexico</MenuItem>
                                                        <MenuItem value="NY" sx={{ fontSize: '12px' }}>New York</MenuItem>
                                                        <MenuItem value="NC" sx={{ fontSize: '12px' }}>North Carolina</MenuItem>
                                                        <MenuItem value="ND" sx={{ fontSize: '12px' }}>North Dakota</MenuItem>
                                                        <MenuItem value="OH" sx={{ fontSize: '12px' }}>Ohio</MenuItem>
                                                        <MenuItem value="OK" sx={{ fontSize: '12px' }}>Oklahoma</MenuItem>
                                                        <MenuItem value="OR" sx={{ fontSize: '12px' }}>Oregon</MenuItem>
                                                        <MenuItem value="PA" sx={{ fontSize: '12px' }}>Pennsylvania</MenuItem>
                                                        <MenuItem value="RI" sx={{ fontSize: '12px' }}>Rhode Island</MenuItem>
                                                        <MenuItem value="SC" sx={{ fontSize: '12px' }}>South Carolina</MenuItem>
                                                        <MenuItem value="SD" sx={{ fontSize: '12px' }}>South Dakota</MenuItem>
                                                        <MenuItem value="TN" sx={{ fontSize: '12px' }}>Tennessee</MenuItem>
                                                        <MenuItem value="TX" sx={{ fontSize: '12px' }}>Texas</MenuItem>
                                                        <MenuItem value="UT" sx={{ fontSize: '12px' }}>Utah</MenuItem>
                                                        <MenuItem value="VT" sx={{ fontSize: '12px' }}>Vermont</MenuItem>
                                                        <MenuItem value="VA" sx={{ fontSize: '12px' }}>Virginia</MenuItem>
                                                        <MenuItem value="WA" sx={{ fontSize: '12px' }}>Washington</MenuItem>
                                                        <MenuItem value="WV" sx={{ fontSize: '12px' }}>West Virginia</MenuItem>
                                                        <MenuItem value="WI" sx={{ fontSize: '12px' }}>Wisconsin</MenuItem>
                                                        <MenuItem value="WY" sx={{ fontSize: '12px' }}>Wyoming</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                    <Select
                                                        value={formData.destinationCountry || 'CA'}
                                                        onChange={(e) => handleFieldChange('destinationCountry', e.target.value)}
                                                        label="Country"
                                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                    >
                                                        <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                                        <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                            ) : (
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={12} sm={5}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={ROUTE_TYPES.find(t => t.value === formData.routeType)?.originLabel || 'Origin'}
                                            value={formData.origin}
                                            onChange={(e) => handleFieldChange('origin', e.target.value)}
                                            error={!!errors.origin}
                                            helperText={errors.origin || getPlaceholderText(formData.routeType, 'origin')}
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                '& .MuiFormHelperText-root': { fontSize: '10px' }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={2} sx={{ textAlign: 'center' }}>
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '40px'
                                        }}>
                                            <Typography sx={{
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                color: '#3b82f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.5
                                            }}>
                                                <ArrowForwardIcon sx={{ fontSize: '16px' }} />
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={5}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={ROUTE_TYPES.find(t => t.value === formData.routeType)?.destinationLabel || 'Destination'}
                                            value={formData.destination}
                                            onChange={(e) => handleFieldChange('destination', e.target.value)}
                                            error={!!errors.destination}
                                            helperText={errors.destination || getPlaceholderText(formData.routeType, 'destination')}
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                '& .MuiFormHelperText-root': { fontSize: '10px' }
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                            )}

                            {/* Country Selection for non-city routes that need it */}
                            {formData.routeType !== 'city_to_city' && ROUTE_TYPES.find(t => t.value === formData.routeType)?.showCountry && (
                                <Grid container spacing={2} sx={{ mt: 1 }}>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>Country/Region</InputLabel>
                                            <Select
                                                value={formData.country || 'CA'}
                                                onChange={(e) => handleFieldChange('country', e.target.value)}
                                                label="Country/Region"
                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                            >
                                                <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                                <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                                <MenuItem value="BOTH" sx={{ fontSize: '12px' }}>Both (Cross-Border)</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            )}
                        </Paper>
                    </Box>

                    {/* Route Preview */}
                    {formData.origin && formData.destination && (
                        <Box sx={{
                            p: 2,
                            bgcolor: '#f0fdf4',
                            borderRadius: 1,
                            border: '1px solid #bbf7d0',
                            mb: 2
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CheckCircleIcon sx={{ fontSize: '16px', color: '#10b981' }} />
                                <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#065f46' }}>
                                    Route Configured: {formData.origin}
                                    {formData.routeType === 'city_to_city' && formData.originStateProvince && (
                                        <span>, {formData.originStateProvince}</span>
                                    )}
                                    {formData.routeType === 'city_to_city' && formData.originCountry && (
                                        <span> ({formData.originCountry})</span>
                                    )}
                                    <span> → </span>
                                    {formData.destination}
                                    {formData.routeType === 'city_to_city' && formData.destinationStateProvince && (
                                        <span>, {formData.destinationStateProvince}</span>
                                    )}
                                    {formData.routeType === 'city_to_city' && formData.destinationCountry && (
                                        <span> ({formData.destinationCountry})</span>
                                    )}
                                    {formData.routeType !== 'city_to_city' && ROUTE_TYPES.find(t => t.value === formData.routeType)?.showCountry && formData.country && (
                                        <span> ({formData.country === 'BOTH' ? 'Cross-Border' : formData.country})</span>
                                    )}
                                    {formData.routeType === 'city_to_city' && formData.originCountry !== formData.destinationCountry && (
                                        <span className="cross-border-indicator" style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                                            Cross-Border
                                        </span>
                                    )}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Pricing Configuration Section */}
                    <Accordion defaultExpanded sx={{ mt: 2 }}>
                        <AccordionSummary
                            sx={{ bgcolor: '#f8fafc', minHeight: '48px', '& .MuiAccordionSummary-expandIconWrapper': { display: 'none' } }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MoneyIcon sx={{ fontSize: '18px', color: '#059669' }} />
                                <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                    Pricing Configuration ({rateType === 'pound' ? 'Weight-Based' : 'Skid-Based'})
                                </Typography>
                                <Chip
                                    label={rateType === 'pound' ? 'Per Pound' : 'Per Skid'}
                                    size="small"
                                    color={rateType === 'pound' ? 'primary' : 'secondary'}
                                    sx={{ fontSize: '9px', height: '18px' }}
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 2 }}>
                            {rateType === 'pound' && (
                                <Box>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                                        Configure weight-based pricing for this freight lane.
                                    </Typography>
                                    <Paper sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Per Pound Rate ($)"
                                                    type="number"
                                                    value={formData.poundRate.perPoundRate}
                                                    onChange={(e) => handleNestedFieldChange('poundRate', 'perPoundRate', parseFloat(e.target.value) || 0)}
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Minimum Charge ($)"
                                                    type="number"
                                                    value={formData.poundRate.minimumCharge}
                                                    onChange={(e) => handleNestedFieldChange('poundRate', 'minimumCharge', parseFloat(e.target.value) || 0)}
                                                    error={!!errors.minimumCharge}
                                                    helperText={errors.minimumCharge}
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                                        '& .MuiFormHelperText-root': { fontSize: '10px' }
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                </Box>
                            )}

                            {rateType === 'skid' && (
                                <Box>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                                        Configure skid-based pricing using the interactive 53' trailer layout.
                                    </Typography>

                                    {/* Enhanced Bulk Update Controls for Dialog */}
                                    <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => {
                                                const newPricing = formData.skidRate.skidPricing.map((skid, i) =>
                                                    i >= 0 && i <= 14 ? { ...skid, rate: 150 } : skid
                                                );
                                                setFormData(prev => ({
                                                    ...prev,
                                                    skidRate: { ...prev.skidRate, skidPricing: newPricing }
                                                }));
                                            }}
                                            sx={{ fontSize: '10px', px: 1.5, py: 0.5 }}
                                        >
                                            LTL $150
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => {
                                                const newPricing = formData.skidRate.skidPricing.map((skid, i) =>
                                                    i >= 15 && i <= 25 ? { ...skid, rate: 2500 } : skid
                                                );
                                                setFormData(prev => ({
                                                    ...prev,
                                                    skidRate: { ...prev.skidRate, skidPricing: newPricing }
                                                }));
                                            }}
                                            sx={{ fontSize: '10px', px: 1.5, py: 0.5 }}
                                        >
                                            FTL $2500
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            onClick={() => {
                                                const newPricing = formData.skidRate.skidPricing.map((skid) => ({ ...skid, rate: 0 }));
                                                setFormData(prev => ({
                                                    ...prev,
                                                    skidRate: { ...prev.skidRate, skidPricing: newPricing }
                                                }));
                                            }}
                                            sx={{ fontSize: '10px', px: 1.5, py: 0.5 }}
                                        >
                                            Clear
                                        </Button>
                                    </Box>

                                    {/* Compact Trailer Layout */}
                                    <Paper sx={{ p: 2, bgcolor: '#fafafa', border: '2px solid #e0e0e0', borderRadius: '8px' }}>
                                        {/* Legend */}
                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{
                                                    width: '14px',
                                                    height: '14px',
                                                    bgcolor: '#e3f2fd',
                                                    border: '2px solid #2196f3',
                                                    borderRadius: '3px'
                                                }} />
                                                <Typography sx={{ fontSize: '10px', fontWeight: 500 }}>LTL (1-15)</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{
                                                    width: '14px',
                                                    height: '14px',
                                                    bgcolor: '#fff3e0',
                                                    border: '2px solid #ff9800',
                                                    borderRadius: '3px'
                                                }} />
                                                <Typography sx={{ fontSize: '10px', fontWeight: 500 }}>FTL (16-26)</Typography>
                                            </Box>
                                        </Box>

                                        {/* Compact Trailer Layout */}
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            p: 1.5,
                                            bgcolor: 'white',
                                            borderRadius: '6px',
                                            border: '2px solid #424242',
                                            position: 'relative',
                                            maxHeight: '400px',
                                            overflow: 'auto'
                                        }}>
                                            {/* Compact 53' Trailer Layout: 2 across, 13 deep = 26 skids */}
                                            {Array.from({ length: 13 }, (_, row) => (
                                                <Box key={row} sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                                                    {Array.from({ length: 2 }, (_, col) => {
                                                        const skidIndex = row * 2 + col;
                                                        if (skidIndex < 26) {
                                                            const skid = formData.skidRate.skidPricing[skidIndex];
                                                            return (
                                                                <Box
                                                                    key={skidIndex}
                                                                    sx={{
                                                                        width: '100px',
                                                                        height: '60px',
                                                                        border: `2px solid ${skid.skidCount <= 15 ? '#2196f3' : '#ff9800'}`,
                                                                        backgroundColor: skid.skidCount <= 15 ? '#e3f2fd' : '#fff3e0',
                                                                        borderRadius: '6px',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease',
                                                                        position: 'relative',
                                                                        '&:hover': {
                                                                            transform: 'translateY(-1px)',
                                                                            boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
                                                                        }
                                                                    }}
                                                                    onClick={() => {
                                                                        const newRate = prompt(`Enter rate for skid ${skid.skidCount}:`, skid.rate.toString());
                                                                        if (newRate !== null) {
                                                                            handleSkidRateChange(skidIndex, newRate);
                                                                        }
                                                                    }}
                                                                >
                                                                    {/* Skid Number Badge */}
                                                                    <Typography sx={{
                                                                        position: 'absolute',
                                                                        top: '2px',
                                                                        left: '4px',
                                                                        fontSize: '9px',
                                                                        fontWeight: 600,
                                                                        color: skid.skidCount <= 15 ? '#1976d2' : '#f57c00',
                                                                        backgroundColor: 'white',
                                                                        borderRadius: '4px',
                                                                        px: '2px',
                                                                        py: '1px'
                                                                    }}>
                                                                        {skid.skidCount}
                                                                    </Typography>

                                                                    {/* LTL/FTL Badge */}
                                                                    <Typography sx={{
                                                                        position: 'absolute',
                                                                        top: '2px',
                                                                        right: '4px',
                                                                        fontSize: '8px',
                                                                        fontWeight: 600,
                                                                        color: 'white',
                                                                        backgroundColor: skid.skidCount <= 15 ? '#1976d2' : '#f57c00',
                                                                        borderRadius: '3px',
                                                                        px: '2px',
                                                                        py: '1px'
                                                                    }}>
                                                                        {skid.skidCount <= 15 ? 'LTL' : 'FTL'}
                                                                    </Typography>

                                                                    {/* Price Display */}
                                                                    <Typography sx={{
                                                                        fontSize: '11px',
                                                                        fontWeight: 600,
                                                                        color: skid.skidCount <= 15 ? '#1976d2' : '#f57c00',
                                                                        mt: '6px'
                                                                    }}>
                                                                        ${skid.rate || '0'}
                                                                    </Typography>
                                                                </Box>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </Box>
                                            ))}
                                        </Box>

                                        {/* Summary Stats */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-around',
                                            mt: 2,
                                            p: 1.5,
                                            bgcolor: '#f5f5f5',
                                            borderRadius: '6px',
                                            border: '1px solid #e0e0e0'
                                        }}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography sx={{ fontSize: '10px', color: '#666', fontWeight: 500 }}>LTL Skids</Typography>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#1976d2' }}>
                                                    {formData.skidRate.skidPricing.slice(0, 15).filter(s => s.rate > 0).length}/15
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography sx={{ fontSize: '10px', color: '#666', fontWeight: 500 }}>FTL Skids</Typography>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#f57c00' }}>
                                                    {formData.skidRate.skidPricing.slice(15, 26).filter(s => s.rate > 0).length}/11
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography sx={{ fontSize: '10px', color: '#666', fontWeight: 500 }}>Avg Rate</Typography>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#4caf50' }}>
                                                    ${Math.round(formData.skidRate.skidPricing.filter(s => s.rate > 0).reduce((sum, s) => sum + s.rate, 0) / formData.skidRate.skidPricing.filter(s => s.rate > 0).length || 0)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Paper>

                                    {errors.skidRates && (
                                        <Typography sx={{ fontSize: '10px', color: '#d32f2f', mt: 1 }}>
                                            {errors.skidRates}
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={onClose} sx={{ fontSize: '12px' }}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    sx={{ fontSize: '12px' }}
                    startIcon={<CheckCircleIcon sx={{ fontSize: '16px' }} />}
                >
                    {isEdit ? 'Update Lane' : 'Add Lane'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// 53' Trailer Visual Skid Pricing Component
const SkidPricingTable = ({ skidPricing, onUpdate, currency }) => {
    const [editingSkid, setEditingSkid] = useState(null);
    const [tempValue, setTempValue] = useState('');

    const handleRateChange = (index, rate) => {
        const newPricing = skidPricing.map((skid, i) =>
            i === index ? { ...skid, rate: parseFloat(rate) || 0 } : skid
        );
        onUpdate(newPricing);
    };

    const handleBulkUpdate = (startIndex, endIndex, rate) => {
        const parsedRate = parseFloat(rate) || 0;
        const newPricing = skidPricing.map((skid, i) =>
            i >= startIndex && i <= endIndex ? { ...skid, rate: parsedRate } : skid
        );
        onUpdate(newPricing);
    };

    const handleSkidClick = (index) => {
        setEditingSkid(index);
        setTempValue(skidPricing[index].rate.toString());
    };

    const handleSkidSave = () => {
        if (editingSkid !== null) {
            handleRateChange(editingSkid, tempValue);
            setEditingSkid(null);
            setTempValue('');
        }
    };

    const handleSkidCancel = () => {
        setEditingSkid(null);
        setTempValue('');
    };

    const getSkidColor = (skidCount) => {
        if (skidCount <= 15) return '#e3f2fd'; // Light blue for LTL
        return '#fff3e0'; // Light orange for FTL
    };

    const getSkidBorderColor = (skidCount) => {
        if (skidCount <= 15) return '#2196f3'; // Blue for LTL
        return '#ff9800'; // Orange for FTL
    };

    // Create the 53' trailer layout: 2 across, 13 deep = 26 skids
    const renderTrailerLayout = () => {
        const rows = [];

        for (let row = 0; row < 13; row++) {
            const rowSkids = [];
            for (let col = 0; col < 2; col++) {
                const skidIndex = row * 2 + col;
                if (skidIndex < 26) {
                    const skid = skidPricing[skidIndex];
                    const isEditing = editingSkid === skidIndex;

                    rowSkids.push(
                        <Box
                            key={skidIndex}
                            onClick={() => !isEditing && handleSkidClick(skidIndex)}
                            sx={{
                                width: { xs: '80px', sm: '90px', md: '100px' },
                                height: { xs: '50px', sm: '55px', md: '60px' },
                                border: `1px solid ${getSkidBorderColor(skid.skidCount)}`,
                                backgroundColor: getSkidColor(skid.skidCount),
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: isEditing ? 'default' : 'pointer',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                                '&:hover': !isEditing ? {
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                } : {},
                                mr: col === 0 ? 0.5 : 0
                            }}
                        >
                            {/* Skid Number */}
                            <Typography sx={{
                                position: 'absolute',
                                top: '2px',
                                left: '4px',
                                fontSize: '9px',
                                fontWeight: 600,
                                color: skid.skidCount <= 15 ? '#1976d2' : '#f57c00'
                            }}>
                                {skid.skidCount}
                            </Typography>

                            {/* LTL/FTL Type */}
                            <Typography sx={{
                                position: 'absolute',
                                top: '2px',
                                right: '4px',
                                fontSize: '8px',
                                fontWeight: 500,
                                color: skid.skidCount <= 15 ? '#1976d2' : '#f57c00'
                            }}>
                                {skid.skidCount <= 15 ? 'LTL' : 'FTL'}
                            </Typography>

                            {/* Price Display/Edit */}
                            {isEditing ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, mt: 1 }}>
                                    <TextField
                                        size="small"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') handleSkidSave();
                                            if (e.key === 'Escape') handleSkidCancel();
                                        }}
                                        autoFocus
                                        sx={{
                                            width: { xs: '60px', sm: '65px', md: '70px' },
                                            '& .MuiInputBase-input': {
                                                fontSize: '10px',
                                                textAlign: 'center',
                                                padding: '3px'
                                            }
                                        }}
                                    />
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <IconButton
                                            size="small"
                                            onClick={handleSkidSave}
                                            sx={{ padding: '1px', minWidth: 'auto' }}
                                        >
                                            <CheckCircleIcon sx={{ fontSize: '12px', color: '#4caf50' }} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={handleSkidCancel}
                                            sx={{ padding: '1px', minWidth: 'auto' }}
                                        >
                                            <WarningIcon sx={{ fontSize: '12px', color: '#f44336' }} />
                                        </IconButton>
                                    </Box>
                                </Box>
                            ) : (
                                <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                                    <Typography sx={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: skid.skidCount <= 15 ? '#1976d2' : '#f57c00'
                                    }}>
                                        ${skid.rate || '0'}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    );
                }
            }

            rows.push(
                <Box key={row} sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                    {rowSkids}
                </Box>
            );
        }

        return rows;
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 'none' }}>
            {/* Bulk Update Controls */}
            <Box sx={{
                display: 'flex',
                gap: 1,
                mb: 2,
                flexWrap: 'wrap',
                justifyContent: 'flex-start'
            }}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleBulkUpdate(0, 14, '150')}
                    sx={{ fontSize: '11px', minWidth: 'auto' }}
                    startIcon={<ScaleIcon sx={{ fontSize: '14px' }} />}
                >
                    LTL $150
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleBulkUpdate(15, 25, '500')}
                    sx={{ fontSize: '11px', minWidth: 'auto' }}
                    startIcon={<InventoryIcon sx={{ fontSize: '14px' }} />}
                >
                    FTL $500
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleBulkUpdate(15, 25, '2500')}
                    sx={{ fontSize: '11px', minWidth: 'auto' }}
                    startIcon={<InventoryIcon sx={{ fontSize: '14px' }} />}
                >
                    FTL $2500
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleBulkUpdate(15, 25, '5000')}
                    sx={{ fontSize: '11px', minWidth: 'auto' }}
                    startIcon={<InventoryIcon sx={{ fontSize: '14px' }} />}
                >
                    FTL $5000
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleBulkUpdate(15, 25, '10000')}
                    sx={{ fontSize: '11px', minWidth: 'auto' }}
                    startIcon={<InventoryIcon sx={{ fontSize: '14px' }} />}
                >
                    FTL $10000
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleBulkUpdate(0, 25, '200')}
                    sx={{ fontSize: '11px', minWidth: 'auto' }}
                    startIcon={<MoneyIcon sx={{ fontSize: '14px' }} />}
                >
                    All $200
                </Button>
            </Box>

            {/* Trailer Header */}
            <Box sx={{
                textAlign: 'center',
                mb: 2,
                p: 1.5,
                bgcolor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
            }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    53' Trailer Layout - Interactive Skid Pricing
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5 }}>
                    2 across × 13 deep = 26 skids maximum • Click any skid to edit price
                </Typography>
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                        width: '12px',
                        height: '12px',
                        bgcolor: '#e3f2fd',
                        border: '1px solid #2196f3',
                        borderRadius: '2px'
                    }} />
                    <Typography sx={{ fontSize: '11px' }}>LTL (1-15)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                        width: '12px',
                        height: '12px',
                        bgcolor: '#fff3e0',
                        border: '1px solid #ff9800',
                        borderRadius: '2px'
                    }} />
                    <Typography sx={{ fontSize: '11px' }}>FTL (16-26)</Typography>
                </Box>
            </Box>

            {/* Trailer Layout */}
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                maxWidth: 'none',
                overflow: 'auto'
            }}>
                {renderTrailerLayout()}
            </Box>

            {/* Summary Stats */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-around',
                mt: 2,
                p: 1.5,
                bgcolor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>LTL Skids</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#1976d2' }}>
                        {skidPricing.slice(0, 15).filter(s => s.rate > 0).length}/15
                    </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>FTL Skids</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#f57c00' }}>
                        {skidPricing.slice(15, 26).filter(s => s.rate > 0).length}/11
                    </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Avg Rate</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#4caf50' }}>
                        {currency} {Math.round(skidPricing.filter(s => s.rate > 0).reduce((sum, s) => sum + s.rate, 0) / skidPricing.filter(s => s.rate > 0).length || 0)}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

const RateConfigurationStep = ({ data, onUpdate, errors, setErrors, isEdit = false }) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingLane, setEditingLane] = useState(null);
    const [editingIndex, setEditingIndex] = useState(-1);

    // Handle rate configuration toggle
    const handleConfigurationToggle = useCallback((enabled) => {
        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                enabled
            }
        });
    }, [data.rateConfiguration, onUpdate]);

    // Handle rate type change
    const handleRateTypeChange = useCallback((rateType) => {
        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                rateType
            }
        });
    }, [data.rateConfiguration, onUpdate]);

    // Handle rate structure change
    const handleRateStructureChange = useCallback((rateStructure) => {
        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                rateStructure
            }
        });
    }, [data.rateConfiguration, onUpdate]);

    // Handle currency change
    const handleCurrencyChange = useCallback((currency) => {
        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                currency
            }
        });
    }, [data.rateConfiguration, onUpdate]);

    // Handle flat rate changes
    const handleFlatRateChange = useCallback((rateType, field, value) => {
        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                flatRates: {
                    ...data.rateConfiguration.flatRates,
                    [rateType]: {
                        ...data.rateConfiguration.flatRates[rateType],
                        [field]: value
                    }
                }
            }
        });
    }, [data.rateConfiguration, onUpdate]);

    // Handle skid pricing update
    const handleSkidPricingUpdate = useCallback((newPricing) => {
        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                flatRates: {
                    ...data.rateConfiguration.flatRates,
                    skidRate: {
                        ...data.rateConfiguration.flatRates.skidRate,
                        skidPricing: newPricing
                    }
                }
            }
        });
    }, [data.rateConfiguration, onUpdate]);

    // Handle freight lane operations
    const handleAddLane = () => {
        setEditingLane(null);
        setEditingIndex(-1);
        setDialogOpen(true);
    };

    const handleEditLane = (lane, index) => {
        setEditingLane(lane);
        setEditingIndex(index);
        setDialogOpen(true);
    };

    const handleDeleteLane = (index) => {
        const newLanes = data.rateConfiguration.freightLanes.filter((_, i) => i !== index);
        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                freightLanes: newLanes
            }
        });
    };

    const handleSaveLane = useCallback((laneData) => {
        let newLanes;
        if (editingIndex >= 0) {
            newLanes = [...data.rateConfiguration.freightLanes];
            newLanes[editingIndex] = laneData;
        } else {
            newLanes = [...(data.rateConfiguration.freightLanes || []), laneData];
        }

        onUpdate({
            rateConfiguration: {
                ...data.rateConfiguration,
                freightLanes: newLanes
            }
        });
    }, [data.rateConfiguration, onUpdate, editingIndex]);

    const isConfigurationEnabled = data.rateConfiguration?.enabled && data.connectionType === 'manual';
    const rateType = data.rateConfiguration?.rateType || 'pound';
    const rateStructure = data.rateConfiguration?.rateStructure || 'flat';

    return (
        <Box sx={{ width: '100%', maxWidth: 'none' }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Enhanced Rate Configuration
            </Typography>

            {/* API Carrier Information */}
            {data.connectionType === 'api' && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: '#f0f9ff', border: '1px solid #bfdbfe' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <InfoIcon sx={{ fontSize: '18px', color: '#1e40af' }} />
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#1e40af' }}>
                            API Carrier - No Rate Configuration Required
                        </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '12px', color: '#1e40af', mb: 2 }}>
                        This carrier is configured as an <strong>API carrier</strong>. Rates are automatically
                        retrieved from the carrier's API in real-time, so manual rate configuration is not needed.
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: '16px', color: '#10b981' }} />
                        <Typography sx={{ fontSize: '11px', color: '#1e40af' }}>
                            Rates will be fetched automatically from {data.name || 'carrier'} API
                        </Typography>
                    </Box>
                </Paper>
            )}

            {/* Configuration Toggle - Only for Manual Carriers */}
            {data.connectionType === 'manual' && (
                <>
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                            <MoneyIcon sx={{ fontSize: '18px', color: '#10b981' }} />
                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                Rate Configuration Settings
                            </Typography>
                        </Box>

                        {/* Enable Rate Configuration */}
                        <Paper sx={{ p: 2, border: '1px solid #e5e7eb', bgcolor: '#f8fafc', mb: 3 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={data.rateConfiguration?.enabled || false}
                                        onChange={(e) => handleConfigurationToggle(e.target.checked)}
                                        color="primary"
                                        size="medium"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                            Enable Custom Rate Configuration
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Create advanced pound or skid-based rates with flat pricing or freight lanes
                                        </Typography>
                                    </Box>
                                }
                            />
                        </Paper>

                        {/* Configuration Options - Only show when enabled */}
                        {isConfigurationEnabled && (
                            <Grid container spacing={3}>
                                {/* Basic Settings */}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 500, mb: 2 }}>
                                        Basic Settings
                                    </Typography>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                        <Select
                                            value={data.rateConfiguration?.currency || 'CAD'}
                                            onChange={(e) => handleCurrencyChange(e.target.value)}
                                            label="Currency"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD - Canadian Dollar</MenuItem>
                                            <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD - US Dollar</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Rate Type</InputLabel>
                                        <Select
                                            value={rateType}
                                            onChange={(e) => handleRateTypeChange(e.target.value)}
                                            label="Rate Type"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            {RATE_TYPES.map((type) => (
                                                <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                                    {type.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Rate Structure</InputLabel>
                                        <Select
                                            value={rateStructure}
                                            onChange={(e) => handleRateStructureChange(e.target.value)}
                                            label="Rate Structure"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            {RATE_STRUCTURES.map((structure) => (
                                                <MenuItem key={structure.value} value={structure.value} sx={{ fontSize: '12px' }}>
                                                    {structure.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>


                            </Grid>
                        )}
                    </Paper>

                    {/* Rate Configuration Content */}
                    {isConfigurationEnabled && (
                        <>
                            {rateStructure === 'flat' && (
                                <Paper sx={{ p: 3, mb: 3 }}>
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 500, mb: 3 }}>
                                        Flat Rate Configuration
                                    </Typography>

                                    {rateType === 'pound' && (
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Per Pound Rate"
                                                    type="number"
                                                    value={data.rateConfiguration?.flatRates?.poundRate?.perPoundRate || 0}
                                                    onChange={(e) => handleFlatRateChange('poundRate', 'perPoundRate', parseFloat(e.target.value) || 0)}
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Minimum Charge"
                                                    type="number"
                                                    value={data.rateConfiguration?.flatRates?.poundRate?.minimumCharge || 0}
                                                    onChange={(e) => handleFlatRateChange('poundRate', 'minimumCharge', parseFloat(e.target.value) || 0)}
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    )}

                                    {rateType === 'skid' && (
                                        <Box>

                                            <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 500, mb: 2 }}>
                                                Skid Pricing Table (1-26 Skids)
                                            </Typography>
                                            <SkidPricingTable
                                                skidPricing={data.rateConfiguration?.flatRates?.skidRate?.skidPricing || []}
                                                onUpdate={handleSkidPricingUpdate}
                                                currency={data.rateConfiguration?.currency || 'CAD'}
                                            />
                                        </Box>
                                    )}
                                </Paper>
                            )}

                            {rateStructure === 'freight_lanes' && (
                                <Paper sx={{ p: 3, mb: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            Freight Lanes ({rateType === 'pound' ? 'Weight-Based' : 'Skid-Based'})
                                        </Typography>
                                        <Button
                                            startIcon={<AddIcon />}
                                            variant="contained"
                                            size="small"
                                            onClick={handleAddLane}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Add Freight Lane
                                        </Button>
                                    </Box>

                                    {data.rateConfiguration?.freightLanes?.length > 0 ? (
                                        <TableContainer component={Paper}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Route</TableCell>
                                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Rate Type</TableCell>
                                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Pricing</TableCell>

                                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Actions</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {data.rateConfiguration.freightLanes.map((lane, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Box>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                        {lane.origin || lane.fromCity}
                                                                        {lane.routeType === 'city_to_city' && lane.originStateProvince && (
                                                                            <Typography component="span" sx={{ fontSize: '11px', color: '#6b7280', ml: 0.5 }}>
                                                                                , {lane.originStateProvince}
                                                                            </Typography>
                                                                        )}
                                                                        {lane.routeType === 'city_to_city' && lane.originCountry && (
                                                                            <Typography component="span" sx={{ fontSize: '11px', color: '#6b7280', ml: 0.5 }}>
                                                                                ({lane.originCountry})
                                                                            </Typography>
                                                                        )}
                                                                    </Typography>
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        → {lane.destination || lane.toCity}
                                                                        {lane.routeType === 'city_to_city' && lane.destinationStateProvince && (
                                                                            <Typography component="span" sx={{ fontSize: '11px', color: '#6b7280', ml: 0.5 }}>
                                                                                , {lane.destinationStateProvince}
                                                                            </Typography>
                                                                        )}
                                                                        {lane.routeType === 'city_to_city' && lane.destinationCountry && (
                                                                            <Typography component="span" sx={{ fontSize: '11px', color: '#6b7280', ml: 0.5 }}>
                                                                                ({lane.destinationCountry})
                                                                            </Typography>
                                                                        )}
                                                                        {lane.routeType === 'city_to_city' && lane.originCountry !== lane.destinationCountry && (
                                                                            <Chip
                                                                                label="Cross-Border"
                                                                                size="small"
                                                                                sx={{ fontSize: '8px', height: '16px', ml: 0.5, bgcolor: '#fef3c7', color: '#92400e' }}
                                                                            />
                                                                        )}
                                                                    </Typography>
                                                                    {lane.routeType && (
                                                                        <Chip
                                                                            label={ROUTE_TYPES.find(t => t.value === lane.routeType)?.label || lane.routeType}
                                                                            size="small"
                                                                            sx={{ fontSize: '9px', mt: 0.5 }}
                                                                        />
                                                                    )}
                                                                    {lane.routeType !== 'city_to_city' && lane.country && lane.country !== 'CA' && (
                                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                            {lane.country === 'BOTH' ? 'Cross-Border' : lane.country}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Chip
                                                                    label={rateType === 'pound' ? 'Weight' : 'Skid'}
                                                                    size="small"
                                                                    color={rateType === 'pound' ? 'primary' : 'secondary'}
                                                                    sx={{ fontSize: '11px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                {rateType === 'pound' ? (
                                                                    <Box>
                                                                        <Typography sx={{ fontSize: '11px' }}>
                                                                            Per lb: {data.rateConfiguration?.currency || 'CAD'} {lane.poundRate?.perPoundRate || 0}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: '11px' }}>
                                                                            Min: {data.rateConfiguration?.currency || 'CAD'} {lane.poundRate?.minimumCharge || 0}
                                                                        </Typography>
                                                                    </Box>
                                                                ) : (
                                                                    <Typography sx={{ fontSize: '11px' }}>
                                                                        {lane.skidRate?.skidPricing?.filter(s => s.rate > 0).length || 0} skid rates configured
                                                                    </Typography>
                                                                )}
                                                            </TableCell>

                                                            <TableCell>
                                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleEditLane(lane, index)}
                                                                    >
                                                                        <EditIcon sx={{ fontSize: '16px' }} />
                                                                    </IconButton>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleDeleteLane(index)}
                                                                        color="error"
                                                                    >
                                                                        <DeleteIcon sx={{ fontSize: '16px' }} />
                                                                    </IconButton>
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
                                            <RouteIcon sx={{ fontSize: '48px', color: '#9ca3af', mb: 2 }} />
                                            <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                No freight lanes configured
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                Add freight lanes for city-to-city, province-to-province, or cross-border route-specific pricing
                                            </Typography>
                                        </Paper>
                                    )}
                                </Paper>
                            )}
                        </>
                    )}

                    {/* Information when disabled */}
                    {!isConfigurationEnabled && data.connectionType === 'manual' && (
                        <Paper sx={{ p: 3, mt: 3, bgcolor: '#fef3ff', border: '1px solid #e9d5ff' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <InfoIcon sx={{ fontSize: '16px', color: '#7c3aed' }} />
                                <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#7c3aed' }}>
                                    Rate Configuration Disabled
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: '12px', color: '#7c3aed' }}>
                                Enable rate configuration to set up custom pricing with pound rates, skid rates,
                                flat pricing, or freight lane specific rates for this manual carrier.
                            </Typography>
                        </Paper>
                    )}
                </>
            )}

            {/* Freight Lane Dialog */}
            <FreightLaneDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                lane={editingLane}
                onSave={handleSaveLane}
                isEdit={editingIndex >= 0}
                rateType={rateType}
            />
        </Box>
    );
};

export default RateConfigurationStep; 