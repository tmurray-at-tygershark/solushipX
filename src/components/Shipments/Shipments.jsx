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
    Tab
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Clear as ClearIcon,
    Sort as SortIcon,
    Add as AddIcon,
    CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import './Shipments.css';

const Shipments = () => {
    const [shipments, setShipments] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [sortAnchorEl, setSortAnchorEl] = useState(null);
    const [selectedTab, setSelectedTab] = useState('all');
    const [filters, setFilters] = useState({
        status: 'all',
        carrier: 'all',
        dateRange: [null, null]
    });
    const [sortBy, setSortBy] = useState({
        field: 'date',
        direction: 'desc'
    });
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
    const [dateRange, setDateRange] = useState([null, null]);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    // Mock data generation
    const generateMockShipments = (count) => {
        const carriers = ['FedEx', 'UPS', 'DHL', 'USPS', 'Canada Post', 'Purolator'];
        const statuses = ['In Transit', 'Delivered', 'Pending', 'Awaiting Shipment'];
        const usStates = [
            { city: 'New York', state: 'NY' },
            { city: 'Los Angeles', state: 'CA' },
            { city: 'Chicago', state: 'IL' },
            { city: 'Houston', state: 'TX' },
            { city: 'Miami', state: 'FL' },
            { city: 'Seattle', state: 'WA' },
            { city: 'Boston', state: 'MA' },
            { city: 'Denver', state: 'CO' }
        ];
        const canadianProvinces = [
            { city: 'Toronto', province: 'ON' },
            { city: 'Vancouver', province: 'BC' },
            { city: 'Montreal', province: 'QC' },
            { city: 'Calgary', province: 'AB' },
            { city: 'Ottawa', province: 'ON' },
            { city: 'Edmonton', province: 'AB' },
            { city: 'Winnipeg', province: 'MB' },
            { city: 'Halifax', province: 'NS' }
        ];
        const customers = [
            'John Smith', 'Emma Wilson', 'Michael Brown', 'Sarah Davis',
            'David Miller', 'Lisa Anderson', 'James Taylor', 'Jennifer White',
            'Robert Martin', 'Maria Garcia', 'William Lee', 'Patricia Moore',
            'Christopher Clark', 'Elizabeth Hall', 'Daniel Young', 'Margaret King'
        ];

        const getRandomLocation = () => {
            const isUS = Math.random() < 0.5;
            return isUS ? usStates[Math.floor(Math.random() * usStates.length)] :
                canadianProvinces[Math.floor(Math.random() * canadianProvinces.length)];
        };

        const getRandomDate = () => {
            const start = new Date(2024, 0, 1);
            const end = new Date();
            return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        };

        const getRandomCost = () => (50 + Math.random() * 450).toFixed(2);
        const getRandomItems = () => Math.floor(1 + Math.random() * 5);

        return Array.from({ length: count }, (_, i) => {
            const origin = getRandomLocation();
            let destination;
            do {
                destination = getRandomLocation();
            } while (destination === origin);

            const items = getRandomItems();
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const carrier = carriers[Math.floor(Math.random() * carriers.length)];
            const date = getRandomDate();

            return {
                id: `SHP${String(287683 - i).padStart(6, '0')}`,
                date: date.toISOString(),
                customer: customers[Math.floor(Math.random() * customers.length)],
                origin: `${origin.city}, ${origin.state || origin.province}`,
                destination: `${destination.city}, ${destination.state || destination.province}`,
                status: status,
                carrier: carrier,
                trackingNumber: Math.random().toString(36).substring(2, 12).toUpperCase(),
                items: items,
                deliveryStatus: status === 'Delivered' ? 'Delivered' : status === 'Awaiting Shipment' ? 'Not Started' : 'On Schedule',
                cost: getRandomCost()
            };
        });
    };

    // Load shipments with filters and pagination
    const loadShipments = async () => {
        setLoading(true);
        try {
            // Simulate API call
            const mockData = generateMockShipments(100);
            let filteredData = mockData;

            // Apply filters
            if (searchTerm) {
                filteredData = filteredData.filter(shipment =>
                    Object.values(shipment).some(value =>
                        String(value).toLowerCase().includes(searchTerm.toLowerCase())
                    )
                );
            }

            if (filters.status !== 'all') {
                filteredData = filteredData.filter(shipment =>
                    shipment.status === filters.status
                );
            }

            if (filters.carrier !== 'all') {
                filteredData = filteredData.filter(shipment =>
                    shipment.carrier === filters.carrier
                );
            }

            if (dateRange[0] && dateRange[1]) {
                filteredData = filteredData.filter(shipment => {
                    const shipmentDate = new Date(shipment.date);
                    return shipmentDate >= dateRange[0] && shipmentDate <= dateRange[1];
                });
            }

            // Filter by tab
            switch (selectedTab) {
                case 'in-transit':
                    filteredData = filteredData.filter(s => s.status === 'In Transit');
                    break;
                case 'delivered':
                    filteredData = filteredData.filter(s => s.status === 'Delivered');
                    break;
                case 'awaiting':
                    filteredData = filteredData.filter(s => s.status === 'Awaiting Shipment');
                    break;
                default:
                    break;
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
            setShipments(filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage));
        } catch (error) {
            console.error('Error loading shipments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadShipments();
    }, [page, rowsPerPage, searchTerm, filters, sortBy, selectedTab, dateRange]);

    // Calculate stats
    const stats = {
        total: totalCount,
        inTransit: shipments.filter(s => s.status === 'In Transit').length,
        delivered: shipments.filter(s => s.status === 'Delivered').length,
        awaitingShipment: shipments.filter(s => s.status === 'Awaiting Shipment').length
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
            'Cost': `$${shipment.cost}`
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

    return (
        <Box sx={{ width: '100%', bgcolor: '#f6f6f7', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
                        Shipments: All locations
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<ExportIcon />}
                            onClick={() => setIsExportDialogOpen(true)}
                            sx={{ color: 'text.primary', borderColor: 'divider' }}
                        >
                            Export
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            component={Link}
                            to="/create-shipment"
                            sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' } }}
                        >
                            Create shipment
                        </Button>
                    </Box>
                </Box>

                {/* Main Content */}
                <Paper sx={{ mb: 3 }}>
                    <Toolbar sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={selectedTab} onChange={handleTabChange}>
                            <Tab label={`All (${stats.total})`} value="all" />
                            <Tab label={`In Transit (${stats.inTransit})`} value="in-transit" />
                            <Tab label={`Delivered (${stats.delivered})`} value="delivered" />
                            <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="awaiting" />
                        </Tabs>
                        <Box sx={{ flexGrow: 1 }} />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Paper sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400 }}>
                                <SearchIcon sx={{ p: 1, color: 'action.active' }} />
                                <InputBase
                                    sx={{ ml: 1, flex: 1 }}
                                    placeholder="Search shipments"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                                        <ClearIcon />
                                    </IconButton>
                                )}
                            </Paper>
                            <Button
                                variant="outlined"
                                startIcon={<CalendarIcon />}
                                onClick={() => setIsDatePickerOpen(true)}
                                sx={{ color: 'text.primary', borderColor: 'divider', minWidth: 'auto' }}
                            >
                                {dateRange[0] && dateRange[1]
                                    ? `${dateRange[0].toLocaleDateString()} - ${dateRange[1].toLocaleDateString()}`
                                    : 'Date Range'
                                }
                            </Button>
                            <IconButton onClick={(e) => setFilterAnchorEl(e.currentTarget)}>
                                <FilterIcon />
                            </IconButton>
                            <IconButton onClick={(e) => setSortAnchorEl(e.currentTarget)}>
                                <SortIcon />
                            </IconButton>
                        </Box>
                    </Toolbar>

                    {/* Shipments Table */}
                    <TableContainer>
                        <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Shipment ID</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Origin</TableCell>
                                    <TableCell>Destination</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Carrier</TableCell>
                                    <TableCell align="right">Items</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {shipments.map((shipment) => (
                                    <TableRow
                                        hover
                                        key={shipment.id}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell>
                                            <Link
                                                to={`/shipment/${shipment.id}`}
                                                className="shipment-link"
                                            >
                                                {shipment.id}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{new Date(shipment.date).toLocaleDateString()}</TableCell>
                                        <TableCell>{shipment.customer}</TableCell>
                                        <TableCell>{shipment.origin}</TableCell>
                                        <TableCell>{shipment.destination}</TableCell>
                                        <TableCell>{getStatusChip(shipment.status)}</TableCell>
                                        <TableCell>{shipment.carrier}</TableCell>
                                        <TableCell align="right">{shipment.items}</TableCell>
                                        <TableCell align="right">${shipment.cost}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(event, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(parseInt(event.target.value, 10));
                            setPage(0);
                        }}
                    />
                </Paper>

                {/* Filter Menu */}
                <Menu
                    anchorEl={filterAnchorEl}
                    open={Boolean(filterAnchorEl)}
                    onClose={() => setFilterAnchorEl(null)}
                >
                    <Box sx={{ p: 2, minWidth: 200 }}>
                        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filters.status}
                                label="Status"
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    status: e.target.value
                                }))}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="Delivered">Delivered</MenuItem>
                                <MenuItem value="In Transit">In Transit</MenuItem>
                                <MenuItem value="Pending">Pending</MenuItem>
                                <MenuItem value="Awaiting Shipment">Awaiting Shipment</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                            <InputLabel>Carrier</InputLabel>
                            <Select
                                value={filters.carrier}
                                label="Carrier"
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    carrier: e.target.value
                                }))}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="FedEx">FedEx</MenuItem>
                                <MenuItem value="UPS">UPS</MenuItem>
                                <MenuItem value="USPS">USPS</MenuItem>
                                <MenuItem value="DHL">DHL</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Menu>

                {/* Sort Menu */}
                <Menu
                    anchorEl={sortAnchorEl}
                    open={Boolean(sortAnchorEl)}
                    onClose={() => setSortAnchorEl(null)}
                >
                    <MenuItem
                        onClick={() => {
                            setSortBy({ field: 'date', direction: 'desc' });
                            setSortAnchorEl(null);
                        }}
                    >
                        Date (Newest First)
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setSortBy({ field: 'date', direction: 'asc' });
                            setSortAnchorEl(null);
                        }}
                    >
                        Date (Oldest First)
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setSortBy({ field: 'cost', direction: 'desc' });
                            setSortAnchorEl(null);
                        }}
                    >
                        Cost (Highest First)
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setSortBy({ field: 'cost', direction: 'asc' });
                            setSortAnchorEl(null);
                        }}
                    >
                        Cost (Lowest First)
                    </MenuItem>
                </Menu>

                {/* Export Dialog */}
                <Dialog
                    open={isExportDialogOpen}
                    onClose={() => setIsExportDialogOpen(false)}
                >
                    <DialogTitle>Export Shipments</DialogTitle>
                    <DialogContent>
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>Export Format</InputLabel>
                            <Select
                                value={selectedExportFormat}
                                label="Export Format"
                                onChange={(e) => setSelectedExportFormat(e.target.value)}
                            >
                                <MenuItem value="csv">CSV</MenuItem>
                                <MenuItem value="xlsx" disabled>Excel (Coming Soon)</MenuItem>
                                <MenuItem value="pdf" disabled>PDF (Coming Soon)</MenuItem>
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleExport} variant="contained">Export</Button>
                    </DialogActions>
                </Dialog>

                {/* Date Picker Dialog */}
                <Dialog
                    open={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                    PaperProps={{
                        sx: { width: '400px', p: 2 }
                    }}
                >
                    <DialogTitle sx={{ px: 0, pt: 0 }}>Select Date Range</DialogTitle>
                    <DialogContent sx={{ px: 0 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <Stack spacing={2}>
                                <DatePicker
                                    label="Start Date"
                                    value={dateRange[0]}
                                    onChange={(newValue) => setDateRange([newValue, dateRange[1]])}
                                    renderInput={(params) => <TextField {...params} />}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={dateRange[1]}
                                    onChange={(newValue) => setDateRange([dateRange[0], newValue])}
                                    renderInput={(params) => <TextField {...params} />}
                                    minDate={dateRange[0]}
                                />
                            </Stack>
                        </LocalizationProvider>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => {
                            setDateRange([null, null]);
                            setIsDatePickerOpen(false);
                        }}>
                            Clear
                        </Button>
                        <Button onClick={() => setIsDatePickerOpen(false)}>
                            Apply
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default Shipments; 