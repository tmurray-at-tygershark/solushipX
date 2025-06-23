import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Grid,
    // TextField, // No longer directly used in filter, but could be for search
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
    DialogTitle
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed
import { useSnackbar } from 'notistack';
import AddEditBusinessMarkupDialog from './AddEditBusinessMarkupDialog'; // Import the new dialog

const BusinessMarkupsTab = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [companies, setCompanies] = useState([]);
    const [customers, setCustomers] = useState([]); // To populate customer dropdown
    const [carriers, setCarriers] = useState([]);   // To populate carrier dropdown
    const [markups, setMarkups] = useState([]);
    const [loadingData, setLoadingData] = useState(true); // Combined loading state
    const [error, setError] = useState(null);

    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [editingMarkup, setEditingMarkup] = useState(null);
    const [deletingMarkupId, setDeletingMarkupId] = useState(null);

    const fetchData = useCallback(async () => {
        setLoadingData(true);
        setError(null);
        try {
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCompanies(companiesData);

            const customersSnapshot = await getDocs(collection(db, 'customers'));
            const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomers(customersData);

            const carriersSnapshot = await getDocs(collection(db, 'carriers'));
            const carriersData = carriersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCarriers(carriersData);

            // Fetch markups
            const markupsQuery = query(collection(db, 'markups'), where('markupScope', '==', 'business'));
            const markupsSnapshot = await getDocs(markupsQuery);
            const markupsData = markupsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Denormalize names for display - consider doing this on write if performance becomes an issue
                fromBusinessName: companiesData.find(c => c.id === doc.data().fromBusinessId)?.name || doc.data().fromBusinessId,
                toBusinessName: doc.data().toBusinessId === 'ANY' ? 'Any' : companiesData.find(c => c.id === doc.data().toBusinessId)?.name || doc.data().toBusinessId,
                customerName: doc.data().customerId === 'ANY' ? 'Any' : customersData.find(cust => cust.id === doc.data().customerId)?.name || doc.data().customerId,
                carrierName: doc.data().carrierId === 'ANY' ? 'Any' : carriersData.find(carr => carr.id === doc.data().carrierId)?.name || doc.data().carrierId,
            }));
            setMarkups(markupsData);

        } catch (err) {
            console.error("Error fetching data for business markups:", err);
            setError("Could not load required data for business markups.");
            enqueueSnackbar('Error fetching data: ' + err.message, { variant: 'error' });
        } finally {
            setLoadingData(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddMarkupOpen = () => {
        setEditingMarkup(null);
        setIsAddEditDialogOpen(true);
    };

    const handleEditMarkupOpen = (markup) => {
        setEditingMarkup(markup);
        setIsAddEditDialogOpen(true);
    };

    const handleDialogClose = () => {
        setIsAddEditDialogOpen(false);
        setEditingMarkup(null);
    };

    const handleSaveMarkup = async (markupData) => {
        try {
            const dataToSave = {
                ...markupData,
                markupScope: 'business',
                updatedAt: serverTimestamp(),
                value: parseFloat(markupData.value) || 0,
            };
            // Remove potentially undefined id if it was from initialData=null
            if (dataToSave.id === null || dataToSave.id === undefined) {
                delete dataToSave.id;
            }

            if (markupData.id) { // Editing existing markup
                const markupRef = doc(db, 'markups', markupData.id);
                await updateDoc(markupRef, dataToSave);
                enqueueSnackbar('Business markup updated successfully!', { variant: 'success' });
            } else { // Adding new markup
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, 'markups'), dataToSave);
                enqueueSnackbar('Business markup added successfully!', { variant: 'success' });
            }
            fetchData(); // Refresh the list and potentially related data
        } catch (err) {
            console.error("Error saving business markup:", err);
            enqueueSnackbar('Error saving business markup: ' + err.message, { variant: 'error' });
        }
    };

    const handleDeleteMarkupConfirm = (id) => {
        setDeletingMarkupId(id);
    };

    const handleDeleteMarkupExecute = async () => {
        if (!deletingMarkupId) return;
        try {
            await deleteDoc(doc(db, 'markups', deletingMarkupId));
            enqueueSnackbar('Business markup deleted successfully!', { variant: 'success' });
            setDeletingMarkupId(null);
            fetchData(); // Refresh list
        } catch (err) {
            console.error("Error deleting business markup:", err);
            enqueueSnackbar('Error deleting business markup: ' + err.message, { variant: 'error' });
            setDeletingMarkupId(null);
        }
    };

    if (loadingData) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularProgress /><Typography sx={{ ml: 2, fontSize: '12px' }}>Loading data...</Typography></Box>;
    if (error) return <Alert severity="error" sx={{ m: 2, fontSize: '12px' }}>{error}</Alert>;

    return (
        <Box>
            {/* Compact Header with Filters and Actions */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 3,
                gap: 2,
                flexWrap: 'wrap'
            }}>
                {/* Left Side - Title and Filters */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flex: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', minWidth: 'max-content' }}>
                        Business Markups
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>From Business</InputLabel>
                        <Select
                            defaultValue="ANY"
                            label="From Business"
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                            {companies.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: '12px' }}>{c.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>To Business</InputLabel>
                        <Select
                            defaultValue="ANY"
                            label="To Business"
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                            {companies.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: '12px' }}>{c.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>Customer</InputLabel>
                        <Select
                            defaultValue="ANY"
                            label="Customer"
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                            {customers.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: '12px' }}>{c.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                {/* Right Side - Action Buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <Button
                        variant="outlined"
                        startIcon={<SearchIcon />}
                        onClick={fetchData}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Search
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddMarkupOpen}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Add New
                    </Button>
                </Box>
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>From Business</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>To Business</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customer</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Service</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Value</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Effective</TableCell>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Expires</TableCell>
                            <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {markups.map((markup) => (
                            <TableRow key={markup.id} hover>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.fromBusinessName}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.toBusinessName}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.customerName}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.carrierName}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.service}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.type}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.value}{markup.type === 'PERCENTAGE' ? '%' : ''}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.effectiveDate ? new Date(markup.effectiveDate).toLocaleDateString() : 'N/A'}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{markup.expiryDate ? new Date(markup.expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleEditMarkupOpen(markup)} color="primary">
                                        <EditIcon fontSize="inherit" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDeleteMarkupConfirm(markup.id)} color="error">
                                        <DeleteIcon fontSize="inherit" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {markups.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} align="center">
                                    <Typography color="textSecondary" sx={{ p: 2, fontSize: '12px' }}>No business markups found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <AddEditBusinessMarkupDialog
                open={isAddEditDialogOpen}
                onClose={handleDialogClose}
                onSave={handleSaveMarkup}
                initialData={editingMarkup}
                companiesList={companies}
                customersList={customers}
                carriersList={carriers}
            />

            <Dialog open={!!deletingMarkupId} onClose={() => setDeletingMarkupId(null)}>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete this business markup rule?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeletingMarkupId(null)}
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

export default BusinessMarkupsTab; 