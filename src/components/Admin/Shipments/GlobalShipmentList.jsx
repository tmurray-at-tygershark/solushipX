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
    IconButton,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Tooltip,
    Pagination,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Stack,
} from '@mui/material';
import {
    Visibility as ViewIcon,
    LocalShipping as ShippingIcon,
    FilterList as FilterIcon,
    Download as DownloadIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import './Shipments.css';

const GlobalShipmentList = () => {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        status: 'all',
        dateRange: 'all',
        carrier: 'all',
        company: 'all'
    });
    const [showFilters, setShowFilters] = useState(false);
    const { userRole } = useAuth();

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        fetchShipments();
    }, [page, filters]);

    const fetchShipments = async () => {
        try {
            setLoading(true);
            const shipmentsRef = collection(db, 'shipments');
            let q = query(shipmentsRef, orderBy('createdAt', 'desc'));

            // Apply filters
            if (filters.status !== 'all') {
                q = query(q, where('status', '==', filters.status));
            }
            if (filters.carrier !== 'all') {
                q = query(q, where('carrier', '==', filters.carrier));
            }
            if (filters.company !== 'all') {
                q = query(q, where('companyId', '==', filters.company));
            }

            const querySnapshot = await getDocs(q);
            const shipmentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Apply date range filter
            let filteredData = shipmentsData;
            if (filters.dateRange !== 'all') {
                const now = new Date();
                const startDate = new Date();
                switch (filters.dateRange) {
                    case 'today':
                        startDate.setHours(0, 0, 0, 0);
                        break;
                    case 'week':
                        startDate.setDate(now.getDate() - 7);
                        break;
                    case 'month':
                        startDate.setMonth(now.getMonth() - 1);
                        break;
                    case 'year':
                        startDate.setFullYear(now.getFullYear() - 1);
                        break;
                }
                filteredData = shipmentsData.filter(shipment =>
                    shipment.createdAt.toDate() >= startDate
                );
            }

            setShipments(filteredData);
            setTotalPages(Math.ceil(filteredData.length / ITEMS_PER_PAGE));
        } catch (err) {
            setError('Error fetching shipments: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (shipment = null) => {
        setSelectedShipment(shipment);
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setSelectedShipment(null);
        setOpenDialog(false);
    };

    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
        setPage(1);
    };

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
        setPage(1);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return 'warning';
            case 'in_transit':
                return 'info';
            case 'delivered':
                return 'success';
            case 'cancelled':
                return 'error';
            default:
                return 'default';
        }
    };

    const filteredShipments = shipments.filter(shipment =>
        shipment.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.carrier?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const paginatedShipments = filteredShipments.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    const handleExport = () => {
        // Implement export functionality
        console.log('Exporting shipments...');
    };

    return (
        <Box className="shipments-container">
            <Box className="shipments-header">
                <Typography variant="h4" className="shipments-title">
                    Global Shipments
                </Typography>
                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        startIcon={<FilterIcon />}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        Filters
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleExport}
                    >
                        Export
                    </Button>
                </Stack>
            </Box>

            {showFilters && (
                <Paper className="shipments-filters">
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    name="status"
                                    value={filters.status}
                                    onChange={handleFilterChange}
                                    label="Status"
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="in_transit">In Transit</MenuItem>
                                    <MenuItem value="delivered">Delivered</MenuItem>
                                    <MenuItem value="cancelled">Cancelled</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Date Range</InputLabel>
                                <Select
                                    name="dateRange"
                                    value={filters.dateRange}
                                    onChange={handleFilterChange}
                                    label="Date Range"
                                >
                                    <MenuItem value="all">All Time</MenuItem>
                                    <MenuItem value="today">Today</MenuItem>
                                    <MenuItem value="week">Last 7 Days</MenuItem>
                                    <MenuItem value="month">Last 30 Days</MenuItem>
                                    <MenuItem value="year">Last Year</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Carrier</InputLabel>
                                <Select
                                    name="carrier"
                                    value={filters.carrier}
                                    onChange={handleFilterChange}
                                    label="Carrier"
                                >
                                    <MenuItem value="all">All Carriers</MenuItem>
                                    <MenuItem value="fedex">FedEx</MenuItem>
                                    <MenuItem value="ups">UPS</MenuItem>
                                    <MenuItem value="usps">USPS</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Search"
                                value={searchTerm}
                                onChange={handleSearch}
                                placeholder="Search by tracking number, company, or carrier"
                            />
                        </Grid>
                    </Grid>
                </Paper>
            )}

            <TableContainer component={Paper} className="shipments-table">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Tracking Number</TableCell>
                            <TableCell>Company</TableCell>
                            <TableCell>Carrier</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedShipments.map((shipment) => (
                            <TableRow key={shipment.id}>
                                <TableCell>{shipment.trackingNumber}</TableCell>
                                <TableCell>{shipment.companyName}</TableCell>
                                <TableCell>{shipment.carrier}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={shipment.status}
                                        color={getStatusColor(shipment.status)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    {shipment.createdAt?.toDate().toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="View Details">
                                        <IconButton
                                            color="primary"
                                            onClick={() => handleOpenDialog(shipment)}
                                        >
                                            <ViewIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box className="shipments-pagination">
                <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                    color="primary"
                    showFirstButton
                    showLastButton
                />
            </Box>

            {/* Shipment Details Dialog */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Shipment Details
                </DialogTitle>
                <DialogContent>
                    {/* Shipment details will be implemented here */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default GlobalShipmentList; 