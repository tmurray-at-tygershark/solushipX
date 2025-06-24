import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Grid,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    CircularProgress,
    Alert,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Chip,
    Tooltip,
    Card,
    CardContent,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    ExpandMore as ExpandMoreIcon,
    TrendingUp as TrendingUpIcon,
    LocalShipping as LocalShippingIcon,
    Public as PublicIcon,
    Scale as ScaleIcon,
    Accessibility as AccessibilityIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import AddEditFixedRateDialog from './AddEditFixedRateDialog';
import dayjs from 'dayjs';

const FixedRatesTab = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [fixedRates, setFixedRates] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState(null);

    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [editingRate, setEditingRate] = useState(null);
    const [deletingRateId, setDeletingRateId] = useState(null);

    // Enhanced Filters State with proper filtering
    const [filters, setFilters] = useState({
        companyId: 'ANY',
        carrierId: 'ANY',
        fromCountry: 'ANY',
        toCountry: 'ANY',
        service: 'ANY',
        rateType: 'ANY',
        minValue: '',
        maxValue: '',
        isActive: 'ANY',
        searchTerm: ''
    });

    // Statistics
    const [statistics, setStatistics] = useState({
        totalRates: 0,
        activeRates: 0,
        expiredRates: 0,
        averageValue: 0,
        totalRevenue: 0
    });

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            companyId: 'ANY',
            carrierId: 'ANY',
            fromCountry: 'ANY',
            toCountry: 'ANY',
            service: 'ANY',
            rateType: 'ANY',
            minValue: '',
            maxValue: '',
            isActive: 'ANY',
            searchTerm: ''
        });
    };

    const fetchSupportingData = useCallback(async () => {
        try {
            // Fetch companies
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCompanies(companiesData);

            // Fetch carriers
            const carriersSnapshot = await getDocs(collection(db, 'carriers'));
            const carriersData = carriersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCarriers(carriersData);
        } catch (err) {
            console.error("Error fetching supporting data:", err);
        }
    }, []);

    const fetchFixedRates = useCallback(async () => {
        setLoadingData(true);
        setError(null);
        try {
            // Base query for fixed rates
            let q = query(
                collection(db, 'markups'),
                where('markupScope', '==', 'fixedRate'),
                orderBy('createdAt', 'desc')
            );

            const ratesSnapshot = await getDocs(q);
            let ratesData = ratesSnapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                return {
                    id: docSnapshot.id,
                    ...data,
                    // Denormalize company and carrier names
                    companyName: companies.find(c => c.id === data.companyId)?.name || data.companyId || 'Any Company',
                    carrierName: carriers.find(c => c.id === data.carrierId)?.name || data.carrierId || 'Any Carrier',
                    // Calculate active status
                    isActive: !data.expiryDate || new Date(data.expiryDate) > new Date(),
                    // Format display values
                    displayValue: `${data.value || 0}${data.type === 'PERCENTAGE' ? '%' : ''}`,
                    formattedEffectiveDate: data.effectiveDate ? dayjs(data.effectiveDate).format('MMM DD, YYYY') : 'N/A',
                    formattedExpiryDate: data.expiryDate ? dayjs(data.expiryDate).format('MMM DD, YYYY') : 'Never'
                };
            });

            // Apply client-side filtering
            if (filters.companyId !== 'ANY') {
                ratesData = ratesData.filter(rate => rate.companyId === filters.companyId);
            }
            if (filters.carrierId !== 'ANY') {
                ratesData = ratesData.filter(rate => rate.carrierId === filters.carrierId);
            }
            if (filters.fromCountry !== 'ANY') {
                ratesData = ratesData.filter(rate => rate.fromCountry === filters.fromCountry || rate.fromCountry === 'ANY');
            }
            if (filters.toCountry !== 'ANY') {
                ratesData = ratesData.filter(rate => rate.toCountry === filters.toCountry || rate.toCountry === 'ANY');
            }
            if (filters.service !== 'ANY') {
                ratesData = ratesData.filter(rate => rate.service === filters.service || rate.service === 'ANY');
            }
            if (filters.rateType !== 'ANY') {
                ratesData = ratesData.filter(rate => rate.type === filters.rateType);
            }
            if (filters.minValue) {
                ratesData = ratesData.filter(rate => (rate.value || 0) >= parseFloat(filters.minValue));
            }
            if (filters.maxValue) {
                ratesData = ratesData.filter(rate => (rate.value || 0) <= parseFloat(filters.maxValue));
            }
            if (filters.isActive !== 'ANY') {
                ratesData = ratesData.filter(rate => rate.isActive === (filters.isActive === 'true'));
            }
            if (filters.searchTerm) {
                const searchLower = filters.searchTerm.toLowerCase();
                ratesData = ratesData.filter(rate =>
                    rate.companyName?.toLowerCase().includes(searchLower) ||
                    rate.carrierName?.toLowerCase().includes(searchLower) ||
                    rate.service?.toLowerCase().includes(searchLower) ||
                    rate.type?.toLowerCase().includes(searchLower) ||
                    rate.fromCity?.toLowerCase().includes(searchLower) ||
                    rate.toCity?.toLowerCase().includes(searchLower)
                );
            }

            setFixedRates(ratesData);

            // Calculate statistics
            const totalRates = ratesData.length;
            const activeRates = ratesData.filter(rate => rate.isActive).length;
            const expiredRates = totalRates - activeRates;
            const averageValue = ratesData.reduce((sum, rate) => sum + (rate.value || 0), 0) / (totalRates || 1);
            const totalRevenue = ratesData.filter(rate => rate.isActive).reduce((sum, rate) => sum + (rate.value || 0), 0);

            setStatistics({
                totalRates,
                activeRates,
                expiredRates,
                averageValue,
                totalRevenue
            });

        } catch (err) {
            console.error("Error fetching fixed rates:", err);
            setError("Could not load fixed rates.");
            enqueueSnackbar('Error fetching fixed rates: ' + err.message, { variant: 'error' });
        } finally {
            setLoadingData(false);
        }
    }, [enqueueSnackbar, filters, companies, carriers]);

    useEffect(() => {
        fetchSupportingData();
    }, [fetchSupportingData]);

    useEffect(() => {
        if (companies.length > 0 && carriers.length > 0) {
            fetchFixedRates();
        }
    }, [fetchFixedRates, companies.length, carriers.length]);

    const handleAddRateOpen = () => {
        setEditingRate(null);
        setIsAddEditDialogOpen(true);
    };

    const handleEditRateOpen = (rate) => {
        setEditingRate(rate);
        setIsAddEditDialogOpen(true);
    };

    const handleDialogClose = () => {
        setIsAddEditDialogOpen(false);
        setEditingRate(null);
    };

    const handleSaveRate = async (rateDataFromDialog) => {
        const { id, ...dataFields } = rateDataFromDialog;
        const dataToSave = {
            ...dataFields,
            markupScope: 'fixedRate',
            updatedAt: serverTimestamp(),
            value: parseFloat(dataFields.value) || 0,
            fromWeight: parseFloat(dataFields.fromWeight) || 0,
            toWeight: parseFloat(dataFields.toWeight) || 0,
            minQuantity: parseInt(dataFields.minQuantity) || 0,
            maxQuantity: parseInt(dataFields.maxQuantity) || 0,
        };

        try {
            if (id) {
                const rateRef = doc(db, 'markups', id);
                await updateDoc(rateRef, dataToSave);
                enqueueSnackbar('Fixed rate updated successfully!', { variant: 'success' });
            } else {
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, 'markups'), dataToSave);
                enqueueSnackbar('Fixed rate added successfully!', { variant: 'success' });
            }
            handleDialogClose();
            fetchFixedRates();
        } catch (err) {
            console.error("Error saving fixed rate:", err);
            enqueueSnackbar('Error saving fixed rate: ' + err.message, { variant: 'error' });
        }
    };

    const handleDeleteRateConfirm = (rateId) => {
        setDeletingRateId(rateId);
    };

    const handleDeleteRateExecute = async () => {
        if (!deletingRateId) return;
        try {
            await deleteDoc(doc(db, 'markups', deletingRateId));
            enqueueSnackbar('Fixed rate deleted successfully!', { variant: 'success' });
            setDeletingRateId(null);
            fetchFixedRates();
        } catch (err) {
            console.error("Error deleting fixed rate:", err);
            enqueueSnackbar('Error deleting fixed rate: ' + err.message, { variant: 'error' });
            setDeletingRateId(null);
        }
    };

    const getRateTypeColor = (type) => {
        switch (type) {
            case 'FLAT_FEE_SHIPMENT': return '#059669';
            case 'FLAT_FEE_PACKAGE': return '#7c3aed';
            case 'FLAT_FEE_POUND': return '#dc2626';
            case 'PERCENTAGE': return '#ea580c';
            default: return '#6b7280';
        }
    };

    if (loadingData) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularProgress /><Typography sx={{ ml: 2, fontSize: '12px' }}>Loading fixed rates...</Typography></Box>;
    if (error) return <Alert severity="error" sx={{ m: 2, fontSize: '12px' }}>{error}</Alert>;

    return (
        <Box>
            {/* Statistics Dashboard */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUpIcon sx={{ color: '#0ea5e9', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#0ea5e9' }}>
                                        {statistics.totalRates}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Total Rates
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #22c55e' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AccessibilityIcon sx={{ color: '#22c55e', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#22c55e' }}>
                                        {statistics.activeRates}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Active Rates
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#fef2f2', border: '1px solid #ef4444' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocalShippingIcon sx={{ color: '#ef4444', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>
                                        {statistics.expiredRates}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Expired Rates
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#fef3c7', border: '1px solid #f59e0b' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ScaleIcon sx={{ color: '#f59e0b', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                                        ${statistics.averageValue.toFixed(2)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Avg Rate Value
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ bgcolor: '#f3e8ff', border: '1px solid #8b5cf6' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PublicIcon sx={{ color: '#8b5cf6', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#8b5cf6' }}>
                                        ${statistics.totalRevenue.toFixed(2)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Active Revenue
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Advanced Filters */}
            <Accordion sx={{ mb: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                        Advanced Filters & Search
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="Search Rates"
                                name="searchTerm"
                                value={filters.searchTerm}
                                onChange={handleFilterChange}
                                fullWidth
                                size="small"
                                placeholder="Company, carrier, service, city..."
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Company</InputLabel>
                                <Select
                                    name="companyId"
                                    value={filters.companyId}
                                    onChange={handleFilterChange}
                                    label="Company"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any Company</MenuItem>
                                    {companies.map(company => (
                                        <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>
                                            {company.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                                <Select
                                    name="carrierId"
                                    value={filters.carrierId}
                                    onChange={handleFilterChange}
                                    label="Carrier"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any Carrier</MenuItem>
                                    {carriers.map(carrier => (
                                        <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>
                                            {carrier.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>From Country</InputLabel>
                                <Select
                                    name="fromCountry"
                                    value={filters.fromCountry}
                                    onChange={handleFilterChange}
                                    label="From Country"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                    <MenuItem value="MX" sx={{ fontSize: '12px' }}>Mexico</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>To Country</InputLabel>
                                <Select
                                    name="toCountry"
                                    value={filters.toCountry}
                                    onChange={handleFilterChange}
                                    label="To Country"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                    <MenuItem value="MX" sx={{ fontSize: '12px' }}>Mexico</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service</InputLabel>
                                <Select
                                    name="service"
                                    value={filters.service}
                                    onChange={handleFilterChange}
                                    label="Service"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                                    <MenuItem value="STANDARD" sx={{ fontSize: '12px' }}>Standard</MenuItem>
                                    <MenuItem value="EXPRESS" sx={{ fontSize: '12px' }}>Express</MenuItem>
                                    <MenuItem value="PRIORITY" sx={{ fontSize: '12px' }}>Priority</MenuItem>
                                    <MenuItem value="ECONOMY" sx={{ fontSize: '12px' }}>Economy</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Rate Type</InputLabel>
                                <Select
                                    name="rateType"
                                    value={filters.rateType}
                                    onChange={handleFilterChange}
                                    label="Rate Type"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                                    <MenuItem value="FLAT_FEE_SHIPMENT" sx={{ fontSize: '12px' }}>Per Shipment</MenuItem>
                                    <MenuItem value="FLAT_FEE_PACKAGE" sx={{ fontSize: '12px' }}>Per Package</MenuItem>
                                    <MenuItem value="FLAT_FEE_POUND" sx={{ fontSize: '12px' }}>Per Pound</MenuItem>
                                    <MenuItem value="PERCENTAGE" sx={{ fontSize: '12px' }}>Percentage</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={1.5}>
                            <TextField
                                label="Min Value"
                                name="minValue"
                                type="number"
                                value={filters.minValue}
                                onChange={handleFilterChange}
                                fullWidth
                                size="small"
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={1.5}>
                            <TextField
                                label="Max Value"
                                name="maxValue"
                                type="number"
                                value={filters.maxValue}
                                onChange={handleFilterChange}
                                fullWidth
                                size="small"
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                <Select
                                    name="isActive"
                                    value={filters.isActive}
                                    onChange={handleFilterChange}
                                    label="Status"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                                    <MenuItem value="true" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                    <MenuItem value="false" sx={{ fontSize: '12px' }}>Expired</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={1}>
                            <Button
                                variant="outlined"
                                startIcon={<ClearIcon />}
                                onClick={clearFilters}
                                size="small"
                                sx={{ fontSize: '11px', height: '40px' }}
                            >
                                Clear
                            </Button>
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>

            {/* Header with Action Buttons */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Fixed Rate Management ({fixedRates.length} rates)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<SearchIcon />}
                        onClick={fetchFixedRates}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddRateOpen}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Add Fixed Rate
                    </Button>
                </Box>
            </Box>

            {/* Enhanced Data Table */}
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Service</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Rate Type</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Value</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Route</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Weight Range</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Effective</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Expires</TableCell>
                            <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {fixedRates.map((rate) => (
                            <TableRow key={rate.id} hover>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        {rate.companyName}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {rate.carrierName}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={rate.service || 'ANY'}
                                        size="small"
                                        sx={{
                                            fontSize: '10px',
                                            bgcolor: rate.service === 'ANY' ? '#f3f4f6' : '#dbeafe',
                                            color: rate.service === 'ANY' ? '#6b7280' : '#1e40af'
                                        }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={rate.type?.replace('FLAT_FEE_', '').replace('_', ' ') || 'N/A'}
                                        size="small"
                                        sx={{
                                            fontSize: '10px',
                                            bgcolor: getRateTypeColor(rate.type) + '20',
                                            color: getRateTypeColor(rate.type),
                                            fontWeight: 600
                                        }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        {rate.displayValue}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            {rate.fromCity || 'Any'}, {rate.fromCountry || 'Any'}
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            → {rate.toCity || 'Any'}, {rate.toCountry || 'Any'}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        {rate.fromWeight || 0} - {rate.toWeight || '∞'} lbs
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={rate.isActive ? 'Active' : 'Expired'}
                                        size="small"
                                        sx={{
                                            fontSize: '10px',
                                            bgcolor: rate.isActive ? '#dcfce7' : '#fee2e2',
                                            color: rate.isActive ? '#166534' : '#dc2626',
                                            fontWeight: 600
                                        }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {rate.formattedEffectiveDate}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {rate.formattedExpiryDate}
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Edit Rate">
                                        <IconButton size="small" onClick={() => handleEditRateOpen(rate)} color="primary">
                                            <EditIcon fontSize="inherit" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Rate">
                                        <IconButton size="small" onClick={() => handleDeleteRateConfirm(rate.id)} color="error">
                                            <DeleteIcon fontSize="inherit" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                        {fixedRates.length === 0 && !loadingData && (
                            <TableRow>
                                <TableCell colSpan={11} align="center">
                                    <Box sx={{ py: 4 }}>
                                        <Typography color="textSecondary" sx={{ fontSize: '14px', mb: 1 }}>
                                            No fixed rates found
                                        </Typography>
                                        <Typography color="textSecondary" sx={{ fontSize: '12px' }}>
                                            Try adjusting your filters or create a new fixed rate
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Enhanced Dialog */}
            <AddEditFixedRateDialog
                open={isAddEditDialogOpen}
                onClose={handleDialogClose}
                onSave={handleSaveRate}
                initialData={editingRate}
                companiesList={companies}
                carriersList={carriers}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingRateId} onClose={() => setDeletingRateId(null)}>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Delete
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete this fixed rate rule? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeletingRateId(null)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteRateExecute}
                        color="error"
                        variant="contained"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FixedRatesTab; 