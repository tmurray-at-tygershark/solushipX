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
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>Carrier Markups</Typography>

            <Paper sx={{ p: 2, mb: 3, border: '1px solid #e5e7eb' }} elevation={0}>
                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>Filters</Typography>
                <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                            <Select
                                defaultValue="ANY"
                                label="Carrier"
                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                            >
                                <MenuItem value="ANY" sx={{ fontSize: '12px' }}>Any</MenuItem>
                                {carriers.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: '12px' }}>{c.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Button
                            variant="contained"
                            startIcon={<SearchIcon />}
                            onClick={fetchMarkups}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Search
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddMarkupOpen}
                size="small"
                sx={{ mb: 2, fontSize: '12px' }}
            >
                Add New Carrier Markup
            </Button>

            {loadingMarkups ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading carrier markups...</Typography>
                </Box>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Service</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Value</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Variable</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>From Country</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>To Country</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>From Weight</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>To Weight</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Effective Date</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Expiry Date</TableCell>
                                <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {markups.map((markup) => (
                                <TableRow key={markup.id} hover>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.carrierName || carriers.find(c => c.id === markup.carrierId)?.name}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.service}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.type}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.value}{markup.type === 'PERCENTAGE' ? '%' : ''}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.variable}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.fromCountry}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.toCountry}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.fromWeight}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.toWeight}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.effectiveDate ? dayjs(markup.effectiveDate).format('YYYY-MM-DD') : 'N/A'}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{markup.expiryDate ? dayjs(markup.expiryDate).format('YYYY-MM-DD') : 'N/A'}</TableCell>
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
                                        <Typography color="textSecondary" sx={{ p: 2, fontSize: '12px' }}>No carrier markups found.</Typography>
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
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete this carrier markup rule?
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

export default CarrierMarkupsTab; 