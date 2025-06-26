import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Card,
    CardContent,
    Divider,
    Alert,
    CircularProgress,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Switch,
    FormControlLabel,
    Autocomplete
} from '@mui/material';
import {
    Calculate as CalculateIcon,
    TrendingUp as TrendingUpIcon,
    MonetizationOn as MoneyIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
    Assessment as AssessmentIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase/firebase';

const CommissionCalculator = ({ salesPersons: propSalesPersons }) => {
    // State
    const [salesPersons, setSalesPersons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Calculator form state for single shipment calculations
    const [calculatorForm, setCalculatorForm] = useState({
        salesPersonId: '',
        shipmentType: 'LTL',
        grossRevenue: '',
        netRevenue: '',
        commissionType: 'gross', // 'gross' or 'net'
        customCommissionRate: '',
        useCustomRate: false
    });

    // Bulk calculation state
    const [bulkCalculation, setBulkCalculation] = useState({
        startDate: '',
        endDate: '',
        salesPersonIds: [],
        includeUnpaidInvoices: false
    });

    const [calculationResults, setCalculationResults] = useState(null);
    const [showBulkResults, setShowBulkResults] = useState(false);

    // Cloud function references
    const getSalesPersons = httpsCallable(functions, 'getSalesPersons');
    const calculateCommissions = httpsCallable(functions, 'calculateCommissions');
    const getSalesPersonCommissionSummary = httpsCallable(functions, 'getSalesPersonCommissionSummary');

    // Load data on component mount
    useEffect(() => {
        // Use props if provided, otherwise load data
        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
        } else {
            loadSalesPersons();
        }
    }, [propSalesPersons]);

    // Update local state when prop changes
    useEffect(() => {
        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
        }
    }, [propSalesPersons]);

    const loadSalesPersons = async () => {
        try {
            setError('');
            const result = await getSalesPersons({ filters: { active: true }, limit: 100 });

            if (result.data && result.data.success) {
                setSalesPersons(result.data.data.salesPersons || []);
            } else if (result.data && result.data.data) {
                // Handle direct data format
                setSalesPersons(result.data.data.salesPersons || []);
            } else {
                setSalesPersons([]);
            }
        } catch (error) {
            console.error('Error loading sales persons:', error);
            setSalesPersons([]); // Set empty array instead of showing error for empty state

            // Only show error if it's not just an empty collection
            if (!error.message.includes('No sales persons found') &&
                !error.message.includes('empty') &&
                error.code !== 'not-found') {
                setError('Failed to load sales persons');
            }
        }
    };

    // Single shipment commission calculation
    const calculateSingleCommission = () => {
        const { salesPersonId, shipmentType, grossRevenue, netRevenue, commissionType, customCommissionRate, useCustomRate } = calculatorForm;

        if (!salesPersonId || !grossRevenue) {
            setError('Please select a sales person and enter gross revenue');
            return;
        }

        const selectedPerson = salesPersons.find(p => p.id === salesPersonId);
        if (!selectedPerson) {
            setError('Selected sales person not found');
            return;
        }

        const grossAmount = parseFloat(grossRevenue) || 0;
        const netAmount = parseFloat(netRevenue) || grossAmount * 0.8; // Default 20% margin

        let commissionRate = 0;
        const commissionSettings = selectedPerson.commissionSettings || {};

        if (useCustomRate && customCommissionRate) {
            commissionRate = parseFloat(customCommissionRate);
        } else {
            // Get rate based on shipment type and commission type
            switch (shipmentType.toLowerCase()) {
                case 'ltl':
                    commissionRate = commissionType === 'gross'
                        ? (commissionSettings.ltlGrossPercent || 0)
                        : (commissionSettings.ltlNetPercent || 0);
                    break;
                case 'courier':
                case 'spd':
                    commissionRate = commissionType === 'gross'
                        ? (commissionSettings.courierGrossPercent || 0)
                        : (commissionSettings.courierNetPercent || 0);
                    break;
                case 'log':
                case 'services':
                    commissionRate = commissionType === 'gross'
                        ? (commissionSettings.servicesGrossPercent || 0)
                        : (commissionSettings.servicesNetPercent || 0);
                    break;
                default:
                    commissionRate = 0;
            }
        }

        const revenueBase = commissionType === 'gross' ? grossAmount : netAmount;
        const commissionAmount = (revenueBase * commissionRate) / 100;
        const margin = grossAmount > 0 ? ((grossAmount - netAmount) / grossAmount * 100) : 0;

        const results = {
            type: 'single',
            salesPerson: `${selectedPerson.firstName} ${selectedPerson.lastName}`,
            shipmentType,
            grossRevenue: grossAmount,
            netRevenue: netAmount,
            margin: margin.toFixed(2),
            commissionType,
            commissionRate,
            revenueBase,
            commissionAmount,
            calculatedAt: new Date()
        };

        setCalculationResults(results);
        setError('');
        setSuccess('Commission calculated successfully');
    };

    // Bulk commission calculation
    const calculateBulkCommissions = async () => {
        try {
            setLoading(true);
            setError('');

            const { startDate, endDate, salesPersonIds, includeUnpaidInvoices } = bulkCalculation;

            if (!startDate || !endDate) {
                setError('Please select start and end dates');
                return;
            }

            const result = await calculateCommissions({
                startDate,
                endDate,
                salesPersonIds,
                companyIds: [],
                includeUnpaidInvoices
            });

            if (result.data && result.data.success) {
                setCalculationResults({
                    type: 'bulk',
                    ...result.data,
                    calculatedAt: new Date()
                });
                setShowBulkResults(true);
                setSuccess(`Calculated commissions for ${result.data.commissionsCount} shipments`);
            } else {
                setError('Failed to calculate bulk commissions');
            }

        } catch (error) {
            console.error('Error calculating bulk commissions:', error);
            setError(error.message || 'Failed to calculate bulk commissions');
        } finally {
            setLoading(false);
        }
    };

    const resetCalculator = () => {
        setCalculatorForm({
            salesPersonId: '',
            shipmentType: 'LTL',
            grossRevenue: '',
            netRevenue: '',
            commissionType: 'gross',
            customCommissionRate: '',
            useCustomRate: false
        });
        setCalculationResults(null);
        setError('');
        setSuccess('');
    };

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Commission Calculator
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Calculate commissions for individual shipments or bulk periods
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={resetCalculator}
                    sx={{ fontSize: '12px' }}
                >
                    Reset
                </Button>
            </Box>

            {/* Success/Error Messages */}
            {success && (
                <Alert severity="success" sx={{ mb: 2, fontSize: '12px' }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Single Shipment Calculator */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ border: '1px solid #e5e7eb' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <CalculateIcon sx={{ fontSize: 20, color: '#2563eb', mr: 1 }} />
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Single Shipment Calculator
                                </Typography>
                            </Box>

                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Autocomplete
                                        options={salesPersons}
                                        getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
                                        value={salesPersons.find(p => p.id === calculatorForm.salesPersonId) || null}
                                        onChange={(event, newValue) => {
                                            setCalculatorForm({
                                                ...calculatorForm,
                                                salesPersonId: newValue ? newValue.id : ''
                                            });
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Sales Person"
                                                size="small"
                                                required
                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            />
                                        )}
                                        size="small"
                                    />
                                </Grid>

                                <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Shipment Type</InputLabel>
                                        <Select
                                            value={calculatorForm.shipmentType}
                                            onChange={(e) => setCalculatorForm({
                                                ...calculatorForm,
                                                shipmentType: e.target.value
                                            })}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="LTL" sx={{ fontSize: '12px' }}>LTL</MenuItem>
                                            <MenuItem value="SPD" sx={{ fontSize: '12px' }}>SPD (Courier)</MenuItem>
                                            <MenuItem value="LOG" sx={{ fontSize: '12px' }}>LOG (Services)</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Commission Type</InputLabel>
                                        <Select
                                            value={calculatorForm.commissionType}
                                            onChange={(e) => setCalculatorForm({
                                                ...calculatorForm,
                                                commissionType: e.target.value
                                            })}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="gross" sx={{ fontSize: '12px' }}>Gross Revenue</MenuItem>
                                            <MenuItem value="net" sx={{ fontSize: '12px' }}>Net Revenue</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Gross Revenue"
                                        value={calculatorForm.grossRevenue}
                                        onChange={(e) => setCalculatorForm({
                                            ...calculatorForm,
                                            grossRevenue: e.target.value
                                        })}
                                        size="small"
                                        type="number"
                                        required
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{
                                            startAdornment: <Typography sx={{ fontSize: '12px', mr: 0.5 }}>$</Typography>
                                        }}
                                    />
                                </Grid>

                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Net Revenue"
                                        value={calculatorForm.netRevenue}
                                        onChange={(e) => setCalculatorForm({
                                            ...calculatorForm,
                                            netRevenue: e.target.value
                                        })}
                                        size="small"
                                        type="number"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{
                                            startAdornment: <Typography sx={{ fontSize: '12px', mr: 0.5 }}>$</Typography>
                                        }}
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={calculatorForm.useCustomRate}
                                                onChange={(e) => setCalculatorForm({
                                                    ...calculatorForm,
                                                    useCustomRate: e.target.checked
                                                })}
                                                size="small"
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Use Custom Commission Rate</Typography>}
                                    />
                                </Grid>

                                {calculatorForm.useCustomRate && (
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Custom Commission Rate"
                                            value={calculatorForm.customCommissionRate}
                                            onChange={(e) => setCalculatorForm({
                                                ...calculatorForm,
                                                customCommissionRate: e.target.value
                                            })}
                                            size="small"
                                            type="number"
                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{
                                                endAdornment: <Typography sx={{ fontSize: '12px', ml: 0.5 }}>%</Typography>
                                            }}
                                        />
                                    </Grid>
                                )}

                                <Grid item xs={12}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={calculateSingleCommission}
                                        size="small"
                                        startIcon={<CalculateIcon />}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Calculate Commission
                                    </Button>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Bulk Period Calculator */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ border: '1px solid #e5e7eb' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <AssessmentIcon sx={{ fontSize: 20, color: '#7c3aed', mr: 1 }} />
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Bulk Period Calculator
                                </Typography>
                            </Box>

                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Start Date"
                                        type="date"
                                        value={bulkCalculation.startDate}
                                        onChange={(e) => setBulkCalculation({
                                            ...bulkCalculation,
                                            startDate: e.target.value
                                        })}
                                        size="small"
                                        InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>

                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="End Date"
                                        type="date"
                                        value={bulkCalculation.endDate}
                                        onChange={(e) => setBulkCalculation({
                                            ...bulkCalculation,
                                            endDate: e.target.value
                                        })}
                                        size="small"
                                        InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <Autocomplete
                                        multiple
                                        options={salesPersons}
                                        getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
                                        value={salesPersons.filter(p => bulkCalculation.salesPersonIds.includes(p.id))}
                                        onChange={(event, newValue) => {
                                            setBulkCalculation({
                                                ...bulkCalculation,
                                                salesPersonIds: newValue.map(person => person.id)
                                            });
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Sales Persons (optional)"
                                                size="small"
                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            />
                                        )}
                                        renderTags={(value, getTagProps) =>
                                            value.map((option, index) => (
                                                <Chip
                                                    variant="outlined"
                                                    label={`${option.firstName} ${option.lastName}`}
                                                    size="small"
                                                    sx={{ fontSize: '11px' }}
                                                    {...getTagProps({ index })}
                                                />
                                            ))
                                        }
                                        size="small"
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={bulkCalculation.includeUnpaidInvoices}
                                                onChange={(e) => setBulkCalculation({
                                                    ...bulkCalculation,
                                                    includeUnpaidInvoices: e.target.checked
                                                })}
                                                size="small"
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Include Unpaid Invoices</Typography>}
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={calculateBulkCommissions}
                                        size="small"
                                        startIcon={loading ? <CircularProgress size={16} /> : <TrendingUpIcon />}
                                        disabled={loading}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {loading ? 'Calculating...' : 'Calculate Bulk Commissions'}
                                    </Button>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Results Display */}
                {calculationResults && (
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Box display="flex" alignItems="center" mb={2}>
                                <MoneyIcon sx={{ fontSize: 20, color: '#059669', mr: 1 }} />
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                    Calculation Results
                                </Typography>
                                <Chip
                                    label={calculationResults.type === 'single' ? 'Single Shipment' : 'Bulk Period'}
                                    size="small"
                                    color="primary"
                                    sx={{ ml: 2, fontSize: '11px' }}
                                />
                            </Box>

                            {calculationResults.type === 'single' ? (
                                // Single shipment results
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                Shipment Details
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px' }}>Sales Person: {calculationResults.salesPerson}</Typography>
                                            <Typography sx={{ fontSize: '12px' }}>Shipment Type: {calculationResults.shipmentType}</Typography>
                                            <Typography sx={{ fontSize: '12px' }}>Commission Type: {calculationResults.commissionType}</Typography>
                                            <Typography sx={{ fontSize: '12px' }}>Margin: {calculationResults.margin}%</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                Financial Breakdown
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px' }}>Gross Revenue: ${calculationResults.grossRevenue.toFixed(2)}</Typography>
                                            <Typography sx={{ fontSize: '12px' }}>Net Revenue: ${calculationResults.netRevenue.toFixed(2)}</Typography>
                                            <Typography sx={{ fontSize: '12px' }}>Commission Rate: {calculationResults.commissionRate}%</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                                                Commission Amount: ${calculationResults.commissionAmount.toFixed(2)}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            ) : (
                                // Bulk results
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={8}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6} md={3}>
                                                <Box textAlign="center" p={2} sx={{ backgroundColor: '#f0fdf4', borderRadius: 1 }}>
                                                    <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#059669' }}>
                                                        ${calculationResults.payableCommissionAmount?.toFixed(2) || '0.00'}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#065f46' }}>
                                                        Payable Commissions
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Box textAlign="center" p={2} sx={{ backgroundColor: '#fef3c7', borderRadius: 1 }}>
                                                    <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#d97706' }}>
                                                        ${calculationResults.pendingCommissionAmount?.toFixed(2) || '0.00'}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#92400e' }}>
                                                        Pending Commissions
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Box textAlign="center" p={2} sx={{ backgroundColor: '#eff6ff', borderRadius: 1 }}>
                                                    <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#2563eb' }}>
                                                        {calculationResults.commissionsCount || 0}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#1e40af' }}>
                                                        Total Commissions
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Box textAlign="center" p={2} sx={{ backgroundColor: '#f3f4f6', borderRadius: 1 }}>
                                                    <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#374151' }}>
                                                        {calculationResults.shipmentCount || 0}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        Shipments
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Alert severity="info" sx={{ fontSize: '12px' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                Remember: Only Payable!
                                            </Typography>
                                            Commissions are only payable on invoices that have been paid.
                                            Pending commissions will become payable once invoices are collected.
                                        </Alert>
                                    </Grid>
                                </Grid>
                            )}

                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 2 }}>
                                Calculated on: {calculationResults.calculatedAt.toLocaleString()}
                            </Typography>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};

export default CommissionCalculator; 