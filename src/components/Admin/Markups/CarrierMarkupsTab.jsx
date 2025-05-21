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
import { db } from '../../../firebase'; // Adjust path as needed
import { useSnackbar } from 'notistack';
import AddEditCarrierMarkupDialog from './AddEditCarrierMarkupDialog';
import dayjs from 'dayjs';

const CarrierMarkupsTab = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [carriers, setCarriers] = useState([]);
    const [markups, setMarkups] = useState([]);
    const [loadingCarriers, setLoadingCarriers] = useState(false);
    const [loadingMarkups, setLoadingMarkups] = useState(false);
    const [error, setError] = useState(null);

    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [editingMarkup, setEditingMarkup] = useState(null);
    const [deletingMarkupId, setDeletingMarkupId] = useState(null);

    useEffect(() => {
        const fetchCarriers = async () => {
            setLoadingCarriers(true);
            try {
                const carriersSnapshot = await getDocs(collection(db, 'carriers'));
                const carriersData = carriersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCarriers(carriersData);
            } catch (err) {
                console.error("Error fetching carriers:", err);
                setError("Could not load carriers.");
                enqueueSnackbar('Error fetching carriers', { variant: 'error' });
            } finally {
                setLoadingCarriers(false);
            }
        };
        fetchCarriers();
    }, [enqueueSnackbar]);

    const fetchMarkups = useCallback(async () => {
        setLoadingMarkups(true);
        setError(null);
        try {
            const markupsQuery = query(collection(db, 'markups'), where('markupScope', '==', 'carrier'));
            const markupsSnapshot = await getDocs(markupsQuery);
            const markupsData = markupsSnapshot.docs.map(docSnapshot => ({
                id: docSnapshot.id,
                ...docSnapshot.data(),
                carrierName: carriers.find(c => c.id === docSnapshot.data().carrierId)?.name || docSnapshot.data().carrierId
            }));
            setMarkups(markupsData);
        } catch (err) {
            console.error("Error fetching carrier markups:", err);
            setError("Could not load carrier markups.");
            enqueueSnackbar('Error fetching carrier markups', { variant: 'error' });
        } finally {
            setLoadingMarkups(false);
        }
    }, [carriers, enqueueSnackbar]);

    useEffect(() => {
        if (carriers.length > 0) {
            fetchMarkups();
        }
    }, [carriers, fetchMarkups]);

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

    const handleSaveMarkup = async (markupDataFromDialog) => {
        const { id, ...dataFields } = markupDataFromDialog;

        const dataToSave = {
            ...dataFields,
            markupScope: 'carrier',
            updatedAt: serverTimestamp(),
            value: parseFloat(dataFields.value) || 0,
            fromWeight: parseFloat(dataFields.fromWeight) || 0,
            toWeight: parseFloat(dataFields.toWeight) || 0,
        };

        if (!dataToSave.carrierId) {
            enqueueSnackbar('Carrier must be selected.', { variant: 'error' });
            return;
        }

        try {
            if (id) {
                const markupRef = doc(db, 'markups', id);
                await updateDoc(markupRef, dataToSave);
                enqueueSnackbar('Carrier markup updated successfully!', { variant: 'success' });
            } else {
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, 'markups'), dataToSave);
                enqueueSnackbar('Carrier markup added successfully!', { variant: 'success' });
            }
            handleDialogClose();
            fetchMarkups();
        } catch (err) {
            console.error("Error saving carrier markup:", err);
            enqueueSnackbar('Error saving carrier markup: ' + err.message, { variant: 'error' });
        }
    };

    const handleDeleteMarkupConfirm = (markupId) => {
        setDeletingMarkupId(markupId);
    };

    const handleDeleteMarkupExecute = async () => {
        if (!deletingMarkupId) return;
        try {
            await deleteDoc(doc(db, 'markups', deletingMarkupId));
            enqueueSnackbar('Carrier markup deleted successfully!', { variant: 'success' });
            setDeletingMarkupId(null);
            fetchMarkups();
        } catch (err) {
            console.error("Error deleting carrier markup:", err);
            enqueueSnackbar('Error deleting carrier markup: ' + err.message, { variant: 'error' });
            setDeletingMarkupId(null);
        }
    };

    if (loadingCarriers) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /><Typography sx={{ ml: 2 }}>Loading carriers...</Typography></Box>;
    if (error && !loadingMarkups) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Carrier Markups</Typography>

            <Paper sx={{ p: 2, mb: 3 }} elevation={1} variant="outlined">
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Carrier</InputLabel>
                            <Select defaultValue="ANY" label="Carrier">
                                <MenuItem value="ANY">Any</MenuItem>
                                {carriers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Button variant="contained" startIcon={<SearchIcon />} onClick={fetchMarkups}>Search</Button>
                    </Grid>
                </Grid>
            </Paper>

            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddMarkupOpen} sx={{ mb: 2 }}>
                Add New Carrier Markup
            </Button>

            {loadingMarkups ? <CircularProgress sx={{ display: 'block', margin: '20px auto' }} /> : (
                <TableContainer component={Paper} elevation={1} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Carrier</TableCell>
                                <TableCell>Service</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Value</TableCell>
                                <TableCell>Variable</TableCell>
                                <TableCell>From Country</TableCell>
                                <TableCell>To Country</TableCell>
                                <TableCell>From Weight</TableCell>
                                <TableCell>To Weight</TableCell>
                                <TableCell>Effective Date</TableCell>
                                <TableCell>Expiry Date</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {markups.map((markup) => (
                                <TableRow key={markup.id} hover>
                                    <TableCell>{markup.carrierName || carriers.find(c => c.id === markup.carrierId)?.name}</TableCell>
                                    <TableCell>{markup.service}</TableCell>
                                    <TableCell>{markup.type}</TableCell>
                                    <TableCell>{markup.value}{markup.type === 'PERCENTAGE' ? '%' : ''}</TableCell>
                                    <TableCell>{markup.variable}</TableCell>
                                    <TableCell>{markup.fromCountry}</TableCell>
                                    <TableCell>{markup.toCountry}</TableCell>
                                    <TableCell>{markup.fromWeight}</TableCell>
                                    <TableCell>{markup.toWeight}</TableCell>
                                    <TableCell>{markup.effectiveDate ? dayjs(markup.effectiveDate).format('YYYY-MM-DD') : 'N/A'}</TableCell>
                                    <TableCell>{markup.expiryDate ? dayjs(markup.expiryDate).format('YYYY-MM-DD') : 'N/A'}</TableCell>
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
                                    <TableCell colSpan={12} align="center">
                                        <Typography color="textSecondary" sx={{ p: 2 }}>No carrier markups found.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <AddEditCarrierMarkupDialog
                open={isAddEditDialogOpen}
                onClose={handleDialogClose}
                onSave={handleSaveMarkup}
                initialData={editingMarkup}
                carriersList={carriers}
            />

            <Dialog open={!!deletingMarkupId} onClose={() => setDeletingMarkupId(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this carrier markup rule?
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

export default CarrierMarkupsTab; 