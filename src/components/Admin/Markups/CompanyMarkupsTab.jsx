import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Grid,
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
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Tabs,
    Tab,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Card,
    CardContent,
    Tooltip,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    Business as BusinessIcon,
    LocalShipping as LocalShippingIcon,
    ExpandMore as ExpandMoreIcon,
    TrendingUp as TrendingUpIcon,
    Public as PublicIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import AddEditCompanyMarkupDialog from './AddEditCompanyMarkupDialog';
import AddEditCarrierMarkupDialog from './AddEditCarrierMarkupDialog';

const CompanyMarkupsTab = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [companies, setCompanies] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [companyMarkups, setCompanyMarkups] = useState([]);
    const [carrierMarkups, setCarrierMarkups] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState(null);
    const [currentTab, setCurrentTab] = useState(0);

    // Dialog states
    const [isCompanyMarkupDialogOpen, setIsCompanyMarkupDialogOpen] = useState(false);
    const [isCarrierMarkupDialogOpen, setIsCarrierMarkupDialogOpen] = useState(false);
    const [editingCompanyMarkup, setEditingCompanyMarkup] = useState(null);
    const [editingCarrierMarkup, setEditingCarrierMarkup] = useState(null);
    const [deletingMarkupId, setDeletingMarkupId] = useState(null);
    const [deletingMarkupType, setDeletingMarkupType] = useState(null);

    // Statistics
    const [statistics, setStatistics] = useState({
        totalCompanyMarkups: 0,
        totalCarrierMarkups: 0,
        activeCompanyMarkups: 0,
        activeCarrierMarkups: 0,
        averageCompanyMarkup: 0,
        averageCarrierMarkup: 0
    });

    const fetchData = useCallback(async () => {
        setLoadingData(true);
        setError(null);
        try {
            // Fetch supporting data
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCompanies(companiesData);

            const customersSnapshot = await getDocs(collection(db, 'customers'));
            const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomers(customersData);

            const carriersSnapshot = await getDocs(collection(db, 'carriers'));
            const carriersData = carriersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCarriers(carriersData);

            // Fetch company markups (company-to-company)
            const companyMarkupsQuery = query(
                collection(db, 'markups'),
                where('markupScope', '==', 'company')
            );
            const companyMarkupsSnapshot = await getDocs(companyMarkupsQuery);
            const companyMarkupsData = companyMarkupsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                fromCompanyName: companiesData.find(c => c.id === doc.data().fromBusinessId)?.name || doc.data().fromBusinessId,
                toCompanyName: doc.data().toBusinessId === 'ANY' ? 'Any' : companiesData.find(c => c.id === doc.data().toBusinessId)?.name || doc.data().toBusinessId,
                customerName: doc.data().customerId === 'ANY' ? 'Any' : customersData.find(cust => cust.id === doc.data().customerId)?.name || doc.data().customerId,
                carrierName: doc.data().carrierId === 'ANY' ? 'Any' : carriersData.find(carr => carr.id === doc.data().carrierId)?.name || doc.data().carrierId,
                isActive: !doc.data().expiryDate || new Date(doc.data().expiryDate) > new Date()
            }));
            setCompanyMarkups(companyMarkupsData);

            // Fetch carrier markups (carrier/service-specific global)
            const carrierMarkupsQuery = query(
                collection(db, 'markups'),
                where('markupScope', '==', 'carrierService')
            );
            const carrierMarkupsSnapshot = await getDocs(carrierMarkupsQuery);
            const carrierMarkupsData = carrierMarkupsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                carrierName: carriersData.find(carr => carr.id === doc.data().carrierId)?.name || doc.data().carrierId || 'Any',
                isActive: !doc.data().expiryDate || new Date(doc.data().expiryDate) > new Date()
            }));
            setCarrierMarkups(carrierMarkupsData);

            // Calculate statistics
            const totalCompanyMarkups = companyMarkupsData.length;
            const totalCarrierMarkups = carrierMarkupsData.length;
            const activeCompanyMarkups = companyMarkupsData.filter(m => m.isActive).length;
            const activeCarrierMarkups = carrierMarkupsData.filter(m => m.isActive).length;
            const averageCompanyMarkup = companyMarkupsData.reduce((sum, m) => sum + (m.value || 0), 0) / (totalCompanyMarkups || 1);
            const averageCarrierMarkup = carrierMarkupsData.reduce((sum, m) => sum + (m.value || 0), 0) / (totalCarrierMarkups || 1);

            setStatistics({
                totalCompanyMarkups,
                totalCarrierMarkups,
                activeCompanyMarkups,
                activeCarrierMarkups,
                averageCompanyMarkup,
                averageCarrierMarkup
            });

        } catch (err) {
            console.error("Error fetching data for markups:", err);
            setError("Could not load required data for markups.");
            enqueueSnackbar('Error fetching data: ' + err.message, { variant: 'error' });
        } finally {
            setLoadingData(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    // Company Markup handlers
    const handleAddCompanyMarkupOpen = () => {
        setEditingCompanyMarkup(null);
        setIsCompanyMarkupDialogOpen(true);
    };

    const handleEditCompanyMarkupOpen = (markup) => {
        setEditingCompanyMarkup(markup);
        setIsCompanyMarkupDialogOpen(true);
    };

    const handleCompanyMarkupDialogClose = () => {
        setIsCompanyMarkupDialogOpen(false);
        setEditingCompanyMarkup(null);
    };

    const handleSaveCompanyMarkup = async (markupData) => {
        try {
            const dataToSave = {
                ...markupData,
                markupScope: 'company',
                updatedAt: serverTimestamp(),
                value: parseFloat(markupData.value) || 0,
            };
            if (dataToSave.id === null || dataToSave.id === undefined) {
                delete dataToSave.id;
            }

            if (markupData.id) {
                const markupRef = doc(db, 'markups', markupData.id);
                await updateDoc(markupRef, dataToSave);
                enqueueSnackbar('Company markup updated successfully!', { variant: 'success' });
            } else {
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, 'markups'), dataToSave);
                enqueueSnackbar('Company markup added successfully!', { variant: 'success' });
            }
            fetchData();
        } catch (err) {
            console.error("Error saving company markup:", err);
            enqueueSnackbar('Error saving company markup: ' + err.message, { variant: 'error' });
        }
    };

    // Carrier Markup handlers
    const handleAddCarrierMarkupOpen = () => {
        setEditingCarrierMarkup(null);
        setIsCarrierMarkupDialogOpen(true);
    };

    const handleEditCarrierMarkupOpen = (markup) => {
        setEditingCarrierMarkup(markup);
        setIsCarrierMarkupDialogOpen(true);
    };

    const handleCarrierMarkupDialogClose = () => {
        setIsCarrierMarkupDialogOpen(false);
        setEditingCarrierMarkup(null);
    };

    const handleSaveCarrierMarkup = async (markupData) => {
        try {
            const dataToSave = {
                ...markupData,
                markupScope: 'carrierService',
                updatedAt: serverTimestamp(),
                value: parseFloat(markupData.value) || 0,
            };
            if (dataToSave.id === null || dataToSave.id === undefined) {
                delete dataToSave.id;
            }

            if (markupData.id) {
                const markupRef = doc(db, 'markups', markupData.id);
                await updateDoc(markupRef, dataToSave);
                enqueueSnackbar('Carrier markup updated successfully!', { variant: 'success' });
            } else {
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, 'markups'), dataToSave);
                enqueueSnackbar('Carrier markup added successfully!', { variant: 'success' });
            }
            fetchData();
        } catch (err) {
            console.error("Error saving carrier markup:", err);
            enqueueSnackbar('Error saving carrier markup: ' + err.message, { variant: 'error' });
        }
    };

    // Delete handlers
    const handleDeleteMarkupConfirm = (id, type) => {
        setDeletingMarkupId(id);
        setDeletingMarkupType(type);
    };

    const handleDeleteMarkupExecute = async () => {
        if (!deletingMarkupId) return;
        try {
            await deleteDoc(doc(db, 'markups', deletingMarkupId));
            enqueueSnackbar(`${deletingMarkupType === 'company' ? 'Company' : 'Carrier'} markup deleted successfully!`, { variant: 'success' });
            setDeletingMarkupId(null);
            setDeletingMarkupType(null);
            fetchData();
        } catch (err) {
            console.error("Error deleting markup:", err);
            enqueueSnackbar('Error deleting markup: ' + err.message, { variant: 'error' });
            setDeletingMarkupId(null);
            setDeletingMarkupType(null);
        }
    };

    if (loadingData) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularProgress /><Typography sx={{ ml: 2, fontSize: '12px' }}>Loading markups...</Typography></Box>;
    if (error) return <Alert severity="error" sx={{ m: 2, fontSize: '12px' }}>{error}</Alert>;

    return (
        <Box>
            {/* Statistics Dashboard */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <BusinessIcon sx={{ color: '#0ea5e9', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#0ea5e9' }}>
                                        {statistics.totalCompanyMarkups}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Company Rules
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #22c55e' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocalShippingIcon sx={{ color: '#22c55e', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#22c55e' }}>
                                        {statistics.totalCarrierMarkups}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Carrier Rules
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: '#fef3c7', border: '1px solid #f59e0b' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUpIcon sx={{ color: '#f59e0b', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                                        {statistics.activeCompanyMarkups}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Active Company
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: '#f3e8ff', border: '1px solid #8b5cf6' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PublicIcon sx={{ color: '#8b5cf6', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#8b5cf6' }}>
                                        {statistics.activeCarrierMarkups}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Active Carrier
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: '#fef2f2', border: '1px solid #ef4444' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUpIcon sx={{ color: '#ef4444', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>
                                        {statistics.averageCompanyMarkup.toFixed(1)}%
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Avg Company
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: '#ecfdf5', border: '1px solid #10b981' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocalShippingIcon sx={{ color: '#10b981', fontSize: '20px' }} />
                                <Box>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>
                                        {statistics.averageCarrierMarkup.toFixed(1)}%
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Avg Carrier
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tabs for different markup types */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={currentTab}
                    onChange={handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    sx={{ borderBottom: '1px solid #e5e7eb' }}
                >
                    <Tab
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <BusinessIcon sx={{ fontSize: '18px' }} />
                                <Typography sx={{ fontSize: '12px', textTransform: 'none' }}>
                                    Company Markups ({statistics.totalCompanyMarkups})
                                </Typography>
                            </Box>
                        }
                    />
                    <Tab
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocalShippingIcon sx={{ fontSize: '18px' }} />
                                <Typography sx={{ fontSize: '12px', textTransform: 'none' }}>
                                    Carrier Markups ({statistics.totalCarrierMarkups})
                                </Typography>
                            </Box>
                        }
                    />
                </Tabs>

                {/* Company Markups Tab */}
                {currentTab === 0 && (
                    <Box sx={{ p: 3 }}>
                        {/* Header */}
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 3
                        }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                    Company-to-Company Markups
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Manage markups between specific companies and customers
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddCompanyMarkupOpen}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Add Company Markup
                            </Button>
                        </Box>

                        {/* Company Markups Table */}
                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>From Company</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>To Company</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customer</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Service</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Value</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                        <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {companyMarkups.map((markup) => (
                                        <TableRow key={markup.id} hover>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.fromCompanyName}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.toCompanyName}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.customerName}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.carrierName}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.service || 'ANY'}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.type}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.value}{markup.type === 'PERCENTAGE' ? '%' : ''}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Chip
                                                    label={markup.isActive ? 'Active' : 'Expired'}
                                                    size="small"
                                                    sx={{
                                                        fontSize: '10px',
                                                        bgcolor: markup.isActive ? '#dcfce7' : '#fee2e2',
                                                        color: markup.isActive ? '#166534' : '#dc2626',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit Markup">
                                                    <IconButton size="small" onClick={() => handleEditCompanyMarkupOpen(markup)} color="primary">
                                                        <EditIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Markup">
                                                    <IconButton size="small" onClick={() => handleDeleteMarkupConfirm(markup.id, 'company')} color="error">
                                                        <DeleteIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {companyMarkups.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} align="center">
                                                <Box sx={{ py: 4 }}>
                                                    <Typography color="textSecondary" sx={{ fontSize: '14px', mb: 1 }}>
                                                        No company markups found
                                                    </Typography>
                                                    <Typography color="textSecondary" sx={{ fontSize: '12px' }}>
                                                        Create company-to-company markup rules
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {/* Carrier Markups Tab */}
                {currentTab === 1 && (
                    <Box sx={{ p: 3 }}>
                        {/* Header */}
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 3
                        }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                    Carrier & Service Markups
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Global markups for specific carriers and services (e.g., Canpar Expedited)
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddCarrierMarkupOpen}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Add Carrier Markup
                            </Button>
                        </Box>

                        {/* Carrier Markups Table */}
                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Service</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Value</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Description</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Effective</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Expires</TableCell>
                                        <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {carrierMarkups.map((markup) => (
                                        <TableRow key={markup.id} hover>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    {markup.carrierName}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Chip
                                                    label={markup.service || 'ANY'}
                                                    size="small"
                                                    sx={{
                                                        fontSize: '10px',
                                                        bgcolor: markup.service === 'ANY' ? '#f3f4f6' : '#dbeafe',
                                                        color: markup.service === 'ANY' ? '#6b7280' : '#1e40af'
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.type}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    {markup.value}{markup.type === 'PERCENTAGE' ? '%' : ''}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{markup.description || '-'}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Chip
                                                    label={markup.isActive ? 'Active' : 'Expired'}
                                                    size="small"
                                                    sx={{
                                                        fontSize: '10px',
                                                        bgcolor: markup.isActive ? '#dcfce7' : '#fee2e2',
                                                        color: markup.isActive ? '#166534' : '#dc2626',
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {markup.effectiveDate ? new Date(markup.effectiveDate).toLocaleDateString() : 'N/A'}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {markup.expiryDate ? new Date(markup.expiryDate).toLocaleDateString() : 'Never'}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit Markup">
                                                    <IconButton size="small" onClick={() => handleEditCarrierMarkupOpen(markup)} color="primary">
                                                        <EditIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Markup">
                                                    <IconButton size="small" onClick={() => handleDeleteMarkupConfirm(markup.id, 'carrier')} color="error">
                                                        <DeleteIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {carrierMarkups.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} align="center">
                                                <Box sx={{ py: 4 }}>
                                                    <Typography color="textSecondary" sx={{ fontSize: '14px', mb: 1 }}>
                                                        No carrier markups found
                                                    </Typography>
                                                    <Typography color="textSecondary" sx={{ fontSize: '12px' }}>
                                                        Create carrier-specific markup rules (e.g., Canpar Expedited)
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </Paper>

            {/* Company Markup Dialog */}
            <AddEditCompanyMarkupDialog
                open={isCompanyMarkupDialogOpen}
                onClose={handleCompanyMarkupDialogClose}
                onSave={handleSaveCompanyMarkup}
                initialData={editingCompanyMarkup}
                companiesList={companies}
                customersList={customers}
                carriersList={carriers}
            />

            {/* Carrier Markup Dialog */}
            <AddEditCarrierMarkupDialog
                open={isCarrierMarkupDialogOpen}
                onClose={handleCarrierMarkupDialogClose}
                onSave={handleSaveCarrierMarkup}
                initialData={editingCarrierMarkup}
                carriersList={carriers}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingMarkupId} onClose={() => { setDeletingMarkupId(null); setDeletingMarkupType(null); }}>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Delete
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete this {deletingMarkupType} markup rule? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => { setDeletingMarkupId(null); setDeletingMarkupType(null); }}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteMarkupExecute}
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

export default CompanyMarkupsTab; 