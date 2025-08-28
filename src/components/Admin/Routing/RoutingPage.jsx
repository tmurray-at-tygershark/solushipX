import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
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
    FormControl,
    InputLabel,
    Select,
    TextField,
    TablePagination
} from '@mui/material';
import {
    Add as AddIcon,
    MoreVert as MoreVertIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Route as RouteIcon,
    Search as SearchIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';

// Import common components
import AdminBreadcrumb from '../AdminBreadcrumb';
import CarrierEligibilityDialog from './components/CarrierEligibilityDialog';

const RoutingPage = () => {
    const { enqueueSnackbar } = useSnackbar();

    // State management
    const [loading, setLoading] = useState(true);
    const [eligibilityRules, setEligibilityRules] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Dialog states
    const [showEligibilityDialog, setShowEligibilityDialog] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

    // Action menu states
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedRule, setSelectedRule] = useState(null);

    // Filter states
    const [filters, setFilters] = useState({
        customer: '',
        business: '',
        carrier: '',
        service: '',
        fromCountry: '',
        toCountry: '',
        exclude: 'all' // all, true, false
    });

    // Search state
    const [searchTerm, setSearchTerm] = useState('');

    // Load eligibility rules
    const loadEligibilityRules = useCallback(async () => {
        setLoading(true);
        try {
            const getCarrierEligibilityRules = httpsCallable(functions, 'getCarrierEligibilityRules');
            const result = await getCarrierEligibilityRules({
                page: page + 1,
                limit: rowsPerPage,
                filters,
                searchTerm
            });

            setEligibilityRules(result.data.rules || []);
            setTotalCount(result.data.totalCount || 0);
        } catch (error) {
            console.error('Error loading eligibility rules:', error);
            enqueueSnackbar('Failed to load eligibility rules', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filters, searchTerm, enqueueSnackbar]);

    // Load data on component mount and when dependencies change
    useEffect(() => {
        loadEligibilityRules();
    }, [loadEligibilityRules]);

    // Action menu handlers
    const handleActionMenuOpen = (event, rule) => {
        setSelectedRule(rule);
        setActionMenuAnchor(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedRule(null);
        setActionMenuAnchor(null);
    };

    // CRUD handlers
    const handleAddRule = () => {
        setEditingRule(null);
        setShowEligibilityDialog(true);
    };

    const handleEditRule = (rule) => {
        setEditingRule(rule);
        setShowEligibilityDialog(true);
        handleActionMenuClose();
    };

    const handleDeleteRule = async (rule) => {
        if (!window.confirm(`Are you sure you want to delete this eligibility rule?`)) {
            return;
        }

        try {
            const deleteCarrierEligibilityRule = httpsCallable(functions, 'deleteCarrierEligibilityRule');
            await deleteCarrierEligibilityRule({ ruleId: rule.id });

            enqueueSnackbar('Eligibility rule deleted successfully', { variant: 'success' });
            loadEligibilityRules();
        } catch (error) {
            console.error('Error deleting eligibility rule:', error);
            enqueueSnackbar('Failed to delete eligibility rule', { variant: 'error' });
        }
        handleActionMenuClose();
    };

    // Filter handlers
    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPage(0); // Reset to first page when filters change
    };

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
        setPage(0); // Reset to first page when search changes
    };

    // Pagination handlers
    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Format helper functions
    const getExcludeLabel = (exclude) => {
        return exclude ? 'Excluded' : 'Allowed';
    };

    const getExcludeColor = (exclude) => {
        return exclude ? 'error' : 'success';
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                            Carrier Routing & Eligibility
                        </Typography>
                        <AdminBreadcrumb currentPage="Routing" />
                    </Box>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddRule}
                        sx={{ fontSize: '12px' }}
                    >
                        Add Eligibility Rule
                    </Button>
                </Box>

                {/* Search and Filters */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Search */}
                    <TextField
                        size="small"
                        placeholder="Search rules..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ color: '#9ca3af', mr: 1 }} />
                        }}
                        sx={{
                            minWidth: 200,
                            '& .MuiInputBase-input': { fontSize: '12px' }
                        }}
                    />

                    {/* Customer Filter */}
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>Customer</InputLabel>
                        <Select
                            value={filters.customer}
                            onChange={(e) => handleFilterChange('customer', e.target.value)}
                            label="Customer"
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                            <MenuItem value="ALL" sx={{ fontSize: '12px' }}>ALL</MenuItem>
                            <MenuItem value="SYSTEM" sx={{ fontSize: '12px' }}>SYSTEM</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Exclude Filter */}
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                        <Select
                            value={filters.exclude}
                            onChange={(e) => handleFilterChange('exclude', e.target.value)}
                            label="Status"
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="all" sx={{ fontSize: '12px' }}>All</MenuItem>
                            <MenuItem value="false" sx={{ fontSize: '12px' }}>Allowed</MenuItem>
                            <MenuItem value="true" sx={{ fontSize: '12px' }}>Excluded</MenuItem>
                        </Select>
                    </FormControl>

                    {/* From Country Filter */}
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>From Country</InputLabel>
                        <Select
                            value={filters.fromCountry}
                            onChange={(e) => handleFilterChange('fromCountry', e.target.value)}
                            label="From Country"
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                            <MenuItem value="US" sx={{ fontSize: '12px' }}>US</MenuItem>
                            <MenuItem value="CA" sx={{ fontSize: '12px' }}>CA</MenuItem>
                            <MenuItem value="MX" sx={{ fontSize: '12px' }}>MX</MenuItem>
                        </Select>
                    </FormControl>

                    {/* To Country Filter */}
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ fontSize: '12px' }}>To Country</InputLabel>
                        <Select
                            value={filters.toCountry}
                            onChange={(e) => handleFilterChange('toCountry', e.target.value)}
                            label="To Country"
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                            <MenuItem value="US" sx={{ fontSize: '12px' }}>US</MenuItem>
                            <MenuItem value="CA" sx={{ fontSize: '12px' }}>CA</MenuItem>
                            <MenuItem value="MX" sx={{ fontSize: '12px' }}>MX</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {/* Content Section */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : eligibilityRules.length === 0 ? (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                            <RouteIcon sx={{ fontSize: '48px', color: '#9ca3af', mb: 2 }} />
                            <Typography sx={{ fontSize: '16px', color: '#6b7280', mb: 1 }}>
                                No eligibility rules found
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                Create your first carrier eligibility rule to get started
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                Customer
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                Business
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                Carrier
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                Service
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                From Country
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                From State
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                To Country
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                To State
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                                Status
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151', width: '80px' }}>
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {eligibilityRules.map((rule) => (
                                            <TableRow key={rule.id} hover>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.customer || 'ALL'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.business || 'SYSTEM'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.carrier}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.service || 'ANY'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.fromCountry || 'ANY'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.fromState || 'ANY'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.toCountry || 'ANY'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {rule.toState || 'ANY'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={getExcludeLabel(rule.exclude)}
                                                        color={getExcludeColor(rule.exclude)}
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleActionMenuOpen(e, rule)}
                                                    >
                                                        <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Pagination */}
                            <TablePagination
                                component="div"
                                count={totalCount}
                                page={page}
                                onPageChange={handlePageChange}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleRowsPerPageChange}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                                sx={{
                                    borderTop: '1px solid #e5e7eb',
                                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </>
                    )}
                </Paper>
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => handleEditRule(selectedRule)}
                    sx={{ fontSize: '12px' }}
                >
                    <EditIcon sx={{ mr: 1, fontSize: '16px' }} />
                    Edit Rule
                </MenuItem>
                <MenuItem
                    onClick={() => handleDeleteRule(selectedRule)}
                    sx={{ fontSize: '12px', color: '#ef4444' }}
                >
                    <DeleteIcon sx={{ mr: 1, fontSize: '16px' }} />
                    Delete Rule
                </MenuItem>
            </Menu>

            {/* Carrier Eligibility Dialog */}
            <CarrierEligibilityDialog
                open={showEligibilityDialog}
                onClose={() => {
                    setShowEligibilityDialog(false);
                    setEditingRule(null);
                }}
                editingRule={editingRule}
                onSave={() => {
                    loadEligibilityRules();
                    setShowEligibilityDialog(false);
                    setEditingRule(null);
                }}
            />
        </Box>
    );
};

export default RoutingPage;
