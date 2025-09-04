import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    IconButton,
    Menu,
    MenuItem as ContextMenuItem,
    Tooltip,
    Alert,
    Skeleton,
    Card,
    CardContent,
    LinearProgress,
    Avatar,
    Autocomplete,
    Switch,
    FormControlLabel,
    InputAdornment,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    MoreVert as MoreIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    RestoreFromTrash as RestoreIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    Business as BusinessIcon,
    Assessment as MetricsIcon,
    PlayArrow as RetrainIcon,
    Visibility as ViewIcon,
    Close as CloseIcon,
    Upload as UploadIcon,
    Download as DownloadIcon,
    GetApp as ExportIcon,
    AutoAwesome as PromptIcon
} from '@mui/icons-material';
import CarrierPromptManager from './CarrierPromptManager';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';

const CarrierManagement = () => {
    const { enqueueSnackbar } = useSnackbar();

    // State management
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCarrier, setSelectedCarrier] = useState(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Filtering and search
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('active');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [promptManagerOpen, setPromptManagerOpen] = useState(false);
    const [selectedPromptCarrier, setSelectedPromptCarrier] = useState(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'general',
        externalId: ''
    });
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);

    // Context menu
    const [contextMenu, setContextMenu] = useState(null);
    const [contextCarrier, setContextCarrier] = useState(null);

    // Bulk import state
    const [importFile, setImportFile] = useState(null);
    const [importData, setImportData] = useState([]);
    const [importErrors, setImportErrors] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    // Categories
    const [categories, setCategories] = useState(['general', 'courier', 'freight', 'ltl', 'postal']);

    // Cloud functions
    const createTrainingCarrier = httpsCallable(functions, 'createTrainingCarrier');
    const getTrainingCarriers = httpsCallable(functions, 'getTrainingCarriers');
    const updateTrainingCarrier = httpsCallable(functions, 'updateTrainingCarrier');
    const deleteTrainingCarrier = httpsCallable(functions, 'deleteTrainingCarrier');
    const getCarrierDetails = httpsCallable(functions, 'getCarrierDetails');
    const retrainCarrier = httpsCallable(functions, 'retrainCarrier');
    // const getCarrierCategories = httpsCallable(functions, 'getCarrierCategories'); // Temporarily unused

    // Load carriers
    const loadCarriers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const result = await getTrainingCarriers({
                page: page + 1,
                limit: rowsPerPage,
                search: searchTerm,
                category: categoryFilter,
                status: statusFilter,
                sortBy,
                sortOrder
            });

            if (result.data.success) {
                setCarriers(result.data.data.carriers);
                setTotalCount(result.data.data.pagination.totalCount);
            } else {
                throw new Error(result.data.error || 'Failed to load carriers');
            }
        } catch (error) {
            console.error('Load carriers error:', error);
            setError(error.message);
            enqueueSnackbar('Failed to load carriers', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchTerm, categoryFilter, statusFilter, sortBy, sortOrder]);

    // Load categories
    const loadCategories = useCallback(() => {
        try {
            const base = new Set(['general', 'courier', 'freight', 'ltl', 'postal']);
            (carriers || []).forEach(c => {
                if (c?.category) base.add(c.category);
            });
            setCategories(Array.from(base).sort());
        } catch (error) {
            console.error('Load categories error:', error);
        }
    }, [carriers]);

    // Effects
    useEffect(() => {
        loadCarriers();
    }, [loadCarriers]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    // Form validation
    const validateForm = useCallback(() => {
        const errors = {};

        if (!formData.name || formData.name.trim().length === 0) {
            errors.name = 'Carrier name is required';
        } else if (formData.name.trim().length > 100) {
            errors.name = 'Carrier name must be 100 characters or less';
        }

        if (formData.description && formData.description.length > 500) {
            errors.description = 'Description must be 500 characters or less';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData]);

    // Handlers
    const handleCreateCarrier = async () => {
        if (!validateForm()) return;

        try {
            setSaving(true);
            const result = await createTrainingCarrier(formData);

            if (result.data.success) {
                enqueueSnackbar('Carrier created successfully', { variant: 'success' });
                setCreateDialogOpen(false);
                resetForm();
                loadCarriers();
            } else {
                throw new Error(result.data.error || 'Failed to create carrier');
            }
        } catch (error) {
            console.error('Create carrier error:', error);
            enqueueSnackbar(error.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateCarrier = async () => {
        if (!validateForm()) return;

        try {
            setSaving(true);
            const result = await updateTrainingCarrier({
                carrierId: selectedCarrier.id,
                updates: formData
            });

            if (result.data.success) {
                enqueueSnackbar('Carrier updated successfully', { variant: 'success' });
                setEditDialogOpen(false);
                resetForm();
                loadCarriers();
            } else {
                throw new Error(result.data.error || 'Failed to update carrier');
            }
        } catch (error) {
            console.error('Update carrier error:', error);
            enqueueSnackbar(error.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCarrier = async (force = false) => {
        try {
            setSaving(true);
            const result = await deleteTrainingCarrier({
                carrierId: selectedCarrier.id,
                force
            });

            if (result.data.success) {
                enqueueSnackbar(
                    force ? 'Carrier permanently deleted' : 'Carrier archived',
                    { variant: 'success' }
                );
                setDeleteDialogOpen(false);
                setSelectedCarrier(null);
                loadCarriers();
            } else {
                throw new Error(result.data.error || 'Failed to delete carrier');
            }
        } catch (error) {
            console.error('Delete carrier error:', error);
            enqueueSnackbar(error.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleRetrainCarrier = async (carrier) => {
        try {
            const result = await retrainCarrier({
                carrierId: carrier.id
            });

            if (result.data.success) {
                enqueueSnackbar('Retraining initiated successfully', { variant: 'success' });
                loadCarriers();
            } else {
                throw new Error(result.data.error || 'Failed to initiate retraining');
            }
        } catch (error) {
            console.error('Retrain carrier error:', error);
            enqueueSnackbar(error.message, { variant: 'error' });
        }
    };

    // Export carriers to CSV
    const handleExportCarriers = () => {
        try {
            const csvData = carriers.map(carrier => ({
                name: carrier.name,
                description: carrier.description || '',
                category: carrier.category || 'general',
                externalId: carrier.externalId || '',
                active: carrier.active ? 'true' : 'false',
                totalSamples: carrier.stats?.totalSamples || 0,
                averageConfidence: carrier.stats?.averageConfidence || 0,
                createdAt: carrier.audit?.createdAt?.toDate?.()?.toLocaleDateString() || ''
            }));

            const csvContent = [
                ['Name', 'Description', 'Category', 'External ID', 'Active', 'Total Samples', 'Average Confidence', 'Created At'],
                ...csvData.map(row => [
                    row.name,
                    row.description,
                    row.category,
                    row.externalId,
                    row.active,
                    row.totalSamples,
                    row.averageConfidence,
                    row.createdAt
                ])
            ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `carriers_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            enqueueSnackbar(`Exported ${carriers.length} carriers to CSV`, { variant: 'success' });
        } catch (error) {
            console.error('Export error:', error);
            enqueueSnackbar('Failed to export carriers', { variant: 'error' });
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            category: 'general',
            externalId: ''
        });
        setFormErrors({});
        setSelectedCarrier(null);
    };

    const openEditDialog = (carrier) => {
        setSelectedCarrier(carrier);
        setFormData({
            name: carrier.name,
            description: carrier.description || '',
            category: carrier.category || 'general',
            externalId: carrier.externalId || ''
        });
        setEditDialogOpen(true);
    };

    const openDeleteDialog = (carrier) => {
        setSelectedCarrier(carrier);
        setDeleteDialogOpen(true);
    };

    const handleContextMenu = (event, carrier) => {
        event.preventDefault();
        setContextMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
        });
        setContextCarrier(carrier);
    };

    const closeContextMenu = () => {
        setContextMenu(null);
        setContextCarrier(null);
    };

    const handleOpenPromptManager = (carrier) => {
        setSelectedPromptCarrier(carrier);
        setPromptManagerOpen(true);
        closeContextMenu();
    };

    const handleClosePromptManager = () => {
        setPromptManagerOpen(false);
        setSelectedPromptCarrier(null);
    };

    // Memoized values
    const filteredAndSortedCarriers = useMemo(() => {
        return carriers.filter(carrier => {
            if (searchTerm && !carrier.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            if (categoryFilter !== 'all' && carrier.category !== categoryFilter) {
                return false;
            }
            return true;
        });
    }, [carriers, searchTerm, categoryFilter]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'success';
            case 'inactive': return 'warning';
            case 'archived': return 'default';
            case 'retraining': return 'info';
            default: return 'default';
        }
    };

    const getCategoryColor = (category) => {
        switch (category) {
            case 'courier': return '#2196F3';
            case 'freight': return '#FF9800';
            case 'ltl': return '#4CAF50';
            case 'postal': return '#9C27B0';
            default: return '#757575';
        }
    };

    // Render functions
    const renderCarrierRow = (carrier) => (
        <TableRow
            key={carrier.id}
            hover
            onContextMenu={(e) => handleContextMenu(e, carrier)}
            sx={{
                cursor: 'context-menu',
                '&:hover': { backgroundColor: '#f5f5f5' }
            }}
        >
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            bgcolor: getCategoryColor(carrier.category),
                            fontSize: '12px'
                        }}
                    >
                        {carrier.name.substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="body2" fontWeight={600} fontSize="12px">
                            {carrier.name}
                        </Typography>
                        {carrier.externalId && (
                            <Typography variant="caption" color="text.secondary" fontSize="11px">
                                ID: {carrier.externalId}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </TableCell>

            <TableCell>
                <Typography
                    variant="body2"
                    fontSize="12px"
                    sx={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {carrier.description || 'No description'}
                </Typography>
            </TableCell>

            <TableCell>
                <Chip
                    label={carrier.category}
                    size="small"
                    sx={{
                        backgroundColor: getCategoryColor(carrier.category),
                        color: 'white',
                        fontSize: '11px'
                    }}
                />
            </TableCell>

            <TableCell>
                <Chip
                    label={carrier.metadata?.status || 'active'}
                    color={getStatusColor(carrier.metadata?.status || 'active')}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '11px' }}
                />
            </TableCell>

            <TableCell align="center">
                <Typography variant="body2" fontSize="12px">
                    {carrier.stats?.totalSamples || 0}
                </Typography>
            </TableCell>

            <TableCell align="center">
                <Typography variant="body2" fontSize="12px">
                    {carrier.stats?.totalTemplates || 0}
                </Typography>
            </TableCell>

            <TableCell align="center">
                <Typography variant="body2" fontSize="12px">
                    {carrier.stats?.averageConfidence
                        ? `${(carrier.stats.averageConfidence * 100).toFixed(1)}%`
                        : 'N/A'
                    }
                </Typography>
            </TableCell>

            <TableCell>
                <Typography variant="body2" fontSize="12px" color="text.secondary">
                    {carrier.audit?.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                </Typography>
            </TableCell>

            <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="AI Prompt Manager">
                        <IconButton
                            size="small"
                            onClick={() => handleOpenPromptManager(carrier)}
                            sx={{ 
                                color: '#8b5cf6',
                                '&:hover': { backgroundColor: '#f3f4f6' }
                            }}
                        >
                            <PromptIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <IconButton
                        size="small"
                        onClick={(e) => handleContextMenu(e, carrier)}
                    >
                        <MoreIcon fontSize="small" />
                    </IconButton>
                </Box>
            </TableCell>
        </TableRow>
    );

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                borderBottom: '1px solid #e5e7eb',
                pb: 3
            }}>
                <Box>
                    <Typography variant="h5" fontWeight={600} color="#111827">
                        Carrier Training Management
                    </Typography>
                    <Typography variant="body2" color="#6b7280" fontSize="12px">
                        Manage AI training carriers for invoice processing
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={loadCarriers}
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<UploadIcon />}
                        onClick={() => setBulkImportDialogOpen(true)}
                        sx={{ fontSize: '12px' }}
                    >
                        Bulk Import
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ExportIcon />}
                        onClick={handleExportCarriers}
                        disabled={carriers.length === 0}
                        sx={{ fontSize: '12px' }}
                    >
                        Export
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                        sx={{ fontSize: '12px' }}
                    >
                        Add Carrier
                    </Button>
                </Box>
            </Box>

            {/* Filters */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    mb: 3,
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                }}
            >
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search carriers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '12px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                            <Select
                                value={categoryFilter}
                                label="Category"
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Categories</MenuItem>
                                {categories.map(category => (
                                    <MenuItem key={category} value={category} sx={{ fontSize: '12px' }}>
                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                            <Select
                                value={statusFilter}
                                label="Status"
                                onChange={(e) => setStatusFilter(e.target.value)}
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Status</MenuItem>
                                <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                <MenuItem value="inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                                <MenuItem value="archived" sx={{ fontSize: '12px' }}>Archived</MenuItem>
                                <MenuItem value="retraining" sx={{ fontSize: '12px' }}>Retraining</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Sort By</InputLabel>
                            <Select
                                value={sortBy}
                                label="Sort By"
                                onChange={(e) => setSortBy(e.target.value)}
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="name" sx={{ fontSize: '12px' }}>Name</MenuItem>
                                <MenuItem value="audit.createdAt" sx={{ fontSize: '12px' }}>Created Date</MenuItem>
                                <MenuItem value="stats.totalSamples" sx={{ fontSize: '12px' }}>Samples</MenuItem>
                                <MenuItem value="stats.averageConfidence" sx={{ fontSize: '12px' }}>Confidence</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Order</InputLabel>
                            <Select
                                value={sortOrder}
                                label="Order"
                                onChange={(e) => setSortOrder(e.target.value)}
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="asc" sx={{ fontSize: '12px' }}>Ascending</MenuItem>
                                <MenuItem value="desc" sx={{ fontSize: '12px' }}>Descending</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Main Table */}
            <Paper
                elevation={0}
                sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                }}
            >
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Carrier
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Description
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Category
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Status
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Samples
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Templates
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Confidence
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Created
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: rowsPerPage }).map((_, index) => (
                                    <TableRow key={index}>
                                        {Array.from({ length: 9 }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex}>
                                                <Skeleton variant="text" height={20} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : carriers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body2" color="text.secondary" fontSize="12px">
                                            No carriers found
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                carriers.map(renderCarrierRow)
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    sx={{ borderTop: '1px solid #e5e7eb' }}
                />
            </Paper>

            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={closeContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <ContextMenuItem
                    onClick={() => {
                        // Open details dialog
                        closeContextMenu();
                    }}
                    sx={{ fontSize: '12px' }}
                >
                    <ViewIcon fontSize="small" sx={{ mr: 1 }} />
                    View Details
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() => handleOpenPromptManager(contextCarrier)}
                    sx={{ fontSize: '12px' }}
                >
                    <PromptIcon fontSize="small" sx={{ mr: 1, color: '#8b5cf6' }} />
                    AI Prompt Manager
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() => {
                        openEditDialog(contextCarrier);
                        closeContextMenu();
                    }}
                    sx={{ fontSize: '12px' }}
                >
                    <EditIcon fontSize="small" sx={{ mr: 1 }} />
                    Edit
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() => {
                        handleRetrainCarrier(contextCarrier);
                        closeContextMenu();
                    }}
                    sx={{ fontSize: '12px' }}
                >
                    <RetrainIcon fontSize="small" sx={{ mr: 1 }} />
                    Retrain
                </ContextMenuItem>
                <Divider />
                <ContextMenuItem
                    onClick={() => {
                        openDeleteDialog(contextCarrier);
                        closeContextMenu();
                    }}
                    sx={{ fontSize: '12px', color: 'error.main' }}
                >
                    <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                    Delete
                </ContextMenuItem>
            </Menu>

            {/* Create Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Create New Training Carrier
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Carrier Name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                error={!!formErrors.name}
                                helperText={formErrors.name}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                                <Select
                                    value={formData.category}
                                    label="Category"
                                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                    sx={{ fontSize: '12px' }}
                                >
                                    {categories.map(category => (
                                        <MenuItem key={category} value={category} sx={{ fontSize: '12px' }}>
                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="External ID (Optional)"
                                value={formData.externalId}
                                onChange={(e) => setFormData(prev => ({ ...prev, externalId: e.target.value }))}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Description (Optional)"
                                multiline
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                error={!!formErrors.description}
                                helperText={formErrors.description}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setCreateDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateCarrier}
                        variant="contained"
                        size="small"
                        disabled={saving}
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Creating...' : 'Create Carrier'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Edit Training Carrier
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Carrier Name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                error={!!formErrors.name}
                                helperText={formErrors.name}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                                <Select
                                    value={formData.category}
                                    label="Category"
                                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                    sx={{ fontSize: '12px' }}
                                >
                                    {categories.map(category => (
                                        <MenuItem key={category} value={category} sx={{ fontSize: '12px' }}>
                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="External ID (Optional)"
                                value={formData.externalId}
                                onChange={(e) => setFormData(prev => ({ ...prev, externalId: e.target.value }))}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Description (Optional)"
                                multiline
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                error={!!formErrors.description}
                                helperText={formErrors.description}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setEditDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateCarrier}
                        variant="contained"
                        size="small"
                        disabled={saving}
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Updating...' : 'Update Carrier'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Delete Training Carrier
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This action will archive the carrier and all its training data.
                    </Alert>
                    <Typography variant="body2" fontSize="12px">
                        Are you sure you want to delete "{selectedCarrier?.name}"?
                    </Typography>
                    <Typography variant="body2" fontSize="12px" color="text.secondary" sx={{ mt: 1 }}>
                        This will not permanently delete the data - the carrier will be archived and can be restored later.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handleDeleteCarrier(false)}
                        variant="outlined"
                        color="warning"
                        size="small"
                        disabled={saving}
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Archiving...' : 'Archive'}
                    </Button>
                    <Button
                        onClick={() => handleDeleteCarrier(true)}
                        variant="contained"
                        color="error"
                        size="small"
                        disabled={saving}
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Deleting...' : 'Permanently Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Carrier Prompt Manager */}
            {promptManagerOpen && selectedPromptCarrier && (
                <CarrierPromptManager
                    carrierId={selectedPromptCarrier.id}
                    carrierName={selectedPromptCarrier.name}
                    onClose={handleClosePromptManager}
                />
            )}
        </Box>
    );
};

export default CarrierManagement;
