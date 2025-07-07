import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Grid,
    IconButton,
    Alert,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    Close as CloseIcon
} from '@mui/icons-material';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

const QuickShipBrokerDialog = ({
    open,
    onClose,
    onSuccess,
    editingBroker = null,
    existingBrokers = [],
    companyId
}) => {
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Form data state - only company-level information
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        enabled: true
    });

    // Initialize form data when editing
    useEffect(() => {
        if (editingBroker) {
            setFormData({
                name: editingBroker.name || '',
                phone: editingBroker.phone || '',
                email: editingBroker.email || '',
                enabled: editingBroker.enabled !== false
            });
        } else {
            // Reset form for new broker
            setFormData({
                name: '',
                phone: '',
                email: '',
                enabled: true
            });
        }
    }, [editingBroker, open]);

    const validateForm = () => {
        const newErrors = {};

        // Name is required
        if (!formData.name.trim()) {
            newErrors.name = 'Broker name is required';
        } else if (formData.name.length < 2) {
            newErrors.name = 'Broker name must be at least 2 characters';
        }

        // Check for duplicate names (only for new brokers or when name changes)
        const isDuplicateName = existingBrokers.some(broker =>
            broker.name.toLowerCase() === formData.name.toLowerCase() &&
            (!editingBroker || broker.id !== editingBroker.id)
        );
        if (isDuplicateName) {
            newErrors.name = 'A broker with this name already exists';
        }

        // Phone validation (optional but if provided must be valid)
        if (formData.phone && !/^[\d\s\-\+\(\)\.]+$/.test(formData.phone)) {
            newErrors.phone = 'Please enter a valid phone number';
        }

        // Email validation (optional but if provided must be valid)
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const brokerData = {
                name: formData.name.trim(),
                phone: formData.phone.trim() || '',
                email: formData.email.trim() || '',
                enabled: formData.enabled,
                companyID: companyId,
                updatedAt: new Date()
            };

            if (editingBroker) {
                // Update existing broker
                await updateDoc(doc(db, 'companyBrokers', editingBroker.id), brokerData);
                onSuccess({ ...brokerData, id: editingBroker.id }, true);
            } else {
                // Create new broker
                brokerData.createdAt = new Date();
                const docRef = await addDoc(collection(db, 'companyBrokers'), brokerData);
                onSuccess({ ...brokerData, id: docRef.id }, false);
            }

            handleClose();
        } catch (error) {
            console.error('Error saving broker:', error);
            setErrors({
                submit: 'Failed to save broker. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            name: '',
            phone: '',
            email: '',
            enabled: true
        });
        setErrors({});
        onClose();
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear field-specific error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    minHeight: '400px'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e5e7eb',
                pb: 2
            }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
                    {editingBroker ? 'Edit Broker' : 'Add New Broker'}
                </Typography>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ mt: 2 }}>
                {errors.submit && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }}>
                        {errors.submit}
                    </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Broker Name */}
                    <TextField
                        label="Broker Name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        error={!!errors.name}
                        helperText={errors.name}
                        fullWidth
                        required
                        variant="outlined"
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '14px' },
                            '& .MuiInputBase-input': { fontSize: '14px' }
                        }}
                    />

                    {/* Phone Number */}
                    <TextField
                        label="Phone Number"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        error={!!errors.phone}
                        helperText={errors.phone || 'Optional - Default phone number for this broker'}
                        fullWidth
                        variant="outlined"
                        placeholder="e.g., (555) 123-4567"
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '14px' },
                            '& .MuiInputBase-input': { fontSize: '14px' }
                        }}
                    />

                    {/* Email Address */}
                    <TextField
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        error={!!errors.email}
                        helperText={errors.email || 'Optional - Default email address for this broker'}
                        fullWidth
                        variant="outlined"
                        placeholder="e.g., broker@company.com"
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '14px' },
                            '& .MuiInputBase-input': { fontSize: '14px' }
                        }}
                    />

                    {/* Enable/Disable Switch */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        bgcolor: '#f9fafb',
                        borderRadius: 1,
                        border: '1px solid #e5e7eb'
                    }}>
                        <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '14px' }}>
                                Active Status
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                {formData.enabled ? 'This broker is active and available for selection' : 'This broker is disabled and hidden from selection'}
                            </Typography>
                        </Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.enabled}
                                    onChange={(e) => handleInputChange('enabled', e.target.checked)}
                                    color="primary"
                                />
                            }
                            label={formData.enabled ? "Active" : "Disabled"}
                            sx={{
                                '& .MuiFormControlLabel-label': {
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: formData.enabled ? '#059669' : '#dc2626'
                                }
                            }}
                        />
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{
                px: 3,
                py: 2,
                borderTop: '1px solid #e5e7eb',
                gap: 1
            }}>
                <Button
                    onClick={handleClose}
                    variant="outlined"
                    sx={{
                        borderColor: '#d1d5db',
                        color: '#374151',
                        fontSize: '14px',
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: '#9ca3af',
                            bgcolor: '#f9fafb'
                        }
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    sx={{
                        bgcolor: '#3b82f6',
                        fontSize: '14px',
                        textTransform: 'none',
                        '&:hover': {
                            bgcolor: '#2563eb'
                        }
                    }}
                >
                    {loading ? (editingBroker ? 'Updating...' : 'Adding...') : (editingBroker ? 'Update Broker' : 'Add Broker')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuickShipBrokerDialog; 