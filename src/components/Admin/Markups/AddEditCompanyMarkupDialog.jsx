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
    Business as BusinessIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

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

const AddEditCompanyMarkupDialog = ({
    open,
    onClose,
    onSave,
    initialData,
    companiesList, // Expecting array of { id, name, customerID (for companyID) }
    customersList, // Expecting array of { id, name, customerID, companyID (links to a company in companiesList) }
    carriersList // Expecting array of { id, name }
}) => {
    const [formData, setFormData] = useState({
        fromBusinessId: '',
        toBusinessId: 'ANY',
        customerId: 'ANY', // Specific customer under toBusinessId
        carrierId: 'ANY',
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
    const [filteredCustomers, setFilteredCustomers] = useState([]);

    // Filter customers based on selected "To Company"
    useEffect(() => {
        if (formData.toBusinessId === 'ANY' || !formData.toBusinessId) {
            setFilteredCustomers([]);
        } else {
            const filtered = customersList.filter(customer => customer.companyID === formData.toBusinessId);
            setFilteredCustomers(filtered);
        }
    }, [formData.toBusinessId, customersList]);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    fromBusinessId: initialData.fromBusinessId || '',
                    toBusinessId: initialData.toBusinessId || 'ANY',
                    customerId: initialData.customerId || 'ANY',
                    carrierId: initialData.carrierId || 'ANY',
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
                    fromBusinessId: (companiesList.length > 0 ? companiesList[0].id : ''),
                    toBusinessId: 'ANY',
                    customerId: 'ANY',
                    carrierId: 'ANY',
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
    }, [initialData, open, companiesList]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === "toBusinessId") {
            setFormData(prev => ({ ...prev, customerId: 'ANY' })); // Reset customer if To Company changes
        }

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
        if (!formData.fromBusinessId) {
            errors.fromBusinessId = 'From Company is required';
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

        const fromCompany = companiesList.find(c => c.id === formData.fromBusinessId);
        const toCompany = companiesList.find(c => c.id === formData.toBusinessId);
        const customer = filteredCustomers.find(c => c.id === formData.customerId);
        const carrier = carriersList.find(c => c.id === formData.carrierId);

        const saveData = {
            ...formData,
            fromCompanyName: fromCompany?.name || '',
            toCompanyName: formData.toBusinessId === 'ANY' ? 'ANY' : (toCompany?.name || ''),
            customerName: formData.customerId === 'ANY' ? 'ANY' : (customer?.name || ''),
            carrierName: formData.carrierId === 'ANY' ? 'ANY' : (carrier?.name || ''),
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

    const getFromCompanyName = () => {
        const company = companiesList.find(c => c.id === formData.fromBusinessId);
        return company?.name || 'Select Company';
    };

    const getToCompanyName = () => {
        if (formData.toBusinessId === 'ANY') return 'Any Company';
        const company = companiesList.find(c => c.id === formData.toBusinessId);
        return company?.name || 'Select Company';
    };

    const getCarrierName = () => {
        if (formData.carrierId === 'ANY') return 'Any Carrier';
        const carrier = carriersList.find(c => c.id === formData.carrierId);
        return carrier?.name || 'Select Carrier';
    };

    const dialogTitle = formData.id ? 'Edit Company Markup' : 'Add New Company Markup';

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
                        <BusinessIcon sx={{ color: '#3b82f6' }} />
                        {dialogTitle}
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    {/* Preview Card */}
                    <Paper sx={{ m: 3, p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <BusinessIcon sx={{ fontSize: '24px', color: '#3b82f6' }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    {getFromCompanyName()} → {getToCompanyName()}
                                    {formData.service && formData.service !== 'ANY' && ` (${formData.service})`}
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    {getSelectedMarkupType().description} • Carrier: {getCarrierName()}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#2563eb', fontWeight: 500 }}>
                                    Example: {getSelectedMarkupType().example}
                                </Typography>
                            </Box>
                            {formData.value > 0 && (
                                <Chip
                                    label={`${formData.value}${formData.type === 'PERCENTAGE' ? '%' : ''} markup`}
                                    sx={{
                                        bgcolor: '#3b82f6',
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
                            {/* Company Configuration */}
                            <Grid item xs={12}>
                                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                    Company Configuration
                                </Typography>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth required error={!!validationErrors.fromBusinessId}>
                                    <InputLabel sx={{ fontSize: '12px' }}>From Company</InputLabel>
                                    <Select
                                        name="fromBusinessId"
                                        value={formData.fromBusinessId}
                                        label="From Company"
                                        onChange={handleChange}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        {companiesList.map(company => (
                                            <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {company.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        ID: {company.id}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {validationErrors.fromBusinessId && (
                                        <FormHelperText>{validationErrors.fromBusinessId}</FormHelperText>
                                    )}
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        Company that will receive the markup revenue
                                    </FormHelperText>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>To Company (Optional)</InputLabel>
                                    <Select
                                        name="toBusinessId"
                                        value={formData.toBusinessId}
                                        label="To Company"
                                        onChange={handleChange}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        <MenuItem value="ANY" sx={{ fontSize: '12px' }}>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    Any Company
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Applies to all destination companies
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                        {companiesList.map(company => (
                                            <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {company.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        ID: {company.id}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        Specific destination company or "Any" for all companies
                                    </FormHelperText>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth disabled={formData.toBusinessId === 'ANY' || filteredCustomers.length === 0}>
                                    <InputLabel sx={{ fontSize: '12px' }}>Specific Customer (Optional)</InputLabel>
                                    <Select
                                        name="customerId"
                                        value={formData.customerId}
                                        label="Specific Customer"
                                        onChange={handleChange}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        <MenuItem value="ANY" sx={{ fontSize: '12px' }}>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    Any Customer
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Applies to all customers of selected company
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                        {filteredCustomers.map(cust => (
                                            <MenuItem key={cust.id} value={cust.id} sx={{ fontSize: '12px' }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {cust.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        ID: {cust.customerID}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        {formData.toBusinessId !== 'ANY' && filteredCustomers.length === 0
                                            ? 'No customers found for selected company'
                                            : 'Specific customer within the destination company'
                                        }
                                    </FormHelperText>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                                    <Select
                                        name="carrierId"
                                        value={formData.carrierId}
                                        label="Carrier"
                                        onChange={handleChange}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        <MenuItem value="ANY" sx={{ fontSize: '12px' }}>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    Any Carrier
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Applies to all available carriers
                                                </Typography>
                                            </Box>
                                        </MenuItem>
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
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        Specific carrier or "Any" for all carriers
                                    </FormHelperText>
                                </FormControl>
                            </Grid>

                            {/* Service & Pricing Configuration */}
                            <Grid item xs={12}>
                                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2, mt: 2 }}>
                                    Service & Pricing Configuration
                                </Typography>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>Service Level</InputLabel>
                                    <Select
                                        name="service"
                                        value={formData.service}
                                        label="Service Level"
                                        onChange={handleChange}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        {serviceTypes.map(service => (
                                            <MenuItem key={service.value} value={service.value} sx={{ fontSize: '12px' }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {service.label}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        {service.description}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        Specific service level or "Any" for all services
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

                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    fullWidth
                                    placeholder="Brief description of this markup rule"
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
                                    Company-to-Company Markups
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: '11px', mt: 1 }}>
                                These markups apply to shipments between specific companies and work alongside carrier markups.
                                Use this for business relationship pricing (e.g., Company A ships to Company B with 15% markup).
                                The markup hierarchy will determine which markups are applied and in what order.
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

export default AddEditCompanyMarkupDialog; 