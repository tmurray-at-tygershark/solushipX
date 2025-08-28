import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert,
    IconButton,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Chip,
    TablePagination,
    Box,
    Typography,
    Grid
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    CheckCircleOutline as CheckIcon,
    Cancel as CancelIcon,
    Close as CloseIcon,
    Route as RouteIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import CarrierEligibilityForm from './CarrierEligibilityForm';

const CarrierRoutingDialog = ({ open, onClose, carrier }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

    // Filters and Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('ALL');
    const [filterBusiness, setFilterBusiness] = useState('SYSTEM');
    const [filterService, setFilterService] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalRules, setTotalRules] = useState(0);

    // Data for dropdowns
    const [customers, setCustomers] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [services, setServices] = useState([]);

    const loadDropdownData = useCallback(async () => {
        try {
            // Set default data - these could be loaded from APIs if needed
            setCustomers([{ id: 'ALL', name: 'ALL' }]);
            setBusinesses([{ id: 'SYSTEM', name: 'SYSTEM' }]);
            setServices([{ code: 'ANY', name: 'ANY' }]);
        } catch (err) {
            console.error("Error loading dropdown data:", err);
            enqueueSnackbar("Failed to load filter options.", { variant: "error" });
        }
    }, [enqueueSnackbar]);

    const fetchRules = useCallback(async () => {
        if (!carrier?.id) return;

        setLoading(true);
        setError(null);
        try {
            const getRules = httpsCallable(functions, 'getCarrierEligibilityRules');
            const response = await getRules({
                carrierId: carrier.id, // Filter by specific carrier
                searchTerm,
                filterCustomer: filterCustomer === 'ALL' ? null : filterCustomer,
                filterBusiness: filterBusiness === 'SYSTEM' ? null : filterBusiness,
                filterService: filterService === 'ALL' ? null : filterService,
                filterStatus: filterStatus === 'ALL' ? null : filterStatus,
                page,
                rowsPerPage
            });
            setRules(response.data.rules);
            setTotalRules(response.data.totalCount);
        } catch (err) {
            console.error("Error fetching carrier eligibility rules:", err);
            setError("Failed to load routing rules.");
            enqueueSnackbar("Failed to load routing rules.", { variant: "error" });
        } finally {
            setLoading(false);
        }
    }, [carrier?.id, enqueueSnackbar, searchTerm, filterCustomer, filterBusiness, filterService, filterStatus, page, rowsPerPage]);

    useEffect(() => {
        if (open && carrier) {
            loadDropdownData();
            fetchRules();
        }
    }, [open, carrier, fetchRules, loadDropdownData]);

    const handleAddRule = () => {
        setEditingRule(null);
        setShowForm(true);
    };

    const handleEditRule = (rule) => {
        setEditingRule(rule);
        setShowForm(true);
    };

    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm("Are you sure you want to delete this routing rule?")) return;
        try {
            const deleteRule = httpsCallable(functions, 'deleteCarrierEligibilityRule');
            await deleteRule({ ruleId });
            enqueueSnackbar('Routing rule deleted successfully', { variant: 'success' });
            fetchRules();
        } catch (err) {
            console.error("Error deleting rule:", err);
            enqueueSnackbar('Failed to delete routing rule', { variant: 'error' });
        }
    };

    const handleFormClose = (refresh = false) => {
        setShowForm(false);
        setEditingRule(null);
        if (refresh) {
            fetchRules();
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleClose = () => {
        setRules([]);
        setPage(0);
        setSearchTerm('');
        setFilterCustomer('ALL');
        setFilterBusiness('SYSTEM');
        setFilterService('ALL');
        setFilterStatus('ALL');
        onClose();
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="xl"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <DialogTitle sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pb: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RouteIcon sx={{ fontSize: '20px', color: '#6366f1' }} />
                        <Box>
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                Carrier Routing Rules
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                {carrier?.name} • Manage route eligibility and restrictions
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleAddRule}
                            sx={{ fontSize: '12px' }}
                        >
                            Add Route Rule
                        </Button>
                        <IconButton onClick={handleClose} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
                    <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Search routes"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Customer</InputLabel>
                                    <Select
                                        value={filterCustomer}
                                        label="Customer"
                                        onChange={(e) => setFilterCustomer(e.target.value)}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        {customers.map((customer) => (
                                            <MenuItem key={customer.id} value={customer.id} sx={{ fontSize: '12px' }}>
                                                {customer.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Service</InputLabel>
                                    <Select
                                        value={filterService}
                                        label="Service"
                                        onChange={(e) => setFilterService(e.target.value)}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        {services.map((service) => (
                                            <MenuItem key={service.code} value={service.code} sx={{ fontSize: '12px' }}>
                                                {service.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                    <Select
                                        value={filterStatus}
                                        label="Status"
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        <MenuItem value="ALL" sx={{ fontSize: '12px' }}>ALL</MenuItem>
                                        <MenuItem value="TRUE" sx={{ fontSize: '12px' }}>EXCLUDED</MenuItem>
                                        <MenuItem value="FALSE" sx={{ fontSize: '12px' }}>ALLOWED</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<RefreshIcon />}
                                    onClick={fetchRules}
                                    sx={{ fontSize: '12px' }}
                                    fullWidth
                                >
                                    Refresh
                                </Button>
                            </Grid>
                        </Grid>
                    </Box>

                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : error ? (
                            <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>
                        ) : (
                            <Paper elevation={0} sx={{ border: 'none' }}>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#f9fafb' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Customer</TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Service</TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>From Country</TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>From State</TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>To Country</TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>To State</TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Status</TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {rules.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                        No routing rules found for this carrier.
                                                        <br />
                                                        <Button
                                                            variant="text"
                                                            size="small"
                                                            onClick={handleAddRule}
                                                            sx={{ fontSize: '11px', mt: 1 }}
                                                        >
                                                            Add your first route rule
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                rules.map((rule) => (
                                                    <TableRow key={rule.id} hover>
                                                        <TableCell sx={{ fontSize: '12px' }}>{rule.customerName || 'ALL'}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{rule.serviceName || 'ANY'}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{rule.fromCountry}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{rule.fromState || 'ANY'}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{rule.toCountry}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{rule.toState || 'ANY'}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            <Chip
                                                                label={rule.exclude ? 'EXCLUDED' : 'ALLOWED'}
                                                                size="small"
                                                                icon={rule.exclude ? <CancelIcon sx={{ fontSize: '14px' }} /> : <CheckIcon sx={{ fontSize: '14px' }} />}
                                                                sx={{
                                                                    fontSize: '10px',
                                                                    height: '20px',
                                                                    bgcolor: rule.exclude ? '#fee2e2' : '#d1fae5',
                                                                    color: rule.exclude ? '#ef4444' : '#10b981',
                                                                    '& .MuiChip-icon': { color: rule.exclude ? '#ef4444' : '#10b981' }
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            <IconButton size="small" onClick={() => handleEditRule(rule)}>
                                                                <EditIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                            <IconButton size="small" color="error" onClick={() => handleDeleteRule(rule.id)}>
                                                                <DeleteIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                {rules.length > 0 && (
                                    <TablePagination
                                        component="div"
                                        count={totalRules}
                                        page={page}
                                        onPageChange={handleChangePage}
                                        rowsPerPage={rowsPerPage}
                                        onRowsPerPageChange={handleChangeRowsPerPage}
                                        rowsPerPageOptions={[10, 25, 50]}
                                        sx={{
                                            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                                                fontSize: '12px',
                                            },
                                            '.MuiTablePagination-select': {
                                                fontSize: '12px',
                                            },
                                        }}
                                    />
                                )}
                            </Paper>
                        )}
                    </Box>
                </DialogContent>
            </Dialog>

            <CarrierEligibilityForm
                open={showForm}
                onClose={handleFormClose}
                rule={editingRule}
                carrier={carrier}
                customers={customers}
                businesses={businesses}
                services={services}
            />
        </>
    );
};

export default CarrierRoutingDialog;
