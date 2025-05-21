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

    if (loadingData) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /><Typography sx={{ ml: 2 }}>Loading data...</Typography></Box>;
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Business Markups</Typography>

            <Paper sx={{ p: 2, mb: 3 }} elevation={1} variant="outlined">
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>From Business</InputLabel>
                            <Select defaultValue="ANY" label="From Business">
                                <MenuItem value="ANY">Any</MenuItem>
                                {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    {/* TODO: Add other filters: To Business, Customer, Carrier, Service */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Button variant="contained" startIcon={<SearchIcon />} onClick={fetchData}>Search</Button>
                    </Grid>
                </Grid>
            </Paper>

            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddMarkupOpen} sx={{ mb: 2 }}>
                Add New Business Markup
            </Button>

            <TableContainer component={Paper} elevation={1} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>From Business</TableCell>
                            <TableCell>To Business</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Carrier</TableCell>
                            <TableCell>Service</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Value</TableCell>
                            <TableCell>Effective</TableCell>
                            <TableCell>Expires</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {markups.map((markup) => (
                            <TableRow key={markup.id} hover>
                                <TableCell>{markup.fromBusinessName}</TableCell>
                                <TableCell>{markup.toBusinessName}</TableCell>
                                <TableCell>{markup.customerName}</TableCell>
                                <TableCell>{markup.carrierName}</TableCell>
                                <TableCell>{markup.service}</TableCell>
                                <TableCell>{markup.type}</TableCell>
                                <TableCell>{markup.value}{markup.type === 'PERCENTAGE' ? '%' : ''}</TableCell>
                                <TableCell>{markup.effectiveDate ? new Date(markup.effectiveDate).toLocaleDateString() : 'N/A'}</TableCell>
                                <TableCell>{markup.expiryDate ? new Date(markup.expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
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
                                    <Typography color="textSecondary" sx={{ p: 2 }}>No business markups found.</Typography>
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
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this business markup rule?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeletingMarkupId(null)}>Cancel</Button>
                    <Button onClick={handleDeleteMarkupExecute} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BusinessMarkupsTab; 