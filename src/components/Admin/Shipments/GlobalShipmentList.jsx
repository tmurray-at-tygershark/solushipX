import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
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
    NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import './Shipments.css';

const GlobalShipmentList = () => {
    const { user, loading: authLoading } = useAuth();
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

    // Initial load effect
    useEffect(() => {
        if (!authLoading) {
            loadShipments();
        }
    }, [user, authLoading]);

    // Update when filters change
    useEffect(() => {
        if (!authLoading) {
            loadShipments();
        }
    }, [page, rowsPerPage, searchTerm, filters, sortBy, selectedTab, dateRange]);

    // Load shipments with filters and pagination
    const loadShipments = async () => {
        setLoading(true);
        try {
            const shipmentsRef = collection(db, 'shipments');
            let q = query(shipmentsRef, orderBy('createdAt', 'desc'));

            // Apply filters
            if (filters.status !== 'all') {
                q = query(q, where('status', '==', filters.status));
            }
            if (filters.carrier !== 'all') {
                q = query(q, where('carrier', '==', filters.carrier));
            }
            if (filters.shipmentType !== 'all') {
                q = query(q, where('shipmentType', '==', filters.shipmentType));
            }

            const querySnapshot = await getDocs(q);
            let shipmentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Apply date range filter
            if (dateRange[0] && dateRange[1]) {
                shipmentsData = shipmentsData.filter(shipment => {
                    const shipmentDate = new Date(shipment.createdAt.toDate());
                    return shipmentDate >= dateRange[0].toDate() && shipmentDate <= dateRange[1].toDate();
                });
            }

            // Apply search filter
            if (searchTerm) {
                shipmentsData = shipmentsData.filter(shipment =>
                    Object.values(shipment).some(value =>
                        String(value).toLowerCase().includes(searchTerm.toLowerCase())
                    )
                );
            }

            // Apply tab filter
            if (selectedTab !== 'all') {
                shipmentsData = shipmentsData.filter(s => s.status === selectedTab);
            }

            // Apply sorting
            shipmentsData.sort((a, b) => {
                const aValue = a[sortBy.field];
                const bValue = b[sortBy.field];
                const direction = sortBy.direction === 'asc' ? 1 : -1;

                if (sortBy.field === 'date') {
                    return direction * (new Date(aValue) - new Date(bValue));
                }

                if (typeof aValue === 'string') {
                    return direction * aValue.localeCompare(bValue);
                }

                return direction * (aValue - bValue);
            });

            setTotalCount(shipmentsData.length);

            // Calculate pagination
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedData = shipmentsData.slice(startIndex, endIndex);

            setShipments(paginatedData);
        } catch (error) {
            console.error('Error loading shipments:', error);
            setShipments([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
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
        navigate(`/admin/shipment/${shipment.id}`);
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

    const handleExport = () => {
        const data = shipments.map(shipment => ({
            'Shipment ID': shipment.id,
            'Date': new Date(shipment.createdAt.toDate()).toLocaleDateString(),
            'Customer': shipment.companyName,
            'Origin': shipment.shippingAddress,
            'Destination': shipment.deliveryAddress,
            'Status': shipment.status,
            'Carrier': shipment.carrier,
            'Items': shipment.items,
            'Cost': `$${shipment.cost?.toFixed(2) || '0.00'}`
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

    return (
        <div className="shipments-container">
            <div className="breadcrumb-container">
                <Link to="/admin" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Admin</Typography>
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
                                Global Shipments
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
                                    to="/admin/create-shipment"
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
                                    <Tab label={`In Transit (${stats.inTransit})`} value="In Transit" />
                                    <Tab label={`Delivered (${stats.delivered})`} value="Delivered" />
                                    <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="Awaiting Shipment" />
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
                                            placeholder="Search shipments..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </Paper>
                                </Box>
                            </Toolbar>

                            {/* Smart Filters */}
                            <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                <FormControl sx={{ minWidth: 200 }}>
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

                                <FormControl sx={{ minWidth: 200 }}>
                                    <InputLabel>Shipment Type</InputLabel>
                                    <Select
                                        value={filters.shipmentType}
                                        onChange={(e) => setFilters(prev => ({
                                            ...prev,
                                            shipmentType: e.target.value
                                        }))}
                                        label="Shipment Type"
                                    >
                                        <MenuItem value="all">All Types</MenuItem>
                                        <MenuItem value="Courier">Courier</MenuItem>
                                        <MenuItem value="Freight">Freight</MenuItem>
                                    </Select>
                                </FormControl>

                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <DatePicker
                                        label="From Date"
                                        value={dateRange[0]}
                                        onChange={(newValue) => setDateRange([newValue, dateRange[1]])}
                                        renderInput={(params) => <TextField {...params} />}
                                        sx={{ minWidth: 200 }}
                                    />
                                    <DatePicker
                                        label="To Date"
                                        value={dateRange[1]}
                                        onChange={(newValue) => setDateRange([dateRange[0], newValue])}
                                        renderInput={(params) => <TextField {...params} />}
                                        sx={{ minWidth: 200 }}
                                    />
                                </LocalizationProvider>

                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        setDateRange([null, null]);
                                        setFilters(prev => ({
                                            ...prev,
                                            carrier: 'all',
                                            shipmentType: 'all'
                                        }));
                                    }}
                                    startIcon={<ClearIcon />}
                                >
                                    Clear Filters
                                </Button>
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
                                                    <TableCell>{shipment.companyName}</TableCell>
                                                    <TableCell>{shipment.shippingAddress}</TableCell>
                                                    <TableCell>{shipment.deliveryAddress}</TableCell>
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
                                    navigate(`/admin/shipment/${selectedShipment.id}`);
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

export default GlobalShipmentList; 