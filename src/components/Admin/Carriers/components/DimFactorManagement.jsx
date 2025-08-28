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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Chip,
    Alert,
    Grid,
    Card,
    CardContent,
    Tooltip,
    CircularProgress
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Info as InfoIcon,
    Calculate as CalculateIcon,
    CheckCircle as ActiveIcon,
    Cancel as InactiveIcon
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useSnackbar } from 'notistack';
import { functions } from '../../../../firebase/firebase';
import { httpsCallable } from 'firebase/functions';

// Cloud Functions
const createDimFactor = httpsCallable(functions, 'createDimFactor');
const getDimFactors = httpsCallable(functions, 'getDimFactors');
const updateDimFactor = httpsCallable(functions, 'updateDimFactor');
const deleteDimFactor = httpsCallable(functions, 'deleteDimFactor');
const calculateVolumetricWeight = httpsCallable(functions, 'calculateVolumetricWeight');

const DimFactorManagement = ({ carrier }) => {
    const { enqueueSnackbar } = useSnackbar();

    // State
    const [dimFactors, setDimFactors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [testDialogOpen, setTestDialogOpen] = useState(false);
    const [editingFactor, setEditingFactor] = useState(null);
    const [formData, setFormData] = useState({
        serviceType: 'all',
        zone: 'all',
        dimFactor: '',
        unit: 'in³/lb',
        effectiveDate: new Date(),
        expiryDate: null,
        isActive: true,
        notes: ''
    });
    const [testData, setTestData] = useState({
        length: '24',
        width: '18',
        height: '12',
        actualWeight: '10',
        dimensionUnit: 'in',
        weightUnit: 'lbs',
        serviceType: 'all',
        zone: 'all'
    });
    const [testResult, setTestResult] = useState(null);
    const [testLoading, setTestLoading] = useState(false);

    // Load DIM factors
    const loadDimFactors = useCallback(async () => {
        try {
            setLoading(true);
            const result = await getDimFactors({
                carrierId: carrier.id,
                activeOnly: false
            });

            if (result.data.success) {
                setDimFactors(result.data.dimFactors);
            } else {
                enqueueSnackbar('Failed to load DIM factors', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading DIM factors:', error);
            enqueueSnackbar('Failed to load DIM factors', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrier.id, enqueueSnackbar]);

    useEffect(() => {
        if (carrier?.id) {
            loadDimFactors();
        }
    }, [carrier?.id, loadDimFactors]);

    // Handle form submission
    const handleSubmit = async () => {
        try {
            const submitData = {
                carrierId: carrier.id,
                carrierName: carrier.name,
                ...formData,
                dimFactor: parseFloat(formData.dimFactor),
                effectiveDate: formData.effectiveDate?.toISOString(),
                expiryDate: formData.expiryDate?.toISOString() || null
            };

            let result;
            if (editingFactor) {
                result = await updateDimFactor({
                    dimFactorId: editingFactor.id,
                    updates: submitData
                });
            } else {
                result = await createDimFactor(submitData);
            }

            if (result.data.success) {
                enqueueSnackbar(
                    editingFactor ? 'DIM factor updated successfully' : 'DIM factor created successfully',
                    { variant: 'success' }
                );
                handleCloseDialog();
                loadDimFactors();
            } else {
                enqueueSnackbar(result.data.message || 'Operation failed', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error saving DIM factor:', error);
            enqueueSnackbar('Failed to save DIM factor', { variant: 'error' });
        }
    };

    // Handle delete
    const handleDelete = async (dimFactorId) => {
        if (!window.confirm('Are you sure you want to delete this DIM factor?')) {
            return;
        }

        try {
            const result = await deleteDimFactor({ dimFactorId });

            if (result.data.success) {
                enqueueSnackbar('DIM factor deleted successfully', { variant: 'success' });
                loadDimFactors();
            } else {
                enqueueSnackbar(result.data.message || 'Delete failed', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error deleting DIM factor:', error);
            enqueueSnackbar('Failed to delete DIM factor', { variant: 'error' });
        }
    };

    // Handle test calculation
    const handleTestCalculation = async () => {
        try {
            setTestLoading(true);
            const result = await calculateVolumetricWeight({
                carrierId: carrier.id,
                serviceType: testData.serviceType,
                zone: testData.zone,
                length: parseFloat(testData.length),
                width: parseFloat(testData.width),
                height: parseFloat(testData.height),
                actualWeight: parseFloat(testData.actualWeight),
                dimensionUnit: testData.dimensionUnit,
                weightUnit: testData.weightUnit
            });

            if (result.data.success) {
                setTestResult(result.data);
            } else {
                enqueueSnackbar('Calculation failed', { variant: 'error' });
                setTestResult(null);
            }
        } catch (error) {
            console.error('Error testing calculation:', error);
            enqueueSnackbar('Test calculation failed', { variant: 'error' });
            setTestResult(null);
        } finally {
            setTestLoading(false);
        }
    };

    // Dialog handlers
    const handleOpenDialog = (factor = null) => {
        if (factor) {
            setEditingFactor(factor);
            setFormData({
                serviceType: factor.serviceType || 'all',
                zone: factor.zone || 'all',
                dimFactor: factor.dimFactor.toString(),
                unit: factor.unit,
                effectiveDate: factor.effectiveDate ? new Date(factor.effectiveDate) : new Date(),
                expiryDate: factor.expiryDate ? new Date(factor.expiryDate) : null,
                isActive: factor.isActive,
                notes: factor.notes || ''
            });
        } else {
            setEditingFactor(null);
            setFormData({
                serviceType: 'all',
                zone: 'all',
                dimFactor: '',
                unit: 'in³/lb',
                effectiveDate: new Date(),
                expiryDate: null,
                isActive: true,
                notes: ''
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingFactor(null);
    };

    // Form handlers
    const handleFormChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleTestDataChange = (field, value) => {
        setTestData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Get status color
    const getStatusColor = (factor) => {
        if (!factor.isActive) return 'error';
        if (!factor.isCurrentlyEffective) return 'warning';
        return 'success';
    };

    const getStatusLabel = (factor) => {
        if (!factor.isActive) return 'Inactive';
        if (!factor.isCurrentlyEffective) return 'Scheduled';
        return 'Active';
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    DIM Factor Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CalculateIcon />}
                        onClick={() => setTestDialogOpen(true)}
                        sx={{ fontSize: '12px' }}
                    >
                        Test Calculator
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog()}
                        sx={{ fontSize: '12px' }}
                    >
                        Add DIM Factor
                    </Button>
                </Box>
            </Box>

            {/* DIM Factors Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Service / Zone
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                DIM Factor
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Effective Period
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Status
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {dimFactors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4, fontSize: '12px', color: '#6b7280' }}>
                                    No DIM factors configured. Add your first DIM factor to enable volumetric weight calculations.
                                </TableCell>
                            </TableRow>
                        ) : (
                            dimFactors.map((factor) => (
                                <TableRow key={factor.id} hover>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {factor.serviceType === 'all' ? 'All Services' : factor.serviceType}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {factor.zone === 'all' ? 'All Zones' : factor.zone}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {factor.dimFactor}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {factor.unit}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {new Date(factor.effectiveDate).toLocaleDateString()}
                                            </Typography>
                                            {factor.expiryDate && (
                                                <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    → {new Date(factor.expiryDate).toLocaleDateString()}
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={getStatusLabel(factor)}
                                            color={getStatusColor(factor)}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <Tooltip title="Edit DIM Factor">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenDialog(factor)}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete DIM Factor">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDelete(factor.id)}
                                                    color="error"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Add/Edit Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingFactor ? 'Edit DIM Factor' : 'Add DIM Factor'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service Type</InputLabel>
                                <Select
                                    value={formData.serviceType}
                                    onChange={(e) => handleFormChange('serviceType', e.target.value)}
                                    label="Service Type"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>All Services</MenuItem>
                                    <MenuItem value="express" sx={{ fontSize: '12px' }}>Express</MenuItem>
                                    <MenuItem value="ground" sx={{ fontSize: '12px' }}>Ground</MenuItem>
                                    <MenuItem value="priority" sx={{ fontSize: '12px' }}>Priority</MenuItem>
                                    <MenuItem value="economy" sx={{ fontSize: '12px' }}>Economy</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Zone</InputLabel>
                                <Select
                                    value={formData.zone}
                                    onChange={(e) => handleFormChange('zone', e.target.value)}
                                    label="Zone"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>All Zones</MenuItem>
                                    <MenuItem value="local" sx={{ fontSize: '12px' }}>Local</MenuItem>
                                    <MenuItem value="regional" sx={{ fontSize: '12px' }}>Regional</MenuItem>
                                    <MenuItem value="national" sx={{ fontSize: '12px' }}>National</MenuItem>
                                    <MenuItem value="international" sx={{ fontSize: '12px' }}>International</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="DIM Factor"
                                value={formData.dimFactor}
                                onChange={(e) => handleFormChange('dimFactor', e.target.value)}
                                type="number"
                                inputProps={{ min: 0, step: 0.1 }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                                helperText="Higher factor = lower volumetric weight"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Unit</InputLabel>
                                <Select
                                    value={formData.unit}
                                    onChange={(e) => handleFormChange('unit', e.target.value)}
                                    label="Unit"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="in³/lb" sx={{ fontSize: '12px' }}>in³/lb (Imperial)</MenuItem>
                                    <MenuItem value="cm³/kg" sx={{ fontSize: '12px' }}>cm³/kg (Metric)</MenuItem>
                                    <MenuItem value="in³/kg" sx={{ fontSize: '12px' }}>in³/kg (Mixed)</MenuItem>
                                    <MenuItem value="cm³/lb" sx={{ fontSize: '12px' }}>cm³/lb (Mixed)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Effective Date"
                                    value={formData.effectiveDate}
                                    onChange={(date) => handleFormChange('effectiveDate', date)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: 'small',
                                            InputLabelProps: { sx: { fontSize: '12px' } },
                                            InputProps: { sx: { fontSize: '12px' } }
                                        }
                                    }}
                                />
                            </LocalizationProvider>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Expiry Date (Optional)"
                                    value={formData.expiryDate}
                                    onChange={(date) => handleFormChange('expiryDate', date)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: 'small',
                                            InputLabelProps: { sx: { fontSize: '12px' } },
                                            InputProps: { sx: { fontSize: '12px' } }
                                        }
                                    }}
                                />
                            </LocalizationProvider>
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Notes"
                                value={formData.notes}
                                onChange={(e) => handleFormChange('notes', e.target.value)}
                                multiline
                                rows={2}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Optional notes about this DIM factor configuration"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.isActive}
                                        onChange={(e) => handleFormChange('isActive', e.target.checked)}
                                    />
                                }
                                label="Active"
                                sx={{ '& .MuiFormControlLabel-label': { fontSize: '12px' } }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button
                        onClick={handleCloseDialog}
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
                        sx={{ fontSize: '12px' }}
                    >
                        {editingFactor ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Test Calculator Dialog */}
            <Dialog
                open={testDialogOpen}
                onClose={() => setTestDialogOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    DIM Weight Test Calculator
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Length"
                                value={testData.length}
                                onChange={(e) => handleTestDataChange('length', e.target.value)}
                                type="number"
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Width"
                                value={testData.width}
                                onChange={(e) => handleTestDataChange('width', e.target.value)}
                                type="number"
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Height"
                                value={testData.height}
                                onChange={(e) => handleTestDataChange('height', e.target.value)}
                                type="number"
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Actual Weight"
                                value={testData.actualWeight}
                                onChange={(e) => handleTestDataChange('actualWeight', e.target.value)}
                                type="number"
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Dimension Unit</InputLabel>
                                <Select
                                    value={testData.dimensionUnit}
                                    onChange={(e) => handleTestDataChange('dimensionUnit', e.target.value)}
                                    label="Dimension Unit"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="in" sx={{ fontSize: '12px' }}>Inches</MenuItem>
                                    <MenuItem value="cm" sx={{ fontSize: '12px' }}>Centimeters</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleTestCalculation}
                                disabled={testLoading}
                                startIcon={testLoading ? <CircularProgress size={16} /> : <CalculateIcon />}
                                sx={{ fontSize: '12px' }}
                            >
                                Calculate DIM Weight
                            </Button>
                        </Grid>

                        {testResult && (
                            <Grid item xs={12}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                            Calculation Result
                                        </Typography>

                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    Actual Weight:
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                    {testResult.actualWeight} lbs
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    Volumetric Weight:
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                    {testResult.volumetricWeight} lbs
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    Chargeable Weight:
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#059669' }}>
                                                    {testResult.chargeableWeight} lbs
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="body2" sx={{ fontSize: '11px', fontStyle: 'italic', color: '#6b7280' }}>
                                                    {testResult.calculation}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button
                        onClick={() => setTestDialogOpen(false)}
                        variant="outlined"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DimFactorManagement;
