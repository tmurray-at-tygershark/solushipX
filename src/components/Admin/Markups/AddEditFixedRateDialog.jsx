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

// Reusing similar types from carrier markups, can be expanded
const markupTypes = [
    { value: 'FLAT_FEE_SHIPMENT', label: 'Flat Fee per Shipment' },
    { value: 'FLAT_FEE_PACKAGE', label: 'Flat Fee per Package' },
    { value: 'FLAT_FEE_POUND', label: 'Flat Fee per Pound/Kg' },
    { value: 'PERCENTAGE', label: 'Percentage of Base Rate (%)' },
];

const variables = [
    { value: 'SHIPMENT', label: 'Per Shipment' },
    { value: 'PACKAGE', label: 'Per Package' },
    { value: 'POUND', label: 'Per Pound/Kg' },
    { value: 'WEIGHT_TIER', label: 'Weight Tier' },
];

const AddEditFixedRateDialog = ({ open, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);

    const initializeState = () => ({
        service: initialData?.service || 'ANY',
        type: initialData?.type || markupTypes[0].value,
        value: initialData?.value || 0,
        variable: initialData?.variable || variables[0].value,
        fromCity: initialData?.fromCity || '',
        fromCountry: initialData?.fromCountry || 'CA',
        fromStateProv: initialData?.fromStateProv || '',
        toCity: initialData?.toCity || '',
        toCountry: initialData?.toCountry || 'CA',
        toStateProv: initialData?.toStateProv || '',
        fromWeight: initialData?.fromWeight || 0,
        toWeight: initialData?.toWeight || 0,
        effectiveDate: initialData?.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
        expiryDate: initialData?.expiryDate ? dayjs(initialData.expiryDate) : null,
        id: initialData?.id || null,
    });

    useEffect(() => {
        if (open) {
            setFormData(initializeState());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, open]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (name, date) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };

    const handleSave = async () => {
        setLoading(true);
        const saveData = {
            ...formData,
            effectiveDate: formData.effectiveDate ? formData.effectiveDate.toISOString() : null,
            expiryDate: formData.expiryDate ? formData.expiryDate.toISOString() : null,
            value: parseFloat(formData.value) || 0,
            fromWeight: parseFloat(formData.fromWeight) || 0,
            toWeight: parseFloat(formData.toWeight) || 0,
        };
        await onSave(saveData);
        setLoading(false);
        onClose();
    };

    const dialogTitle = formData.id ? 'Edit Fixed Rate' : 'Add New Fixed Rate';

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="Service (e.g., STANDARD, EXPRESS, ANY)" name="service" value={formData.service || ''} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth required>
                                <InputLabel>Rate Type</InputLabel>
                                <Select name="type" value={formData.type || ''} label="Rate Type" onChange={handleChange}>
                                    {markupTypes.map(mt => <MenuItem key={mt.value} value={mt.value}>{mt.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="Value" name="value" type="number" value={formData.value || ''} onChange={handleChange} fullWidth required />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Variable (Basis for Rate)</InputLabel>
                                <Select name="variable" value={formData.variable || ''} label="Variable" onChange={handleChange}>
                                    {variables.map(v => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}><Typography variant="subtitle2" sx={{ mt: 1, color: 'text.secondary' }}>Origin</Typography></Grid>
                        <Grid item xs={12} sm={4} md={4}>
                            <TextField label="From City (or ANY)" name="fromCity" value={formData.fromCity || ''} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={4} md={4}>
                            <TextField label="From State/Province (e.g., ON, NY, ANY)" name="fromStateProv" value={formData.fromStateProv || ''} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={4} md={4}>
                            <TextField label="From Country (e.g., CA, US, ANY)" name="fromCountry" value={formData.fromCountry || ''} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>

                        <Grid item xs={12}><Typography variant="subtitle2" sx={{ mt: 1, color: 'text.secondary' }}>Destination</Typography></Grid>
                        <Grid item xs={12} sm={4} md={4}>
                            <TextField label="To City (or ANY)" name="toCity" value={formData.toCity || ''} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={4} md={4}>
                            <TextField label="To State/Province (e.g., ON, NY, ANY)" name="toStateProv" value={formData.toStateProv || ''} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={4} md={4}>
                            <TextField label="To Country (e.g., CA, US, ANY)" name="toCountry" value={formData.toCountry || ''} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>

                        <Grid item xs={12}><Typography variant="subtitle2" sx={{ mt: 1, color: 'text.secondary' }}>Weight & Dates</Typography></Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="Min Weight (0 for ANY)" name="fromWeight" type="number" value={formData.fromWeight || ''} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="Max Weight (0 for ANY)" name="toWeight" type="number" value={formData.toWeight || ''} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker
                                label="Effective Date"
                                value={formData.effectiveDate}
                                onChange={(newValue) => handleDateChange('effectiveDate', newValue)}
                                renderInput={(params) => <TextField {...params} fullWidth required />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
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
                        {loading ? <CircularProgress size={24} /> : (formData.id ? 'Save Changes' : 'Add Fixed Rate')}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default AddEditFixedRateDialog; 