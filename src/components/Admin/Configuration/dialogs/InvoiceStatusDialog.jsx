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
    Tooltip,
    Popover
} from '@mui/material';
import {
    Close as CloseIcon,
    Receipt as ReceiptIcon,
    ColorLens as ColorIcon
} from '@mui/icons-material';
import { HexColorPicker } from 'react-colorful';

// Common color options for invoice statuses
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

// Font color options
const FONT_COLORS = [
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#000000' },
    { name: 'Dark Gray', value: '#374151' },
    { name: 'Light Gray', value: '#9ca3af' }
];

const InvoiceStatusDialog = ({ open, mode, data, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        statusLabel: '',
        statusDescription: '',
        color: '#6b7280',
        fontColor: '#ffffff',
        sortOrder: 0,
        enabled: true
    });
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [colorPickerAnchor, setColorPickerAnchor] = useState(null);
    const [activeColorField, setActiveColorField] = useState(null); // 'background' or 'font'
    // Initialize form data when dialog opens or data changes
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && data) {
                setFormData({
                    statusLabel: data.statusLabel || '',
                    statusDescription: data.statusDescription || '',
                    color: data.color || '#6b7280',
                    fontColor: data.fontColor || '#ffffff',
                    sortOrder: data.sortOrder || 0,
                    enabled: data.enabled !== undefined ? data.enabled : true
                });
            } else {
                setFormData({
                    statusLabel: '',
                    statusDescription: '',
                    color: '#6b7280',
                    fontColor: '#ffffff',
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

        if (!formData.statusLabel.trim()) {
            errors.statusLabel = 'Status label is required';
        } else if (formData.statusLabel.length < 2) {
            errors.statusLabel = 'Status label must be at least 2 characters';
        } else if (formData.statusLabel.length > 50) {
            errors.statusLabel = 'Status label must be less than 50 characters';
        }

        if (formData.statusDescription && formData.statusDescription.length > 200) {
            errors.statusDescription = 'Description must be less than 200 characters';
        }

        if (formData.sortOrder < 0 || formData.sortOrder > 999) {
            errors.sortOrder = 'Sort order must be between 0 and 999';
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

    // Handle color picker open
    const handleColorPickerOpen = (event, field) => {
        setColorPickerAnchor(event.currentTarget);
        setActiveColorField(field);
    };

    // Handle color picker close
    const handleColorPickerClose = () => {
        setColorPickerAnchor(null);
        setActiveColorField(null);
    };

    // Handle color selection from picker
    const handleColorSelect = (color) => {
        if (activeColorField === 'background') {
            handleInputChange('color', color);
        } else if (activeColorField === 'font') {
            handleInputChange('fontColor', color);
        }
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
            console.error('Error saving invoice status:', error);
        } finally {
            setSaving(false);
        }
    };

    // Handle close
    const handleClose = () => {
        if (!saving) {
            handleColorPickerClose();
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '12px',
                    maxHeight: '90vh'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151',
                borderBottom: '1px solid #e5e7eb',
                pb: 2
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ReceiptIcon sx={{ fontSize: 20, color: '#6366f1' }} />
                    {mode === 'create' ? 'Create Invoice Status' : 'Edit Invoice Status'}
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={saving}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                    {/* Status Label */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Status Label"
                            value={formData.statusLabel}
                            onChange={(e) => handleInputChange('statusLabel', e.target.value)}
                            error={!!formErrors.statusLabel}
                            helperText={formErrors.statusLabel || 'Enter the status label (e.g., "Invoiced", "Paid")'}
                            fullWidth
                            size="small"
                            required
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Sort Order */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Sort Order"
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
                            error={!!formErrors.sortOrder}
                            helperText={formErrors.sortOrder || 'Order for display (0-999)'}
                            fullWidth
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Status Description */}
                    <Grid item xs={12}>
                        <TextField
                            label="Description"
                            value={formData.statusDescription}
                            onChange={(e) => handleInputChange('statusDescription', e.target.value)}
                            error={!!formErrors.statusDescription}
                            helperText={formErrors.statusDescription || 'Optional description of this invoice status'}
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Background Color Selection */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                            Background Color
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {STATUS_COLORS.map((colorOption) => (
                                <Tooltip key={colorOption.value} title={colorOption.name}>
                                    <Box
                                        onClick={() => handleInputChange('color', colorOption.value)}
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                                onClick={(event) => handleColorPickerOpen(event, 'background')}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: formData.color,
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '&:hover': {
                                        border: '2px solid #6366f1'
                                    }
                                }}
                            >
                                <ColorIcon sx={{ fontSize: 16, color: formData.fontColor }} />
                            </Box>
                            <TextField
                                label="Custom Background Color (Hex)"
                                value={formData.color}
                                onChange={(e) => handleInputChange('color', e.target.value)}
                                size="small"
                                sx={{ flex: 1 }}
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
                        </Box>
                    </Grid>

                    {/* Font Color Selection */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                            Text Color
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {FONT_COLORS.map((colorOption) => (
                                <Tooltip key={colorOption.value} title={colorOption.name}>
                                    <Box
                                        onClick={() => handleInputChange('fontColor', colorOption.value)}
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 1,
                                            backgroundColor: colorOption.value,
                                            cursor: 'pointer',
                                            border: formData.fontColor === colorOption.value
                                                ? '3px solid #111827'
                                                : '2px solid #e5e7eb',
                                            '&:hover': {
                                                transform: 'scale(1.1)',
                                                transition: 'all 0.2s'
                                            },
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Typography sx={{
                                            fontSize: '12px',
                                            color: colorOption.value === '#ffffff' ? '#000000' : '#ffffff',
                                            fontWeight: 'bold'
                                        }}>
                                            Aa
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                                onClick={(event) => handleColorPickerOpen(event, 'font')}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: formData.fontColor,
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '&:hover': {
                                        border: '2px solid #6366f1'
                                    }
                                }}
                            >
                                <Typography sx={{
                                    fontSize: '16px',
                                    color: formData.color,
                                    fontWeight: 'bold'
                                }}>
                                    Aa
                                </Typography>
                            </Box>
                            <TextField
                                label="Custom Text Color (Hex)"
                                value={formData.fontColor}
                                onChange={(e) => handleInputChange('fontColor', e.target.value)}
                                size="small"
                                sx={{ flex: 1 }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{
                                    sx: { fontSize: '12px' },
                                    startAdornment: (
                                        <Box
                                            sx={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: '50%',
                                                backgroundColor: formData.fontColor,
                                                border: '1px solid #e5e7eb',
                                                mr: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Typography sx={{
                                                fontSize: '10px',
                                                color: formData.fontColor === '#ffffff' ? '#000000' : '#ffffff',
                                                fontWeight: 'bold'
                                            }}>
                                                Aa
                                            </Typography>
                                        </Box>
                                    )
                                }}
                            />
                        </Box>
                    </Grid>

                    {/* Enabled Toggle */}
                    <Grid item xs={12}>
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
                    </Grid>

                    {/* Preview */}
                    <Grid item xs={12}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#374151' }}>
                            Preview
                        </Typography>
                        <Box sx={{
                            p: 2,
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            backgroundColor: '#f8fafc'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 0.5,
                                        backgroundColor: formData.color,
                                        color: formData.fontColor,
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 500
                                    }}
                                >
                                    {formData.statusLabel || 'Status Label'}
                                </Box>
                                {!formData.enabled && (
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                        (Disabled)
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Grid>
                </Grid>

                {/* Color Picker Popover */}
                <Popover
                    open={Boolean(colorPickerAnchor)}
                    anchorEl={colorPickerAnchor}
                    onClose={handleColorPickerClose}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    PaperProps={{
                        sx: {
                            p: 2,
                            borderRadius: 2,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                            {activeColorField === 'background' ? 'Background Color' : 'Text Color'}
                        </Typography>
                        <HexColorPicker
                            color={activeColorField === 'background' ? formData.color : formData.fontColor}
                            onChange={handleColorSelect}
                            style={{ width: '200px', height: '200px' }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                {activeColorField === 'background' ? formData.color : formData.fontColor}
                            </Typography>
                            <Button
                                size="small"
                                onClick={handleColorPickerClose}
                                sx={{ fontSize: '11px' }}
                            >
                                Done
                            </Button>
                        </Box>
                    </Box>
                </Popover>
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

export default InvoiceStatusDialog; 