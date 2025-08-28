/**
 * QuickShip to Connected Carrier Conversion Wizard
 * Allows upgrading a basic QuickShip carrier to a full connected carrier with rate configuration
 */

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stepper,
    Step,
    StepLabel,
    Box,
    Typography,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Alert,
    Card,
    CardContent,
    Chip,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    CircularProgress
} from '@mui/material';
import {
    ArrowForward as ArrowForwardIcon,
    CheckCircle as CheckIcon,
    Info as InfoIcon,
    LocalShipping as CarrierIcon,
    Settings as SettingsIcon,
    MonetizationOn as RateIcon,
    Verified as VerifiedIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const steps = [
    'Review Carrier Information',
    'Configure Connection Type',
    'Set Up Rate Configuration',
    'Review & Convert'
];

const QuickShipConversionWizard = ({
    isOpen,
    onClose,
    quickShipCarrier,
    onConversionComplete
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Conversion form data
    const [conversionData, setConversionData] = useState({
        // Basic information (pre-populated from QuickShip carrier)
        name: '',
        carrierId: '',
        contactEmail: '',
        logo: '',

        // Connection configuration
        connectionType: 'manual',

        // Rate configuration
        enableRateConfiguration: true,
        rateType: 'skid_based',
        currency: 'CAD',

        // Services and equipment (transferred from QuickShip)
        supportedServiceLevels: [],
        supportedEquipmentTypes: [],
        supportedAdditionalServices: [],

        // Email configuration for manual carriers
        emailContacts: []
    });

    // Initialize conversion data when QuickShip carrier is provided
    useEffect(() => {
        if (quickShipCarrier) {
            setConversionData(prev => ({
                ...prev,
                name: quickShipCarrier.name || '',
                carrierId: quickShipCarrier.carrierId || '',
                contactEmail: quickShipCarrier.contactEmail || '',
                logo: quickShipCarrier.logo || '',
                supportedServiceLevels: quickShipCarrier.supportedServiceLevels || [],
                supportedEquipmentTypes: quickShipCarrier.supportedEquipmentTypes || [],
                supportedAdditionalServices: quickShipCarrier.supportedAdditionalServices || [],
                emailContacts: quickShipCarrier.contactEmail ? [{
                    type: 'general',
                    email: quickShipCarrier.contactEmail,
                    name: 'General Contact'
                }] : []
            }));
        }
    }, [quickShipCarrier]);

    const handleNext = () => {
        setActiveStep(prev => prev + 1);
        setError(null);
    };

    const handleBack = () => {
        setActiveStep(prev => prev - 1);
        setError(null);
    };

    const handleConversion = async () => {
        setLoading(true);
        setError(null);

        try {
            // Step 1: Create the connected carrier
            const createConnectedCarrier = httpsCallable(functions, 'createConnectedCarrier');
            const carrierResult = await createConnectedCarrier({
                name: conversionData.name,
                carrierId: conversionData.carrierId,
                contactEmail: conversionData.contactEmail,
                logo: conversionData.logo,
                connectionType: conversionData.connectionType,
                supportedServiceLevels: conversionData.supportedServiceLevels,
                supportedEquipmentTypes: conversionData.supportedEquipmentTypes,
                supportedAdditionalServices: conversionData.supportedAdditionalServices,
                emailContacts: conversionData.emailContacts,
                enabled: true,
                convertedFrom: 'quickship',
                originalQuickShipId: quickShipCarrier.id
            });

            if (!carrierResult.data.success) {
                throw new Error(carrierResult.data.error || 'Failed to create connected carrier');
            }

            const newCarrierId = carrierResult.data.carrierId;

            // Step 2: Create initial rate card if enabled
            if (conversionData.enableRateConfiguration) {
                const createCarrierRateCard = httpsCallable(functions, 'createCarrierRateCard');
                await createCarrierRateCard({
                    carrierId: newCarrierId,
                    rateCardName: `${conversionData.name} - Default Rates`,
                    rateType: conversionData.rateType,
                    currency: conversionData.currency,
                    enabled: true,
                    skidRates: conversionData.rateType === 'skid_based' ? [
                        { skidCount: 1, retailPrice: 150, ourCost: 100, notes: 'Default single skid rate' },
                        { skidCount: 2, retailPrice: 250, ourCost: 175, notes: 'Default two skid rate' },
                        { skidCount: 3, retailPrice: 350, ourCost: 245, notes: 'Default three skid rate' }
                    ] : [],
                    weightBreaks: conversionData.rateType === 'weight_based' ? [
                        { minWeight: 0, maxWeight: 100, rate: 2.50, minimumCharge: 50 },
                        { minWeight: 101, maxWeight: 500, rate: 2.00, minimumCharge: 100 },
                        { minWeight: 501, maxWeight: 1000, rate: 1.75, minimumCharge: 200 }
                    ] : [],
                    flatRate: conversionData.rateType === 'flat' ? 100 : null
                });
            }

            // Step 3: Deactivate the original QuickShip carrier (optional - keep for reference)
            // We'll keep the original QuickShip carrier but mark it as converted
            const updateQuickShipCarrier = httpsCallable(functions, 'updateQuickShipCarrier');
            await updateQuickShipCarrier({
                carrierId: quickShipCarrier.id,
                convertedToConnected: true,
                convertedAt: new Date().toISOString(),
                connectedCarrierId: newCarrierId,
                enabled: false // Disable to prevent confusion
            });

            enqueueSnackbar(`Successfully converted ${conversionData.name} to connected carrier`, {
                variant: 'success'
            });

            // Call completion callback
            if (onConversionComplete) {
                onConversionComplete({
                    success: true,
                    newCarrierId,
                    originalQuickShipId: quickShipCarrier.id
                });
            }

            onClose();

        } catch (error) {
            console.error('Conversion error:', error);
            setError(error.message);
            enqueueSnackbar('Conversion failed: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const updateConversionData = (field, value) => {
        setConversionData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const renderStepContent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <Box>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                Converting QuickShip Carrier to Connected Carrier
                            </Typography>
                            <Typography sx={{ fontSize: '11px' }}>
                                This will upgrade your basic QuickShip carrier to a full connected carrier with advanced rate configuration capabilities.
                            </Typography>
                        </Alert>

                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 2 }}>
                                    Current QuickShip Carrier Information
                                </Typography>
                            </Grid>

                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier Name"
                                    value={conversionData.name}
                                    onChange={(e) => updateConversionData('name', e.target.value)}
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier ID"
                                    value={conversionData.carrierId}
                                    onChange={(e) => updateConversionData('carrierId', e.target.value)}
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Contact Email"
                                    value={conversionData.contactEmail}
                                    onChange={(e) => updateConversionData('contactEmail', e.target.value)}
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1 }}>
                                    Services & Equipment
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {conversionData.supportedServiceLevels?.map((service, index) => (
                                        <Chip
                                            key={index}
                                            label={service}
                                            size="small"
                                            color="primary"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    ))}
                                    {conversionData.supportedEquipmentTypes?.map((equipment, index) => (
                                        <Chip
                                            key={index}
                                            label={equipment}
                                            size="small"
                                            color="secondary"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    ))}
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 2 }}>
                            Connection Configuration
                        </Typography>

                        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                            <InputLabel sx={{ fontSize: '12px' }}>Connection Type</InputLabel>
                            <Select
                                value={conversionData.connectionType}
                                onChange={(e) => updateConversionData('connectionType', e.target.value)}
                                label="Connection Type"
                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                            >
                                <MenuItem value="manual" sx={{ fontSize: '12px' }}>
                                    Manual Connection (Phone/Email)
                                </MenuItem>
                                <MenuItem value="api" sx={{ fontSize: '12px' }}>
                                    API Integration (Advanced)
                                </MenuItem>
                            </Select>
                        </FormControl>

                        {conversionData.connectionType === 'manual' && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    Manual connection will use phone/email for rate requests and booking confirmations.
                                    The existing contact email will be configured as the primary contact.
                                </Typography>
                            </Alert>
                        )}

                        {conversionData.connectionType === 'api' && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    API integration requires additional configuration including endpoints,
                                    credentials, and testing. This can be completed after conversion.
                                </Typography>
                            </Alert>
                        )}
                    </Box>
                );

            case 2:
                return (
                    <Box>
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 2 }}>
                            Rate Configuration Setup
                        </Typography>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={conversionData.enableRateConfiguration}
                                    onChange={(e) => updateConversionData('enableRateConfiguration', e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Typography sx={{ fontSize: '12px' }}>
                                    Enable automatic rate configuration
                                </Typography>
                            }
                            sx={{ mb: 3 }}
                        />

                        {conversionData.enableRateConfiguration && (
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Rate Type</InputLabel>
                                        <Select
                                            value={conversionData.rateType}
                                            onChange={(e) => updateConversionData('rateType', e.target.value)}
                                            label="Rate Type"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="skid_based" sx={{ fontSize: '12px' }}>
                                                Skid Based (Recommended)
                                            </MenuItem>
                                            <MenuItem value="weight_based" sx={{ fontSize: '12px' }}>
                                                Weight Based
                                            </MenuItem>
                                            <MenuItem value="zone_based" sx={{ fontSize: '12px' }}>
                                                Zone Based
                                            </MenuItem>
                                            <MenuItem value="flat" sx={{ fontSize: '12px' }}>
                                                Flat Rate
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                        <Select
                                            value={conversionData.currency}
                                            onChange={(e) => updateConversionData('currency', e.target.value)}
                                            label="Currency"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD</MenuItem>
                                            <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12}>
                                    <Alert severity="info">
                                        <Typography sx={{ fontSize: '12px' }}>
                                            Default rate templates will be created. You can customize these rates
                                            after conversion in the carrier management interface.
                                        </Typography>
                                    </Alert>
                                </Grid>
                            </Grid>
                        )}

                        {!conversionData.enableRateConfiguration && (
                            <Alert severity="warning">
                                <Typography sx={{ fontSize: '12px' }}>
                                    Without rate configuration, this carrier will only support manual rate entry.
                                    You can enable rate configuration later.
                                </Typography>
                            </Alert>
                        )}
                    </Box>
                );

            case 3:
                return (
                    <Box>
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 3 }}>
                            Review Conversion Settings
                        </Typography>

                        <List dense>
                            <ListItem>
                                <ListItemIcon>
                                    <CarrierIcon sx={{ fontSize: '18px', color: '#10b981' }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            Carrier: {conversionData.name}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            ID: {conversionData.carrierId} | Contact: {conversionData.contactEmail}
                                        </Typography>
                                    }
                                />
                            </ListItem>

                            <ListItem>
                                <ListItemIcon>
                                    <SettingsIcon sx={{ fontSize: '18px', color: '#3b82f6' }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            Connection: {conversionData.connectionType === 'manual' ? 'Manual' : 'API Integration'}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            {conversionData.connectionType === 'manual'
                                                ? 'Phone/Email based communication'
                                                : 'API endpoints and automated integration'
                                            }
                                        </Typography>
                                    }
                                />
                            </ListItem>

                            <ListItem>
                                <ListItemIcon>
                                    <RateIcon sx={{ fontSize: '18px', color: '#f59e0b' }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            Rate Configuration: {conversionData.enableRateConfiguration ? 'Enabled' : 'Disabled'}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            {conversionData.enableRateConfiguration
                                                ? `${conversionData.rateType} rates in ${conversionData.currency}`
                                                : 'Manual rate entry only'
                                            }
                                        </Typography>
                                    }
                                />
                            </ListItem>

                            <ListItem>
                                <ListItemIcon>
                                    <VerifiedIcon sx={{ fontSize: '18px', color: '#8b5cf6' }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            Services: {conversionData.supportedServiceLevels?.length || 0} service levels
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            {conversionData.supportedEquipmentTypes?.length || 0} equipment types, {' '}
                                            {conversionData.supportedAdditionalServices?.length || 0} additional services
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        </List>

                        <Divider sx={{ my: 2 }} />

                        <Alert severity="warning" sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                Important Notes
                            </Typography>
                            <Typography sx={{ fontSize: '11px' }}>
                                • The original QuickShip carrier will be disabled but preserved for reference<br />
                                • All existing configuration will be transferred to the new connected carrier<br />
                                • You can configure detailed rates and settings after conversion<br />
                                • This action cannot be easily undone
                            </Typography>
                        </Alert>

                        {error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    {error}
                                </Typography>
                            </Alert>
                        )}
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { height: '80vh' } }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ArrowForwardIcon sx={{ color: '#10b981' }} />
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Convert to Connected Carrier
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {/* Stepper */}
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px' } }}>
                                {label}
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {/* Step Content */}
                {renderStepContent()}
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb' }}>
                <Button
                    onClick={onClose}
                    sx={{ fontSize: '12px' }}
                    disabled={loading}
                >
                    Cancel
                </Button>

                {activeStep > 0 && (
                    <Button
                        onClick={handleBack}
                        sx={{ fontSize: '12px' }}
                        disabled={loading}
                    >
                        Back
                    </Button>
                )}

                {activeStep < steps.length - 1 ? (
                    <Button
                        onClick={handleNext}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                        disabled={loading}
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        onClick={handleConversion}
                        variant="contained"
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                        startIcon={loading ? <CircularProgress size={16} /> : null}
                    >
                        {loading ? 'Converting...' : 'Convert Carrier'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default QuickShipConversionWizard;
