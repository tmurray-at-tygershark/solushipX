import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Box,
    Typography,
    Grid,
    Alert,
    CircularProgress,
    IconButton,
    Chip,
    Autocomplete
} from '@mui/material';
import {
    Close as CloseIcon,
    List as ListIcon,
    Category as CategoryIcon
} from '@mui/icons-material';

const ShipmentStatusDialog = ({ open, mode, data, masterStatuses, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        masterStatus: '',
        statusLabel: '',
        statusMeaning: '',
        enabled: true
    });
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);

    // Initialize form data when dialog opens or data changes
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && data) {
                setFormData({
                    masterStatus: data.masterStatus || '',
                    statusLabel: data.statusLabel || '',
                    statusMeaning: data.statusMeaning || '',
                    enabled: data.enabled !== undefined ? data.enabled : true
                });
            } else {
                setFormData({
                    masterStatus: '',
                    statusLabel: '',
                    statusMeaning: '',
                    enabled: true
                });
            }
            setFormErrors({});
        }
    }, [open, mode, data]);

    // Form validation
    const validateForm = () => {
        const errors = {};

        if (!formData.masterStatus) {
            errors.masterStatus = 'Master status is required';
        }

        if (!formData.statusLabel.trim()) {
            errors.statusLabel = 'Status label is required';
        } else if (formData.statusLabel.length < 2) {
            errors.statusLabel = 'Status label must be at least 2 characters';
        } else if (formData.statusLabel.length > 100) {
            errors.statusLabel = 'Status label must be less than 100 characters';
        }

        if (!formData.statusMeaning.trim()) {
            errors.statusMeaning = 'Status meaning is required';
        } else if (formData.statusMeaning.length < 10) {
            errors.statusMeaning = 'Status meaning must be at least 10 characters';
        } else if (formData.statusMeaning.length > 300) {
            errors.statusMeaning = 'Status meaning must be less than 300 characters';
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

    // Handle save
    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setSaving(true);
        try {
            await onSave(formData);
        } catch (error) {
            console.error('Error saving shipment status:', error);
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

    // Get selected master status data
    const getSelectedMasterStatus = () => {
        return masterStatuses.find(ms => ms.id === formData.masterStatus);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
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
                    <ListIcon sx={{ fontSize: 20, color: '#6366f1' }} />
                    {mode === 'create' ? 'Create Shipment Status' : 'Edit Shipment Status'}
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={saving}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                    {/* Master Status Selection */}
                    <Grid item xs={12}>
                        <Autocomplete
                            value={getSelectedMasterStatus() || null}
                            onChange={(event, newValue) => {
                                handleInputChange('masterStatus', newValue ? newValue.id : '');
                            }}
                            options={masterStatuses.filter(ms => ms.enabled)}
                            getOptionLabel={(option) => option.displayLabel || option.label}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Master Status"
                                    error={!!formErrors.masterStatus}
                                    helperText={formErrors.masterStatus || 'Select the master status category'}
                                    required
                                    size="small"
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    InputProps={{
                                        ...params.InputProps,
                                        sx: { fontSize: '12px' }
                                    }}
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                />
                            )}
                            renderOption={(props, option) => (
                                <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        <Box
                                            sx={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                backgroundColor: option.color || '#6b7280',
                                                border: '1px solid #e5e7eb'
                                            }}
                                        />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                {option.displayLabel || option.label}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {option.description}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                            size="small"
                            fullWidth
                        />
                    </Grid>

                    {/* Status Label */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Status Label"
                            value={formData.statusLabel}
                            onChange={(e) => handleInputChange('statusLabel', e.target.value)}
                            error={!!formErrors.statusLabel}
                            helperText={formErrors.statusLabel || 'Enter the specific status label (e.g., "In Customs Clearance")'}
                            fullWidth
                            size="small"
                            required
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Enabled Toggle */}
                    <Grid item xs={12} md={6}>
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

                    {/* Status Meaning */}
                    <Grid item xs={12}>
                        <TextField
                            label="Status Meaning"
                            value={formData.statusMeaning}
                            onChange={(e) => handleInputChange('statusMeaning', e.target.value)}
                            error={!!formErrors.statusMeaning}
                            helperText={formErrors.statusMeaning || 'Describe what this status means to customers (e.g., "Your shipment is at border customs inspection")'}
                            fullWidth
                            multiline
                            rows={4}
                            size="small"
                            required
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Preview */}
                    <Grid item xs={12}>
                        <Box sx={{
                            p: 3,
                            border: '1px solid #e5e7eb',
                            borderRadius: 1,
                            backgroundColor: '#f8fafc'
                        }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 2 }}>
                                Preview
                            </Typography>

                            {/* Master Status Display */}
                            {getSelectedMasterStatus() && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 0.5 }}>
                                        Master Status:
                                    </Typography>
                                    <Chip
                                        label={getSelectedMasterStatus().displayLabel || getSelectedMasterStatus().label}
                                        size="small"
                                        sx={{
                                            fontSize: '11px',
                                            backgroundColor: getSelectedMasterStatus().color + '20',
                                            color: getSelectedMasterStatus().color,
                                            border: `1px solid ${getSelectedMasterStatus().color}40`
                                        }}
                                    />
                                </Box>
                            )}

                            {/* Status Label Display */}
                            <Box sx={{ mb: 2 }}>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 0.5 }}>
                                    Status:
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ListIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        {formData.statusLabel || 'Status Label'}
                                    </Typography>
                                    {!formData.enabled && (
                                        <Chip label="Disabled" size="small" color="default" sx={{ fontSize: '10px' }} />
                                    )}
                                </Box>
                            </Box>

                            {/* Status Meaning Display */}
                            <Box>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 0.5 }}>
                                    Customer Message:
                                </Typography>
                                <Typography sx={{ fontSize: '12px', fontStyle: 'italic', color: '#374151' }}>
                                    "{formData.statusMeaning || 'Status meaning will appear here for customers'}"
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Master Status Info */}
                    {getSelectedMasterStatus() && (
                        <Grid item xs={12}>
                            <Alert severity="info" sx={{ fontSize: '11px' }}>
                                <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 0.5 }}>
                                    Master Status Information:
                                </Typography>
                                <Typography sx={{ fontSize: '11px' }}>
                                    <strong>Description:</strong> {getSelectedMasterStatus().description}
                                </Typography>
                                <Typography sx={{ fontSize: '11px' }}>
                                    <strong>Sort Order:</strong> {getSelectedMasterStatus().sortOrder || 0}
                                </Typography>
                            </Alert>
                        </Grid>
                    )}
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

export default ShipmentStatusDialog; 