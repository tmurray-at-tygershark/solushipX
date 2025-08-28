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

const CarrierWeightForm = ({ open, onClose, onSuccess, carrier, editingRule }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        restrictionType: 'total_weight',
        minWeight: '',
        maxWeight: '',
        weightUnit: 'lbs',
        description: '',
        enabled: true
    });
    const [errors, setErrors] = useState({});

    // Cloud functions
    const createCarrierWeightRule = httpsCallable(functions, 'createCarrierWeightRule');
    const updateCarrierWeightRule = httpsCallable(functions, 'updateCarrierWeightRule');

    // Initialize form data when editing
    useEffect(() => {
        if (editingRule) {
            setFormData({
                restrictionType: editingRule.restrictionType || 'total_weight',
                minWeight: editingRule.minWeight || '',
                maxWeight: editingRule.maxWeight || '',
                weightUnit: editingRule.weightUnit || 'lbs',
                description: editingRule.description || '',
                enabled: editingRule.enabled !== false
            });
        } else {
            setFormData({
                restrictionType: 'total_weight',
                minWeight: '',
                maxWeight: '',
                weightUnit: 'lbs',
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

        // At least one weight value is required
        if (!formData.minWeight && !formData.maxWeight) {
            newErrors.weight = 'Either minimum weight or maximum weight is required';
        }

        // Validate weight values
        if (formData.minWeight && (isNaN(formData.minWeight) || Number(formData.minWeight) < 0)) {
            newErrors.minWeight = 'Must be a valid positive number';
        }

        if (formData.maxWeight && (isNaN(formData.maxWeight) || Number(formData.maxWeight) < 0)) {
            newErrors.maxWeight = 'Must be a valid positive number';
        }

        // Validate min <= max
        if (formData.minWeight && formData.maxWeight &&
            Number(formData.minWeight) > Number(formData.maxWeight)) {
            newErrors.maxWeight = 'Maximum weight must be greater than minimum weight';
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
                minWeight: formData.minWeight ? Number(formData.minWeight) : null,
                maxWeight: formData.maxWeight ? Number(formData.maxWeight) : null,
                weightUnit: formData.weightUnit,
                description: formData.description.trim(),
                enabled: formData.enabled
            };

            let response;
            if (editingRule) {
                response = await updateCarrierWeightRule({
                    ...ruleData,
                    ruleId: editingRule.id
                });
            } else {
                response = await createCarrierWeightRule(ruleData);
            }

            if (response.data.success) {
                onSuccess();
            } else {
                throw new Error(response.data.error || 'Failed to save weight rule');
            }
        } catch (error) {
            console.error('Error saving weight rule:', error);
            enqueueSnackbar('Failed to save weight rule', 'error');
        } finally {
            setLoading(false);
        }
    };

    const restrictionTypes = [
        { value: 'total_weight', label: 'Total Weight', description: 'Basic total weight ranges for shipments' },
        { value: 'cubic_weight', label: 'Cubic Weight', description: 'Volume-based weight restrictions (dimensional weight)' },
        { value: 'weight_per_skid', label: 'Weight Per Skid', description: 'Maximum weight limits per individual skid/pallet' }
    ];

    const weightUnits = [
        { value: 'lbs', label: 'Pounds (lbs)' },
        { value: 'kg', label: 'Kilograms (kg)' }
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
                        {editingRule ? 'Edit Weight Rule' : 'Add Weight Rule'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                        Configure weight-based eligibility for {carrier?.name}
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

                    {/* Weight Range */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Weight Range
                        </Typography>
                        {errors.weight && (
                            <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                                {errors.weight}
                            </Alert>
                        )}
                        <Grid container spacing={2}>
                            <Grid item xs={4}>
                                <TextField
                                    label="Minimum Weight"
                                    type="number"
                                    value={formData.minWeight}
                                    onChange={(e) => handleChange('minWeight', e.target.value)}
                                    error={!!errors.minWeight}
                                    helperText={errors.minWeight}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField
                                    label="Maximum Weight"
                                    type="number"
                                    value={formData.maxWeight}
                                    onChange={(e) => handleChange('maxWeight', e.target.value)}
                                    error={!!errors.maxWeight}
                                    helperText={errors.maxWeight}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Unit</InputLabel>
                                    <Select
                                        value={formData.weightUnit}
                                        onChange={(e) => handleChange('weightUnit', e.target.value)}
                                        label="Unit"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {weightUnits.map((unit) => (
                                            <MenuItem key={unit.value} value={unit.value} sx={{ fontSize: '12px' }}>
                                                {unit.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mt: 1 }}>
                            Leave minimum empty for "up to maximum" rules, or maximum empty for "minimum and above" rules
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
                            helperText="Optional description for this weight restriction"
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
                                    Enable this weight rule
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

export default CarrierWeightForm;