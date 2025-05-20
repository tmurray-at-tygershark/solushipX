import React, { useState, useEffect } from 'react';
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
    GetApp as ExportIcon,
    FilterList as FilterIcon,
    Sort as SortIcon,
    Clear as ClearIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    SearchOff as SearchOffIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Add as AddIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import './Customers.css';
import { useCompany } from '../../contexts/CompanyContext';

const Customers = () => {
    const navigate = useNavigate();
    const { companyIdForAddress } = useCompany();
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
        navigate(`/customers/${customerId}`);
    };

    const filteredCustomers = customers.filter(customer => {
        const searchLower = searchQuery.toLowerCase();
        return (
            customer.name?.toLowerCase().includes(searchLower) ||
            customer.companyName?.toLowerCase().includes(searchLower) ||
            customer.accountNumber?.toLowerCase().includes(searchLower) ||
            customer.contactName?.toLowerCase().includes(searchLower) ||
            customer.email?.toLowerCase().includes(searchLower)
        );
    });

    return (
        <Box className="customers-container">
            <div className="breadcrumb-container">
                <Link to="/" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Home</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Typography variant="body2" className="breadcrumb-current">
                    Customers
                </Typography>
            </div>

            <Paper className="customers-paper">
                <Box className="customers-header">
                    <Typography variant="h4" component="h1" gutterBottom>
                        Customers
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/customers/new')}
                    >
                        Add Customer
                    </Button>
                </Box>

                <Box className="customers-toolbar">
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
                </Box>

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
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Customer ID</TableCell>
                                    <TableCell>Company Name</TableCell>
                                    <TableCell>Contact Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Created At</TableCell>
                                    <TableCell align="right">Actions</TableCell>
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
                                        <TableCell>{customer.companyName || customer.name}</TableCell>
                                        <TableCell>{customer.contact ? `${customer.contact.firstName || ''} ${customer.contact.lastName || ''}`.trim() : 'N/A'}</TableCell>
                                        <TableCell>{customer.contact ? customer.contact.email : 'N/A'}</TableCell>
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
                                                new Date(customer.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowClick(customer.id);
                                                }}
                                            >
                                                <VisibilityIcon />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/customers/${customer.id}/edit`);
                                                }}
                                            >
                                                <EditIcon />
                                            </IconButton>
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
        </Box>
    );
};

export default Customers; 