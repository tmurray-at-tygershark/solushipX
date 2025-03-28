import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
} from '@mui/material';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';

const CompanyForm = ({ company, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        status: 'active',
        type: 'customer',
        notes: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (company) {
            setFormData({
                name: company.name || '',
                email: company.email || '',
                phone: company.phone || '',
                address: company.address || '',
                city: company.city || '',
                state: company.state || '',
                zipCode: company.zipCode || '',
                country: company.country || '',
                status: company.status || 'active',
                type: company.type || 'customer',
                notes: company.notes || '',
            });
        }
    }, [company]);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Company name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        }
        if (!formData.address.trim()) {
            newErrors.address = 'Address is required';
        }
        if (!formData.city.trim()) {
            newErrors.city = 'City is required';
        }
        if (!formData.state.trim()) {
            newErrors.state = 'State is required';
        }
        if (!formData.zipCode.trim()) {
            newErrors.zipCode = 'ZIP code is required';
        }
        if (!formData.country.trim()) {
            newErrors.country = 'Country is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setLoading(true);
            const companyData = {
                ...formData,
                updatedAt: new Date(),
            };

            if (company) {
                // Update existing company
                await updateDoc(doc(db, 'companies', company.id), companyData);
            } else {
                // Create new company
                companyData.createdAt = new Date();
                await addDoc(collection(db, 'companies'), companyData);
            }

            onSubmit();
        } catch (error) {
            console.error('Error saving company:', error);
            setErrors(prev => ({
                ...prev,
                submit: 'Error saving company. Please try again.'
            }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} className="company-form">
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Company Name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        error={!!errors.name}
                        helperText={errors.name}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        error={!!errors.email}
                        helperText={errors.email}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        error={!!errors.phone}
                        helperText={errors.phone}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.type}>
                        <InputLabel>Company Type</InputLabel>
                        <Select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            label="Company Type"
                        >
                            <MenuItem value="customer">Customer</MenuItem>
                            <MenuItem value="vendor">Vendor</MenuItem>
                            <MenuItem value="partner">Partner</MenuItem>
                        </Select>
                        {errors.type && (
                            <FormHelperText>{errors.type}</FormHelperText>
                        )}
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        error={!!errors.address}
                        helperText={errors.address}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        label="City"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        error={!!errors.city}
                        helperText={errors.city}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        label="State"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        error={!!errors.state}
                        helperText={errors.state}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        label="ZIP Code"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleChange}
                        error={!!errors.zipCode}
                        helperText={errors.zipCode}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Country"
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        error={!!errors.country}
                        helperText={errors.country}
                        required
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.status}>
                        <InputLabel>Status</InputLabel>
                        <Select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            label="Status"
                        >
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                            <MenuItem value="suspended">Suspended</MenuItem>
                        </Select>
                        {errors.status && (
                            <FormHelperText>{errors.status}</FormHelperText>
                        )}
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Notes"
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        multiline
                        rows={4}
                    />
                </Grid>
            </Grid>
        </Box>
    );
};

export default CompanyForm; 