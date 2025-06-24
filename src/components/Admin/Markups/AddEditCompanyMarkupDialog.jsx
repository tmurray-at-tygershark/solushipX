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
    Typography
} from '@mui/material';
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

const AddEditCompanyMarkupDialog = ({
    open,
    onClose,
    onSave,
    initialData,
    companiesList, // Expecting array of { id, name, customerID (for companyID) }
    customersList, // Expecting array of { id, name, customerID, companyID (links to a company in companiesList) }
    carriersList // Expecting array of { id, name }
}) => {
    const defaultMarkupType = 'PERCENTAGE';

    const [formData, setFormData] = useState({
        fromBusinessId: initialData?.fromBusinessId || (companiesList.length > 0 ? companiesList[0].id : ''),
        toBusinessId: initialData?.toBusinessId || 'ANY',
        customerId: initialData?.customerId || 'ANY', // Specific customer under toBusinessId
        carrierId: initialData?.carrierId || 'ANY',
        service: initialData?.service || 'ANY',
        type: initialData?.type || defaultMarkupType,
        value: initialData?.value || 0,
        effectiveDate: initialData?.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
        expiryDate: initialData?.expiryDate ? dayjs(initialData.expiryDate) : null,
    });
    const [loading, setLoading] = useState(false);
    const [filteredCustomers, setFilteredCustomers] = useState([]);

    const markupTypes = [
        { value: 'PERCENTAGE', label: 'Percentage' },
        { value: 'FIXED_AMOUNT', label: 'Fixed Amount' },
        { value: 'PER_POUND', label: 'Per Pound' },
        { value: 'PER_PACKAGE', label: 'Per Package' }
    ];

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
                    fromBusinessId: initialData.fromBusinessId,
                    toBusinessId: initialData.toBusinessId,
                    customerId: initialData.customerId,
                    carrierId: initialData.carrierId,
                    service: initialData.service,
                    type: initialData.type,
                    value: initialData.value,
                    effectiveDate: initialData.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
                    expiryDate: initialData.expiryDate ? dayjs(initialData.expiryDate) : null,
                    id: initialData.id
                });
            } else {
                setFormData({
                    fromBusinessId: (companiesList.length > 0 ? companiesList[0].id : ''),
                    toBusinessId: 'ANY',
                    customerId: 'ANY',
                    carrierId: 'ANY',
                    service: 'ANY',
                    type: defaultMarkupType,
                    value: 0,
                    effectiveDate: dayjs(),
                    expiryDate: null,
                    id: null
                });
            }
        }
    }, [initialData, open, companiesList]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === "toBusinessId") {
            setFormData(prev => ({ ...prev, customerId: 'ANY' })); // Reset customer if To Company changes
        }
    };

    const handleDateChange = (name, date) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };

    const handleSave = async () => {
        setLoading(true);
        const fromCompany = companiesList.find(c => c.id === formData.fromBusinessId);
        const toCompany = companiesList.find(c => c.id === formData.toBusinessId);
        const customer = filteredCustomers.find(c => c.id === formData.customerId);
        const carrier = carriersList.find(c => c.id === formData.carrierId);

        const saveData = {
            ...formData,
            fromCompanyName: fromCompany?.name || '', // Updated from fromBusinessName
            toCompanyName: formData.toBusinessId === 'ANY' ? 'ANY' : (toCompany?.name || ''), // Updated from toBusinessName
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

    const dialogTitle = formData.id ? 'Edit Company Markup' : 'Add New Company Markup'; // Updated from Business Markup

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                {dialogTitle}
            </DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={6} lg={3}>
                        <FormControl fullWidth required>
                            <InputLabel sx={{ fontSize: '12px' }}>From Company</InputLabel> {/* Updated from From Business */}
                            <Select name="fromBusinessId" value={formData.fromBusinessId} label="From Company" onChange={handleChange} sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}>
                                {companiesList.map(company => (
                                    <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>{company.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <FormControl fullWidth>
                            <InputLabel sx={{ fontSize: '12px' }}>To Company (Optional)</InputLabel> {/* Updated from To Business */}
                            <Select name="toBusinessId" value={formData.toBusinessId} label="To Company" onChange={handleChange} sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}>
                                <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any Company</MenuItem> {/* Updated */}
                                {companiesList.map(company => (
                                    <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>{company.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <FormControl fullWidth disabled={formData.toBusinessId === 'ANY' || filteredCustomers.length === 0}>
                            <InputLabel sx={{ fontSize: '12px' }}>Specific Customer (of To Company)</InputLabel>
                            <Select name="customerId" value={formData.customerId} label="Specific Customer" onChange={handleChange} sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}>
                                <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any Customer</MenuItem>
                                {filteredCustomers.map(cust => (
                                    <MenuItem key={cust.id} value={cust.id} sx={{ fontSize: '12px' }}>{cust.name} ({cust.customerID})</MenuItem>
                                ))}
                            </Select>
                            {formData.toBusinessId !== 'ANY' && filteredCustomers.length === 0 && <Typography variant="caption" color="textSecondary" sx={{ fontSize: '11px' }}>No customers found for selected 'To Company'.</Typography>}
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <FormControl fullWidth>
                            <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                            <Select name="carrierId" value={formData.carrierId} label="Carrier" onChange={handleChange} sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}>
                                <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any Carrier</MenuItem>
                                {carriersList.map(carrier => (
                                    <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>{carrier.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <FormControl fullWidth>
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
                                        {service.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <FormControl fullWidth required>
                            <InputLabel sx={{ fontSize: '12px' }}>Markup Type</InputLabel>
                            <Select name="type" value={formData.type || ''} label="Markup Type" onChange={handleChange} sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}>
                                {markupTypes.map(mt => <MenuItem key={mt.value} value={mt.value} sx={{ fontSize: '12px' }}>{mt.label}</MenuItem>)}
                                {/* Add other types if specific to company markups */}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <TextField label="Value" name="value" type="number" value={formData.value || ''} onChange={handleChange} fullWidth required InputLabelProps={{ sx: { fontSize: '12px' } }} InputProps={{ sx: { fontSize: '12px' } }} />
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="Effective Date"
                                value={formData.effectiveDate}
                                onChange={(date) => handleDateChange('effectiveDate', date)}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: "small",
                                        InputLabelProps: { sx: { fontSize: '12px' } },
                                        InputProps: { sx: { fontSize: '12px' } }
                                    }
                                }}
                            />
                        </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="Expiry Date (Optional)"
                                value={formData.expiryDate}
                                onChange={(date) => handleDateChange('expiryDate', date)}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: "small",
                                        InputLabelProps: { sx: { fontSize: '12px' } },
                                        InputProps: { sx: { fontSize: '12px' } }
                                    }
                                }}
                            />
                        </LocalizationProvider>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading} size="small" sx={{ fontSize: '12px' }}>
                    Cancel
                </Button>
                <Button onClick={handleSave} variant="contained" disabled={loading} size="small" sx={{ fontSize: '12px' }}>
                    {loading ? <CircularProgress size={20} /> : (formData.id ? 'Update' : 'Create')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddEditCompanyMarkupDialog; 