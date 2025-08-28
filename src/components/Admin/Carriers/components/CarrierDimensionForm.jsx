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
    Typography,
    Box,
    Grid,
    Switch,
    FormControlLabel,
    Alert
} from '@mui/material';
import {
    Close as CloseIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const CarrierDimensionForm = ({ open, onClose, onSuccess, carrier, editingRule }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        restrictionType: 'max_individual',
        maxLength: '',
        maxWidth: '',
        maxHeight: '',
        dimensionUnit: 'in',
        description: '',
        enabled: true
    });
    const [errors, setErrors] = useState({});

    // Cloud functions
    const createCarrierDimensionRule = httpsCallable(functions, 'createCarrierDimensionRule');
    const updateCarrierDimensionRule = httpsCallable(functions, 'updateCarrierDimensionRule');

    // Initialize form data when editing
    useEffect(() => {
        if (editingRule) {
            setFormData({
                restrictionType: editingRule.restrictionType || 'max_individual',
                maxLength: editingRule.maxLength || '',
                maxWidth: editingRule.maxWidth || '',
                maxHeight: editingRule.maxHeight || '',
                dimensionUnit: editingRule.dimensionUnit || 'in',
                description: editingRule.description || '',
                enabled: editingRule.enabled !== false
            });
        } else {
            setFormData({
                restrictionType: 'max_individual',
                maxLength: '',
                maxWidth: '',
                maxHeight: '',
                dimensionUnit: 'in',
                description: '',
                enabled: true
            });
        }
        setErrors({});
    }, [editingRule, open]);

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: null
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // At least one dimension is required
        if (!formData.maxLength && !formData.maxWidth && !formData.maxHeight) {
            newErrors.dimensions = 'At least one dimension limit is required';
        }

        // Validate dimension values
        if (formData.maxLength && (isNaN(formData.maxLength) || Number(formData.maxLength) <= 0)) {
            newErrors.maxLength = 'Must be a valid positive number';
        }

        if (formData.maxWidth && (isNaN(formData.maxWidth) || Number(formData.maxWidth) <= 0)) {
            newErrors.maxWidth = 'Must be a valid positive number';
        }

        if (formData.maxHeight && (isNaN(formData.maxHeight) || Number(formData.maxHeight) <= 0)) {
            newErrors.maxHeight = 'Must be a valid positive number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setLoading(true);

            const ruleData = {
                carrierId: carrier.id,
                restrictionType: formData.restrictionType,
                maxLength: formData.maxLength ? Number(formData.maxLength) : null,
                maxWidth: formData.maxWidth ? Number(formData.maxWidth) : null,
                maxHeight: formData.maxHeight ? Number(formData.maxHeight) : null,
                dimensionUnit: formData.dimensionUnit,
                description: formData.description.trim(),
                enabled: formData.enabled
            };

            let response;
            if (editingRule) {
                response = await updateCarrierDimensionRule({
                    ...ruleData,
                    ruleId: editingRule.id
                });
            } else {
                response = await createCarrierDimensionRule(ruleData);
            }

            if (response.data.success) {
                onSuccess();
            } else {
                throw new Error(response.data.error || 'Failed to save dimension rule');
            }
        } catch (error) {
            console.error('Error saving dimension rule:', error);
            enqueueSnackbar('Failed to save dimension rule', 'error');
        } finally {
            setLoading(false);
        }
    };

    const restrictionTypes = [
        {
            value: 'max_individual',
            label: 'Max Individual Package',
            description: 'Maximum dimensions for any single package in a shipment'
        },
        {
            value: 'max_total',
            label: 'Max Total Shipment',
            description: 'Maximum combined dimensions for the entire shipment'
        },
        {
            value: 'truck_space',
            label: 'Truck Space Limitation',
            description: 'Vehicle constraints (truck bed/cargo area limitations)'
        }
    ];

    const dimensionUnits = [
        { value: 'in', label: 'Inches (in)' },
        { value: 'cm', label: 'Centimeters (cm)' },
        { value: 'ft', label: 'Feet (ft)' },
        { value: 'm', label: 'Meters (m)' }
    ];

    const selectedRestrictionType = restrictionTypes.find(type => type.value === formData.restrictionType);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <DialogTitle
                sx={{
                    borderBottom: '1px solid #e5e7eb',
                    pb: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Box>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        {editingRule ? 'Edit Dimension Rule' : 'Add Dimension Rule'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                        Configure dimension-based eligibility for {carrier?.name}
                    </Typography>
                </Box>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    size="small"
                    startIcon={<CloseIcon />}
                    sx={{ fontSize: '12px' }}
                >
                    Cancel
                </Button>
            </DialogTitle>

            <DialogContent sx={{ flex: 1, overflow: 'auto', pt: 2 }}>
                <Grid container spacing={3}>
                    {/* Restriction Type */}
                    <Grid item xs={12}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Restriction Type</InputLabel>
                            <Select
                                value={formData.restrictionType}
                                onChange={(e) => handleChange('restrictionType', e.target.value)}
                                label="Restriction Type"
                                sx={{ fontSize: '12px' }}
                            >
                                {restrictionTypes.map((type) => (
                                    <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                        {type.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {selectedRestrictionType && (
                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5 }}>
                                {selectedRestrictionType.description}
                            </Typography>
                        )}
                    </Grid>

                    {/* Dimension Limits */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Maximum Dimensions
                        </Typography>
                        {errors.dimensions && (
                            <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                                {errors.dimensions}
                            </Alert>
                        )}
                        <Grid container spacing={2}>
                            <Grid item xs={3}>
                                <TextField
                                    label="Max Length"
                                    type="number"
                                    value={formData.maxLength}
                                    onChange={(e) => handleChange('maxLength', e.target.value)}
                                    error={!!errors.maxLength}
                                    helperText={errors.maxLength}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                />
                            </Grid>
                            <Grid item xs={3}>
                                <TextField
                                    label="Max Width"
                                    type="number"
                                    value={formData.maxWidth}
                                    onChange={(e) => handleChange('maxWidth', e.target.value)}
                                    error={!!errors.maxWidth}
                                    helperText={errors.maxWidth}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                />
                            </Grid>
                            <Grid item xs={3}>
                                <TextField
                                    label="Max Height"
                                    type="number"
                                    value={formData.maxHeight}
                                    onChange={(e) => handleChange('maxHeight', e.target.value)}
                                    error={!!errors.maxHeight}
                                    helperText={errors.maxHeight}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                />
                            </Grid>
                            <Grid item xs={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Unit</InputLabel>
                                    <Select
                                        value={formData.dimensionUnit}
                                        onChange={(e) => handleChange('dimensionUnit', e.target.value)}
                                        label="Unit"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {dimensionUnits.map((unit) => (
                                            <MenuItem key={unit.value} value={unit.value} sx={{ fontSize: '12px' }}>
                                                {unit.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mt: 1 }}>
                            Leave dimensions empty if there are no restrictions for that direction. At least one dimension must be specified.
                        </Typography>
                    </Grid>

                    {/* Description */}
                    <Grid item xs={12}>
                        <TextField
                            label="Description (Optional)"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            multiline
                            rows={2}
                            size="small"
                            fullWidth
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            helperText="Optional description for this dimension restriction"
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                        />
                    </Grid>

                    {/* Enabled Toggle */}
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.enabled}
                                    onChange={(e) => handleChange('enabled', e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Typography sx={{ fontSize: '12px' }}>
                                    Enable this dimension rule
                                </Typography>
                            }
                        />
                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', ml: 4 }}>
                            Only enabled rules will be applied when determining carrier eligibility
                        </Typography>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid #e5e7eb', p: 2, gap: 1 }}>
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
                    startIcon={<SaveIcon />}
                    disabled={loading}
                    sx={{ fontSize: '12px' }}
                >
                    {loading ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CarrierDimensionForm;