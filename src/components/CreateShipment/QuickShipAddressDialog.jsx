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
    Box,
    Typography,
    FormControlLabel,
    Checkbox,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

const QuickShipAddressDialog = ({
    open,
    onClose,
    onSuccess,
    editingAddress = null,
    addressType = 'from', // 'from' or 'to'
    companyId
}) => {
    const [formData, setFormData] = useState({
        addressClass: 'company',
        addressClassID: companyId,
        addressType: addressType === 'from' ? 'pickup' : 'delivery',
        companyName: '',
        nickname: '',
        firstName: '',
        lastName: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        phone: '',
        email: '',
        specialInstructions: '',
        isDefault: false,
        status: 'active'
    });

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Load existing address data when editing
    useEffect(() => {
        if (editingAddress) {
            setFormData({
                ...formData,
                ...editingAddress,
                addressType: addressType === 'from' ? 'pickup' : 'delivery'
            });
        }
    }, [editingAddress, addressType]);

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.companyName) {
            newErrors.companyName = 'Company name is required';
        }
        if (!formData.firstName) {
            newErrors.firstName = 'First name is required';
        }
        if (!formData.lastName) {
            newErrors.lastName = 'Last name is required';
        }
        if (!formData.street) {
            newErrors.street = 'Street address is required';
        }
        if (!formData.city) {
            newErrors.city = 'City is required';
        }
        if (!formData.state) {
            newErrors.state = 'State/Province is required';
        }
        if (!formData.postalCode) {
            newErrors.postalCode = 'Postal code is required';
        }
        if (!formData.phone) {
            newErrors.phone = 'Phone number is required';
        }
        if (!formData.email) {
            newErrors.email = 'Email is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const addressData = {
                ...formData,
                updatedAt: new Date().toISOString()
            };

            if (editingAddress && editingAddress.id) {
                // Update existing address
                await updateDoc(doc(db, 'addressBook', editingAddress.id), addressData);
                onSuccess({ ...addressData, id: editingAddress.id });
            } else {
                // Create new address
                addressData.createdAt = new Date().toISOString();
                const docRef = await addDoc(collection(db, 'addressBook'), addressData);
                onSuccess({ ...addressData, id: docRef.id });
            }

            onClose();
        } catch (error) {
            console.error('Error saving address:', error);
            setErrors({ submit: 'Failed to save address. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const title = editingAddress
        ? `Edit ${addressType === 'from' ? 'Ship From' : 'Ship To'} Address`
        : `Add ${addressType === 'from' ? 'Ship From' : 'Ship To'} Address`;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151'
            }}>
                {title}
                <IconButton onClick={onClose} size="small">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 2 }}>
                {errors.submit && (
                    <Typography color="error" sx={{ mb: 2, fontSize: '12px' }}>
                        {errors.submit}
                    </Typography>
                )}

                <Grid container spacing={2}>
                    {/* Address Nickname */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Address Nickname (Optional)"
                            value={formData.nickname || ''}
                            onChange={(e) => handleChange('nickname', e.target.value)}
                            placeholder="e.g., Main Warehouse"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                    </Grid>

                    {/* Company Name */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Company Name"
                            value={formData.companyName}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            error={!!errors.companyName}
                            helperText={errors.companyName}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* First Name */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="First Name"
                            value={formData.firstName}
                            onChange={(e) => handleChange('firstName', e.target.value)}
                            error={!!errors.firstName}
                            helperText={errors.firstName}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Last Name */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Last Name"
                            value={formData.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            error={!!errors.lastName}
                            helperText={errors.lastName}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Street Address */}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Street Address"
                            value={formData.street}
                            onChange={(e) => handleChange('street', e.target.value)}
                            error={!!errors.street}
                            helperText={errors.street}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Address Line 2 */}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Address Line 2 (Optional)"
                            value={formData.street2 || ''}
                            onChange={(e) => handleChange('street2', e.target.value)}
                            placeholder="Apartment, suite, unit, building, floor, etc."
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                    </Grid>

                    {/* City */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="City"
                            value={formData.city}
                            onChange={(e) => handleChange('city', e.target.value)}
                            error={!!errors.city}
                            helperText={errors.city}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* State/Province */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="State/Province"
                            value={formData.state}
                            onChange={(e) => handleChange('state', e.target.value)}
                            error={!!errors.state}
                            helperText={errors.state}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Postal Code */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Postal Code"
                            value={formData.postalCode}
                            onChange={(e) => handleChange('postalCode', e.target.value)}
                            error={!!errors.postalCode}
                            helperText={errors.postalCode}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Country */}
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small" required>
                            <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                            <Select
                                value={formData.country}
                                onChange={(e) => handleChange('country', e.target.value)}
                                label="Country"
                                sx={{
                                    '& .MuiSelect-select': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            >
                                <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Phone */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Phone"
                            value={formData.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            error={!!errors.phone}
                            helperText={errors.phone}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Email */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            error={!!errors.email}
                            helperText={errors.email}
                            required
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Special Instructions */}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Special Instructions (Optional)"
                            value={formData.specialInstructions || ''}
                            onChange={(e) => handleChange('specialInstructions', e.target.value)}
                            multiline
                            rows={3}
                            placeholder="Enter any special delivery or pickup instructions..."
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                    </Grid>

                    {/* Set as Default - Only for Ship From */}
                    {addressType === 'from' && (
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={formData.isDefault || false}
                                        onChange={(e) => handleChange('isDefault', e.target.checked)}
                                        size="small"
                                    />
                                }
                                label="Set as default pickup address"
                                sx={{
                                    '& .MuiFormControlLabel-label': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                    )}
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    size="small"
                    disabled={loading}
                    sx={{ fontSize: '12px' }}
                >
                    {loading ? 'Saving...' : (editingAddress ? 'Update' : 'Create')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuickShipAddressDialog; 