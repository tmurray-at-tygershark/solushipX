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

const AddEditBusinessMarkupDialog = ({
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

    useEffect(() => {
        const toBusiness = companiesList.find(c => c.id === formData.toBusinessId);
        const companyIDForFiltering = toBusiness?.customerID; // Assuming company's own customerID field is used like a company code

        if (formData.toBusinessId && formData.toBusinessId !== 'ANY' && companyIDForFiltering) {
            setFilteredCustomers(customersList.filter(cust => cust.companyID === companyIDForFiltering));
        } else {
            setFilteredCustomers([]); // No specific company selected or company has no customerID, so no customers to filter
        }
    }, [formData.toBusinessId, customersList, companiesList]);


    useEffect(() => {
        if (open) { // Reset/initialize form when dialog opens
            if (initialData) {
                setFormData({
                    fromBusinessId: initialData.fromBusinessId || (companiesList.length > 0 ? companiesList[0].id : ''),
                    toBusinessId: initialData.toBusinessId || 'ANY',
                    customerId: initialData.customerId || 'ANY',
                    carrierId: initialData.carrierId || 'ANY',
                    service: initialData.service || 'ANY',
                    type: initialData.type || defaultMarkupType,
                    value: initialData.value || 0,
                    effectiveDate: initialData.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
                    expiryDate: initialData.expiryDate ? dayjs(initialData.expiryDate) : null,
                    id: initialData.id || null // For editing
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
            setFormData(prev => ({ ...prev, customerId: 'ANY' })); // Reset customer if To Business changes
        }
    };

    const handleDateChange = (name, date) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };

    const handleSave = async () => {
        setLoading(true);
        const fromBusiness = companiesList.find(c => c.id === formData.fromBusinessId);
        const toBusiness = companiesList.find(c => c.id === formData.toBusinessId);
        const customer = filteredCustomers.find(c => c.id === formData.customerId);
        const carrier = carriersList.find(c => c.id === formData.carrierId);

        const saveData = {
            ...formData,
            fromBusinessName: fromBusiness?.name || '',
            toBusinessName: formData.toBusinessId === 'ANY' ? 'ANY' : (toBusiness?.name || ''),
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

    const dialogTitle = formData.id ? 'Edit Business Markup' : 'Add New Business Markup';

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6} lg={3}>
                            <FormControl fullWidth required>
                                <InputLabel>From Business</InputLabel>
                                <Select name="fromBusinessId" value={formData.fromBusinessId} label="From Business" onChange={handleChange}>
                                    {companiesList.map(comp => (
                                        <MenuItem key={comp.id} value={comp.id}>{comp.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <FormControl fullWidth>
                                <InputLabel>To Business (Target)</InputLabel>
                                <Select name="toBusinessId" value={formData.toBusinessId} label="To Business (Target)" onChange={handleChange}>
                                    <MenuItem value="ANY">Any Business</MenuItem>
                                    {companiesList.map(comp => (
                                        <MenuItem key={comp.id} value={comp.id}>{comp.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <FormControl fullWidth disabled={formData.toBusinessId === 'ANY' || filteredCustomers.length === 0}>
                                <InputLabel>Specific Customer (of To Business)</InputLabel>
                                <Select name="customerId" value={formData.customerId} label="Specific Customer" onChange={handleChange}>
                                    <MenuItem value="ANY">Any Customer</MenuItem>
                                    {filteredCustomers.map(cust => (
                                        <MenuItem key={cust.id} value={cust.id}>{cust.name} ({cust.customerID})</MenuItem>
                                    ))}
                                </Select>
                                {formData.toBusinessId !== 'ANY' && filteredCustomers.length === 0 && <Typography variant="caption" color="textSecondary">No customers found for selected 'To Business'.</Typography>}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <FormControl fullWidth>
                                <InputLabel>Carrier</InputLabel>
                                <Select name="carrierId" value={formData.carrierId} label="Carrier" onChange={handleChange}>
                                    <MenuItem value="ANY">Any Carrier</MenuItem>
                                    {carriersList.map(carrier => (
                                        <MenuItem key={carrier.id} value={carrier.id}>{carrier.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <TextField label="Service (e.g., GROUND, ANY)" name="service" value={formData.service} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <FormControl fullWidth required>
                                <InputLabel>Markup Type</InputLabel>
                                <Select name="type" value={formData.type} label="Markup Type" onChange={handleChange}>
                                    <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
                                    <MenuItem value="FLAT_FEE">Flat Fee</MenuItem>
                                    {/* Add other types if specific to business markups */}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <TextField label="Value (e.g., 10 for 10% or 5 for $5)" name="value" type="number" value={formData.value} onChange={handleChange} fullWidth required />
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <DatePicker
                                label="Effective Date"
                                value={formData.effectiveDate}
                                onChange={(newValue) => handleDateChange('effectiveDate', newValue)}
                                renderInput={(params) => <TextField {...params} fullWidth required />}
                            />
                        </Grid>
                        <Grid item xs={12} md={6} lg={3} /> {/* Spacer */}
                        <Grid item xs={12} md={6} lg={3}>
                            <DatePicker
                                label="Expiry Date (Optional)"
                                value={formData.expiryDate}
                                onChange={(newValue) => handleDateChange('expiryDate', newValue)}
                                renderInput={(params) => <TextField {...params} fullWidth />}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" color="primary" disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : (formData.id ? 'Save Changes' : 'Add Markup')}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default AddEditBusinessMarkupDialog; 