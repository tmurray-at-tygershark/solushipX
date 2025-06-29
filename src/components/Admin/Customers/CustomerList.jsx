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
    Link
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
import { db } from '../../../firebase/firebase';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';

// Import reusable components that match ShipmentsX patterns
import ModalHeader from '../../common/ModalHeader';
import AdminBreadcrumb from '../AdminBreadcrumb';

// Skeleton component for loading state
const CustomersTableSkeleton = () => {
    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Checkbox disabled />
                            Customer
                        </Box>
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customer ID</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company Owner</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Activity</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Addresses</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {[...Array(10)].map((_, index) => (
                    <TableRow key={index}>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox disabled />
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        bgcolor: '#e5e7eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    <PersonIcon sx={{ fontSize: '16px', color: '#9ca3af' }} />
                                </Box>
                                <Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} />
                            </Box>
                        </TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '100px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '90px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '60px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton size="small" disabled>
                                    <ViewIcon />
                                </IconButton>
                                <IconButton size="small" disabled>
                                    <MoreVertIcon />
                                </IconButton>
                            </Box>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

// Custom pagination component matching ShipmentsX
const CustomersPagination = ({
    totalCount,
    currentPage,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange
}) => {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    const startItem = (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalCount);

    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderTop: '1px solid #e5e7eb',
            bgcolor: '#fafafa'
        }}>
            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalCount.toLocaleString()} customers
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Rows per page:
                    </Typography>
                    <Select
                        size="small"
                        value={rowsPerPage}
                        onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                        sx={{ fontSize: '12px', minWidth: '60px' }}
                    >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                    </Select>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        First
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Prev
                    </Button>
                    <Typography variant="body2" sx={{ fontSize: '12px', px: 2, py: 1, bgcolor: '#f3f4f6', borderRadius: '4px' }}>
                        {currentPage} of {totalPages}
                    </Typography>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Next
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Last
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

const CustomerList = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const { user, userRole } = useAuth();

    // Main data states
    const [customers, setCustomers] = useState([]);
    const [allCustomers, setAllCustomers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
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
        hasAddresses: 'all',
        dateRange: [null, null]
    });
    const [searchFields, setSearchFields] = useState({
        customerName: '',
        customerId: '',
        contactName: '',
        email: ''
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

    // Handle URL query parameters for company filtering
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const companyParam = searchParams.get('company');

        if (companyParam && companies.length > 0) {
            // Find the company by companyID
            const company = companies.find(c => c.companyID === companyParam);
            if (company) {
                console.log('Setting company filter from URL parameter:', companyParam, 'to company ID:', company.id);
                setSelectedCompanyId(company.id);
                setFiltersOpen(true); // Open filters to show the selection
            }
        }
    }, [location.search, companies]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = allCustomers.length;
        const active = allCustomers.filter(c => c.status === 'active').length;
        const inactive = allCustomers.filter(c => c.status === 'inactive').length;
        const withAddresses = allCustomers.filter(c => c.addressCount > 0).length;
        const withoutAddresses = total - withAddresses;

        return {
            total,
            active,
            inactive,
            withAddresses,
            withoutAddresses
        };
    }, [allCustomers]);



    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = customers.map(customer => customer.id);
            setSelected(newSelected);
            return;
        }
        setSelected([]);
    };

    const handleSelect = (id) => {
        const selectedIndex = selected.indexOf(id);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1),
            );
        }

        setSelected(newSelected);
    };

    // Action menu handlers
    const handleActionMenuOpen = (event, customer) => {
        setSelectedCustomer(customer);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedCustomer(null);
        setActionMenuAnchorEl(null);
    };

    // Copy to clipboard handler
    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`${label} copied to clipboard`, 'success');
        } catch (error) {
            showSnackbar(`Failed to copy ${label}`, 'error');
        }
    };

    // Export functionality
    const handleExport = () => {
        const dataToExport = selected.length > 0
            ? customers.filter(customer => selected.includes(customer.id))
            : customers;

        if (dataToExport.length === 0) {
            showSnackbar('No customers to export', 'warning');
            return;
        }

        // Create CSV content
        const headers = [
            'Customer Name',
            'Customer ID',
            'Company',
            'Status',
            'Contact Email',
            'Dispatch Email',
            'Billing Email',
            'Website',
            'Address Count',
            'Created Date'
        ];

        const csvContent = [
            headers.join(','),
            ...dataToExport.map(customer => [
                `"${customer.name || ''}"`,
                `"${customer.customerID || ''}"`,
                `"${getCompanyName(customer.companyID)}"`,
                `"${customer.status || ''}"`,
                `"${customer.contactEmail || ''}"`,
                `"${customer.dispatchEmail || ''}"`,
                `"${customer.billingEmail || ''}"`,
                `"${customer.website || ''}"`,
                customer.addressCount || 0,
                customer.createdAt ? `"${format(customer.createdAt.toDate(), 'yyyy-MM-dd')}"` : '""'
            ].join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);

        const filename = selected.length > 0
            ? `selected_customers_${new Date().toISOString().split('T')[0]}.csv`
            : `all_customers_${new Date().toISOString().split('T')[0]}.csv`;

        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const exportCount = dataToExport.length;
        const exportType = selected.length > 0 ? 'selected' : 'all';
        showSnackbar(`Exported ${exportCount} ${exportType} customers to CSV`, 'success');
    };

    // Load companies for selection
    const loadCompanies = async () => {
        try {
            let companiesQuery;
            let connectedCompanyIds = [];

            if (userRole === 'superadmin') {
                // Super admins can see all companies
                companiesQuery = query(
                    collection(db, 'companies'),
                    orderBy('name', 'asc')
                );
            } else if (userRole === 'admin') {
                // Admins can see companies they're connected to
                const userDoc = await getDocs(
                    query(collection(db, 'users'), where('uid', '==', user.uid))
                );

                if (!userDoc.empty) {
                    const userData = userDoc.docs[0].data();
                    connectedCompanyIds = userData.connectedCompanies?.companies || [];

                    if (connectedCompanyIds.length > 0) {
                        companiesQuery = query(
                            collection(db, 'companies'),
                            where('companyID', 'in', connectedCompanyIds),
                            orderBy('name', 'asc')
                        );
                    } else {
                        setCompanies([]);
                        return;
                    }
                } else {
                    setCompanies([]);
                    return;
                }
            } else {
                // Regular users shouldn't access this page
                setCompanies([]);
                return;
            }

            const companiesSnapshot = await getDocs(companiesQuery);
            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setCompanies(companiesData);
        } catch (error) {
            console.error('Error loading companies:', error);
            showSnackbar('Failed to load companies', 'error');
        }
    };

    // Load customers data
    const loadCustomers = async () => {
        setLoading(true);
        try {
            const customersRef = collection(db, 'customers');
            let queryConstraints = [];

            // Filter by selected company if not 'all'
            if (selectedCompanyId !== 'all') {
                const selectedCompany = companies.find(c => c.id === selectedCompanyId);
                if (selectedCompany) {
                    queryConstraints.push(where('companyID', '==', selectedCompany.companyID));
                }
            } else if (userRole === 'admin') {
                // For admins, filter to only their connected companies
                const userDoc = await getDocs(
                    query(collection(db, 'users'), where('uid', '==', user.uid))
                );
                if (!userDoc.empty) {
                    const userData = userDoc.docs[0].data();
                    const connectedCompanyIds = userData.connectedCompanies?.companies || [];
                    if (connectedCompanyIds.length > 0) {
                        queryConstraints.push(where('companyID', 'in', connectedCompanyIds));
                    }
                }
            }

            queryConstraints.push(orderBy('name', 'asc'));
            const q = query(customersRef, ...queryConstraints);
            const querySnapshot = await getDocs(q);

            // Fetch customers with their contact information and address counts
            const customersDataPromises = querySnapshot.docs.map(async (doc) => {
                const data = doc.data();
                let contactData = null;
                let addressCount = 0;

                // Fetch main contact from addressBook
                if (data.customerID) {
                    const contactQuery = query(
                        collection(db, 'addressBook'),
                        where('addressClass', '==', 'customer'),
                        where('addressClassID', '==', data.customerID),
                        where('addressType', '==', 'contact')
                    );
                    const contactSnapshot = await getDocs(contactQuery);
                    if (!contactSnapshot.empty) {
                        contactData = contactSnapshot.docs[0].data();
                    }

                    // Count all addresses for this customer
                    const allAddressesQuery = query(
                        collection(db, 'addressBook'),
                        where('addressClass', '==', 'customer'),
                        where('addressClassID', '==', data.customerID)
                    );
                    const allAddressesSnapshot = await getDocs(allAddressesQuery);
                    addressCount = allAddressesSnapshot.size;
                }

                return {
                    id: doc.id,
                    ...data,
                    contact: contactData,
                    addressCount
                };
            });

            const customersData = await Promise.all(customersDataPromises);
            setAllCustomers(customersData);
            setTotalCount(customersData.length);
        } catch (error) {
            console.error('Error loading customers:', error);
            showSnackbar('Failed to load customers', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter and paginate customers
    useEffect(() => {
        let filtered = [...allCustomers];

        // Apply unified search filter
        if (searchFields.customerName) {
            const searchTerm = searchFields.customerName.toLowerCase();
            filtered = filtered.filter(c => {
                const customerName = c.name?.toLowerCase() || '';
                const customerId = c.customerID?.toLowerCase() || '';
                const contactName = c.contact ? `${c.contact.firstName || ''} ${c.contact.lastName || ''}`.trim().toLowerCase() : '';
                const contactEmail = c.contact?.email?.toLowerCase() || '';
                const dispatchEmail = c.dispatchEmail?.toLowerCase() || '';
                const billingEmail = c.billingEmail?.toLowerCase() || '';
                const companyName = getCompanyName(c.companyID)?.toLowerCase() || '';

                return customerName.includes(searchTerm) ||
                    customerId.includes(searchTerm) ||
                    contactName.includes(searchTerm) ||
                    contactEmail.includes(searchTerm) ||
                    dispatchEmail.includes(searchTerm) ||
                    billingEmail.includes(searchTerm) ||
                    companyName.includes(searchTerm);
            });
        }

        // Apply advanced filters
        if (filters.status !== 'all') {
            filtered = filtered.filter(c => c.status === filters.status);
        }
        if (filters.hasAddresses !== 'all') {
            const hasAddresses = filters.hasAddresses === 'yes';
            filtered = filtered.filter(c => {
                return hasAddresses ? c.addressCount > 0 : c.addressCount === 0;
            });
        }

        // Paginate
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedCustomers = filtered.slice(startIndex, endIndex);

        setCustomers(paginatedCustomers);
        setTotalCount(filtered.length);
    }, [allCustomers, searchFields, filters, page, rowsPerPage, companies]);

    // Load data on component mount and when company selection changes
    useEffect(() => {
        loadCompanies();
        fetchShipmentCounts();
    }, []);

    useEffect(() => {
        if (companies.length > 0 || selectedCompanyId === 'all') {
            loadCustomers();
        }
    }, [companies, selectedCompanyId]);

    // Get status chip color
    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'inactive':
                return { color: '#dc2626', bgcolor: '#fef2f2' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    // Get company name from companyID
    const getCompanyName = (companyID) => {
        const company = companies.find(c => c.companyID === companyID);
        return company ? company.name : companyID;
    };

    // Fetch shipment counts for each customer
    const fetchShipmentCounts = async () => {
        try {
            const shipmentsRef = collection(db, 'shipments');
            const querySnapshot = await getDocs(shipmentsRef);
            const counts = {};

            querySnapshot.forEach(doc => {
                const shipment = doc.data();
                const customerID = shipment.customerID;
                if (customerID) {
                    counts[customerID] = (counts[customerID] || 0) + 1;
                }
            });

            setShipmentCounts(counts);
        } catch (error) {
            console.error('Error fetching shipment counts:', error);
        }
    };

    // Render table view
    const renderTableView = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                            Customers
                        </Typography>
                        {/* Breadcrumb */}
                        {!isModal && (
                            <AdminBreadcrumb />
                        )}
                    </Box>
                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleExport}
                            sx={{ fontSize: '12px', minWidth: 'auto', px: 1.5 }}
                        >
                            <ExportIcon sx={{ fontSize: '16px' }} />
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/admin/customers/new')}
                            sx={{ fontSize: '12px' }}
                        >
                            Add
                        </Button>
                    </Box>
                </Box>



                {/* Search Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <TextField
                            size="small"
                            placeholder="Search customers, IDs, contacts, emails..."
                            value={searchFields.customerName}
                            onChange={(e) => setSearchFields(prev => ({
                                ...prev,
                                customerName: e.target.value,
                                customerId: e.target.value,
                                contactName: e.target.value,
                                email: e.target.value
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
                                    <InputLabel sx={{ fontSize: '12px' }}>Company</InputLabel>
                                    <Select
                                        value={selectedCompanyId}
                                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                                        label="Company"
                                        sx={{
                                            fontSize: '12px',
                                            '& .MuiSelect-select': { fontSize: '12px' }
                                        }}
                                    >
                                        <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                            All Companies
                                        </MenuItem>
                                        {companies.map((company) => (
                                            <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar
                                                        src={company.logoUrl}
                                                        sx={{
                                                            width: 20,
                                                            height: 20,
                                                            bgcolor: '#f3f4f6',
                                                            fontSize: '10px',
                                                            border: '1px solid #e5e7eb'
                                                        }}
                                                    >
                                                        {company.name.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    {company.name}
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Customer Name"
                                    value={searchFields.customerName}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, customerName: e.target.value }))}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '16px' }} />
                                            </InputAdornment>
                                        )
                                    }}
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Customer ID"
                                    value={searchFields.customerId}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, customerId: e.target.value }))}
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                </Collapse>
            </Box>

            {/* Table Section */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {loading ? (
                    <CustomersTableSkeleton />
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Checkbox
                                            indeterminate={selected.length > 0 && selected.length < customers.length}
                                            checked={customers.length > 0 && selected.length === customers.length}
                                            onChange={handleSelectAll}
                                            size="small"
                                        />
                                        Customer
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customer ID</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company Owner</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Activity</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Total Shipments</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Addresses</TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {customers.map((customer) => (
                                <TableRow key={customer.id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Checkbox
                                                checked={selected.includes(customer.id)}
                                                onChange={() => handleSelect(customer.id)}
                                                size="small"
                                            />
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
                                                {customer.name.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Link
                                                    component={RouterLink}
                                                    to={`/admin/customers/${customer.id}`}
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
                                                >
                                                    {customer.name}
                                                </Link>
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
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar
                                                src={companies.find(c => c.companyID === customer.companyID)?.logoUrl}
                                                sx={{
                                                    width: 20,
                                                    height: 20,
                                                    bgcolor: '#f3f4f6',
                                                    fontSize: '10px',
                                                    border: '1px solid #e5e7eb'
                                                }}
                                            >
                                                {getCompanyName(customer.companyID).charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Typography
                                                sx={{
                                                    fontSize: '12px',
                                                    color: '#3b82f6',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        textDecoration: 'underline'
                                                    }
                                                }}
                                                onClick={() => {
                                                    const company = companies.find(c => c.companyID === customer.companyID);
                                                    if (company) {
                                                        navigate(`/admin/companies/${company.id}`);
                                                    }
                                                }}
                                            >
                                                {getCompanyName(customer.companyID)}
                                            </Typography>
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
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {shipmentCounts[customer.customerID] || 0}
                                        </Typography>
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
                                                    navigate(`/admin/customers/${customer.id}?tab=addresses`);
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
                                                    onClick={() => navigate(`/admin/customers/${customer.id}`)}
                                                    sx={{ color: '#3b82f6' }}
                                                >
                                                    <ViewIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </Tooltip>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleActionMenuOpen(e, customer)}
                                            >
                                                <MoreVertIcon sx={{ fontSize: '16px' }} />
                                            </IconButton>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Box>

            {/* Pagination */}
            {!loading && (
                <CustomersPagination
                    totalCount={totalCount}
                    currentPage={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                />
            )}

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchorEl}
                open={Boolean(actionMenuAnchorEl)}
                onClose={handleActionMenuClose}
                PaperProps={{
                    sx: { minWidth: 160 }
                }}
            >
                <MenuItem onClick={() => {
                    navigate(`/admin/customers/${selectedCustomer.id}`);
                    handleActionMenuClose();
                }}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>View Details</Typography>
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                    navigate(`/admin/customers/${selectedCustomer.id}/edit`);
                    handleActionMenuClose();
                }}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Edit Customer</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                message={snackbar.message}
            />
        </Box>
    );

    // Main render
    if (isModal) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <ModalHeader
                    title="Customers"
                    onClose={onClose}
                    showCloseButton={showCloseButton}
                />
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    {renderTableView()}
                </Box>
            </Box>
        );
    }

    return renderTableView();
};

export default CustomerList; 