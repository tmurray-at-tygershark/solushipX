import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Tab,
    Tabs,
    Grid,
    Alert,
    Snackbar,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    TablePagination,
    TextField,
    InputAdornment,
    Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Search as SearchIcon,
    ColorLens as ColorIcon,
    Category as CategoryIcon,
    List as ListIcon
} from '@mui/icons-material';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import ModalHeader from '../../common/ModalHeader';
import MasterStatusDialog from './dialogs/MasterStatusDialog';
import ShipmentStatusDialog from './dialogs/ShipmentStatusDialog';
import DeleteConfirmationDialog from './dialogs/DeleteConfirmationDialog';

const ShipmentStatuses = ({ isModal = false, onClose, showCloseButton = true }) => {
    // State management
    const [currentTab, setCurrentTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [masterStatuses, setMasterStatuses] = useState([]);
    const [shipmentStatuses, setShipmentStatuses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog states
    const [masterStatusDialog, setMasterStatusDialog] = useState({ open: false, mode: 'create', data: null });
    const [shipmentStatusDialog, setShipmentStatusDialog] = useState({ open: false, mode: 'create', data: null });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, type: '', id: '', name: '' });

    // UI states
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Cloud function references
    const getMasterStatusesFunc = httpsCallable(functions, 'getMasterStatuses');
    const getShipmentStatusesFunc = httpsCallable(functions, 'getShipmentStatuses');
    const createMasterStatusFunc = httpsCallable(functions, 'createMasterStatus');
    const updateMasterStatusFunc = httpsCallable(functions, 'updateMasterStatus');
    const deleteMasterStatusFunc = httpsCallable(functions, 'deleteMasterStatus');
    const createShipmentStatusFunc = httpsCallable(functions, 'createShipmentStatus');
    const updateShipmentStatusFunc = httpsCallable(functions, 'updateShipmentStatus');
    const deleteShipmentStatusFunc = httpsCallable(functions, 'deleteShipmentStatus');

    // Load data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            if (currentTab === 0) {
                // Load master statuses
                const result = await getMasterStatusesFunc();
                if (result.data.success) {
                    setMasterStatuses(result.data.masterStatuses || []);
                }
            } else {
                // Load shipment statuses
                const result = await getShipmentStatusesFunc();
                if (result.data.success) {
                    setShipmentStatuses(result.data.shipmentStatuses || []);
                    setMasterStatuses(result.data.masterStatuses || []);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showSnackbar('Failed to load data: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [currentTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Snackbar helper
    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
        setPage(0);
        setSearchTerm('');
        setActionMenuAnchor(null);
    };

    // Action menu handlers
    const handleActionMenuOpen = (event, item) => {
        setActionMenuAnchor(event.currentTarget);
        setSelectedItem(item);
    };

    const handleActionMenuClose = () => {
        setActionMenuAnchor(null);
        setSelectedItem(null);
    };

    // Dialog handlers
    const handleCreateMasterStatus = () => {
        setMasterStatusDialog({ open: true, mode: 'create', data: null });
        handleActionMenuClose();
    };

    const handleEditMasterStatus = (masterStatus) => {
        setMasterStatusDialog({ open: true, mode: 'edit', data: masterStatus });
        handleActionMenuClose();
    };

    const handleDeleteMasterStatus = (masterStatus) => {
        setDeleteDialog({
            open: true,
            type: 'master',
            id: masterStatus.id,
            name: masterStatus.displayLabel || masterStatus.label
        });
        handleActionMenuClose();
    };

    const handleCreateShipmentStatus = () => {
        setShipmentStatusDialog({ open: true, mode: 'create', data: null });
        handleActionMenuClose();
    };

    const handleEditShipmentStatus = (shipmentStatus) => {
        setShipmentStatusDialog({ open: true, mode: 'edit', data: shipmentStatus });
        handleActionMenuClose();
    };

    const handleDeleteShipmentStatus = (shipmentStatus) => {
        setDeleteDialog({
            open: true,
            type: 'shipment',
            id: shipmentStatus.id,
            name: shipmentStatus.statusLabel
        });
        handleActionMenuClose();
    };

    // Save handlers
    const handleSaveMasterStatus = async (formData) => {
        try {
            let result;
            if (masterStatusDialog.mode === 'create') {
                result = await createMasterStatusFunc(formData);
            } else {
                result = await updateMasterStatusFunc({
                    masterStatusId: masterStatusDialog.data.id,
                    updates: formData
                });
            }

            if (result.data.success) {
                showSnackbar(result.data.message, 'success');
                setMasterStatusDialog({ open: false, mode: 'create', data: null });
                loadData();
            } else {
                throw new Error(result.data.message || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving master status:', error);
            showSnackbar('Failed to save master status: ' + error.message, 'error');
        }
    };

    const handleSaveShipmentStatus = async (formData) => {
        try {
            let result;
            if (shipmentStatusDialog.mode === 'create') {
                result = await createShipmentStatusFunc(formData);
            } else {
                result = await updateShipmentStatusFunc({
                    shipmentStatusId: shipmentStatusDialog.data.id,
                    updates: formData
                });
            }

            if (result.data.success) {
                showSnackbar(result.data.message, 'success');
                setShipmentStatusDialog({ open: false, mode: 'create', data: null });
                loadData();
            } else {
                throw new Error(result.data.message || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving shipment status:', error);
            showSnackbar('Failed to save shipment status: ' + error.message, 'error');
        }
    };

    // Delete handler
    const handleConfirmDelete = async () => {
        try {
            let result;
            if (deleteDialog.type === 'master') {
                result = await deleteMasterStatusFunc({ masterStatusId: deleteDialog.id });
            } else {
                result = await deleteShipmentStatusFunc({ shipmentStatusId: deleteDialog.id });
            }

            if (result.data.success) {
                showSnackbar(result.data.message, 'success');
                setDeleteDialog({ open: false, type: '', id: '', name: '' });
                loadData();
            } else {
                throw new Error(result.data.message || 'Delete failed');
            }
        } catch (error) {
            console.error('Error deleting:', error);
            showSnackbar('Failed to delete: ' + error.message, 'error');
        }
    };

    // Filter data based on search
    const getFilteredData = () => {
        const data = currentTab === 0 ? masterStatuses : shipmentStatuses;
        if (!searchTerm) return data;

        return data.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            if (currentTab === 0) {
                return (
                    item.displayLabel?.toLowerCase().includes(searchLower) ||
                    item.label?.toLowerCase().includes(searchLower) ||
                    item.description?.toLowerCase().includes(searchLower)
                );
            } else {
                return (
                    item.statusLabel?.toLowerCase().includes(searchLower) ||
                    item.statusMeaning?.toLowerCase().includes(searchLower) ||
                    item.masterStatusData?.displayLabel?.toLowerCase().includes(searchLower)
                );
            }
        });
    };

    // Get paginated data
    const getPaginatedData = () => {
        const filteredData = getFilteredData();
        const startIndex = page * rowsPerPage;
        return filteredData.slice(startIndex, startIndex + rowsPerPage);
    };

    // Render master statuses table
    const renderMasterStatusesTable = () => {
        const paginatedData = getPaginatedData();

        return (
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status Label
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Description
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Color
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Sort Order
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: 60 }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedData.map((masterStatus) => (
                            <TableRow key={masterStatus.id} hover>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CategoryIcon sx={{ fontSize: 16, color: masterStatus.color || '#6b7280' }} />
                                        {masterStatus.displayLabel || masterStatus.label}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', maxWidth: 200 }}>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {masterStatus.description}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                backgroundColor: masterStatus.color || '#6b7280',
                                                border: '1px solid #e5e7eb'
                                            }}
                                        />
                                        {masterStatus.color || '#6b7280'}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {masterStatus.sortOrder || 0}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={masterStatus.enabled ? 'Enabled' : 'Disabled'}
                                        color={masterStatus.enabled ? 'success' : 'default'}
                                        size="small"
                                        sx={{ fontSize: '11px' }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleActionMenuOpen(e, masterStatus)}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    // Render shipment statuses table
    const renderShipmentStatusesTable = () => {
        const paginatedData = getPaginatedData();

        return (
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status Label
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status Meaning
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Master Status
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status Code
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: 60 }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedData.map((shipmentStatus) => (
                            <TableRow key={shipmentStatus.id} hover>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ListIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                        {shipmentStatus.statusLabel}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', maxWidth: 250 }}>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {shipmentStatus.statusMeaning}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {shipmentStatus.masterStatusData ? (
                                        <Chip
                                            label={shipmentStatus.masterStatusData.displayLabel || shipmentStatus.masterStatusData.label}
                                            size="small"
                                            sx={{
                                                fontSize: '11px',
                                                backgroundColor: shipmentStatus.masterStatusData.color + '20',
                                                color: shipmentStatus.masterStatusData.color,
                                                border: `1px solid ${shipmentStatus.masterStatusData.color}40`
                                            }}
                                        />
                                    ) : (
                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Unknown
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Typography variant="body2" sx={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>
                                        {shipmentStatus.statusCode}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={shipmentStatus.enabled ? 'Enabled' : 'Disabled'}
                                        color={shipmentStatus.enabled ? 'success' : 'default'}
                                        size="small"
                                        sx={{ fontSize: '11px' }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleActionMenuOpen(e, shipmentStatus)}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: isModal ? '80vh' : '100vh',
            overflow: 'hidden'
        }}>
            {/* Header */}
            {isModal ? (
                <ModalHeader
                    title="Shipment Statuses Configuration"
                    onClose={onClose}
                    showCloseButton={showCloseButton}
                />
            ) : (
                <Box sx={{
                    p: 3,
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: 'white'
                }}>
                    <Typography variant="h5" sx={{ fontSize: '20px', fontWeight: 600, color: '#111827', mb: 1 }}>
                        Shipment Statuses Configuration
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Manage master statuses and detailed shipment statuses for comprehensive status tracking
                    </Typography>
                </Box>
            )}

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {/* Tabs */}
                <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 3 }}>
                    <Tabs
                        value={currentTab}
                        onChange={handleTabChange}
                        sx={{
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiTab-root': {
                                fontSize: '12px',
                                textTransform: 'none',
                                fontWeight: 600
                            }
                        }}
                    >
                        <Tab
                            label={`Master Statuses (${masterStatuses.length})`}
                            icon={<CategoryIcon />}
                            iconPosition="start"
                        />
                        <Tab
                            label={`Shipment Statuses (${shipmentStatuses.length})`}
                            icon={<ListIcon />}
                            iconPosition="start"
                        />
                    </Tabs>

                    {/* Tab Content */}
                    <Box sx={{ p: 3 }}>
                        {/* Controls */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <TextField
                                placeholder={currentTab === 0 ? "Search master statuses..." : "Search shipment statuses..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                size="small"
                                sx={{ minWidth: 300, '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }}
                            />
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={currentTab === 0 ? handleCreateMasterStatus : handleCreateShipmentStatus}
                                size="small"
                                sx={{ fontSize: '12px', textTransform: 'none' }}
                            >
                                Add {currentTab === 0 ? 'Master Status' : 'Shipment Status'}
                            </Button>
                        </Box>

                        {/* Loading */}
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={40} />
                            </Box>
                        ) : (
                            <>
                                {/* Tables */}
                                {currentTab === 0 ? renderMasterStatusesTable() : renderShipmentStatusesTable()}

                                {/* Pagination */}
                                <TablePagination
                                    component="div"
                                    count={getFilteredData().length}
                                    page={page}
                                    onPageChange={(e, newPage) => setPage(newPage)}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={(e) => {
                                        setRowsPerPage(parseInt(e.target.value, 10));
                                        setPage(0);
                                    }}
                                    rowsPerPageOptions={[10, 25, 50, 100]}
                                    sx={{
                                        mt: 2,
                                        '& .MuiTablePagination-toolbar': { fontSize: '12px' },
                                        '& .MuiTablePagination-selectLabel': { fontSize: '12px' },
                                        '& .MuiTablePagination-displayedRows': { fontSize: '12px' }
                                    }}
                                />
                            </>
                        )}
                    </Box>
                </Paper>
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
            >
                <MenuItem
                    onClick={() => {
                        if (currentTab === 0) {
                            handleEditMasterStatus(selectedItem);
                        } else {
                            handleEditShipmentStatus(selectedItem);
                        }
                    }}
                    sx={{ fontSize: '12px' }}
                >
                    <EditIcon fontSize="small" sx={{ mr: 1 }} />
                    Edit
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (currentTab === 0) {
                            handleDeleteMasterStatus(selectedItem);
                        } else {
                            handleDeleteShipmentStatus(selectedItem);
                        }
                    }}
                    sx={{ fontSize: '12px', color: 'error.main' }}
                >
                    <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>

            {/* Dialogs */}
            <MasterStatusDialog
                open={masterStatusDialog.open}
                mode={masterStatusDialog.mode}
                data={masterStatusDialog.data}
                onSave={handleSaveMasterStatus}
                onClose={() => setMasterStatusDialog({ open: false, mode: 'create', data: null })}
            />

            <ShipmentStatusDialog
                open={shipmentStatusDialog.open}
                mode={shipmentStatusDialog.mode}
                data={shipmentStatusDialog.data}
                masterStatuses={masterStatuses}
                onSave={handleSaveShipmentStatus}
                onClose={() => setShipmentStatusDialog({ open: false, mode: 'create', data: null })}
            />

            <DeleteConfirmationDialog
                open={deleteDialog.open}
                type={deleteDialog.type}
                name={deleteDialog.name}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteDialog({ open: false, type: '', id: '', name: '' })}
            />

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ShipmentStatuses; 