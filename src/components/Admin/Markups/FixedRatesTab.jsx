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
    DialogTitle
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import AddEditFixedRateDialog from './AddEditFixedRateDialog';
import dayjs from 'dayjs';

const FixedRatesTab = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [fixedRates, setFixedRates] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState(null);

    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [editingRate, setEditingRate] = useState(null);
    const [deletingRateId, setDeletingRateId] = useState(null);

    // Filters State - TODO: Implement actual filtering logic
    const [filters, setFilters] = useState({
        fromCountry: 'ANY',
        fromStateProv: 'ANY',
        toCountry: 'ANY',
        toStateProv: 'ANY',
        service: 'ANY'
    });

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const fetchFixedRates = useCallback(async () => {
        setLoadingData(true);
        setError(null);
        try {
            // Basic query, can be expanded with filters
            const q = query(collection(db, 'markups'), where('markupScope', '==', 'fixedRate'));
            // TODO: Add filter clauses to query based on 'filters' state if they are not 'ANY'

            const ratesSnapshot = await getDocs(q);
            const ratesData = ratesSnapshot.docs.map(docSnapshot => ({
                id: docSnapshot.id,
                ...docSnapshot.data(),
            }));
            setFixedRates(ratesData);
        } catch (err) {
            console.error("Error fetching fixed rates:", err);
            setError("Could not load fixed rates.");
            enqueueSnackbar('Error fetching fixed rates: ' + err.message, { variant: 'error' });
        } finally {
            setLoadingData(false);
        }
    }, [enqueueSnackbar]); // Add filters to dependency array when implemented

    useEffect(() => {
        fetchFixedRates();
    }, [fetchFixedRates]);

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
            markupScope: 'fixedRate', // Ensure scope is set
            updatedAt: serverTimestamp(),
            value: parseFloat(dataFields.value) || 0,
            fromWeight: parseFloat(dataFields.fromWeight) || 0,
            toWeight: parseFloat(dataFields.toWeight) || 0,
            // Dates are already dayjs objects from dialog, converted to ISO string in dialog's handleSave
        };

        try {
            if (id) { // Editing
                const rateRef = doc(db, 'markups', id);
                await updateDoc(rateRef, dataToSave);
                enqueueSnackbar('Fixed rate updated successfully!', { variant: 'success' });
            } else { // Adding new
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

    if (loadingData) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularProgress /><Typography sx={{ ml: 2, fontSize: '12px' }}>Loading fixed rates...</Typography></Box>;
    if (error) return <Alert severity="error" sx={{ m: 2, fontSize: '12px' }}>{error}</Alert>;

    return (
        <Box>
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>Fixed Rate Management</Typography>

            <Paper sx={{ p: 2, mb: 3, border: '1px solid #e5e7eb' }} elevation={0}>
                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>Filters</Typography>
                <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} sm={4} md={2}>
                        <TextField
                            fullWidth
                            label="From Country"
                            name="fromCountry"
                            value={filters.fromCountry}
                            onChange={handleFilterChange}
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <TextField
                            fullWidth
                            label="From State/Prov"
                            name="fromStateProv"
                            value={filters.fromStateProv}
                            onChange={handleFilterChange}
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <TextField
                            fullWidth
                            label="To Country"
                            name="toCountry"
                            value={filters.toCountry}
                            onChange={handleFilterChange}
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <TextField
                            fullWidth
                            label="To State/Prov"
                            name="toStateProv"
                            value={filters.toStateProv}
                            onChange={handleFilterChange}
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Button
                            variant="contained"
                            startIcon={<SearchIcon />}
                            onClick={fetchFixedRates}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Search Rates
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddRateOpen}
                size="small"
                sx={{ mb: 2, fontSize: '12px' }}
            >
                Add New Fixed Rate
            </Button>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Service</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Value</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Variable</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>From</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>To</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Weight Range</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Effective</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Expires</TableCell>
                            <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {fixedRates.map((rate) => (
                            <TableRow key={rate.id} hover>
                                <TableCell sx={{ fontSize: '12px' }}>{rate.service}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{rate.type}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{rate.value}{rate.type === 'PERCENTAGE' ? '%' : ''}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{rate.variable}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{`${rate.fromCity || 'Any'}, ${rate.fromStateProv || 'Any'}, ${rate.fromCountry || 'Any'}`}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{`${rate.toCity || 'Any'}, ${rate.toStateProv || 'Any'}, ${rate.toCountry || 'Any'}`}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{`${rate.fromWeight || 0} - ${rate.toWeight || 'Any'}`}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{rate.effectiveDate ? dayjs(rate.effectiveDate).format('YYYY-MM-DD') : 'N/A'}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{rate.expiryDate ? dayjs(rate.expiryDate).format('YYYY-MM-DD') : 'N/A'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleEditRateOpen(rate)} color="primary">
                                        <EditIcon fontSize="inherit" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDeleteRateConfirm(rate.id)} color="error">
                                        <DeleteIcon fontSize="inherit" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {fixedRates.length === 0 && !loadingData && (
                            <TableRow>
                                <TableCell colSpan={10} align="center">
                                    <Typography color="textSecondary" sx={{ p: 2, fontSize: '12px' }}>No fixed rates found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <AddEditFixedRateDialog
                open={isAddEditDialogOpen}
                onClose={handleDialogClose}
                onSave={handleSaveRate}
                initialData={editingRate}
            />

            <Dialog open={!!deletingRateId} onClose={() => setDeletingRateId(null)}>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete this fixed rate rule?
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