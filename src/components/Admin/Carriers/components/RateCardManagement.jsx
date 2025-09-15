/**
 * Rate Card Management Component
 * Handles CRUD operations for carrier rate cards in admin interface
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
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Grid,
    Tabs,
    Tab
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    MonetizationOn as MoneyIcon,
    CloudUpload as ImportIcon,
    LocalShipping as TruckIcon,
    Speed as SpeedIcon,
    Map as MapIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import RateCardImportDialog from './RateCardImportDialog';
import EnhancedGeographicRateCardImport from './EnhancedGeographicRateCardImport';
import QuickShipZoneRateManagement from './QuickShipZoneRateManagement';
import EnhancedChargeMapping from './EnhancedChargeMapping';

const RateCardManagement = ({ carrierId, carrierName, isOpen, onClose, zoneConfig }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [rateCards, setRateCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRateCardDialog, setShowRateCardDialog] = useState(false);
    const [editingRateCard, setEditingRateCard] = useState(null);
    const [selectedTab, setSelectedTab] = useState(0);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteRateCardId, setDeleteRateCardId] = useState(null);
    const [deleteRateCardName, setDeleteRateCardName] = useState('');
    const [showEnhancedImport, setShowEnhancedImport] = useState(false);
    const [showZoneRateManagement, setShowZoneRateManagement] = useState(false);
    const [showEnhancedChargeMapping, setShowEnhancedChargeMapping] = useState(false);

    // Form state for rate card dialog
    const [formData, setFormData] = useState({
        rateCardName: '',
        rateType: 'skid_based',
        enabled: true,
        currency: 'CAD',
        skidRates: [],
        weightBreaks: [],
        zones: [],
        flatRate: 0
    });

    // Load rate cards when component opens
    useEffect(() => {
        if (isOpen && carrierId) {
            loadRateCards();
        }
    }, [isOpen, carrierId]);

    const loadRateCards = useCallback(async () => {
        if (!carrierId) return;

        setLoading(true);
        try {
            const getCarrierRateCards = httpsCallable(functions, 'getCarrierRateCards');
            const result = await getCarrierRateCards({ carrierId });

            if (result.data.success) {
                setRateCards(result.data.rateCards || []);
            } else {
                enqueueSnackbar('Failed to load rate cards', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading rate cards:', error);
            enqueueSnackbar('Error loading rate cards', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, enqueueSnackbar]);

    const handleAddRateCard = () => {
        setEditingRateCard(null);
        setFormData({
            rateCardName: '',
            rateType: 'skid_based',
            enabled: true,
            currency: 'CAD',
            skidRates: [],
            weightBreaks: [],
            zones: [],
            flatRate: 0
        });
        setShowRateCardDialog(true);
    };

    const handleEditRateCard = (rateCard) => {
        setEditingRateCard(rateCard);
        setFormData({
            rateCardName: rateCard.rateCardName || '',
            rateType: rateCard.rateType || 'skid_based',
            enabled: rateCard.enabled !== false,
            currency: rateCard.currency || 'CAD',
            skidRates: rateCard.skidRates || [],
            weightBreaks: rateCard.weightBreaks || [],
            zones: rateCard.zones || [],
            flatRate: rateCard.flatRate || 0
        });
        setShowRateCardDialog(true);
    };

    const handleSaveRateCard = async () => {
        try {
            if (!formData.rateCardName.trim()) {
                enqueueSnackbar('Rate card name is required', { variant: 'error' });
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
        setDeleteRateCardName(rateCard.rateCardName);
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
            setDeleteRateCardName('');
        }
    };

    const addSkidRate = () => {
        setFormData(prev => ({
            ...prev,
            skidRates: [...prev.skidRates, {
                skidCount: 1,
                retailPrice: 0,
                ourCost: 0,
                alternateCarrier: null,
                rushAvailable: false,
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

    const addWeightBreak = () => {
        setFormData(prev => ({
            ...prev,
            weightBreaks: [...prev.weightBreaks, {
                minWeight: 0,
                maxWeight: 50,
                rate: 0,
                minimumCharge: 0
            }]
        }));
    };

    const updateWeightBreak = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            weightBreaks: prev.weightBreaks.map((wb, i) =>
                i === index ? { ...wb, [field]: value } : wb
            )
        }));
    };

    const removeWeightBreak = (index) => {
        setFormData(prev => ({
            ...prev,
            weightBreaks: prev.weightBreaks.filter((_, i) => i !== index)
        }));
    };

    // Zone rate management functions
    const addZoneRate = () => {
        setFormData(prev => ({
            ...prev,
            zones: [...prev.zones, {
                routeType: 'Province to Province',
                originZone: '',
                destinationZone: '',
                costPerMile: 0,
                minimumCharge: 0,
                notes: ''
            }]
        }));
    };

    const updateZoneRate = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            zones: prev.zones.map((zone, i) =>
                i === index ? { ...zone, [field]: value } : zone
            )
        }));
    };

    const removeZoneRate = (index) => {
        setFormData(prev => ({
            ...prev,
            zones: prev.zones.filter((_, i) => i !== index)
        }));
    };

    const getRateTypeIcon = (rateType) => {
        switch (rateType) {
            case 'skid_based': return <TruckIcon sx={{ fontSize: '16px' }} />;
            case 'weight_based': return <SpeedIcon sx={{ fontSize: '16px' }} />;
            case 'zone_based': return <MapIcon sx={{ fontSize: '16px' }} />;
            default: return <MoneyIcon sx={{ fontSize: '16px' }} />;
        }
    };

    const getRateTypeLabel = (rateType) => {
        switch (rateType) {
            case 'skid_based': return 'Skid Based';
            case 'weight_based': return 'Weight Based';
            case 'zone_based': return 'Zone Based';
            default: return 'Flat Rate';
        }
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { height: '90vh' } }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MoneyIcon sx={{ color: '#10b981' }} />
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Rate Card Management - {carrierName}
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
                        {/* Header with Add Button */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                                Configure rate cards for automatic rate calculation
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<ImportIcon />}
                                    onClick={() => setShowImportDialog(true)}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Basic Import
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<MapIcon />}
                                    onClick={() => setShowEnhancedImport(true)}
                                    sx={{
                                        fontSize: '12px',
                                        color: '#7c3aed',
                                        borderColor: '#7c3aed',
                                        '&:hover': {
                                            backgroundColor: '#f3f4f6',
                                            borderColor: '#7c3aed'
                                        }
                                    }}
                                >
                                    Geographic Import
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<MapIcon />}
                                    onClick={() => setShowZoneRateManagement(true)}
                                    sx={{
                                        fontSize: '12px',
                                        color: '#10b981',
                                        borderColor: '#10b981',
                                        '&:hover': {
                                            backgroundColor: '#f0fdf4',
                                            borderColor: '#10b981'
                                        }
                                    }}
                                >
                                    Zone Rate Mapping
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<MoneyIcon />}
                                    onClick={() => setShowEnhancedChargeMapping(true)}
                                    sx={{
                                        fontSize: '12px',
                                        backgroundColor: '#7c3aed',
                                        '&:hover': {
                                            backgroundColor: '#6d28d9'
                                        }
                                    }}
                                >
                                    Enhanced Charge Mapping
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddRateCard}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Add Rate Card
                                </Button>
                            </Box>
                        </Box>

                        {/* Rate Cards Table */}
                        <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Rate Card</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Currency</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rateCards.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                    No rate cards configured. Add a rate card to enable auto-rate calculation.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rateCards.map((rateCard) => (
                                            <TableRow key={rateCard.id}>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rateCard.rateCardName}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        {getRateTypeIcon(rateCard.rateType)}
                                                        {getRateTypeLabel(rateCard.rateType)}
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rateCard.currency || 'CAD'}
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
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} sx={{ fontSize: '12px' }}>
                    Close
                </Button>
            </DialogActions>

            {/* Rate Card Form Dialog */}
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
                        {/* Basic Information */}
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Rate Card Name"
                                value={formData.rateCardName}
                                onChange={(e) => setFormData(prev => ({ ...prev, rateCardName: e.target.value }))}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                required
                            />
                        </Grid>

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
                                    <MenuItem value="geographic_skid" sx={{ fontSize: '12px' }}>Geographic Skid Matrix</MenuItem>
                                    <MenuItem value="weight_based" sx={{ fontSize: '12px' }}>Weight Based</MenuItem>
                                    <MenuItem value="zone_based" sx={{ fontSize: '12px' }}>Zone Based</MenuItem>
                                    <MenuItem value="flat" sx={{ fontSize: '12px' }}>Flat Rate</MenuItem>
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
                                                <Grid item xs={2}>
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
                                                <Grid item xs={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Sell"
                                                        type="number"
                                                        value={rate.retailPrice}
                                                        onChange={(e) => updateSkidRate(index, 'retailPrice', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: '$' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Our Cost"
                                                        type="number"
                                                        value={rate.ourCost}
                                                        onChange={(e) => updateSkidRate(index, 'ourCost', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: '$' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={3}>
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
                                            onClick={addWeightBreak}
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add Weight Break
                                        </Button>
                                    </Box>

                                    {formData.weightBreaks.map((wb, index) => (
                                        <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Min Weight"
                                                        type="number"
                                                        value={wb.minWeight}
                                                        onChange={(e) => updateWeightBreak(index, 'minWeight', parseFloat(e.target.value))}
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
                                                        value={wb.maxWeight}
                                                        onChange={(e) => updateWeightBreak(index, 'maxWeight', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ endAdornment: 'lbs' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Rate per lb"
                                                        type="number"
                                                        value={wb.rate}
                                                        onChange={(e) => updateWeightBreak(index, 'rate', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: '$' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Min Charge"
                                                        type="number"
                                                        value={wb.minimumCharge}
                                                        onChange={(e) => updateWeightBreak(index, 'minimumCharge', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: '$' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={1}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => removeWeightBreak(index)}
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

                            {formData.rateType === 'zone_based' && (
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Configure pricing based on origin/destination zones and route types
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={addZoneRate}
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Add Zone Rate
                                        </Button>
                                    </Box>

                                    {formData.zones.map((zone, index) => (
                                        <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs={2}>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel sx={{ fontSize: '12px' }}>Route Type</InputLabel>
                                                        <Select
                                                            value={zone.routeType}
                                                            onChange={(e) => updateZoneRate(index, 'routeType', e.target.value)}
                                                            label="Route Type"
                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                        >
                                                            <MenuItem value="Province to Province" sx={{ fontSize: '12px' }}>Province to Province</MenuItem>
                                                            <MenuItem value="Province to State" sx={{ fontSize: '12px' }}>Province to State</MenuItem>
                                                            <MenuItem value="State to Province" sx={{ fontSize: '12px' }}>State to Province</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Origin Zone"
                                                        value={zone.originZone}
                                                        onChange={(e) => updateZoneRate(index, 'originZone', e.target.value)}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        placeholder="ON, QC, NY..."
                                                    />
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Destination Zone"
                                                        value={zone.destinationZone}
                                                        onChange={(e) => updateZoneRate(index, 'destinationZone', e.target.value)}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        placeholder="BC, AB, CA..."
                                                    />
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Cost Per Mile"
                                                        type="number"
                                                        value={zone.costPerMile}
                                                        onChange={(e) => updateZoneRate(index, 'costPerMile', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: '$' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={2}>
                                                    <TextField
                                                        fullWidth
                                                        label="Min Charge"
                                                        type="number"
                                                        value={zone.minimumCharge}
                                                        onChange={(e) => updateZoneRate(index, 'minimumCharge', parseFloat(e.target.value))}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        InputProps={{ startAdornment: '$' }}
                                                    />
                                                </Grid>
                                                <Grid item xs={1}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => removeZoneRate(index)}
                                                        color="error"
                                                    >
                                                        <DeleteIcon sx={{ fontSize: '16px' }} />
                                                    </IconButton>
                                                </Grid>
                                            </Grid>
                                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                                <Grid item xs={11}>
                                                    <TextField
                                                        fullWidth
                                                        label="Notes"
                                                        value={zone.notes}
                                                        onChange={(e) => updateZoneRate(index, 'notes', e.target.value)}
                                                        size="small"
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                        placeholder="Route description..."
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                    ))}
                                </Box>
                            )}

                            {formData.rateType === 'flat' && (
                                <TextField
                                    fullWidth
                                    label="Flat Rate"
                                    type="number"
                                    value={formData.flatRate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, flatRate: parseFloat(e.target.value) }))}
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    InputProps={{ startAdornment: '$' }}
                                />
                            )}
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

            {/* Import Dialog */}
            <RateCardImportDialog
                isOpen={showImportDialog}
                onClose={() => setShowImportDialog(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                onImportComplete={() => {
                    setShowImportDialog(false);
                    loadRateCards(); // Refresh the rate cards list
                }}
            />

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
                        Are you sure you want to delete the rate card "{deleteRateCardName}"?
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#ef4444' }}>
                        This action cannot be undone. All associated skid rates, weight breaks, and zones will be permanently deleted.
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

            {/* Enhanced Geographic Import Dialog */}
            <EnhancedGeographicRateCardImport
                isOpen={showEnhancedImport}
                onClose={() => setShowEnhancedImport(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                onImportComplete={() => {
                    setShowEnhancedImport(false);
                    loadRateCards();
                }}
            />

            {/* Zone Rate Management Dialog */}
            <QuickShipZoneRateManagement
                isOpen={showZoneRateManagement}
                onClose={() => setShowZoneRateManagement(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                zoneConfig={zoneConfig}
                onOpenEnhancedChargeMapping={() => setShowEnhancedChargeMapping(true)}
            />

            {/* Enhanced Charge Mapping Dialog */}
            <EnhancedChargeMapping
                isOpen={showEnhancedChargeMapping}
                onClose={() => setShowEnhancedChargeMapping(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                zoneConfig={zoneConfig}
            />
        </Dialog>
    );
};

export default RateCardManagement;
