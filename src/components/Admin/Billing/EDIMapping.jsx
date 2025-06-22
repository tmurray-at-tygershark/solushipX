import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Alert,
    CircularProgress,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
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
    MoreVert as MoreVertIcon,
    DataObject as DataObjectIcon,
    Science as ScienceIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';
import AddCarrierMapping from './AddCarrierMapping';
import MappingTest from '../EDIMapping/MappingTest';
import PromptVersionManager from '../EDIMapping/PromptVersionManager';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import AdminBreadcrumb from '../AdminBreadcrumb';

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
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: 'calc(100vh - 200px)'
            }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827' }}>
                        EDI Mapping Management
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddCarrier}
                        sx={{ fontSize: '12px' }}
                    >
                        Add New Carrier
                    </Button>
                </Box>
                {/* Breadcrumb */}
                <AdminBreadcrumb currentPage="EDI Mapping" />
            </Box>

            {/* Tabs Section */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={selectedTab}
                    onChange={handleTabChange}
                    sx={{
                        px: 3,
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            minHeight: 48,
                            fontWeight: 500,
                            fontSize: '12px'
                        }
                    }}
                >
                    <Tab
                        label="Carrier Mappings"
                        icon={<DataObjectIcon sx={{ fontSize: '16px' }} />}
                        iconPosition="start"
                    />
                    <Tab
                        label="Test Mapping"
                        icon={<ScienceIcon sx={{ fontSize: '16px' }} />}
                        iconPosition="start"
                    />
                    <Tab
                        label="Manage Prompts"
                        icon={<SettingsIcon sx={{ fontSize: '16px' }} />}
                        iconPosition="start"
                    />
                </Tabs>
            </Box>

            {/* Content Area */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ p: 3 }}>
                    {selectedTab === 0 && (
                        <Paper elevation={0} sx={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }}>
                            <TableContainer>
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                Carrier
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                Description
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                Mappings
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                Last Updated
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151',
                                                width: '120px'
                                            }}>
                                                Status
                                            </TableCell>
                                            <TableCell align="right" sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151',
                                                width: '80px'
                                            }}>
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {carriers.map((carrier) => (
                                            <TableRow key={carrier.id} hover>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {carrier.name}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {carrier.description || 'No description'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {carrier.mappingCount || 0}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {carrier.lastUpdated?.toLocaleDateString() || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Switch
                                                            checked={carrier.isEnabled}
                                                            onChange={() => handleToggleEnabled(carrier.id, carrier.isEnabled)}
                                                            color="primary"
                                                            size="small"
                                                        />
                                                        <Typography sx={{
                                                            fontSize: '11px',
                                                            color: carrier.isEnabled ? '#059669' : '#6b7280'
                                                        }}>
                                                            {carrier.isEnabled ? 'Enabled' : 'Disabled'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="Actions">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => handleMenuOpen(e, carrier)}
                                                        >
                                                            <MoreVertIcon sx={{ fontSize: '18px' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {carriers.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center">
                                                    <Box sx={{ py: 6 }}>
                                                        <DataObjectIcon sx={{ fontSize: 48, color: '#e5e7eb', mb: 2 }} />
                                                        <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                            No carrier mappings found
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                            Click "Add New Carrier" to create your first EDI mapping
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}

                    {selectedTab === 1 && (
                        <Paper elevation={0} sx={{
                            p: 3,
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <ScienceIcon sx={{ color: '#374151', fontSize: '20px' }} />
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                    Test EDI Mapping
                                </Typography>
                            </Box>
                            <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '12px' } }}>
                                Upload a sample EDI file to test your carrier mappings and verify the output.
                            </Alert>
                            {/* MappingTest component would be rendered here when available */}
                        </Paper>
                    )}

                    {selectedTab === 2 && (
                        <Paper elevation={0} sx={{
                            p: 3,
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <SettingsIcon sx={{ color: '#374151', fontSize: '20px' }} />
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                    Manage AI Prompts
                                </Typography>
                            </Box>
                            <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '12px' } }}>
                                Manage and version control your AI prompts for EDI field mapping generation.
                            </Alert>
                            {/* PromptVersionManager component would be rendered here when available */}
                        </Paper>
                    )}
                </Box>
            </Box>

            {/* Context Menu */}
            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem onClick={handleViewCurrentCarrier} sx={{ fontSize: '12px' }}>
                    <ListItemIcon><ViewIcon sx={{ fontSize: '18px' }} /></ListItemIcon>
                    View/Test
                </MenuItem>
                <MenuItem onClick={handleEditCurrentCarrier} sx={{ fontSize: '12px' }}>
                    <ListItemIcon><EditIcon sx={{ fontSize: '18px' }} /></ListItemIcon>
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main', fontSize: '12px' }}>
                    <ListItemIcon><DeleteIcon sx={{ fontSize: '18px', color: 'error.main' }} /></ListItemIcon>
                    Delete
                </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={handleDeleteConfirmDialogClose}
                PaperProps={{
                    sx: {
                        borderRadius: '8px',
                        minWidth: '400px'
                    }
                }}
            >
                <DialogTitle sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#374151',
                    pb: 1
                }}>
                    Confirm Delete
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Are you sure you want to delete the EDI mapping for "{carrierToDelete?.name || 'this carrier'}"?
                        This action will also remove its associated mapping details and cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 1 }}>
                    <Button
                        onClick={handleDeleteConfirmDialogClose}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteExecute}
                        color="error"
                        variant="contained"
                        size="small"
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                    >
                        {loading ? <CircularProgress size={16} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EDIMapping; 