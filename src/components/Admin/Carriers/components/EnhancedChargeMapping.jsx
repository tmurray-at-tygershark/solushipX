/**
 * Enhanced Charge Mapping Component
 * Comprehensive rate card management per route with services and service types
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Alert,
    CircularProgress,
    Grid,
    Tabs,
    Tab,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider,
    Card,
    CardContent,
    CardActions,
    Tooltip,
    Badge,
    Autocomplete
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    MonetizationOn as MoneyIcon,
    LocalShipping as TruckIcon,
    Speed as SpeedIcon,
    Map as MapIcon,
    Route as RouteIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Visibility as VisibilityIcon,
    ContentCopy as CopyIcon,
    CloudUpload as ImportIcon,
    Download as ExportIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import EnhancedChargeMappingImport from './EnhancedChargeMappingImport';

const EnhancedChargeMapping = ({ carrierId, carrierName, isOpen, onClose, zoneConfig }) => {
    const { enqueueSnackbar } = useSnackbar();

    // State management
    const [loading, setLoading] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [carrierServices, setCarrierServices] = useState([]);
    const [rateCards, setRateCards] = useState([]);
    const [selectedTab, setSelectedTab] = useState(0);
    const [showRateCardDialog, setShowRateCardDialog] = useState(false);
    const [editingRateCard, setEditingRateCard] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteRateCardId, setDeleteRateCardId] = useState(null);
    const [showImportDialog, setShowImportDialog] = useState(false);

    // Form state for rate card dialog
    const [formData, setFormData] = useState({
        routeId: '',
        service: '',
        serviceType: '',
        rateType: 'skid_based', // skid_based, weight_based
        currency: 'CAD',
        enabled: true,
        skidRates: [],
        weightRates: [],
        notes: ''
    });

    // Service types configuration
    const serviceTypes = {
        'LTL': ['standard', 'rush', 'direct'],
        'FTL': ['standard', 'rush', 'direct'],
        'Courier': ['sameday', 'nextday', 'standard'],
        'Express': ['sameday', 'rush', 'standard'],
        'Freight': ['standard', 'rush', 'direct']
    };

    // Load data when component opens
    useEffect(() => {
        if (isOpen && carrierId) {
            loadData();
        }
    }, [isOpen, carrierId]);

    // Load zone config if not provided
    useEffect(() => {
        if (isOpen && carrierId && !zoneConfig) {
            loadZoneConfig();
        }
    }, [isOpen, carrierId, zoneConfig]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadRoutes(),
                loadCarrierServices(),
                loadRateCards()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            enqueueSnackbar('Failed to load data', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, enqueueSnackbar]);

    const loadZoneConfig = async () => {
        try {
            // Load zone configuration from carrier data
            const getCarrier = httpsCallable(functions, 'getCarrier');
            const result = await getCarrier({ carrierId });

            if (result.data.success) {
                const carrier = result.data.carrier;
                if (carrier.zoneConfig?.routeMappings) {
                    setRoutes(carrier.zoneConfig.routeMappings);
                }
            }
        } catch (error) {
            console.error('Error loading zone config:', error);
        }
    };

    const loadRoutes = async () => {
        try {
            const getCarrierRoutes = httpsCallable(functions, 'getCarrierRoutes');
            const result = await getCarrierRoutes({ carrierId });

            if (result.data.success) {
                setRoutes(result.data.routes || []);
            }
        } catch (error) {
            console.error('Error loading routes:', error);
            // Fallback to zone config routes if available
            if (zoneConfig?.routeMappings) {
                setRoutes(zoneConfig.routeMappings);
            }
        }
    };

    const loadCarrierServices = async () => {
        try {
            const getCarrier = httpsCallable(functions, 'getCarrier');
            const result = await getCarrier({ carrierId });

            if (result.data.success) {
                const carrier = result.data.carrier;
                const services = [];

                // Extract services from supportedServices
                if (carrier.supportedServices) {
                    if (carrier.supportedServices.courier?.length > 0) {
                        carrier.supportedServices.courier.forEach(service => {
                            services.push({ type: 'courier', name: service, label: service });
                        });
                    }
                    if (carrier.supportedServices.freight?.length > 0) {
                        carrier.supportedServices.freight.forEach(service => {
                            services.push({ type: 'freight', name: service, label: service });
                        });
                    }
                }

                // Add default services if none configured
                if (services.length === 0) {
                    services.push(
                        { type: 'freight', name: 'LTL', label: 'LTL' },
                        { type: 'freight', name: 'FTL', label: 'FTL' }
                    );
                }

                setCarrierServices(services);
            }
        } catch (error) {
            console.error('Error loading carrier services:', error);
            // Fallback to default services
            setCarrierServices([
                { type: 'freight', name: 'LTL', label: 'LTL' },
                { type: 'freight', name: 'FTL', label: 'FTL' }
            ]);
        }
    };

    const loadRateCards = async () => {
        try {
            const getCarrierRateCards = httpsCallable(functions, 'getCarrierRateCards');
            const result = await getCarrierRateCards({ carrierId });

            if (result.data.success) {
                setRateCards(result.data.rateCards || []);
            }
        } catch (error) {
            console.error('Error loading rate cards:', error);
        }
    };

    const handleAddRateCard = (route) => {
        setSelectedRoute(route);
        setEditingRateCard(null);
        setFormData({
            routeId: route.id,
            service: '',
            serviceType: '',
            rateType: 'skid_based',
            currency: 'CAD',
            enabled: true,
            skidRates: [],
            weightRates: [],
            notes: ''
        });
        setShowRateCardDialog(true);
    };

    const handleEditRateCard = (rateCard) => {
        setEditingRateCard(rateCard);
        setSelectedRoute(routes.find(r => r.id === rateCard.routeId));
        setFormData({
            routeId: rateCard.routeId,
            service: rateCard.service,
            serviceType: rateCard.serviceType,
            rateType: rateCard.rateType,
            currency: rateCard.currency,
            enabled: rateCard.enabled,
            skidRates: rateCard.skidRates || [],
            weightRates: rateCard.weightRates || [],
            notes: rateCard.notes || ''
        });
        setShowRateCardDialog(true);
    };

    const handleSaveRateCard = async () => {
        try {
            if (!formData.service || !formData.serviceType) {
                enqueueSnackbar('Service and service type are required', { variant: 'error' });
                return;
            }

            const saveData = {
                carrierId,
                ...formData
            };

            if (editingRateCard) {
                saveData.rateCardId = editingRateCard.id;
                const updateCarrierRateCard = httpsCallable(functions, 'updateCarrierRateCard');
                await updateCarrierRateCard(saveData);
                enqueueSnackbar('Rate card updated successfully', { variant: 'success' });
            } else {
                const createCarrierRateCard = httpsCallable(functions, 'createCarrierRateCard');
                await createCarrierRateCard(saveData);
                enqueueSnackbar('Rate card created successfully', { variant: 'success' });
            }

            setShowRateCardDialog(false);
            loadRateCards();
        } catch (error) {
            console.error('Error saving rate card:', error);
            enqueueSnackbar('Failed to save rate card', { variant: 'error' });
        }
    };

    const handleDeleteRateCard = (rateCard) => {
        setDeleteRateCardId(rateCard.id);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteRateCard = async () => {
        if (!deleteRateCardId) return;

        try {
            const deleteCarrierRateCard = httpsCallable(functions, 'deleteCarrierRateCard');
            await deleteCarrierRateCard({ rateCardId: deleteRateCardId });
            enqueueSnackbar('Rate card deleted successfully', { variant: 'success' });
            loadRateCards();
        } catch (error) {
            console.error('Error deleting rate card:', error);
            enqueueSnackbar('Failed to delete rate card', { variant: 'error' });
        } finally {
            setShowDeleteConfirm(false);
            setDeleteRateCardId(null);
        }
    };

    const addSkidRate = () => {
        setFormData(prev => ({
            ...prev,
            skidRates: [...prev.skidRates, {
                skidCount: 1,
                price: 0,
                notes: ''
            }]
        }));
    };

    const updateSkidRate = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            skidRates: prev.skidRates.map((rate, i) =>
                i === index ? { ...rate, [field]: value } : rate
            )
        }));
    };

    const removeSkidRate = (index) => {
        setFormData(prev => ({
            ...prev,
            skidRates: prev.skidRates.filter((_, i) => i !== index)
        }));
    };

    const addWeightRate = () => {
        setFormData(prev => ({
            ...prev,
            weightRates: [...prev.weightRates, {
                minWeight: 0,
                maxWeight: 1000,
                pricePerLb: 0,
                minimumCharge: 0,
                notes: ''
            }]
        }));
    };

    const updateWeightRate = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            weightRates: prev.weightRates.map((rate, i) =>
                i === index ? { ...rate, [field]: value } : rate
            )
        }));
    };

    const removeWeightRate = (index) => {
        setFormData(prev => ({
            ...prev,
            weightRates: prev.weightRates.filter((_, i) => i !== index)
        }));
    };

    const getRouteRateCards = (routeId) => {
        return rateCards.filter(rateCard => rateCard.routeId === routeId);
    };

    const getServiceTypeOptions = (service) => {
        return serviceTypes[service] || ['standard', 'rush', 'direct'];
    };

    const getRateTypeIcon = (rateType) => {
        switch (rateType) {
            case 'skid_based': return <TruckIcon sx={{ fontSize: '16px' }} />;
            case 'weight_based': return <SpeedIcon sx={{ fontSize: '16px' }} />;
            default: return <MoneyIcon sx={{ fontSize: '16px' }} />;
        }
    };

    const getServiceTypeColor = (serviceType) => {
        switch (serviceType) {
            case 'sameday': return 'error';
            case 'rush': return 'warning';
            case 'direct': return 'info';
            case 'standard': return 'success';
            case 'nextday': return 'primary';
            default: return 'default';
        }
    };

    const renderRouteRateCards = () => {
        if (routes.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <RouteIcon sx={{ fontSize: 64, color: '#d1d5db', mb: 2 }} />
                    <Typography sx={{ fontSize: '18px', color: '#374151', mb: 1, fontWeight: 600 }}>
                        No Routes Available
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                        Configure pickup and delivery zones first to generate routes
                    </Typography>
                </Box>
            );
        }

        return (
            <Box>
                <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 1 }}>
                        Route Rate Cards
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Configure pricing for each route, service, and service type combination
                    </Typography>
                </Box>

                <Grid container spacing={2}>
                    {routes.map((route) => {
                        const routeRateCards = getRouteRateCards(route.id);
                        const hasRates = routeRateCards.length > 0;

                        return (
                            <Grid item xs={12} key={route.id}>
                                <Card sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                            <Box>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                    {route.description || `${route.pickup?.city} → ${route.delivery?.city}`}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {route.pickup?.city}, {route.pickup?.provinceState} → {route.delivery?.city}, {route.delivery?.provinceState}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                <Chip
                                                    label={hasRates ? `${routeRateCards.length} Rate Cards` : 'No Rates'}
                                                    size="small"
                                                    color={hasRates ? 'success' : 'warning'}
                                                    sx={{ fontSize: '11px' }}
                                                />
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<AddIcon />}
                                                    onClick={() => handleAddRateCard(route)}
                                                    sx={{ fontSize: '11px' }}
                                                >
                                                    Add Rate
                                                </Button>
                                            </Box>
                                        </Box>

                                        {hasRates ? (
                                            <TableContainer>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Service</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Rate Type</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Actions</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {routeRateCards.map((rateCard) => (
                                                            <TableRow key={rateCard.id}>
                                                                <TableCell sx={{ fontSize: '12px' }}>
                                                                    {rateCard.service}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={rateCard.serviceType}
                                                                        size="small"
                                                                        color={getServiceTypeColor(rateCard.serviceType)}
                                                                        sx={{ fontSize: '11px' }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell sx={{ fontSize: '12px' }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                        {getRateTypeIcon(rateCard.rateType)}
                                                                        {rateCard.rateType === 'skid_based' ? 'Skid Based' : 'Weight Based'}
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={rateCard.enabled ? 'Active' : 'Inactive'}
                                                                        color={rateCard.enabled ? 'success' : 'default'}
                                                                        size="small"
                                                                        sx={{ fontSize: '11px' }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleEditRateCard(rateCard)}
                                                                    >
                                                                        <EditIcon sx={{ fontSize: '16px' }} />
                                                                    </IconButton>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleDeleteRateCard(rateCard)}
                                                                        color="error"
                                                                    >
                                                                        <DeleteIcon sx={{ fontSize: '16px' }} />
                                                                    </IconButton>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        ) : (
                                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                    No rate cards configured for this route
                                                </Typography>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>
        );
    };

    const renderRateCardDialog = () => {
        if (!selectedRoute) return null;

        return (
            <Dialog
                open={showRateCardDialog}
                onClose={() => setShowRateCardDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingRateCard ? 'Edit Rate Card' : 'Create Rate Card'}
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    <Grid container spacing={2}>
                        {/* Route Information */}
                        <Grid item xs={12}>
                            <Paper sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                    Route: {selectedRoute.description || `${selectedRoute.pickup?.city} → ${selectedRoute.delivery?.city}`}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    {selectedRoute.pickup?.city}, {selectedRoute.pickup?.provinceState} → {selectedRoute.delivery?.city}, {selectedRoute.delivery?.provinceState}
                                </Typography>
                            </Paper>
                        </Grid>

                        {/* Service Configuration */}
                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service</InputLabel>
                                <Select
                                    value={formData.service}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        service: e.target.value,
                                        serviceType: '' // Reset service type when service changes
                                    }))}
                                    label="Service"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {carrierServices.map((service) => (
                                        <MenuItem key={service.name} value={service.name} sx={{ fontSize: '12px' }}>
                                            {service.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service Type</InputLabel>
                                <Select
                                    value={formData.serviceType}
                                    onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                                    label="Service Type"
                                    disabled={!formData.service}
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {getServiceTypeOptions(formData.service).map((type) => (
                                        <MenuItem key={type} value={type} sx={{ fontSize: '12px' }}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Rate Type and Currency */}
                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Rate Type</InputLabel>
                                <Select
                                    value={formData.rateType}
                                    onChange={(e) => setFormData(prev => ({ ...prev, rateType: e.target.value }))}
                                    label="Rate Type"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="skid_based" sx={{ fontSize: '12px' }}>Skid Based</MenuItem>
                                    <MenuItem value="weight_based" sx={{ fontSize: '12px' }}>Weight Based</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                <Select
                                    value={formData.currency}
                                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                    label="Currency"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD</MenuItem>
                                    <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.enabled}
                                        onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px' }}>
                                        Enable this rate card
                                    </Typography>
                                }
                            />
                        </Grid>

                        {/* Rate Configuration */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#374151', mt: 2, mb: 1 }}>
                                Rate Configuration
                            </Typography>

                            {formData.rateType === 'skid_based' && (
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Configure pricing based on number of skids/pallets
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={addSkidRate}
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add Skid Rate
                                        </Button>
                                    </Box>

                                    {formData.skidRates.map((rate, index) => (
                                        <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Skids"
                                                        type="number"
                                                        value={rate.skidCount}
                                                        onChange={(e) => updateSkidRate(index, 'skidCount', parseInt(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    />
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Price"
                                                        type="number"
                                                        value={rate.price}
                                                        onChange={(e) => updateSkidRate(index, 'price', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: `${formData.currency} ` }}
                                                    />
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Notes"
                                                        value={rate.notes}
                                                        onChange={(e) => updateSkidRate(index, 'notes', e.target.value)}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    />
                                                </Grid>
                                                <Grid item xs={1}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => removeSkidRate(index)}
                                                        color="error"
                                                    >
                                                        <DeleteIcon sx={{ fontSize: '16px' }} />
                                                    </IconButton>
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                    ))}
                                </Box>
                            )}

                            {formData.rateType === 'weight_based' && (
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Configure pricing based on weight ranges
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={addWeightRate}
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add Weight Rate
                                        </Button>
                                    </Box>

                                    {formData.weightRates.map((rate, index) => (
                                        <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Min Weight"
                                                        type="number"
                                                        value={rate.minWeight}
                                                        onChange={(e) => updateWeightRate(index, 'minWeight', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ endAdornment: 'lbs' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Max Weight"
                                                        type="number"
                                                        value={rate.maxWeight}
                                                        onChange={(e) => updateWeightRate(index, 'maxWeight', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ endAdornment: 'lbs' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Price per lb"
                                                        type="number"
                                                        value={rate.pricePerLb}
                                                        onChange={(e) => updateWeightRate(index, 'pricePerLb', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: `${formData.currency} ` }}
                                                    />
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Min Charge"
                                                        type="number"
                                                        value={rate.minimumCharge}
                                                        onChange={(e) => updateWeightRate(index, 'minimumCharge', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: `${formData.currency} ` }}
                                                    />
                                                </Grid>
                                                <Grid item xs={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Notes"
                                                        value={rate.notes}
                                                        onChange={(e) => updateWeightRate(index, 'notes', e.target.value)}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    />
                                                </Grid>
                                                <Grid item xs={1}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => removeWeightRate(index)}
                                                        color="error"
                                                    >
                                                        <DeleteIcon sx={{ fontSize: '16px' }} />
                                                    </IconButton>
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                    ))}
                                </Box>
                            )}
                        </Grid>

                        {/* Notes */}
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Notes"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                size="small"
                                multiline
                                rows={2}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                placeholder="Additional notes for this rate card..."
                            />
                        </Grid>
                    </Grid>
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() => setShowRateCardDialog(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveRateCard}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingRateCard ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{ sx: { height: '90vh' } }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MoneyIcon sx={{ color: '#10b981' }} />
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Enhanced Charge Mapping - {carrierName}
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {/* Header */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                                    Configure comprehensive rate cards for each route, service, and service type combination
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<ImportIcon />}
                                        onClick={() => setShowImportDialog(true)}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Import CSV
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<ExportIcon />}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Export CSV
                                    </Button>
                                </Box>
                            </Box>
                            <Alert severity="info" sx={{ fontSize: '12px' }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    <strong>Example:</strong> Barrie to Toronto, LTL Rush, 12 Skids = $599 CAD
                                </Typography>
                            </Alert>
                        </Box>

                        {/* Routes and Rate Cards */}
                        {renderRouteRateCards()}
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} sx={{ fontSize: '12px' }}>
                    Close
                </Button>
            </DialogActions>

            {/* Rate Card Dialog */}
            {renderRateCardDialog()}

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Delete Rate Card
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px', mb: 2 }}>
                        Are you sure you want to delete this rate card?
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#ef4444' }}>
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setShowDeleteConfirm(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDeleteRateCard}
                        color="error"
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete Rate Card
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Import Dialog */}
            <EnhancedChargeMappingImport
                isOpen={showImportDialog}
                onClose={() => setShowImportDialog(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                onImportComplete={() => {
                    setShowImportDialog(false);
                    loadRateCards();
                }}
            />
        </Dialog>
    );
};

export default EnhancedChargeMapping;
