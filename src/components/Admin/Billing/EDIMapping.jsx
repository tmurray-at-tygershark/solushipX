import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Grid,
    Alert,
    CircularProgress,
    Tooltip,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Container,
    Tabs,
    Tab,
    Switch,
    Menu,
    MenuItem,
    ListItemIcon,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Visibility as ViewIcon,
    DeleteForever as DeleteIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';
import AddCarrierMapping from './AddCarrierMapping';
import MappingTest from '../EDIMapping/MappingTest';
import PromptVersionManager from '../EDIMapping/PromptVersionManager';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const EDIMapping = () => {
    const navigate = useNavigate();
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);
    const { enqueueSnackbar } = useSnackbar();

    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [selectedCarrierForMenu, setSelectedCarrierForMenu] = useState(null);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [carrierToDelete, setCarrierToDelete] = useState(null);

    const fetchCarriers = useCallback(async () => {
        setLoading(true);
        try {
            const carriersRef = collection(db, 'ediMappings');
            const snapshot = await getDocs(carriersRef);
            const allCarriersData = [];
            for (const docSnapshot of snapshot.docs) {
                const carrierData = docSnapshot.data();
                const mappingDocRef = doc(db, 'ediMappings', docSnapshot.id, 'default', 'mapping');
                const mappingDocSnap = await getDoc(mappingDocRef);
                let mappingCount = 0;
                let lastUpdated = carrierData.updatedAt;

                if (mappingDocSnap.exists()) {
                    const mappingData = mappingDocSnap.data();
                    mappingCount = mappingData.fieldMappings?.length || 0;
                    lastUpdated = mappingData.updatedAt || carrierData.updatedAt;
                }

                allCarriersData.push({
                    id: docSnapshot.id,
                    ...carrierData,
                    mappingCount: mappingCount,
                    lastUpdated: lastUpdated?.toDate ? lastUpdated.toDate() : (lastUpdated ? new Date(lastUpdated) : new Date()),
                    isEnabled: carrierData.enabled === undefined ? true : carrierData.enabled
                });
            }
            setCarriers(allCarriersData);
        } catch (error) {
            console.error('Error fetching carriers:', error);
            enqueueSnackbar('Failed to load carriers: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchCarriers();
    }, [fetchCarriers]);

    const handleToggleEnabled = async (carrierId, currentIsEnabled) => {
        const newIsEnabled = !currentIsEnabled;
        const carrierRef = doc(db, 'ediMappings', carrierId);
        try {
            await updateDoc(carrierRef, {
                enabled: newIsEnabled,
                updatedAt: serverTimestamp()
            });
            enqueueSnackbar(`Carrier mapping ${newIsEnabled ? 'enabled' : 'disabled'} successfully.`, { variant: 'success' });
            setCarriers(prevCarriers =>
                prevCarriers.map(c =>
                    c.id === carrierId ? { ...c, isEnabled: newIsEnabled, updatedAt: new Date() } : c
                )
            );
        } catch (error) {
            console.error('Error updating carrier status:', error);
            enqueueSnackbar('Failed to update carrier status: ' + error.message, { variant: 'error' });
        }
    };

    const handleMenuOpen = (event, carrier) => {
        setMenuAnchorEl(event.currentTarget);
        setSelectedCarrierForMenu(carrier);
    };

    const handleMenuClose = () => {
        setMenuAnchorEl(null);
        setSelectedCarrierForMenu(null);
    };

    const handleViewCurrentCarrier = () => {
        if (selectedCarrierForMenu) {
            navigate(`/admin/billing/edi-mapping/edit/${selectedCarrierForMenu.id}/review`);
        }
        handleMenuClose();
    };

    const handleEditCurrentCarrier = () => {
        if (selectedCarrierForMenu) {
            navigate(`/admin/billing/edi-mapping/edit/${selectedCarrierForMenu.id}/details`);
        }
        handleMenuClose();
    };

    const handleDeleteClick = () => {
        if (selectedCarrierForMenu) {
            setCarrierToDelete(selectedCarrierForMenu);
            setDeleteConfirmOpen(true);
        }
        handleMenuClose();
    };

    const handleDeleteConfirmDialogClose = () => {
        setDeleteConfirmOpen(false);
        setCarrierToDelete(null);
    };

    const handleDeleteExecute = async () => {
        if (!carrierToDelete || !carrierToDelete.id) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const carrierDocRef = doc(db, 'ediMappings', carrierToDelete.id);
            const mappingSubDocRef = doc(db, 'ediMappings', carrierToDelete.id, 'default', 'mapping');

            batch.delete(mappingSubDocRef);
            batch.delete(carrierDocRef);

            await batch.commit();
            enqueueSnackbar('Carrier mapping deleted successfully!', { variant: 'success' });
            fetchCarriers();
        } catch (error) {
            console.error('Error deleting carrier mapping:', error);
            enqueueSnackbar('Error deleting mapping: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
            handleDeleteConfirmDialogClose();
        }
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleAddCarrier = () => {
        navigate('/admin/billing/edi-mapping/new/details');
    };

    if (loading && carriers.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    EDI Mapping Management
                </Typography>

                <Paper sx={{ mb: 3 }}>
                    <Tabs
                        value={selectedTab}
                        onChange={handleTabChange}
                        indicatorColor="primary"
                        textColor="primary"
                        variant="fullWidth"
                    >
                        <Tab label="Carrier Mappings List" />
                        <Tab label="Test Mapping" />
                        <Tab label="Manage Prompts" />
                    </Tabs>
                </Paper>

                <Grid container spacing={3}>
                    {selectedTab === 0 && (
                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<AddIcon />}
                                onClick={handleAddCarrier}
                                sx={{ mb: 2 }}
                            >
                                Add New Carrier Mapping
                            </Button>

                            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                                <TableContainer sx={{ maxHeight: 600 }}>
                                    <Table stickyHeader aria-label="carrier mappings table">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Carrier</TableCell>
                                                <TableCell>Description</TableCell>
                                                <TableCell>Mappings</TableCell>
                                                <TableCell>Last Updated</TableCell>
                                                <TableCell>Status (Enabled)</TableCell>
                                                <TableCell align="right">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {carriers.map((carrier) => (
                                                <TableRow key={carrier.id} hover>
                                                    <TableCell>{carrier.name}</TableCell>
                                                    <TableCell>{carrier.description}</TableCell>
                                                    <TableCell>{carrier.mappingCount || 0}</TableCell>
                                                    <TableCell>
                                                        {carrier.lastUpdated?.toLocaleDateString() || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Switch
                                                            checked={carrier.isEnabled}
                                                            onChange={() => handleToggleEnabled(carrier.id, carrier.isEnabled)}
                                                            color="primary"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Actions">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => handleMenuOpen(e, carrier)}
                                                            >
                                                                <MoreVertIcon fontSize="inherit" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {carriers.length === 0 && !loading && (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center">
                                                        <Typography sx={{ p: 2 }} color="text.secondary">No carrier mappings found. Click "Add New" to create one.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Grid>
                    )}

                    {selectedTab === 1 && (
                        <Grid item xs={12}>
                            <Typography variant="h6">Test Mapping Area</Typography>
                            <Alert severity="info">Test Mapping Component will be rendered here.</Alert>
                        </Grid>
                    )}

                    {selectedTab === 2 && (
                        <Grid item xs={12}>
                            <Typography variant="h6">Manage Prompts Area</Typography>
                            <Alert severity="info">Prompt Version Manager Component will be rendered here.</Alert>
                        </Grid>
                    )}
                </Grid>
            </Box>

            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem onClick={handleViewCurrentCarrier}>
                    <ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>
                    View/Test
                </MenuItem>
                <MenuItem onClick={handleEditCurrentCarrier}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                    Delete
                </MenuItem>
            </Menu>

            <Dialog open={deleteConfirmOpen} onClose={handleDeleteConfirmDialogClose}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete the EDI mapping for "{carrierToDelete?.name || 'this carrier'}"?
                        This action will also remove its associated mapping details and cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteConfirmDialogClose}>Cancel</Button>
                    <Button onClick={handleDeleteExecute} color="error" variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default EDIMapping; 