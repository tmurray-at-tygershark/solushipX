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
    CircularProgress
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
// import { collection, getDocs } from 'firebase/firestore';
// import { db } from '../../../firebase'; // Adjust as needed

const AddEditCarrierMarkupDialog = ({ open, onClose, onSave, initialData, carriersList }) => {
    const defaultMarkupType = 'PERCENTAGE';
    const defaultVariable = 'WEIGHT/SKID';

    const [formData, setFormData] = useState({
        carrierId: initialData?.carrierId || (carriersList.length > 0 ? carriersList[0].id : ''),
        service: initialData?.service || 'ANY',
        type: initialData?.type || defaultMarkupType,
        value: initialData?.value || 0,
        variable: initialData?.variable || defaultVariable,
        fromCountry: initialData?.fromCountry || 'ANY',
        toCountry: initialData?.toCountry || 'ANY',
        fromWeight: initialData?.fromWeight || 0,
        toWeight: initialData?.toWeight || 0,
        effectiveDate: initialData?.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
        expiryDate: initialData?.expiryDate ? dayjs(initialData.expiryDate) : null,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                carrierId: initialData.carrierId || (carriersList.length > 0 ? carriersList[0].id : ''),
                service: initialData.service || 'ANY',
                type: initialData.type || defaultMarkupType,
                value: initialData.value || 0,
                variable: initialData.variable || defaultVariable,
                fromCountry: initialData.fromCountry || 'ANY',
                toCountry: initialData.toCountry || 'ANY',
                fromWeight: initialData.fromWeight || 0,
                toWeight: initialData.toWeight || 0,
                effectiveDate: initialData.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
                expiryDate: initialData.expiryDate ? dayjs(initialData.expiryDate) : null,
                id: initialData.id || null // For editing
            });
        } else {
            // Reset for new entry, ensuring carrierId defaults if carriersList is available
            setFormData({
                carrierId: (carriersList.length > 0 ? carriersList[0].id : ''),
                service: 'ANY',
                type: defaultMarkupType,
                value: 0,
                variable: defaultVariable,
                fromCountry: 'ANY',
                toCountry: 'ANY',
                fromWeight: 0,
                toWeight: 0,
                effectiveDate: dayjs(),
                expiryDate: null,
                id: null
            });
        }
    }, [initialData, open, carriersList]);

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
            value: parseFloat(formData.value) || 0, // Ensure value is a number
            fromWeight: parseFloat(formData.fromWeight) || 0,
            toWeight: parseFloat(formData.toWeight) || 0,
        };
        await onSave(saveData);
        setLoading(false);
        onClose(); // Close dialog after save
    };

    const dialogTitle = formData.id ? 'Edit Carrier Markup' : 'Add New Carrier Markup';

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel>Carrier</InputLabel>
                                <Select name="carrierId" value={formData.carrierId} label="Carrier" onChange={handleChange}>
                                    {carriersList.map(carrier => (
                                        <MenuItem key={carrier.id} value={carrier.id}>{carrier.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Service (e.g., GROUND, ANY)" name="service" value={formData.service} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth required>
                                <InputLabel>Markup Type</InputLabel>
                                <Select name="type" value={formData.type} label="Markup Type" onChange={handleChange}>
                                    <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
                                    <MenuItem value="FLAT_PER_SHIPMENT">Flat per Shipment</MenuItem>
                                    <MenuItem value="FLAT_PER_PACKAGE">Flat per Package</MenuItem>
                                    <MenuItem value="FLAT_PER_POUND">Flat per Pound/Kg</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField label="Value (e.g., 10 for 10% or 5 for $5)" name="value" type="number" value={formData.value} onChange={handleChange} fullWidth required />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth>
                                <InputLabel>Variable (Basis for Markup)</InputLabel>
                                <Select name="variable" value={formData.variable} label="Variable" onChange={handleChange}>
                                    <MenuItem value="WEIGHT/SKID">Weight/Skid</MenuItem>
                                    <MenuItem value="SHIPMENT">Shipment</MenuItem>
                                    <MenuItem value="PACKAGE">Package</MenuItem>
                                    <MenuItem value="POUND">Pound/Kg</MenuItem>
                                    {/* Add other relevant variables */}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="From Country (e.g., CA, US, ANY)" name="fromCountry" value={formData.fromCountry} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="To Country (e.g., CA, US, ANY)" name="toCountry" value={formData.toCountry} onChange={handleChange} fullWidth defaultValue="ANY" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="From Weight (0 for ANY)" name="fromWeight" type="number" value={formData.fromWeight} onChange={handleChange} fullWidth />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField label="To Weight (0 for ANY)" name="toWeight" type="number" value={formData.toWeight} onChange={handleChange} fullWidth />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <DatePicker
                                label="Effective Date"
                                value={formData.effectiveDate}
                                onChange={(newValue) => handleDateChange('effectiveDate', newValue)}
                                renderInput={(params) => <TextField {...params} fullWidth required />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
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

export default AddEditCarrierMarkupDialog; 