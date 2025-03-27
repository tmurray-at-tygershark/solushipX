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
    CircularProgress
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
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import './Customers.css';

const Customers = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [sortAnchorEl, setSortAnchorEl] = useState(null);
    const [selectedTab, setSelectedTab] = useState('all');
    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all'
    });
    const [sortBy, setSortBy] = useState({
        field: 'company',
        direction: 'asc'
    });
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');

    // Calculate stats from filtered data
    const stats = {
        total: totalCount,
        active: customers.filter(c => c.status === 'Active').length,
        inactive: customers.filter(c => c.status === 'Inactive').length,
        suspended: customers.filter(c => c.status === 'Suspended').length,
        pending: customers.filter(c => c.status === 'Pending').length
    };

    // Mock data generation
    const generateMockCustomers = (count) => {
        const companyTypes = ['Retail', 'Manufacturing', 'Technology', 'Healthcare', 'Finance', 'Education', 'Other'];
        const statuses = ['Active', 'Inactive', 'Suspended', 'Pending'];
        const locations = [
            { city: 'New York', state: 'NY' },
            { city: 'Los Angeles', state: 'CA' },
            { city: 'Chicago', state: 'IL' },
            { city: 'Houston', state: 'TX' },
            { city: 'Miami', state: 'FL' },
            { city: 'Seattle', state: 'WA' },
            { city: 'Boston', state: 'MA' },
            { city: 'Denver', state: 'CO' }
        ];

        const companyNames = [
            'Acme Corporation', 'Tech Solutions Inc', 'Global Industries', 'Innovation Labs',
            'Future Systems', 'Digital Dynamics', 'Smart Solutions', 'NextGen Technologies',
            'Elite Enterprises', 'Prime Industries', 'Advanced Systems', 'Core Technologies',
            'Peak Performance', 'Summit Solutions', 'Vertex Ventures', 'Apex Industries'
        ];

        const getRandomLocation = () => locations[Math.floor(Math.random() * locations.length)];
        const getRandomDate = () => {
            const start = new Date(2020, 0, 1);
            const end = new Date();
            return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        };

        return Array.from({ length: count }, (_, i) => {
            const location = getRandomLocation();
            const companyName = companyNames[Math.floor(Math.random() * companyNames.length)];
            const type = companyTypes[Math.floor(Math.random() * companyTypes.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const date = getRandomDate();
            const accountNumber = `ACC${String(1000 + i).padStart(6, '0')}`;

            return {
                accountNumber,
                company: companyName,
                type,
                status,
                location: `${location.city}, ${location.state}`,
                dateAdded: date.toISOString(),
                totalShipments: Math.floor(Math.random() * 1000),
                lastShipment: new Date(date.getTime() + Math.random() * (new Date().getTime() - date.getTime())).toISOString()
            };
        });
    };

    // Load customers with filters and pagination
    const loadCustomers = async () => {
        setLoading(true);
        try {
            // Simulate API call
            const mockData = generateMockCustomers(100);
            let filteredData = mockData;

            // Apply filters
            if (searchQuery) {
                filteredData = filteredData.filter(customer =>
                    Object.values(customer).some(value =>
                        String(value).toLowerCase().includes(searchQuery.toLowerCase())
                    )
                );
            }

            if (filters.status !== 'all') {
                filteredData = filteredData.filter(customer =>
                    customer.status === filters.status
                );
            }

            if (filters.type !== 'all') {
                filteredData = filteredData.filter(customer =>
                    customer.type === filters.type
                );
            }

            // Filter by tab
            if (selectedTab !== 'all') {
                filteredData = filteredData.filter(c => c.status === selectedTab);
            }

            // Apply sorting
            filteredData.sort((a, b) => {
                const aValue = a[sortBy.field];
                const bValue = b[sortBy.field];
                const direction = sortBy.direction === 'asc' ? 1 : -1;

                if (typeof aValue === 'string') {
                    return direction * aValue.localeCompare(bValue);
                }
                return direction * (aValue - bValue);
            });

            setTotalCount(filteredData.length);
            setCustomers(filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage));
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, [page, rowsPerPage, searchQuery, filters, sortBy, selectedTab]);

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
        switch (status.toLowerCase()) {
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

    return (
        <div className="customers-container">
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
                <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                    <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Header Section */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                Customers
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<ExportIcon />}
                                    onClick={handleExport}
                                    sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                                >
                                    Export
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<i className="fas fa-plus"></i>}
                                    sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
                                >
                                    Create Customer
                                </Button>
                            </Box>
                        </Box>

                        {/* Main Content */}
                        <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                            <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0' }}>
                                <Tabs value={selectedTab} onChange={handleTabChange}>
                                    <Tab label={`All (${stats.total})`} value="all" />
                                    <Tab label={`Active (${stats.active})`} value="Active" />
                                    <Tab label={`Inactive (${stats.inactive})`} value="Inactive" />
                                    <Tab label={`Suspended (${stats.suspended})`} value="Suspended" />
                                    <Tab label={`Pending (${stats.pending})`} value="Pending" />
                                </Tabs>
                                <Box sx={{ flexGrow: 1 }} />
                                {/* Search Section */}
                                <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                                    <Paper
                                        component="div"
                                        sx={{
                                            p: '2px 4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            width: '300px',
                                            boxShadow: 'none',
                                            border: '1px solid #e2e8f0',
                                            bgcolor: '#f8fafc'
                                        }}
                                    >
                                        <SearchIcon sx={{ p: 1, color: '#64748b' }} />
                                        <InputBase
                                            sx={{ ml: 1, flex: 1 }}
                                            placeholder="Search customers..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </Paper>
                                </Box>
                            </Toolbar>

                            {/* Smart Filters */}
                            {/* Removed empty Box container */}

                            {/* Active Filters */}
                            {(filters.type !== 'all' || filters.status !== 'all') && (
                                <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {filters.type !== 'all' && (
                                        <Chip
                                            label={`Type: ${filters.type}`}
                                            onDelete={() => handleFilterChange('type', 'all')}
                                            color="primary"
                                            variant="outlined"
                                        />
                                    )}
                                    {filters.status !== 'all' && (
                                        <Chip
                                            label={`Status: ${filters.status}`}
                                            onDelete={() => handleFilterChange('status', 'all')}
                                            color="primary"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>
                            )}

                            {/* Customers Table */}
                            <TableContainer component={Paper} className="customers-table">
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Account Number</TableCell>
                                            <TableCell>Company</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Location</TableCell>
                                            <TableCell>Date Added</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center">
                                                    <CircularProgress />
                                                </TableCell>
                                            </TableRow>
                                        ) : customers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center">
                                                    <Box sx={{ py: 3 }}>
                                                        <SearchOffIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                                        <Typography variant="h6" color="text.secondary">
                                                            No customers found
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            customers.map((customer) => (
                                                <TableRow
                                                    key={customer.accountNumber}
                                                    hover
                                                    onClick={() => handleRowClick(customer.accountNumber)}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                        },
                                                    }}
                                                >
                                                    <TableCell>{customer.accountNumber}</TableCell>
                                                    <TableCell>{customer.company}</TableCell>
                                                    <TableCell>{customer.type}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={customer.status}
                                                            color={getStatusColor(customer.status)}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>{customer.location}</TableCell>
                                                    <TableCell>{new Date(customer.dateAdded).toLocaleDateString()}</TableCell>
                                                    <TableCell align="right">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRowClick(customer.accountNumber);
                                                            }}
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // handleEditCustomer(customer.id);
                                                            }}
                                                        >
                                                            <EditIcon />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // handleDeleteCustomer(customer.id);
                                                            }}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={totalCount}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                            />
                        </Paper>
                    </Box>
                </Box>

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
            </Paper>
        </div>
    );
};

export default Customers; 