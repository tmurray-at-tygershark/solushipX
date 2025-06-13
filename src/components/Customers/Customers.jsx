import React, { useState, useEffect, Suspense } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    InputBase,
    Button,
    TablePagination,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    Toolbar,
    Tabs,
    Tab,
    Stack,
    CircularProgress,
    InputAdornment
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    GetApp,
    GetApp as ExportIcon,
    FilterList as FilterIcon,
    Sort as SortIcon,
    Clear as ClearIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    SearchOff as SearchOffIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Add as AddIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import './Customers.css';
import { useCompany } from '../../contexts/CompanyContext';

// Import common components
import ModalHeader from '../common/ModalHeader';

// Import hooks
import useModalNavigation from '../../hooks/useModalNavigation';

// Lazy load the CustomerDetail component for the slide-over view
const CustomerDetail = React.lazy(() => import('./CustomerDetail'));

const Customers = ({ isModal = false, onClose = null, showCloseButton = false, onNavigateToShipments = null }) => {
    const navigate = useNavigate();
    const { companyIdForAddress } = useCompany();

    // Modal navigation system
    const modalNavigation = useModalNavigation({
        title: 'Customers',
        shortTitle: 'Customers',
        component: 'customers'
    });

    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [sortAnchorEl, setSortAnchorEl] = useState(null);
    const [selectedTab, setSelectedTab] = useState('all');
    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all'
    });
    const [sortBy, setSortBy] = useState({
        field: 'companyName',
        direction: 'asc'
    });
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');

    // Add sliding view state for customer detail
    const [currentView, setCurrentView] = useState('table'); // 'table' or 'detail'
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [isSliding, setIsSliding] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, [page, rowsPerPage, filters, sortBy, selectedTab]);

    useEffect(() => {
        if (companyIdForAddress) {
            console.log('Selected companyId for logged-in customer:', companyIdForAddress);
        }
    }, [companyIdForAddress]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            console.log('Fetching customers with companyIdForAddress:', companyIdForAddress);

            const customersRef = collection(db, 'customers');
            let clauses = [];

            if (companyIdForAddress) {
                console.log('Adding companyID filter:', companyIdForAddress);
                clauses.push(where('companyID', '==', companyIdForAddress));
            } else {
                console.log('No companyIdForAddress available, fetching all customers');
            }

            if (selectedTab !== 'all') {
                console.log('Adding status filter:', selectedTab);
                clauses.push(where('status', '==', selectedTab));
            }

            console.log('Adding sort clause: name, asc');
            clauses.push(orderBy('name', 'asc'));
            clauses.push(limit(rowsPerPage));

            const q = clauses.length > 0 ? query(customersRef, ...clauses) : customersRef;
            console.log('Executing query with clauses:', clauses);

            const querySnapshot = await getDocs(q);
            console.log(`Found ${querySnapshot.size} customers`);

            const customersDataPromises = querySnapshot.docs.map(async (doc) => {
                const data = doc.data();
                let contactData = null;

                // Fetch main contact from addressBook
                if (data.customerID) {
                    const contactQuery = query(
                        collection(db, 'addressBook'),
                        where('addressClass', '==', 'customer'),
                        where('addressClassID', '==', data.customerID),
                        where('addressType', '==', 'contact'),
                        limit(1)
                    );
                    const contactSnapshot = await getDocs(contactQuery);
                    if (!contactSnapshot.empty) {
                        contactData = contactSnapshot.docs[0].data();
                        console.log('Found contact for customer', data.customerID, contactData);
                    } else {
                        console.log('No contact found for customer', data.customerID);
                    }
                }

                const customerObj = {
                    id: doc.id,
                    ...data,
                    contact: contactData // Add contact data to customer object
                };
                console.log('Customer data with contact:', customerObj);
                return customerObj;
            });

            const customersData = await Promise.all(customersDataPromises);

            console.log('All customers fetched from Firestore with contacts:', customersData);

            setCustomers(customersData);
            setTotalCount(customersData.length);
        } catch (error) {
            console.error('Error fetching customers:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilterClick = (event) => {
        setFilterAnchorEl(event.currentTarget);
    };

    const handleSortClick = (event) => {
        setSortAnchorEl(event.currentTarget);
    };

    const handleFilterClose = () => {
        setFilterAnchorEl(null);
    };

    const handleSortClose = () => {
        setSortAnchorEl(null);
    };

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({ ...prev, [filterType]: value }));
        handleFilterClose();
    };

    const handleSortChange = (field, direction) => {
        setSortBy({ field, direction });
        handleSortClose();
    };

    const handleExport = () => {
        setIsExportDialogOpen(true);
    };

    const handleExportClose = () => {
        setIsExportDialogOpen(false);
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active':
                return 'success';
            case 'inactive':
                return 'default';
            case 'suspended':
                return 'error';
            case 'pending':
                return 'warning';
            default:
                return 'default';
        }
    };

    const handleRowClick = (customerId) => {
        // Use slide-over functionality instead of navigation
        handleViewCustomerDetail(customerId);
    };

    // Add handlers for sliding between views (similar to ShipmentsX)
    const handleViewCustomerDetail = (customerId) => {
        // Find the customer to get its details for the title
        const customer = customers.find(c => c.id === customerId) || { name: 'Customer' };

        // Add customer detail page to navigation stack
        modalNavigation.navigateTo({
            title: customer.name || 'Customer Details',
            shortTitle: customer.name || 'Customer',
            component: 'customer-detail',
            data: { customerId }
        });

        setSelectedCustomerId(customerId);
        setIsSliding(true);

        // Small delay to allow state to update before animation
        setTimeout(() => {
            setCurrentView('detail');
            setTimeout(() => {
                setIsSliding(false);
            }, 300); // Match CSS transition duration
        }, 50);
    };

    const handleBackToTable = () => {
        // Go back in navigation stack
        modalNavigation.goBack();

        setIsSliding(true);

        setTimeout(() => {
            setCurrentView('table');
            setTimeout(() => {
                setIsSliding(false);
                setSelectedCustomerId(null);
            }, 300); // Match CSS transition duration
        }, 50);
    };

    // Add navigation object function for ModalHeader (similar to ShipmentsX)
    const getNavigationObject = () => {
        const currentPage = modalNavigation.getCurrentPage();
        const canGoBackNow = currentPage?.component === 'customer-detail' || modalNavigation.canGoBack;

        return {
            title: currentPage?.title || 'Customers',
            canGoBack: canGoBackNow,
            onBack: canGoBackNow ? handleBackToTable : null,
            backText: canGoBackNow && modalNavigation.navigationStack[modalNavigation.currentIndex - 1]
                ? modalNavigation.navigationStack[modalNavigation.currentIndex - 1].shortTitle || 'Back'
                : 'Back'
        };
    };

    const filteredCustomers = customers.filter(customer => {
        const searchLower = searchQuery.toLowerCase();
        let matchesSearch = true; // Assume true if no search query
        if (searchQuery.trim() !== '') {
            matchesSearch = (
                customer.name?.toLowerCase().includes(searchLower) ||
                customer.customerID?.toLowerCase().includes(searchLower) ||
                (customer.contactName && typeof customer.contactName === 'string' && customer.contactName.toLowerCase().includes(searchLower)) || // Search on top-level contactName if it exists
                (customer.contact?.firstName && `${customer.contact.firstName} ${customer.contact.lastName || ''}`.toLowerCase().includes(searchLower)) ||
                (customer.contact?.lastName && `${customer.contact.firstName || ''} ${customer.contact.lastName}`.toLowerCase().includes(searchLower)) ||
                (customer.contact?.email && typeof customer.contact.email === 'string' && customer.contact.email.toLowerCase().includes(searchLower))
            );
        }
        // The `customers` array from state should already be filtered by status (selectedTab) from Firestore query
        // So, no need for additional client-side status filtering here.
        return matchesSearch;
    });

    return (
        <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Modal Header */}
                {isModal && (
                    <ModalHeader
                        navigation={getNavigationObject()}
                        onClose={showCloseButton ? onClose : null}
                        showCloseButton={showCloseButton}
                    />
                )}

                {/* Sliding Container */}
                <Box
                    sx={{
                        display: 'flex',
                        width: '200%',
                        height: '100%',
                        transform: currentView === 'table' ? 'translateX(0%)' : 'translateX(-50%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'transform'
                    }}
                >
                    {/* Main Table View */}
                    <Box sx={{
                        width: '50%',
                        minHeight: '100%',
                        '& .customers-container': {
                            maxWidth: 'none !important',
                            width: '100% !important',
                            padding: '0 !important'
                        }
                    }}>
                        <Box sx={{
                            width: '100%',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            {/* Breadcrumb - only show when not in modal */}
                            {!isModal && (
                                <Box sx={{ px: 2, pt: 2 }}>
                                    <div className="breadcrumb-container">
                                        <Link to="/dashboard" className="breadcrumb-link">
                                            <HomeIcon />
                                            <Typography variant="body2">Dashboard</Typography>
                                        </Link>
                                        <div className="breadcrumb-separator">
                                            <NavigateNextIcon />
                                        </div>
                                        <Typography variant="body2" className="breadcrumb-current">
                                            Customers
                                        </Typography>
                                    </div>
                                </Box>
                            )}

                            {/* Header Section */}
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 3,
                                px: 2,
                                pt: isModal ? 2 : 0
                            }}>
                                {!isModal && (
                                    <Typography variant="h4" component="h1">
                                        Customers
                                    </Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<GetApp />}
                                        disabled
                                        sx={{
                                            opacity: 0.5,
                                            cursor: 'not-allowed'
                                        }}
                                    >
                                        Import Customers
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<AddIcon />}
                                        onClick={() => navigate('/customers/new')}
                                    >
                                        Add Customer
                                    </Button>
                                </Box>
                            </Box>

                            {/* Main Content */}
                            <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none', mx: 2 }}>
                                <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Tabs
                                        value={selectedTab}
                                        onChange={handleTabChange}
                                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                                    >
                                        <Tab label="All" value="all" />
                                        <Tab label="Active" value="active" />
                                        <Tab label="Inactive" value="inactive" />
                                        <Tab label="Pending" value="pending" />
                                    </Tabs>

                                    <Box className="customers-actions">
                                        <TextField
                                            placeholder="Search customers..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchQuery && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setSearchQuery('')}
                                                        >
                                                            <ClearIcon />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                            size="small"
                                            sx={{ width: 300 }}
                                        />

                                        <IconButton onClick={handleFilterClick}>
                                            <FilterIcon />
                                        </IconButton>

                                        <IconButton onClick={handleSortClick}>
                                            <SortIcon />
                                        </IconButton>
                                    </Box>
                                </Toolbar>

                                {loading ? (
                                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                                        <CircularProgress />
                                    </Box>
                                ) : filteredCustomers.length === 0 ? (
                                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                                        <Stack spacing={2} alignItems="center">
                                            <SearchOffIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                                            <Typography variant="h6" color="text.secondary">
                                                No customers found
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Try adjusting your search or filters
                                            </Typography>
                                        </Stack>
                                    </Box>
                                ) : (
                                    <TableContainer sx={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflow: 'auto'
                                    }}>
                                        <Table sx={{
                                            width: '100%',
                                            tableLayout: 'fixed',
                                            '& .MuiTableCell-root': {
                                                fontSize: '12px',
                                                padding: '8px 12px',
                                                borderBottom: '1px solid #e2e8f0'
                                            }
                                        }}>
                                            <TableHead>
                                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                                    <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Customer ID</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Name / Company</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Contact Person</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Contact Email</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Created At</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {filteredCustomers.map((customer) => (
                                                    <TableRow
                                                        key={customer.id}
                                                        hover
                                                        onClick={() => handleRowClick(customer.id)}
                                                        sx={{
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                            },
                                                        }}
                                                    >
                                                        <TableCell>{customer.customerID}</TableCell>
                                                        <TableCell>{customer.name || 'N/A'}</TableCell>
                                                        <TableCell>{customer.contactName || (customer.contact ? `${customer.contact.firstName || ''} ${customer.contact.lastName || ''}`.trim() : 'N/A')}</TableCell>
                                                        <TableCell>{customer.contact?.email || 'N/A'}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={customer.status || 'Unknown'}
                                                                color={getStatusColor(customer.status)}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {customer.createdAt?.toDate ?
                                                                customer.createdAt.toDate().toLocaleDateString() :
                                                                (customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A')}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}

                                <TablePagination
                                    component="div"
                                    count={filteredCustomers.length}
                                    page={page}
                                    onPageChange={handleChangePage}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={handleChangeRowsPerPage}
                                    rowsPerPageOptions={[10, 25, 50]}
                                />
                            </Paper>
                        </Box>
                    </Box>

                    {/* Customer Detail View */}
                    <Box sx={{ width: '50%', minHeight: '100%', position: 'relative' }}>
                        {currentView === 'detail' && selectedCustomerId && (
                            <Box sx={{ position: 'relative', height: '100%' }}>
                                {/* Customer Detail Content */}
                                <Suspense fallback={
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        pt: 8
                                    }}>
                                        <CircularProgress />
                                    </Box>
                                }>
                                    <CustomerDetail
                                        key={selectedCustomerId}
                                        customerId={selectedCustomerId}
                                        onBackToTable={handleBackToTable}
                                        onNavigateToShipments={onNavigateToShipments}
                                    />
                                </Suspense>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Filter Menu */}
            <Menu
                anchorEl={filterAnchorEl}
                open={Boolean(filterAnchorEl)}
                onClose={handleFilterClose}
            >
                <MenuItem onClick={() => handleFilterChange('status', 'all')}>
                    All Statuses
                </MenuItem>
                <MenuItem onClick={() => handleFilterChange('status', 'active')}>
                    Active
                </MenuItem>
                <MenuItem onClick={() => handleFilterChange('status', 'inactive')}>
                    Inactive
                </MenuItem>
                <MenuItem onClick={() => handleFilterChange('status', 'pending')}>
                    Pending
                </MenuItem>
            </Menu>

            {/* Sort Menu */}
            <Menu
                anchorEl={sortAnchorEl}
                open={Boolean(sortAnchorEl)}
                onClose={handleSortClose}
            >
                <MenuItem onClick={() => handleSortChange('companyName', 'asc')}>
                    Company Name (A-Z)
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('companyName', 'desc')}>
                    Company Name (Z-A)
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('createdAt', 'desc')}>
                    Newest First
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('createdAt', 'asc')}>
                    Oldest First
                </MenuItem>
            </Menu>

            {/* Export Dialog */}
            <Dialog open={isExportDialogOpen} onClose={handleExportClose}>
                <DialogTitle>Export Customers</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Format</InputLabel>
                        <Select
                            value={selectedExportFormat}
                            onChange={(e) => setSelectedExportFormat(e.target.value)}
                            label="Format"
                        >
                            <MenuItem value="csv">CSV</MenuItem>
                            <MenuItem value="excel">Excel</MenuItem>
                            <MenuItem value="pdf">PDF</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleExportClose}>Cancel</Button>
                    <Button onClick={handleExportClose} variant="contained">
                        Export
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Customers;