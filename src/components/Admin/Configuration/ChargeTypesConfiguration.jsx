import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    CircularProgress,
    Tabs,
    Tab,
    Grid,
    Tooltip,
    Menu,
    MenuList,
    ListItemIcon,
    ListItemText,
    Alert
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSnackbar } from 'notistack';

/**
 * ChargeTypesConfiguration Component
 * Manages the CRUD operations for charge types in the admin panel
 */
const ChargeTypesConfiguration = () => {
    const { enqueueSnackbar } = useSnackbar();
    const functions = getFunctions();

    // State management
    const [chargeTypes, setChargeTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        enabled: 0,
        disabled: 0,
        core: 0,
        custom: 0,
        byCategory: {}
    });

    // Dialog states
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingChargeType, setEditingChargeType] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [chargeTypeToDelete, setChargeTypeToDelete] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        label: '',
        category: 'miscellaneous',
        taxable: false,
        commissionable: false,
        enabled: true,
        displayOrder: 999
    });

    // Filter state
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Menu state
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [selectedChargeType, setSelectedChargeType] = useState(null);

    // Categories with colors (memoized to prevent re-creation)
    const categories = React.useMemo(() => ({
        freight: { label: 'Freight', color: '#3b82f6' },
        fuel: { label: 'Fuel', color: '#ef4444' },
        accessorial: { label: 'Accessorial', color: '#8b5cf6' },
        taxes: { label: 'Taxes', color: '#10b981' },
        surcharges: { label: 'Surcharges', color: '#f59e0b' },
        insurance: { label: 'Insurance', color: '#06b6d4' },
        logistics: { label: 'Logistics', color: '#84cc16' },
        government: { label: 'Government', color: '#6366f1' },
        miscellaneous: { label: 'Miscellaneous', color: '#6b7280' }
    }), []);

    // Cloud functions (memoized to prevent re-creation)
    const getChargeTypes = React.useMemo(() => httpsCallable(functions, 'getChargeTypes'), [functions]);
    const createChargeType = React.useMemo(() => httpsCallable(functions, 'createChargeType'), [functions]);
    const updateChargeType = React.useMemo(() => httpsCallable(functions, 'updateChargeType'), [functions]);
    const deleteChargeType = React.useMemo(() => httpsCallable(functions, 'deleteChargeType'), [functions]);
    const getChargeTypeStats = React.useMemo(() => httpsCallable(functions, 'getChargeTypeStats'), [functions]);

    // Load charge types and stats
    const loadChargeTypes = useCallback(async () => {
        setLoading(true);
        try {
            const [typesResult, statsResult] = await Promise.all([
                getChargeTypes(),
                getChargeTypeStats()
            ]);

            if (typesResult.data.success) {
                setChargeTypes(typesResult.data.chargeTypes);
            } else {
                throw new Error(typesResult.data.error);
            }

            if (statsResult.data.success) {
                setStats(statsResult.data.stats);
            }

        } catch (error) {
            console.error('Error loading charge types:', error);
            enqueueSnackbar(`Error loading charge types: ${error.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [getChargeTypes, getChargeTypeStats]);

    // Load data on component mount
    useEffect(() => {
        loadChargeTypes();
    }, [loadChargeTypes]);

    // Handle create/edit dialog
    const handleOpenDialog = (chargeType = null) => {
        if (chargeType) {
            setEditingChargeType(chargeType);
            setFormData({
                code: chargeType.code,
                label: chargeType.label,
                category: chargeType.category,
                taxable: chargeType.taxable,
                commissionable: chargeType.commissionable,
                enabled: chargeType.enabled,
                displayOrder: chargeType.displayOrder
            });
        } else {
            setEditingChargeType(null);
            setFormData({
                code: '',
                label: '',
                category: 'miscellaneous',
                taxable: false,
                commissionable: false,
                enabled: true,
                displayOrder: 999
            });
        }
        setDialogOpen(true);
    };

    // Handle form submission
    const handleSubmit = async () => {
        try {
            if (editingChargeType) {
                // Update existing charge type
                const result = await updateChargeType({
                    code: editingChargeType.code,
                    updates: formData
                });

                if (result.data.success) {
                    enqueueSnackbar(result.data.message, { variant: 'success' });
                    await loadChargeTypes();
                    setDialogOpen(false);
                } else {
                    throw new Error(result.data.error);
                }
            } else {
                // Create new charge type
                const result = await createChargeType(formData);

                if (result.data.success) {
                    enqueueSnackbar(result.data.message, { variant: 'success' });
                    await loadChargeTypes();
                    setDialogOpen(false);
                } else {
                    throw new Error(result.data.error);
                }
            }
        } catch (error) {
            console.error('Error saving charge type:', error);
            enqueueSnackbar(`Error saving charge type: ${error.message}`, { variant: 'error' });
        }
    };

    // Handle delete
    const handleDelete = async (forceDelete = false) => {
        try {
            const result = await deleteChargeType({
                code: chargeTypeToDelete.code,
                forceDelete
            });

            if (result.data.success) {
                enqueueSnackbar(result.data.message, { variant: 'success' });
                await loadChargeTypes();
                setDeleteDialogOpen(false);
                setChargeTypeToDelete(null);
            } else {
                throw new Error(result.data.error);
            }
        } catch (error) {
            console.error('Error deleting charge type:', error);
            enqueueSnackbar(`Error deleting charge type: ${error.message}`, { variant: 'error' });
        }
    };

    // Handle menu actions
    const handleMenuOpen = (event, chargeType) => {
        setMenuAnchor(event.currentTarget);
        setSelectedChargeType(chargeType);
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
        setSelectedChargeType(null);
    };

    // Filter charge types
    const filteredChargeTypes = chargeTypes.filter(ct => {
        const categoryMatch = categoryFilter === 'all' || ct.category === categoryFilter;
        const statusMatch = statusFilter === 'all' ||
            (statusFilter === 'enabled' && ct.enabled) ||
            (statusFilter === 'disabled' && !ct.enabled) ||
            (statusFilter === 'core' && ct.isCore) ||
            (statusFilter === 'custom' && !ct.isCore);

        return categoryMatch && statusMatch;
    });

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
                <Typography sx={{ ml: 2, fontSize: '12px', color: '#6b7280' }}>
                    Loading charge types...
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header with Stats */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Manage universal charge types for billing and rate calculations
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog()}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Add Charge Type
                    </Button>
                </Box>



                {/* Filters */}
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                        <Select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            label="Category"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="all" sx={{ fontSize: '12px' }}>All Categories</MenuItem>
                            {Object.entries(categories).map(([key, cat]) => (
                                <MenuItem key={key} value={key} sx={{ fontSize: '12px' }}>
                                    {cat.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                        <Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            label="Status"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="all" sx={{ fontSize: '12px' }}>All Status</MenuItem>
                            <MenuItem value="enabled" sx={{ fontSize: '12px' }}>Enabled Only</MenuItem>
                            <MenuItem value="disabled" sx={{ fontSize: '12px' }}>Disabled Only</MenuItem>
                            <MenuItem value="core" sx={{ fontSize: '12px' }}>Core Types</MenuItem>
                            <MenuItem value="custom" sx={{ fontSize: '12px' }}>Custom Types</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {/* Charge Types Table */}
            <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Code
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Label
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Category
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Properties
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredChargeTypes.map((chargeType) => {
                            const category = categories[chargeType.category] || categories.miscellaneous;

                            return (
                                <TableRow key={chargeType.code} hover>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                {chargeType.code}
                                            </Typography>
                                            {chargeType.isCore && (
                                                <Chip
                                                    label="Core"
                                                    size="small"
                                                    color="primary"
                                                    sx={{ fontSize: '10px', height: 18 }}
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {chargeType.label}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={category.label}
                                            size="small"
                                            sx={{
                                                fontSize: '10px',
                                                backgroundColor: category.color + '20',
                                                color: category.color,
                                                border: `1px solid ${category.color}40`
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            {chargeType.taxable && (
                                                <Chip
                                                    label="Tax"
                                                    size="small"
                                                    color="info"
                                                    sx={{ fontSize: '9px', height: 16 }}
                                                />
                                            )}
                                            {chargeType.commissionable && (
                                                <Chip
                                                    label="Comm"
                                                    size="small"
                                                    color="success"
                                                    sx={{ fontSize: '9px', height: 16 }}
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={chargeType.enabled ? 'Enabled' : 'Disabled'}
                                            size="small"
                                            color={chargeType.enabled ? 'success' : 'default'}
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleMenuOpen(e, chargeType)}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Action Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
            >
                <MenuList dense>
                    <MenuItem
                        onClick={() => {
                            handleOpenDialog(selectedChargeType);
                            handleMenuClose();
                        }}
                    >
                        <ListItemIcon>
                            <EditIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText sx={{ fontSize: '12px' }}>Edit</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setChargeTypeToDelete(selectedChargeType);
                            setDeleteDialogOpen(true);
                            handleMenuClose();
                        }}
                        disabled={selectedChargeType?.isCore}
                    >
                        <ListItemIcon>
                            <DeleteIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText sx={{ fontSize: '12px' }}>Delete</ListItemText>
                    </MenuItem>
                </MenuList>
            </Menu>

            {/* Create/Edit Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingChargeType ? 'Edit Charge Type' : 'Create Charge Type'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                fullWidth
                                size="small"
                                disabled={!!editingChargeType}
                                placeholder="e.g., FRT, FUE, ACC"
                                sx={{ fontSize: '12px' }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Label"
                                value={formData.label}
                                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                fullWidth
                                size="small"
                                placeholder="e.g., Freight, Fuel Surcharge"
                                sx={{ fontSize: '12px' }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                                <Select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    label="Category"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {Object.entries(categories).map(([key, cat]) => (
                                        <MenuItem key={key} value={key} sx={{ fontSize: '12px' }}>
                                            {cat.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Display Order"
                                type="number"
                                value={formData.displayOrder}
                                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 999 })}
                                fullWidth
                                size="small"
                                sx={{ fontSize: '12px' }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.taxable}
                                            onChange={(e) => setFormData({ ...formData, taxable: e.target.checked })}
                                            size="small"
                                        />
                                    }
                                    label={<Typography sx={{ fontSize: '12px' }}>Taxable</Typography>}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.commissionable}
                                            onChange={(e) => setFormData({ ...formData, commissionable: e.target.checked })}
                                            size="small"
                                        />
                                    }
                                    label={<Typography sx={{ fontSize: '12px' }}>Commissionable</Typography>}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.enabled}
                                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                            size="small"
                                        />
                                    }
                                    label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingChargeType ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Delete Charge Type
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '12px' }}>
                            Are you sure you want to delete charge type "{chargeTypeToDelete?.code}"?
                        </Typography>
                        <Typography sx={{ fontSize: '11px', mt: 1 }}>
                            This action cannot be undone. The charge type will be permanently removed from the system.
                        </Typography>
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handleDelete(false)}
                        color="error"
                        variant="contained"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete
                    </Button>
                    <Button
                        onClick={() => handleDelete(true)}
                        color="error"
                        variant="outlined"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Force Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ChargeTypesConfiguration; 