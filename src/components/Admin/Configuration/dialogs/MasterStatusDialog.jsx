import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControlLabel,
    Switch,
    Box,
    Typography,
    Grid,
    Alert,
    CircularProgress,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Close as CloseIcon,
    ColorLens as ColorIcon,
    Palette as PaletteIcon
} from '@mui/icons-material';

// Common color options for status
const STATUS_COLORS = [
    { name: 'Gray', value: '#6b7280' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Teal', value: '#14b8a6' }
];

const MasterStatusDialog = ({ open, mode, data, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        label: '',
        description: '',
        color: '#6b7280',
        sortOrder: 0,
        enabled: true
    });
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);

    // Initialize form data when dialog opens or data changes
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && data) {
                setFormData({
                    label: data.displayLabel || data.label || '',
                    description: data.description || '',
                    color: data.color || '#6b7280',
                    sortOrder: data.sortOrder || 0,
                    enabled: data.enabled !== undefined ? data.enabled : true
                });
            } else {
                setFormData({
                    label: '',
                    description: '',
                    color: '#6b7280',
                    sortOrder: 0,
                    enabled: true
                });
            }
            setFormErrors({});
        }
    }, [open, mode, data]);

    // Form validation
    const validateForm = () => {
        const errors = {};

        if (!formData.label.trim()) {
            errors.label = 'Status label is required';
        } else if (formData.label.length < 2) {
            errors.label = 'Status label must be at least 2 characters';
        } else if (formData.label.length > 50) {
            errors.label = 'Status label must be less than 50 characters';
        }

        if (!formData.description.trim()) {
            errors.description = 'Description is required';
        } else if (formData.description.length < 5) {
            errors.description = 'Description must be at least 5 characters';
        } else if (formData.description.length > 200) {
            errors.description = 'Description must be less than 200 characters';
        }

        if (formData.sortOrder < 0 || formData.sortOrder > 1000) {
            errors.sortOrder = 'Sort order must be between 0 and 1000';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle form input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error for this field
        if (formErrors[field]) {
            setFormErrors(prev => ({
                ...prev,
                [field]: null
            }));
        }
    };

    // Handle color selection
    const handleColorSelect = (color) => {
        handleInputChange('color', color);
    };

    // Handle save
    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setSaving(true);
        try {
            await onSave(formData);
        } catch (error) {
            console.error('Error saving master status:', error);
        } finally {
            setSaving(false);
        }
    };

    // Handle close
    const handleClose = () => {
        if (!saving) {
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ColorIcon sx={{ fontSize: 20, color: '#6366f1' }} />
                    {mode === 'create' ? 'Create Master Status' : 'Edit Master Status'}
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={saving}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                    {/* Status Label */}
                    <Grid item xs={12}>
                        <TextField
                            label="Status Label"
                            value={formData.label}
                            onChange={(e) => handleInputChange('label', e.target.value)}
                            error={!!formErrors.label}
                            helperText={formErrors.label || 'Enter the master status label (e.g., "In Transit", "Completed")'}
                            fullWidth
                            size="small"
                            required
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Description */}
                    <Grid item xs={12}>
                        <TextField
                            label="Description"
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            error={!!formErrors.description}
                            helperText={formErrors.description || 'Describe what this master status represents'}
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            required
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Color Selection */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                            Status Color
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {STATUS_COLORS.map((colorOption) => (
                                <Tooltip key={colorOption.value} title={colorOption.name}>
                                    <Box
                                        onClick={() => handleColorSelect(colorOption.value)}
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 1,
                                            backgroundColor: colorOption.value,
                                            cursor: 'pointer',
                                            border: formData.color === colorOption.value
                                                ? '3px solid #111827'
                                                : '2px solid #e5e7eb',
                                            '&:hover': {
                                                transform: 'scale(1.1)',
                                                transition: 'all 0.2s'
                                            }
                                        }}
                                    />
                                </Tooltip>
                            ))}
                        </Box>
                        <TextField
                            label="Custom Color (Hex)"
                            value={formData.color}
                            onChange={(e) => handleInputChange('color', e.target.value)}
                            size="small"
                            sx={{ mt: 2, minWidth: 150 }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{
                                sx: { fontSize: '12px' },
                                startAdornment: (
                                    <Box
                                        sx={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            backgroundColor: formData.color,
                                            border: '1px solid #e5e7eb',
                                            mr: 1
                                        }}
                                    />
                                )
                            }}
                        />
                    </Grid>

                    {/* Sort Order */}
                    <Grid item xs={6}>
                        <TextField
                            label="Sort Order"
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
                            error={!!formErrors.sortOrder}
                            helperText={formErrors.sortOrder || 'Display order (0-1000)'}
                            fullWidth
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{
                                sx: { fontSize: '12px' },
                                inputProps: { min: 0, max: 1000 }
                            }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Enabled Toggle */}
                    <Grid item xs={6}>
                        <Box sx={{ pt: 1 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.enabled}
                                        onChange={(e) => handleInputChange('enabled', e.target.checked)}
                                        color="primary"
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {formData.enabled ? 'Enabled' : 'Disabled'}
                                    </Typography>
                                }
                            />
                        </Box>
                    </Grid>

                    {/* Preview */}
                    <Grid item xs={12}>
                        <Box sx={{
                            p: 2,
                            border: '1px solid #e5e7eb',
                            borderRadius: 1,
                            backgroundColor: '#f8fafc'
                        }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                Preview
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        backgroundColor: formData.color,
                                        border: '1px solid #e5e7eb'
                                    }}
                                />
                                <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    {formData.label || 'Master Status Label'}
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                                {formData.description || 'Master status description will appear here'}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb', gap: 1 }}>
                <Button
                    onClick={handleClose}
                    disabled={saving}
                    size="small"
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving}
                    size="small"
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                    startIcon={saving && <CircularProgress size={16} />}
                >
                    {saving ? 'Saving...' : (mode === 'create' ? 'Create' : 'Update')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MasterStatusDialog; 