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
    Grid,
    Typography,
    Switch,
    FormControlLabel,
    CircularProgress,
    Alert,
    Autocomplete,
    Box
} from '@mui/material';
import {
    Save as SaveIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { functions } from '../../../../firebase';
import { httpsCallable } from 'firebase/functions';

const CarrierEligibilityDialog = ({ open, onClose, editingRule, onSave }) => {
    const { enqueueSnackbar } = useSnackbar();

    // Form state
    const [formData, setFormData] = useState({
        customer: 'ALL',
        business: 'SYSTEM',
        carrier: '',
        service: 'ANY',
        fromCountry: '',
        fromState: 'ANY',
        toCountry: '',
        toState: 'ANY',
        exclude: false
    });

    // Loading and data states
    const [loading, setLoading] = useState(false);
    const [carriers, setCarriers] = useState([]);
    const [services, setServices] = useState([]);
    const [loadingData, setLoadingData] = useState(false);

    // Load carriers and services on component mount
    useEffect(() => {
        if (open) {
            loadCarriersAndServices();
        }
    }, [open]);

    // Set form data when editing
    useEffect(() => {
        if (editingRule) {
            setFormData({
                customer: editingRule.customer || 'ALL',
                business: editingRule.business || 'SYSTEM',
                carrier: editingRule.carrier || '',
                service: editingRule.service || 'ANY',
                fromCountry: editingRule.fromCountry || '',
                fromState: editingRule.fromState || 'ANY',
                toCountry: editingRule.toCountry || '',
                toState: editingRule.toState || 'ANY',
                exclude: editingRule.exclude || false
            });
        } else {
            // Reset form for new rule
            setFormData({
                customer: 'ALL',
                business: 'SYSTEM',
                carrier: '',
                service: 'ANY',
                fromCountry: '',
                fromState: 'ANY',
                toCountry: '',
                toState: 'ANY',
                exclude: false
            });
        }
    }, [editingRule]);

    const loadCarriersAndServices = async () => {
        setLoadingData(true);
        try {
            // Load carriers from the carriers collection
            const getCarriers = httpsCallable(functions, 'getCarriers');
            const carriersResult = await getCarriers();

            if (carriersResult.data?.carriers) {
                setCarriers(carriersResult.data.carriers);
            }

            // Load services - you could create a separate function for this
            // For now, we'll use common service types
            setServices([
                'ANY',
                'GENERALFREIGHT',
                'GENERALFREIGHT - CA',
                'UPS SAVER',
                'STANDARD',
                'EXPRESS',
                'ECONOMY'
            ]);

        } catch (error) {
            console.error('Error loading carriers and services:', error);
            enqueueSnackbar('Failed to load carriers and services', { variant: 'error' });
        } finally {
            setLoadingData(false);
        }
    };

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        // Validation
        if (!formData.carrier) {
            enqueueSnackbar('Please select a carrier', { variant: 'error' });
            return;
        }

        setLoading(true);
        try {
            const functionName = editingRule ? 'updateCarrierEligibilityRule' : 'createCarrierEligibilityRule';
            const saveFunction = httpsCallable(functions, functionName);

            const payload = {
                ...formData,
                ...(editingRule && { ruleId: editingRule.id })
            };

            await saveFunction(payload);

            enqueueSnackbar(
                editingRule ? 'Eligibility rule updated successfully' : 'Eligibility rule created successfully',
                { variant: 'success' }
            );

            onSave();
        } catch (error) {
            console.error('Error saving eligibility rule:', error);
            enqueueSnackbar('Failed to save eligibility rule', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const countries = [
        { code: 'US', name: 'United States' },
        { code: 'CA', name: 'Canada' },
        { code: 'MX', name: 'Mexico' }
    ];

    const usStates = [
        'ANY', 'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'
    ];

    const canadianProvinces = [
        'ANY', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
    ];

    const getStateOptions = (country) => {
        if (country === 'US') return usStates;
        if (country === 'CA') return canadianProvinces;
        return ['ANY'];
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { borderRadius: '8px' }
            }}
        >
            <DialogTitle sx={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151',
                borderBottom: '1px solid #e5e7eb'
            }}>
                {editingRule ? 'Edit Carrier Eligibility Rule' : 'Add Carrier Eligibility Rule'}
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {loadingData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        {/* Customer and Business */}
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Customer</InputLabel>
                                <Select
                                    value={formData.customer}
                                    onChange={(e) => handleFieldChange('customer', e.target.value)}
                                    label="Customer"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ALL" sx={{ fontSize: '12px' }}>ALL</MenuItem>
                                    <MenuItem value="SYSTEM" sx={{ fontSize: '12px' }}>SYSTEM</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Business</InputLabel>
                                <Select
                                    value={formData.business}
                                    onChange={(e) => handleFieldChange('business', e.target.value)}
                                    label="Business"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="SYSTEM" sx={{ fontSize: '12px' }}>SYSTEM</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Carrier and Service */}
                        <Grid item xs={12} md={6}>
                            <Autocomplete
                                value={carriers.find(c => c.name === formData.carrier) || null}
                                onChange={(event, newValue) => {
                                    handleFieldChange('carrier', newValue ? newValue.name : '');
                                }}
                                options={carriers}
                                getOptionLabel={(option) => option.name}
                                size="small"
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Carrier"
                                        required
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                )}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service</InputLabel>
                                <Select
                                    value={formData.service}
                                    onChange={(e) => handleFieldChange('service', e.target.value)}
                                    label="Service"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {services.map(service => (
                                        <MenuItem key={service} value={service} sx={{ fontSize: '12px' }}>
                                            {service}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Origin (From) */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                Origin (From)
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>From Country</InputLabel>
                                <Select
                                    value={formData.fromCountry}
                                    onChange={(e) => {
                                        handleFieldChange('fromCountry', e.target.value);
                                        handleFieldChange('fromState', 'ANY'); // Reset state when country changes
                                    }}
                                    label="From Country"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="" sx={{ fontSize: '12px' }}>Any Country</MenuItem>
                                    {countries.map(country => (
                                        <MenuItem key={country.code} value={country.code} sx={{ fontSize: '12px' }}>
                                            {country.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>From State/Province</InputLabel>
                                <Select
                                    value={formData.fromState}
                                    onChange={(e) => handleFieldChange('fromState', e.target.value)}
                                    label="From State/Province"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {getStateOptions(formData.fromCountry).map(state => (
                                        <MenuItem key={state} value={state} sx={{ fontSize: '12px' }}>
                                            {state}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Destination (To) */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                Destination (To)
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>To Country</InputLabel>
                                <Select
                                    value={formData.toCountry}
                                    onChange={(e) => {
                                        handleFieldChange('toCountry', e.target.value);
                                        handleFieldChange('toState', 'ANY'); // Reset state when country changes
                                    }}
                                    label="To Country"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="" sx={{ fontSize: '12px' }}>Any Country</MenuItem>
                                    {countries.map(country => (
                                        <MenuItem key={country.code} value={country.code} sx={{ fontSize: '12px' }}>
                                            {country.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>To State/Province</InputLabel>
                                <Select
                                    value={formData.toState}
                                    onChange={(e) => handleFieldChange('toState', e.target.value)}
                                    label="To State/Province"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {getStateOptions(formData.toCountry).map(state => (
                                        <MenuItem key={state} value={state} sx={{ fontSize: '12px' }}>
                                            {state}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Exclude/Allow */}
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.exclude}
                                        onChange={(e) => handleFieldChange('exclude', e.target.checked)}
                                        color="error"
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px', color: formData.exclude ? '#ef4444' : '#10b981' }}>
                                        {formData.exclude ? 'Exclude this route (blocked)' : 'Allow this route (enabled)'}
                                    </Typography>
                                }
                            />
                        </Grid>

                        {/* Helper text */}
                        <Grid item xs={12}>
                            <Alert severity="info" sx={{ fontSize: '11px' }}>
                                <Typography sx={{ fontSize: '11px' }}>
                                    This rule will {formData.exclude ? 'block' : 'allow'} the {formData.carrier || '[carrier]'} carrier
                                    {formData.service !== 'ANY' ? ` (${formData.service} service)` : ''} for shipments from {' '}
                                    {formData.fromCountry || 'any country'}{formData.fromState !== 'ANY' ? ` (${formData.fromState})` : ''} to {' '}
                                    {formData.toCountry || 'any country'}{formData.toState !== 'ANY' ? ` (${formData.toState})` : ''}.
                                </Typography>
                            </Alert>
                        </Grid>
                    </Grid>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb' }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    size="small"
                    startIcon={<CloseIcon />}
                    sx={{ fontSize: '12px' }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    size="small"
                    startIcon={loading ? <CircularProgress size={14} /> : <SaveIcon />}
                    disabled={loading || !formData.carrier}
                    sx={{ fontSize: '12px' }}
                >
                    {editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CarrierEligibilityDialog;
