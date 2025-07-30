import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Chip,
    TextField,
    InputAdornment,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Stack,
    Collapse,
    FormControl,
    InputLabel,
    Select,
    Checkbox,
    FormControlLabel,
    Grid,
    Alert,
    Tooltip,
    Avatar,
    Snackbar,
    Link,
    CircularProgress
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    FileDownload as ExportIcon,
    Person as PersonIcon,
    ContentCopy as ContentCopyIcon,
    Close as CloseIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useCompany } from '../../contexts/CompanyContext';

// Import reusable components
import ModalHeader from '../common/ModalHeader';

const Customers = ({ isModal = false, onClose = null, showCloseButton = false, onNavigateToShipments = null, deepLinkParams = null }) => {
    const { companyIdForAddress } = useCompany();

    // Main data states
    const [customers, setCustomers] = useState([]);
    const [allCustomers, setAllCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [shipmentCounts, setShipmentCounts] = useState({});

    // Filter states
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selected, setSelected] = useState([]);

    // Filter states
    const [filters, setFilters] = useState({
        status: 'all',
        hasAddresses: 'all'
    });
    const [searchFields, setSearchFields] = useState({
        customerName: ''
    });
    const [filtersOpen, setFiltersOpen] = useState(false);

    // UI states
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialog states
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({
            open: true,
            message,
            severity
        });
    }, []);

    // Calculate stats
    const stats = useMemo(() => {
        const total = allCustomers.length;
        const active = allCustomers.filter(c => c.status === 'active').length;
        const inactive = allCustomers.filter(c => c.status === 'inactive').length;
        const withAddresses = allCustomers.filter(c => c.addressCount > 0).length;

        return {
            total,
            active,
            inactive,
            withAddresses
        };
    }, [allCustomers]);

    // Load customers data
    const loadCustomers = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch customers for current company only
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', companyIdForAddress),
                orderBy('name')
            );
            const customersSnapshot = await getDocs(customersQuery);

            // Fetch address book data to count addresses
            const addressBookQuery = query(
                collection(db, 'addressBook'),
                where('addressClass', '==', 'customer'),
                where('ownerCompanyID', '==', companyIdForAddress)
            );
            const addressBookSnapshot = await getDocs(addressBookQuery);

            // Count addresses per customer
            const addressCounts = {};
            addressBookSnapshot.docs.forEach(doc => {
                const address = doc.data();
                const customerID = address.addressClassID;
                if (customerID) {
                    addressCounts[customerID] = (addressCounts[customerID] || 0) + 1;
                }
            });

            // Process customers data
            const customersData = customersSnapshot.docs.map(doc => {
                const customer = { id: doc.id, ...doc.data() };
                return {
                    ...customer,
                    addressCount: addressCounts[customer.customerID] || 0
                };
            });

            setAllCustomers(customersData);
            applyFilters(customersData);
            setTotalCount(customersData.length);

        } catch (error) {
            console.error('Error loading customers:', error);
            showSnackbar('Error loading customers', 'error');
        } finally {
            setLoading(false);
        }
    }, [companyIdForAddress]);

    // Apply filters
    const applyFilters = useCallback((customersData) => {
        let filtered = [...customersData];

        // Apply search filters
        if (searchFields.customerName) {
            const searchTerm = searchFields.customerName.toLowerCase();
            filtered = filtered.filter(customer =>
                customer.name?.toLowerCase().includes(searchTerm) ||
                customer.customerID?.toLowerCase().includes(searchTerm) ||
                customer.mainContactName?.toLowerCase().includes(searchTerm) ||
                customer.mainContactEmail?.toLowerCase().includes(searchTerm)
            );
        }

        // Apply status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(customer => customer.status === filters.status);
        }

        // Apply address filter
        if (filters.hasAddresses !== 'all') {
            const hasAddresses = filters.hasAddresses === 'yes';
            filtered = filtered.filter(customer => (customer.addressCount > 0) === hasAddresses);
        }

        setCustomers(filtered);
    }, [searchFields, filters]);

    // Re-apply filters when search or filter state changes
    useEffect(() => {
        applyFilters(allCustomers);
    }, [applyFilters, allCustomers]);

    // Load data on mount
    useEffect(() => {
        if (companyIdForAddress) {
            loadCustomers();
        }
    }, [companyIdForAddress, loadCustomers]);

    // Handle deep link params for direct navigation
    useEffect(() => {
        if (deepLinkParams && isModal) {
            const { customerId, action } = deepLinkParams;
            console.log('Processing deep link params:', deepLinkParams);

            // The Dashboard will handle opening the appropriate modal
            // We just need to process the parameters here if needed
        }
    }, [deepLinkParams, isModal]);

    // Copy to clipboard function
    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`${label} copied to clipboard`, 'success');
        } catch (error) {
            showSnackbar(`Failed to copy ${label}`, 'error');
        }
    };

    // Navigation handlers - simplified for modal mode
    const handleCustomerClick = (customerId) => {
        // For modal mode, we'll use URL navigation to trigger new modals
        if (isModal) {
            navigate(`/dashboard?modal=customers&customerId=${customerId}`);
        } else {
            navigate(`/dashboard?modal=customers&customerId=${customerId}`);
        }
    };

    const handleAddCustomer = () => {
        // For modal mode, we'll use URL navigation to trigger new modals
        if (isModal) {
            navigate('/dashboard?modal=customers&action=add');
        } else {
            navigate('/dashboard?modal=customers&action=add');
        }
    };

    const handleEditCustomer = (customerId) => {
        // For modal mode, we'll use URL navigation to trigger new modals
        if (isModal) {
            navigate(`/dashboard?modal=customers&customerId=${customerId}&action=edit`);
        } else {
            navigate(`/dashboard?modal=customers&customerId=${customerId}&action=edit`);
        }
    };

    // Main table view
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Modal Header for modal mode */}
            {isModal && (
                <ModalHeader
                    title="Customers"
                    onClose={onClose}
                    showCloseButton={showCloseButton}
                />
            )}

            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        {!isModal && (
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                                Customers
                            </Typography>
                        )}
                    </Box>
                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleAddCustomer}
                            sx={{ fontSize: '12px' }}
                        >
                            Add
                        </Button>
                    </Box>
                </Box>

                {/* Stats Row */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#111827' }}>
                                {stats.total}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Total Customers
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f0f9f4', border: '1px solid #bbf7d0' }}>
                            <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#15803d' }}>
                                {stats.active}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#15803d' }}>
                                Active
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                            <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#dc2626' }}>
                                {stats.inactive}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#dc2626' }}>
                                Inactive
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                            <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#2563eb' }}>
                                {stats.withAddresses}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#2563eb' }}>
                                With Addresses
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Search Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <TextField
                            size="small"
                            placeholder="Search customers, IDs, contacts, emails..."
                            value={searchFields.customerName}
                            onChange={(e) => setSearchFields(prev => ({
                                ...prev,
                                customerName: e.target.value
                            }))}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '12px', width: '390px' }
                            }}
                        />
                    </Box>

                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FilterListIcon />}
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        sx={{ fontSize: '12px' }}
                    >
                        Filters
                    </Button>
                </Box>

                {/* Collapsible Filters */}
                <Collapse in={filtersOpen}>
                    <Paper sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={4}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                    <Select
                                        value={filters.status}
                                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                        label="Status"
                                        sx={{
                                            fontSize: '12px',
                                            '& .MuiSelect-select': { fontSize: '12px' }
                                        }}
                                    >
                                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Status</MenuItem>
                                        <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                        <MenuItem value="inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Addresses</InputLabel>
                                    <Select
                                        value={filters.hasAddresses}
                                        onChange={(e) => setFilters(prev => ({ ...prev, hasAddresses: e.target.value }))}
                                        label="Addresses"
                                        sx={{
                                            fontSize: '12px',
                                            '& .MuiSelect-select': { fontSize: '12px' }
                                        }}
                                    >
                                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Customers</MenuItem>
                                        <MenuItem value="yes" sx={{ fontSize: '12px' }}>With Addresses</MenuItem>
                                        <MenuItem value="no" sx={{ fontSize: '12px' }}>Without Addresses</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </Paper>
                </Collapse>
            </Box>

            {/* Table Section */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Customer
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customer ID</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Activity</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Addresses</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {customers.map((customer) => (
                                <TableRow key={customer.id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar
                                                src={customer.logoUrl}
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    bgcolor: '#3b82f6',
                                                    fontSize: '12px',
                                                    border: '1px solid #e5e7eb'
                                                }}
                                            >
                                                {customer.name?.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography
                                                    sx={{
                                                        textDecoration: 'none',
                                                        color: '#3b82f6',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        '&:hover': {
                                                            textDecoration: 'underline',
                                                            color: '#1d4ed8'
                                                        }
                                                    }}
                                                    onClick={() => handleCustomerClick(customer.id)}
                                                >
                                                    {customer.name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {customer.customerID || 'N/A'}
                                            </Typography>
                                            {customer.customerID && (
                                                <Tooltip title="Copy Customer ID">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyToClipboard(customer.customerID, 'Customer ID')}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {customer.createdAt ? format(customer.createdAt.toDate(), 'MMM dd, yyyy') : 'N/A'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                Created
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            sx={{
                                                fontSize: '12px',
                                                color: customer.addressCount > 0 ? '#3b82f6' : '#6b7280',
                                                cursor: customer.addressCount > 0 ? 'pointer' : 'default',
                                                '&:hover': customer.addressCount > 0 ? {
                                                    textDecoration: 'underline'
                                                } : {}
                                            }}
                                            onClick={() => {
                                                if (customer.addressCount > 0) {
                                                    handleCustomerClick(customer.id);
                                                }
                                            }}
                                        >
                                            {customer.addressCount || 0}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Tooltip title="View Customer">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleCustomerClick(customer.id)}
                                                    sx={{ color: '#3b82f6' }}
                                                >
                                                    <ViewIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit Customer">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleEditCustomer(customer.id)}
                                                    sx={{ color: '#6366f1' }}
                                                >
                                                    <EditIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Box>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                message={snackbar.message}
            />
        </Box>
    );
};

export default Customers;