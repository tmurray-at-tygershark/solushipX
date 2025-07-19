import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
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
    Receipt as ReceiptIcon,
    Payment as PaymentIcon
} from '@mui/icons-material';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import ModalHeader from '../../common/ModalHeader';
import InvoiceStatusDialog from './dialogs/InvoiceStatusDialog';
import DeleteConfirmationDialog from './dialogs/DeleteConfirmationDialog';

const InvoiceStatuses = ({ isModal = false, onClose, showCloseButton = true }) => {
    // State management
    const [loading, setLoading] = useState(true);
    const [invoiceStatuses, setInvoiceStatuses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog states
    const [invoiceStatusDialog, setInvoiceStatusDialog] = useState({ open: false, mode: 'create', data: null });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, id: '', name: '' });

    // UI states
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Cloud function references
    const getAllInvoiceStatusesFunc = httpsCallable(functions, 'getAllInvoiceStatuses');
    const createInvoiceStatusFunc = httpsCallable(functions, 'createInvoiceStatus');
    const updateInvoiceStatusFunc = httpsCallable(functions, 'updateInvoiceStatus');
    const deleteInvoiceStatusFunc = httpsCallable(functions, 'deleteInvoiceStatus');

    // Load data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const result = await getAllInvoiceStatusesFunc();
            if (result.data.success) {
                setInvoiceStatuses(result.data.invoiceStatuses || []);
            }
        } catch (error) {
            console.error('Error loading invoice statuses:', error);
            showSnackbar('Failed to load invoice statuses: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Snackbar helper
    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
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
    const handleCreateInvoiceStatus = () => {
        setInvoiceStatusDialog({ open: true, mode: 'create', data: null });
        handleActionMenuClose();
    };

    const handleEditInvoiceStatus = (invoiceStatus) => {
        setInvoiceStatusDialog({ open: true, mode: 'edit', data: invoiceStatus });
        handleActionMenuClose();
    };

    const handleDeleteInvoiceStatus = (invoiceStatus) => {
        setDeleteDialog({
            open: true,
            id: invoiceStatus.id,
            name: invoiceStatus.statusLabel
        });
        handleActionMenuClose();
    };

    // Save handler
    const handleSaveInvoiceStatus = async (formData) => {
        try {
            let result;
            if (invoiceStatusDialog.mode === 'create') {
                result = await createInvoiceStatusFunc(formData);
            } else {
                result = await updateInvoiceStatusFunc({
                    invoiceStatusId: invoiceStatusDialog.data.id,
                    updates: formData
                });
            }

            if (result.data.success) {
                showSnackbar(result.data.message, 'success');
                setInvoiceStatusDialog({ open: false, mode: 'create', data: null });
                loadData();
            } else {
                throw new Error(result.data.message || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving invoice status:', error);
            showSnackbar('Failed to save invoice status: ' + error.message, 'error');
        }
    };

    // Delete handler
    const handleConfirmDelete = async () => {
        try {
            const result = await deleteInvoiceStatusFunc({ invoiceStatusId: deleteDialog.id });
            if (result.data.success) {
                showSnackbar(result.data.message, 'success');
                setDeleteDialog({ open: false, id: '', name: '' });
                loadData();
            } else {
                throw new Error(result.data.message || 'Delete failed');
            }
        } catch (error) {
            console.error('Error deleting invoice status:', error);
            showSnackbar('Failed to delete invoice status: ' + error.message, 'error');
        }
    };

    // Filter data based on search term
    const getFilteredData = () => {
        if (!searchTerm.trim()) {
            return invoiceStatuses;
        }

        const searchLower = searchTerm.toLowerCase();
        return invoiceStatuses.filter(status =>
            status.statusLabel?.toLowerCase().includes(searchLower) ||
            status.statusDescription?.toLowerCase().includes(searchLower) ||
            status.statusCode?.toLowerCase().includes(searchLower)
        );
    };

    // Get paginated data
    const getPaginatedData = () => {
        const filteredData = getFilteredData();
        const startIndex = page * rowsPerPage;
        return filteredData.slice(startIndex, startIndex + rowsPerPage);
    };

    // Render invoice statuses table
    const renderInvoiceStatusesTable = () => {
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
                                Status Code
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
                        {paginatedData.map((invoiceStatus) => (
                            <TableRow key={invoiceStatus.id} hover>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ReceiptIcon sx={{ fontSize: 16, color: invoiceStatus.color || '#6b7280' }} />
                                        {invoiceStatus.statusLabel}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', maxWidth: 250 }}>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {invoiceStatus.statusDescription}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                backgroundColor: invoiceStatus.color || '#6b7280',
                                                border: '1px solid #e5e7eb'
                                            }}
                                        />
                                        {invoiceStatus.color || '#6b7280'}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Typography variant="body2" sx={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>
                                        {invoiceStatus.statusCode}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        {invoiceStatus.sortOrder || 0}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={invoiceStatus.enabled ? 'Enabled' : 'Disabled'}
                                        color={invoiceStatus.enabled ? 'success' : 'default'}
                                        size="small"
                                        sx={{ fontSize: '11px' }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleActionMenuOpen(e, invoiceStatus)}
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
                    title="Invoice Statuses Configuration"
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
                        Invoice Statuses Configuration
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Manage invoice statuses for comprehensive billing and payment tracking
                    </Typography>
                </Box>
            )}

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 3 }}>
                    {/* Tab Content */}
                    <Box sx={{ p: 3 }}>
                        {/* Controls */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <TextField
                                placeholder="Search invoice statuses..."
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
                                onClick={handleCreateInvoiceStatus}
                                size="small"
                                sx={{ fontSize: '12px', textTransform: 'none' }}
                            >
                                Add Invoice Status
                            </Button>
                        </Box>

                        {/* Loading */}
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={40} />
                            </Box>
                        ) : (
                            <>
                                {/* Table */}
                                {renderInvoiceStatusesTable()}

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
                    onClick={() => handleEditInvoiceStatus(selectedItem)}
                    sx={{ fontSize: '12px' }}
                >
                    <EditIcon fontSize="small" sx={{ mr: 1 }} />
                    Edit
                </MenuItem>
                <MenuItem
                    onClick={() => handleDeleteInvoiceStatus(selectedItem)}
                    sx={{ fontSize: '12px', color: 'error.main' }}
                >
                    <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>

            {/* Dialogs */}
            <InvoiceStatusDialog
                open={invoiceStatusDialog.open}
                mode={invoiceStatusDialog.mode}
                data={invoiceStatusDialog.data}
                onSave={handleSaveInvoiceStatus}
                onClose={() => setInvoiceStatusDialog({ open: false, mode: 'create', data: null })}
            />

            <DeleteConfirmationDialog
                open={deleteDialog.open}
                type="invoice status"
                name={deleteDialog.name}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteDialog({ open: false, id: '', name: '' })}
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

export default InvoiceStatuses; 