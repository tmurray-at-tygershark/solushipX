import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Chip,
    Typography,
    Toolbar,
    Menu,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputBase,
    Tabs,
    Tab,
    Checkbox,
    CircularProgress,
    ListItemIcon,
    Grid
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Clear as ClearIcon,
    Sort as SortIcon,
    Add as AddIcon,
    CalendarToday as CalendarIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    Print as PrintIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import './Shipments.css';
import { useAuth } from '../../contexts/AuthContext';

const Shipments = () => {
    const { user, loading: authLoading } = useAuth();
    const [shipments, setShipments] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [shipmentNumber, setShipmentNumber] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [sortAnchorEl, setSortAnchorEl] = useState(null);
    const [selectedTab, setSelectedTab] = useState('all');
    const [filters, setFilters] = useState({
        status: 'all',
        carrier: 'all',
        dateRange: [null, null],
        shipmentType: 'all'
    });
    const [sortBy, setSortBy] = useState({
        field: 'date',
        direction: 'desc'
    });
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
    const [dateRange, setDateRange] = useState([null, null]);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [selected, setSelected] = useState([]);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const navigate = useNavigate();

    // Calculate stats from filtered data
    const stats = {
        total: totalCount,
        inTransit: shipments.filter(s => s.status === 'In Transit').length,
        delivered: shipments.filter(s => s.status === 'Delivered').length,
        awaitingShipment: shipments.filter(s => s.status === 'Awaiting Shipment').length
    };

    // Get unique customers from shipments
    const customers = [...new Set(shipments.map(shipment => shipment.customer))];

    // Mock data generation
    const generateMockShipments = (count) => {
        const carriers = ['FedEx', 'UPS', 'DHL', 'USPS', 'Canada Post', 'Purolator'];
        const statuses = ['In Transit', 'Delivered', 'Pending', 'Awaiting Shipment'];
        const shipmentTypes = ['Courier', 'Freight'];
        const companies = [
            'Acme Corporation',
            'TechCorp Solutions',
            'Global Logistics Inc',
            'Innovative Systems Ltd',
            'Pacific Trading Co',
            'Atlas Manufacturing',
            'Summit Industries',
            'Quantum Enterprises',
            'Stellar Shipping LLC',
            'Pioneer Distributors'
        ];
        const addresses = [
            { street: '123 Main Street', city: 'New York', state: 'NY', zip: '10001', country: 'USA' },
            { street: '456 Market Ave', city: 'Los Angeles', state: 'CA', zip: '90012', country: 'USA' },
            { street: '789 Bay Street', city: 'Toronto', state: 'ON', zip: 'M5H 2N2', country: 'Canada' },
            { street: '321 Queen Street', city: 'Vancouver', state: 'BC', zip: 'V6B 1B5', country: 'Canada' },
            { street: '555 Fifth Avenue', city: 'Chicago', state: 'IL', zip: '60601', country: 'USA' },
            { street: '999 Peel Street', city: 'Montreal', state: 'QC', zip: 'H3A 1M5', country: 'Canada' },
            { street: '777 Biscayne Blvd', city: 'Miami', state: 'FL', zip: '33131', country: 'USA' },
            { street: '888 Robson Street', city: 'Calgary', state: 'AB', zip: 'T2P 1B8', country: 'Canada' }
        ];

        const formatAddress = (addr) => {
            return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}, ${addr.country}`;
        };

        const getRandomDate = () => {
            const start = new Date(2024, 0, 1);
            const end = new Date();
            return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        };

        const mockShipments = [];
        for (let i = 0; i < count; i++) {
            const origin = addresses[Math.floor(Math.random() * addresses.length)];
            let destination;
            do {
                destination = addresses[Math.floor(Math.random() * addresses.length)];
            } while (destination === origin);

            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const carrier = carriers[Math.floor(Math.random() * carriers.length)];
            const date = getRandomDate();
            const shipmentType = shipmentTypes[Math.floor(Math.random() * shipmentTypes.length)];

            mockShipments.push({
                id: `SHP${String(287683 - i).padStart(6, '0')}`,
                date: date,
                customer: companies[Math.floor(Math.random() * companies.length)],
                origin: formatAddress(origin),
                destination: formatAddress(destination),
                status: status,
                carrier: carrier,
                shipmentType: shipmentType,
                trackingNumber: Math.random().toString(36).substring(2, 12).toUpperCase()
            });
        }

        return mockShipments;
    };

    // Initial load effect
    useEffect(() => {
        console.log('Initial load effect - Auth state:', { user, authLoading });
        if (!authLoading) {
            loadShipments();
        }
    }, [user, authLoading]);

    // Update when filters change
    useEffect(() => {
        console.log('Filter change effect running');
        if (!authLoading) {
            loadShipments();
        }
    }, [page, rowsPerPage, searchTerm, filters, sortBy, selectedTab, dateRange]);

    // Load shipments with filters and pagination
    const loadShipments = async () => {
        console.log('Loading shipments...');
        setLoading(true);
        try {
            // Generate mock data
            const mockData = generateMockShipments(100);
            console.log('Generated mock data:', mockData.length, 'shipments');
            console.log('Sample shipment:', mockData[0]);
            let filteredData = [...mockData];

            // Apply shipment number filter
            if (shipmentNumber) {
                filteredData = filteredData.filter(shipment =>
                    shipment.id.toLowerCase().includes(shipmentNumber.toLowerCase())
                );
            }

            // Apply customer filter
            if (selectedCustomer) {
                filteredData = filteredData.filter(shipment =>
                    shipment.customer === selectedCustomer
                );
            }

            // Apply general search filter
            if (searchTerm) {
                console.log('Applying search filter:', searchTerm);
                filteredData = filteredData.filter(shipment =>
                    Object.values(shipment).some(value =>
                        String(value).toLowerCase().includes(searchTerm.toLowerCase())
                    )
                );
                console.log('After search filter:', filteredData.length);
            }

            if (filters.status !== 'all') {
                console.log('Applying status filter:', filters.status);
                filteredData = filteredData.filter(shipment =>
                    shipment.status === filters.status
                );
                console.log('After status filter:', filteredData.length);
            }

            if (filters.carrier !== 'all') {
                console.log('Applying carrier filter:', filters.carrier);
                filteredData = filteredData.filter(shipment =>
                    shipment.carrier === filters.carrier
                );
                console.log('After carrier filter:', filteredData.length);
            }

            if (dateRange[0] && dateRange[1]) {
                console.log('Applying date range filter:', dateRange[0].format('YYYY-MM-DD'), 'to', dateRange[1].format('YYYY-MM-DD'));
                filteredData = filteredData.filter(shipment => {
                    const shipmentDate = new Date(shipment.date);
                    const result = shipmentDate >= dateRange[0].toDate() && shipmentDate <= dateRange[1].toDate();
                    return result;
                });
                console.log('After date filter:', filteredData.length);
            }

            // Filter by tab
            if (selectedTab !== 'all') {
                console.log('Applying tab filter:', selectedTab);
                filteredData = filteredData.filter(s => s.status === selectedTab);
                console.log('After tab filter:', filteredData.length);
            }

            // Apply sorting
            console.log('Applying sorting:', sortBy);
            filteredData.sort((a, b) => {
                const aValue = a[sortBy.field];
                const bValue = b[sortBy.field];
                const direction = sortBy.direction === 'asc' ? 1 : -1;

                if (sortBy.field === 'date') {
                    return direction * (new Date(aValue) - new Date(bValue));
                }

                if (sortBy.field === 'cost') {
                    return direction * (aValue - bValue);
                }

                if (typeof aValue === 'string') {
                    return direction * aValue.localeCompare(bValue);
                }

                return direction * (aValue - bValue);
            });

            // Update state with filtered data
            console.log('Setting filtered data:', filteredData.length, 'shipments');
            setTotalCount(filteredData.length);

            // Calculate pagination
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedData = filteredData.slice(startIndex, endIndex);

            console.log('Setting paginated data:', paginatedData.length, 'shipments');
            console.log('Sample paginated shipment:', paginatedData[0]);
            setShipments(paginatedData);
        } catch (error) {
            console.error('Error loading shipments:', error);
            setShipments([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    // Handle status chip display
    const getStatusChip = (status) => {
        let color = '';
        switch (status) {
            case 'Delivered':
                color = '#0a875a';
                break;
            case 'In Transit':
                color = '#2c6ecb';
                break;
            case 'Pending':
            case 'Awaiting Shipment':
                color = '#637381';
                break;
            default:
                color = '#637381';
        }

        return (
            <Chip
                label={status}
                sx={{
                    backgroundColor: `${color}10`,
                    color: color,
                    fontWeight: 500,
                    '& .MuiChip-label': { px: 1.5 }
                }}
            />
        );
    };

    // Handle export functionality
    const handleExport = () => {
        const data = shipments.map(shipment => ({
            'Shipment ID': shipment.id,
            'Date': new Date(shipment.date).toLocaleDateString(),
            'Customer': shipment.customer,
            'Origin': shipment.origin,
            'Destination': shipment.destination,
            'Status': shipment.status,
            'Carrier': shipment.carrier,
            'Items': shipment.items,
            'Cost': `$${shipment.cost.toFixed(2)}`
        }));

        if (selectedExportFormat === 'csv') {
            const csvContent = [
                Object.keys(data[0]).join(','),
                ...data.map(row => Object.values(row).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shipments_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        setIsExportDialogOpen(false);
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = shipments.map(shipment => shipment.id);
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

    const handleShipmentClick = (shipment) => {
        navigate(`/shipment/${shipment.shipmentID}`, { state: { from: '/shipments' } });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Delivered':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'In Transit':
                return { color: '#2c6ecb', bgcolor: '#f4f6f8' };
            case 'Pending':
            case 'Awaiting Shipment':
                return { color: '#637381', bgcolor: '#f9fafb' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    const handleActionMenuOpen = (event, shipment) => {
        setSelectedShipment(shipment);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedShipment(null);
        setActionMenuAnchorEl(null);
    };

    const handleSelectClick = (event, id) => {
        event.stopPropagation();
        handleSelect(id);
    };

    return (
        <div className="shipments-container">
            <div className="breadcrumb-container">
                <Link to="/" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Home</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Typography variant="body2" className="breadcrumb-current">
                    Shipments
                </Typography>
            </div>

            <Paper className="shipments-paper">
                <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                    <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Header Section */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                Shipments
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<ExportIcon />}
                                    onClick={() => setIsExportDialogOpen(true)}
                                    sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                                >
                                    Export
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    component={Link}
                                    to="/create-shipment"
                                    sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
                                >
                                    Create shipment
                                </Button>
                            </Box>
                        </Box>

                        {/* Main Content */}
                        <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                            <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Tabs value={selectedTab} onChange={handleTabChange}>
                                    <Tab label={`All (${stats.total})`} value="all" />
                                    <Tab label={`In Transit (${stats.inTransit})`} value="In Transit" />
                                    <Tab label={`Delivered (${stats.delivered})`} value="Delivered" />
                                    <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="Awaiting Shipment" />
                                </Tabs>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <TextField
                                        size="small"
                                        placeholder="Search shipments..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ color: '#64748b' }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: searchTerm && (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setSearchTerm('')}
                                                        sx={{ color: '#64748b' }}
                                                    >
                                                        <ClearIcon />
                                                    </IconButton>
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{ width: 300 }}
                                    />
                                </Box>
                            </Toolbar>

                            {/* Search and Filter Section */}
                            <Box sx={{ p: 3, bgcolor: '#ffffff', borderRadius: 2 }}>
                                <Grid container spacing={2} alignItems="center">
                                    {/* Shipment Number Search */}
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            fullWidth
                                            label="Shipment #"
                                            value={shipmentNumber}
                                            onChange={(e) => setShipmentNumber(e.target.value)}
                                            placeholder="Enter shipment number"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: shipmentNumber && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setShipmentNumber('')}
                                                            sx={{ color: '#64748b' }}
                                                        >
                                                            <ClearIcon />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>

                                    {/* Customer Dropdown */}
                                    <Grid item xs={12} sm={6} md={3}>
                                        <FormControl fullWidth>
                                            <InputLabel>Customer</InputLabel>
                                            <Select
                                                value={selectedCustomer}
                                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                                label="Customer"
                                                startAdornment={
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ color: '#64748b' }} />
                                                    </InputAdornment>
                                                }
                                                endAdornment={selectedCustomer && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setSelectedCustomer('')}
                                                            sx={{ color: '#64748b' }}
                                                        >
                                                            <ClearIcon />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )}
                                            >
                                                <MenuItem value="">All Customers</MenuItem>
                                                {customers.map((customer) => (
                                                    <MenuItem key={customer} value={customer}>
                                                        {customer}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    {/* Carrier Filter */}
                                    <Grid item xs={12} sm={6} md={2}>
                                        <FormControl fullWidth>
                                            <InputLabel>Carrier</InputLabel>
                                            <Select
                                                value={filters.carrier}
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    carrier: e.target.value
                                                }))}
                                                label="Carrier"
                                            >
                                                <MenuItem value="all">All Carriers</MenuItem>
                                                <MenuItem value="FedEx">FedEx</MenuItem>
                                                <MenuItem value="UPS">UPS</MenuItem>
                                                <MenuItem value="DHL">DHL</MenuItem>
                                                <MenuItem value="USPS">USPS</MenuItem>
                                                <MenuItem value="Canada Post">Canada Post</MenuItem>
                                                <MenuItem value="Purolator">Purolator</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    {/* Shipment Type Filter */}
                                    <Grid item xs={12} sm={6} md={2}>
                                        <FormControl fullWidth>
                                            <InputLabel>Type</InputLabel>
                                            <Select
                                                value={filters.shipmentType || 'all'}
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    shipmentType: e.target.value
                                                }))}
                                                label="Type"
                                            >
                                                <MenuItem value="all">All Types</MenuItem>
                                                <MenuItem value="Courier">Courier</MenuItem>
                                                <MenuItem value="Freight">Freight</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    {/* Date Range Filter */}
                                    <Grid item xs={12} sm={6} md={2}>
                                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                                            <DatePicker
                                                label="Date Range"
                                                value={dateRange[0]}
                                                onChange={(newValue) => setDateRange([newValue, dateRange[1]])}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        InputProps={{
                                                            ...params.InputProps,
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <CalendarIcon sx={{ color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                        }}
                                                    />
                                                )}
                                                slotProps={{
                                                    actionBar: {
                                                        actions: ['clear', 'today', 'accept'],
                                                    },
                                                }}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                </Grid>
                            </Box>

                            {/* Shipments Table */}
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    indeterminate={selected.length > 0 && selected.length < shipments.length}
                                                    checked={shipments.length > 0 && selected.length === shipments.length}
                                                    onChange={handleSelectAll}
                                                />
                                            </TableCell>
                                            <TableCell>ID</TableCell>
                                            <TableCell>CUSTOMER</TableCell>
                                            <TableCell>ORIGIN</TableCell>
                                            <TableCell>DESTINATION</TableCell>
                                            <TableCell sx={{ minWidth: 120 }}>CARRIER</TableCell>
                                            <TableCell>TYPE</TableCell>
                                            <TableCell>STATUS</TableCell>
                                            <TableCell align="right">ACTIONS</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center">
                                                    <CircularProgress />
                                                </TableCell>
                                            </TableRow>
                                        ) : shipments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center">
                                                    No shipments found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            shipments.map((shipment) => (
                                                <TableRow
                                                    hover
                                                    key={shipment.id}
                                                    onClick={() => handleShipmentClick(shipment)}
                                                    selected={selected.indexOf(shipment.id) !== -1}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell padding="checkbox">
                                                        <Checkbox
                                                            checked={selected.indexOf(shipment.id) !== -1}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => handleSelectClick(e, shipment.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography
                                                            sx={{
                                                                color: '#3b82f6',
                                                                textDecoration: 'none',
                                                                fontWeight: 500
                                                            }}
                                                        >
                                                            {shipment.id}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{shipment.customer}</TableCell>
                                                    <TableCell>{shipment.origin}</TableCell>
                                                    <TableCell>{shipment.destination}</TableCell>
                                                    <TableCell>{shipment.carrier}</TableCell>
                                                    <TableCell>{shipment.shipmentType}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={shipment.status}
                                                            color={
                                                                shipment.status === 'Delivered' ? 'success' :
                                                                    shipment.status === 'In Transit' ? 'primary' :
                                                                        'default'
                                                            }
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <IconButton
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleActionMenuOpen(e, shipment);
                                                            }}
                                                            size="small"
                                                        >
                                                            <MoreVertIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Pagination */}
                            <TablePagination
                                component="div"
                                count={totalCount}
                                page={page}
                                onPageChange={(event, newPage) => setPage(newPage)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(event) => {
                                    setRowsPerPage(parseInt(event.target.value, 10));
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                            />
                        </Paper>

                        {/* Export Dialog */}
                        <Dialog open={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)}>
                            <DialogTitle>Export Shipments</DialogTitle>
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
                                <Button onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleExport} variant="contained">
                                    Export
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Action Menu */}
                        <Menu
                            anchorEl={actionMenuAnchorEl}
                            open={Boolean(actionMenuAnchorEl)}
                            onClose={handleActionMenuClose}
                        >
                            <MenuItem onClick={() => {
                                handleActionMenuClose();
                                if (selectedShipment) {
                                    navigate(`/shipment/${selectedShipment.id}`);
                                }
                            }}>
                                <ListItemIcon>
                                    <VisibilityIcon fontSize="small" />
                                </ListItemIcon>
                                View Details
                            </MenuItem>
                            <MenuItem onClick={() => {
                                handleActionMenuClose();
                                // Handle print label
                                console.log('Print label for:', selectedShipment?.id);
                            }}>
                                <ListItemIcon>
                                    <PrintIcon fontSize="small" />
                                </ListItemIcon>
                                Print Label
                            </MenuItem>
                        </Menu>
                    </Box>
                </Box>
            </Paper>
        </div>
    );
};

export default Shipments; 