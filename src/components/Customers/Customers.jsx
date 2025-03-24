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
    Select
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    GetApp as ExportIcon,
    FilterList as FilterIcon,
    Sort as SortIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
    }, [page, rowsPerPage, searchQuery, filters, sortBy]);

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

    return (
        <Box sx={{ p: 3 }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ width: '100%' }}
            >
                <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
                    {/* Page Header */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 4
                    }}>
                        <Typography
                            variant="h3"
                            component="h2"
                            sx={{
                                fontWeight: 800,
                                color: '#000',
                                letterSpacing: '-0.02em'
                            }}
                        >
                            Customers
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                startIcon={<ExportIcon />}
                                onClick={handleExport}
                                sx={{
                                    borderColor: '#000',
                                    color: '#000',
                                    '&:hover': {
                                        borderColor: '#000',
                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                    }
                                }}
                            >
                                Export
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<i className="fas fa-plus"></i>}
                                sx={{
                                    bgcolor: '#000',
                                    '&:hover': {
                                        bgcolor: '#333'
                                    }
                                }}
                            >
                                Create Customer
                            </Button>
                            <IconButton
                                onClick={handleFilterClick}
                                sx={{
                                    border: '1px solid #000',
                                    color: '#000',
                                    '&:hover': {
                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                    }
                                }}
                            >
                                <FilterIcon />
                            </IconButton>
                            <IconButton
                                onClick={handleSortClick}
                                sx={{
                                    border: '1px solid #000',
                                    color: '#000',
                                    '&:hover': {
                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                    }
                                }}
                            >
                                <SortIcon />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Search Bar */}
                    <Paper
                        component="div"
                        sx={{
                            p: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            mb: 3,
                            boxShadow: 'none',
                            border: '1px solid #dfe3e8'
                        }}
                    >
                        <SearchIcon sx={{ p: 1, color: 'action.active' }} />
                        <InputBase
                            sx={{ ml: 1, flex: 1 }}
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </Paper>

                    {/* Customers Table */}
                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: 2,
                            border: '1px solid #e0e0e0',
                            overflow: 'hidden'
                        }}
                    >
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ACCOUNT #</TableCell>
                                        <TableCell>Company</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Location</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Total Shipments</TableCell>
                                        <TableCell>Last Shipment</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {customers.map((customer) => (
                                        <TableRow key={customer.accountNumber}>
                                            <TableCell>{customer.accountNumber}</TableCell>
                                            <TableCell>{customer.company}</TableCell>
                                            <TableCell>{customer.type}</TableCell>
                                            <TableCell>{customer.location}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={customer.status}
                                                    color={getStatusColor(customer.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{customer.totalShipments}</TableCell>
                                            <TableCell>
                                                {new Date(customer.lastShipment).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    onClick={() => navigate(`/customers/${customer.accountNumber}`)}
                                                    sx={{ color: '#000' }}
                                                >
                                                    <i className="fas fa-chevron-right"></i>
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
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
            </motion.div>

            {/* Filter Menu */}
            <Menu
                anchorEl={filterAnchorEl}
                open={Boolean(filterAnchorEl)}
                onClose={handleFilterClose}
            >
                <MenuItem>
                    <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            label="Status"
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="Active">Active</MenuItem>
                            <MenuItem value="Inactive">Inactive</MenuItem>
                            <MenuItem value="Suspended">Suspended</MenuItem>
                            <MenuItem value="Pending">Pending</MenuItem>
                        </Select>
                    </FormControl>
                </MenuItem>
                <MenuItem>
                    <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            label="Type"
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="Retail">Retail</MenuItem>
                            <MenuItem value="Manufacturing">Manufacturing</MenuItem>
                            <MenuItem value="Technology">Technology</MenuItem>
                            <MenuItem value="Healthcare">Healthcare</MenuItem>
                            <MenuItem value="Finance">Finance</MenuItem>
                            <MenuItem value="Education">Education</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                        </Select>
                    </FormControl>
                </MenuItem>
            </Menu>

            {/* Sort Menu */}
            <Menu
                anchorEl={sortAnchorEl}
                open={Boolean(sortAnchorEl)}
                onClose={handleSortClose}
            >
                <MenuItem onClick={() => handleSortChange('company', 'asc')}>
                    Company Name (A-Z)
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('company', 'desc')}>
                    Company Name (Z-A)
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('dateAdded', 'desc')}>
                    Date Added (Newest)
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('dateAdded', 'asc')}>
                    Date Added (Oldest)
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('totalShipments', 'desc')}>
                    Total Shipments (High-Low)
                </MenuItem>
                <MenuItem onClick={() => handleSortChange('totalShipments', 'asc')}>
                    Total Shipments (Low-High)
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