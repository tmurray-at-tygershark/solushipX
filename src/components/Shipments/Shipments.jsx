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
    Checkbox
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Clear as ClearIcon,
    Sort as SortIcon,
    Add as AddIcon,
    CalendarToday as CalendarIcon,
    MoreVert as MoreVertIcon
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
    const [selected, setSelected] = useState([]);

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
        // Navigate to shipment detail or handle click
        console.log('Shipment clicked:', shipment);
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

    return (
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
                    <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0' }}>
                        <Tabs value={selectedTab} onChange={handleTabChange}>
                            <Tab label={`All (${stats.total})`} value="all" />
                            <Tab label={`In Transit (${stats.inTransit})`} value="in-transit" />
                            <Tab label={`Delivered (${stats.delivered})`} value="delivered" />
                            <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="awaiting" />
                        </Tabs>
                        <Box sx={{ flexGrow: 1 }} />
                        {/* Search and Filter Section */}
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
                                    placeholder="Search shipments..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </Paper>

                            <IconButton
                                onClick={() => setFilterAnchorEl(true)}
                                sx={{ color: '#64748b' }}
                            >
                                <FilterIcon />
                            </IconButton>

                            <IconButton
                                onClick={() => setSortAnchorEl(true)}
                                sx={{ color: '#64748b' }}
                            >
                                <SortIcon />
                            </IconButton>
                        </Box>
                    </Toolbar>

                    {/* Shipments Table */}
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selected.length === shipments.length}
                                            indeterminate={selected.length > 0 && selected.length < shipments.length}
                                            onChange={handleSelectAll}
                                        />
                                    </TableCell>
                                    <TableCell>Shipment</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Origin</TableCell>
                                    <TableCell>Destination</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Carrier</TableCell>
                                    <TableCell>Items</TableCell>
                                    <TableCell>Cost</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {shipments.map((shipment) => (
                                    <TableRow key={shipment.id} hover>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selected.includes(shipment.id)}
                                                onChange={() => handleSelect(shipment.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                to={`/shipment/${shipment.id}`}
                                                style={{
                                                    color: '#3b82f6',
                                                    textDecoration: 'none',
                                                    fontWeight: 500
                                                }}
                                            >
                                                {shipment.id}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{shipment.date}</TableCell>
                                        <TableCell>{shipment.customer}</TableCell>
                                        <TableCell>{shipment.origin}</TableCell>
                                        <TableCell>{shipment.destination}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={shipment.status}
                                                color={
                                                    shipment.status === 'Delivered' ? 'success' :
                                                        shipment.status === 'In Transit' ? 'primary' :
                                                            'default'
                                                }
                                                size="small"
                                                sx={{
                                                    bgcolor: shipment.status === 'Delivered' ? '#f0fdf4' :
                                                        shipment.status === 'In Transit' ? '#eff6ff' :
                                                            '#f1f5f9',
                                                    color: shipment.status === 'Delivered' ? '#10b981' :
                                                        shipment.status === 'In Transit' ? '#3b82f6' :
                                                            '#64748b',
                                                    fontWeight: 500
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{shipment.carrier}</TableCell>
                                        <TableCell>{shipment.items}</TableCell>
                                        <TableCell>{shipment.cost}</TableCell>
                                        <TableCell>
                                            <IconButton size="small" sx={{ color: '#64748b' }}>
                                                <MoreVertIcon />
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

                {/* Filter Menu */}
                <Menu
                    anchorEl={filterAnchorEl}
                    open={Boolean(filterAnchorEl)}
                    onClose={() => setFilterAnchorEl(null)}
                >
                    <MenuItem>
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    status: e.target.value
                                }))}
                                label="Status"
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="in-transit">In Transit</MenuItem>
                                <MenuItem value="delivered">Delivered</MenuItem>
                                <MenuItem value="awaiting">Awaiting Shipment</MenuItem>
                            </Select>
                        </FormControl>
                    </MenuItem>
                    <MenuItem>
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
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="fedex">FedEx</MenuItem>
                                <MenuItem value="ups">UPS</MenuItem>
                                <MenuItem value="dhl">DHL</MenuItem>
                                <MenuItem value="usps">USPS</MenuItem>
                            </Select>
                        </FormControl>
                    </MenuItem>
                    <MenuItem>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Date Range"
                                value={dateRange}
                                onChange={(newValue) => setDateRange(newValue)}
                                renderInput={(startProps, endProps) => (
                                    <Stack direction="row" spacing={2}>
                                        <TextField {...startProps} />
                                        <TextField {...endProps} />
                                    </Stack>
                                )}
                            />
                        </LocalizationProvider>
                    </MenuItem>
                </Menu>

                {/* Sort Menu */}
                <Menu
                    anchorEl={sortAnchorEl}
                    open={Boolean(sortAnchorEl)}
                    onClose={() => setSortAnchorEl(null)}
                >
                    <MenuItem onClick={() => setSortBy({ field: 'date', direction: 'desc' })}>Date (Newest)</MenuItem>
                    <MenuItem onClick={() => setSortBy({ field: 'date', direction: 'asc' })}>Date (Oldest)</MenuItem>
                    <MenuItem onClick={() => setSortBy({ field: 'cost', direction: 'desc' })}>Cost (High to Low)</MenuItem>
                    <MenuItem onClick={() => setSortBy({ field: 'cost', direction: 'asc' })}>Cost (Low to High)</MenuItem>
                </Menu>
            </Box>
        </Box>
    );
};

export default Shipments; 