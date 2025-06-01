import React, { useState, useEffect, useMemo } from 'react';
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
    Delete as DeleteIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import './Shipments.css';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// Add formatAddress function (copied from admin view)
const formatAddress = (address, label = '') => {
    if (!address || typeof address !== 'object') {
        if (label) {
            console.warn(`No valid address object for ${label}:`, address);
        }
        return <div>N/A</div>;
    }
    return (
        <>
            {address.company && <div>{address.company}</div>}
            {address.attentionName && <div>{address.attentionName}</div>}
            {address.street && <div>{address.street}</div>}
            {address.street2 && address.street2 !== '' && <div>{address.street2}</div>}
            <div>
                {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
            </div>
            {address.country && <div>{address.country}</div>}
        </>
    );
};

// Extract StatusChip component for reusability (from Dashboard)
const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            // Draft/Initial States - Grey
            case 'draft':
                return {
                    color: '#64748b',
                    bgcolor: '#f1f5f9',
                    label: 'Draft'
                };
            case 'unknown':
                return {
                    color: '#6b7280',
                    bgcolor: '#f9fafb',
                    label: 'Unknown'
                };

            // Early Processing - Light Grey
            case 'pending':
            case 'created':
                return {
                    color: '#d97706',
                    bgcolor: '#fef3c7',
                    label: 'Pending'
                };

            // Scheduled - Light Blue
            case 'scheduled':
                return {
                    color: '#7c3aed',
                    bgcolor: '#ede9fe',
                    label: 'Scheduled'
                };

            // Confirmed - Blue
            case 'booked':
                return {
                    color: '#2563eb',
                    bgcolor: '#dbeafe',
                    label: 'Booked'
                };

            // Ready to Ship - Orange
            case 'awaiting pickup':
            case 'awaiting shipment':
            case 'awaiting_shipment':
            case 'label_created':
                return {
                    color: '#ea580c',
                    bgcolor: '#fed7aa',
                    label: 'Awaiting Shipment'
                };

            // In Motion - Purple
            case 'in transit':
            case 'in_transit':
                return {
                    color: '#7c2d92',
                    bgcolor: '#f3e8ff',
                    label: 'In Transit'
                };

            // Success - Green (Reserved for completion)
            case 'delivered':
                return {
                    color: '#16a34a',
                    bgcolor: '#dcfce7',
                    label: 'Delivered'
                };

            // Problem States - Red variants
            case 'on hold':
            case 'on_hold':
                return {
                    color: '#dc2626',
                    bgcolor: '#fee2e2',
                    label: 'On Hold'
                };
            case 'cancelled':
            case 'canceled':
                return {
                    color: '#b91c1c',
                    bgcolor: '#fecaca',
                    label: 'Cancelled'
                };
            case 'void':
                return {
                    color: '#7f1d1d',
                    bgcolor: '#f3f4f6',
                    label: 'Void'
                };

            default:
                return {
                    color: '#6b7280',
                    bgcolor: '#f9fafb',
                    label: status || 'Unknown'
                };
        }
    };

    const { color, bgcolor, label } = getStatusConfig(status);

    return (
        <Chip
            label={label}
            sx={{
                color: color,
                bgcolor: bgcolor,
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: '24px',
                '& .MuiChip-label': {
                    px: 2
                }
            }}
            size="small"
        />
    );
});

// Helper function to capitalize shipment type
const capitalizeShipmentType = (type) => {
    if (!type) return 'N/A';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

const Shipments = () => {
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyCtxLoading } = useCompany();
    const [shipments, setShipments] = useState([]);
    const [allShipments, setAllShipments] = useState([]); // Store all unfiltered shipments for stats
    const [customers, setCustomers] = useState({});
    const [carrierData, setCarrierData] = useState({});
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
    const [refreshingStatus, setRefreshingStatus] = useState(new Set());
    const navigate = useNavigate();

    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Enhanced stats calculation to include all statuses including drafts
    const stats = useMemo(() => {
        // Calculate total excluding drafts for the "All" tab
        const nonDraftShipments = allShipments.filter(s => s.status !== 'draft');

        return {
            total: nonDraftShipments.length, // Exclude drafts from total
            inTransit: allShipments.filter(s => s.status === 'In Transit').length,
            delivered: allShipments.filter(s => s.status === 'Delivered').length,
            awaitingShipment: allShipments.filter(s => s.status === 'Awaiting Shipment').length,
            drafts: allShipments.filter(s => s.status === 'draft').length
        };
    }, [allShipments]);

    // Fetch customers for name lookup (copied from admin view)
    const fetchCustomers = async () => {
        try {
            const customersRef = collection(db, 'customers');
            const querySnapshot = await getDocs(customersRef);
            const customersMap = {};
            querySnapshot.forEach(doc => {
                const customer = doc.data();
                customersMap[customer.customerID] = customer.name;
            });
            setCustomers(customersMap);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    // Fetch carrier information from shipmentRates collection
    const fetchCarrierData = async (shipmentIds) => {
        if (!shipmentIds || shipmentIds.length === 0) return;

        try {
            const carrierMap = {};

            // Fetch carrier data for shipments that have selectedRateDocumentId
            for (const shipmentId of shipmentIds) {
                const shipmentRatesRef = collection(db, 'shipmentRates');
                const q = query(shipmentRatesRef, where('shipmentId', '==', shipmentId));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // Get the most recent rate (or selected rate)
                    const rates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const selectedRate = rates.find(rate => rate.status === 'selected_in_ui' || rate.status === 'booked') || rates[0];

                    if (selectedRate) {
                        carrierMap[shipmentId] = {
                            carrier: selectedRate.carrier,
                            service: selectedRate.service,
                            totalCharges: selectedRate.totalCharges,
                            transitDays: selectedRate.transitDays
                        };
                    }
                }
            }

            setCarrierData(carrierMap);
        } catch (error) {
            console.error('Error fetching carrier data:', error);
        }
    };

    // Remove generateMockShipments and replace loadShipments with Firestore logic
    const loadShipments = async () => {
        if (!companyIdForAddress && !companyCtxLoading) {
            console.log("Shipments.jsx: Waiting for companyIdForAddress or company context to finish loading.");
            setLoading(false);
            setShipments([]); // Clear shipments if no companyId
            setAllShipments([]); // Clear all shipments for stats
            setTotalCount(0);
            return;
        }
        if (!companyIdForAddress && companyCtxLoading) {
            console.log("Shipments.jsx: Company context is loading, waiting for companyIdForAddress.");
            setLoading(true); // Keep loading true while company context loads
            return;
        }
        if (!companyIdForAddress) { // Should be caught by above, but as a safeguard
            console.warn("Shipments.jsx: companyIdForAddress is not available. Cannot load shipments.");
            setLoading(false);
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
            return;
        }

        console.log(`Shipments.jsx: loadShipments called with companyIdForAddress: ${companyIdForAddress}`);
        setLoading(true);
        try {
            let shipmentsRef = collection(db, 'shipments');
            // Always filter by companyID
            let q = query(shipmentsRef, where('companyID', '==', companyIdForAddress), orderBy('createdAt', 'desc'));

            // Apply status filter
            if (filters.status !== 'all') {
                q = query(q, where('status', '==', filters.status));
            }
            // Apply carrier filter - removed from Firestore query, will be handled client-side
            // Apply shipment type filter
            if (filters.shipmentType !== 'all') {
                q = query(q, where('shipmentType', '==', filters.shipmentType));
            }

            // Fetch all shipments (for now, pagination can be improved with startAfter/limit)
            const querySnapshot = await getDocs(q);
            let shipmentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Apply carrier filter (client-side to check both carrier and selectedRate.carrier)
            if (filters.carrier !== 'all') {
                shipmentsData = shipmentsData.filter(shipment => {
                    const shipmentCarrier = carrierData[shipment.id]?.carrier ||
                        shipment.selectedRateRef?.carrier ||
                        shipment.selectedRate?.carrier ||
                        shipment.carrier;
                    return shipmentCarrier === filters.carrier;
                });
            }

            // Apply date range filter
            if (dateRange[0] && dateRange[1]) {
                shipmentsData = shipmentsData.filter(shipment => {
                    const shipmentDate = shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);
                    return shipmentDate >= dateRange[0].toDate() && shipmentDate <= dateRange[1].toDate();
                });
            }

            // Apply shipment number filter
            if (shipmentNumber) {
                shipmentsData = shipmentsData.filter(shipment =>
                    (shipment.shipmentId || shipment.id || '').toLowerCase().includes(shipmentNumber.toLowerCase())
                );
            }

            // Apply customer filter
            if (selectedCustomer) {
                shipmentsData = shipmentsData.filter(shipment =>
                    shipment.companyName === selectedCustomer || shipment.customerId === selectedCustomer
                );
            }

            // Apply general search filter
            if (searchTerm) {
                const searchableFields = ['shipmentId', 'id', 'companyName', 'shippingAddress', 'deliveryAddress', 'carrier', 'shipmentType', 'status'];
                shipmentsData = shipmentsData.filter(shipment =>
                    searchableFields.some(field => {
                        const value = shipment[field];
                        if (!value) return false;
                        if (typeof value === 'string' || typeof value === 'number') {
                            return String(value).toLowerCase().includes(searchTerm.toLowerCase());
                        }
                        // For address objects
                        if ((field === 'shippingAddress' || field === 'deliveryAddress') && typeof value === 'object') {
                            return Object.values(value).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
                        }
                        return false;
                    }) ||
                    // Also search in selectedRate.carrier
                    (shipment.selectedRateRef?.carrier &&
                        String(shipment.selectedRateRef.carrier).toLowerCase().includes(searchTerm.toLowerCase())) ||
                    // Also search in fetched carrier data
                    (carrierData[shipment.id]?.carrier &&
                        String(carrierData[shipment.id].carrier).toLowerCase().includes(searchTerm.toLowerCase()))
                );
            }

            // Store the full unfiltered dataset for stats calculation
            setAllShipments(shipmentsData);

            // Filter by tab - exclude drafts from "All" tab
            if (selectedTab === 'all') {
                // "All" tab should exclude drafts
                shipmentsData = shipmentsData.filter(s => s.status !== 'draft');
            } else if (selectedTab === 'draft') {
                // Handle draft tab - only show drafts
                shipmentsData = shipmentsData.filter(s => s.status === 'draft');
            } else {
                // Handle other specific status tabs (In Transit, Delivered, etc.)
                shipmentsData = shipmentsData.filter(s => s.status === selectedTab);
            }

            // Apply sorting
            shipmentsData.sort((a, b) => {
                const aValue = a[sortBy.field];
                const bValue = b[sortBy.field];
                const direction = sortBy.direction === 'asc' ? 1 : -1;
                if (sortBy.field === 'createdAt' || sortBy.field === 'date') {
                    return direction * ((aValue?.toDate ? aValue.toDate() : new Date(aValue)) - (bValue?.toDate ? bValue.toDate() : new Date(bValue)));
                }
                if (typeof aValue === 'string') {
                    return direction * aValue.localeCompare(bValue);
                }
                return direction * (aValue - bValue);
            });

            setTotalCount(shipmentsData.length);
            // Pagination
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedData = rowsPerPage === -1
                ? shipmentsData // Show all if rowsPerPage is -1 (All option selected)
                : shipmentsData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
            setShipments(paginatedData);

            // Fetch carrier data for the loaded shipments
            const shipmentIds = paginatedData.map(shipment => shipment.id);
            await fetchCarrierData(shipmentIds);
        } catch (error) {
            console.error('Error loading shipments:', error);
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !companyCtxLoading) {
            fetchCustomers();
            loadShipments();
        }
    }, [user, authLoading, companyIdForAddress, companyCtxLoading]);

    useEffect(() => {
        if (!authLoading && !companyCtxLoading && companyIdForAddress) {
            loadShipments();
        }
    }, [page, rowsPerPage, searchTerm, filters, sortBy, selectedTab, dateRange, companyIdForAddress, companyCtxLoading, authLoading]);

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
            'Carrier': carrierData[shipment.id]?.carrier ||
                shipment.selectedRateRef?.carrier ||
                shipment.selectedRate?.carrier ||
                shipment.carrier || 'N/A',
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

    // Handle draft deletion
    const handleDeleteDraft = async (shipmentId) => {
        if (!window.confirm('Are you sure you want to delete this draft shipment? This action cannot be undone.')) {
            return;
        }

        try {
            const shipmentDocRef = doc(db, 'shipments', shipmentId);
            await deleteDoc(shipmentDocRef);

            // Refresh the shipments list
            loadShipments();

            // Show success message (you might want to add a toast/snackbar here)
            console.log('Draft shipment deleted successfully');
        } catch (error) {
            console.error('Error deleting draft shipment:', error);
            alert('Failed to delete draft shipment. Please try again.');
        }
    };

    /**
     * Refresh status for a specific shipment
     */
    const handleRefreshShipmentStatus = async (shipment) => {
        try {
            setRefreshingStatus(prev => new Set([...prev, shipment.id]));

            const response = await fetch('https://checkshipmentstatus-xedyh5vw7a-uc.a.run.app', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    shipmentId: shipment.id,
                    trackingNumber: shipment.trackingNumber || shipment.id,
                    bookingReferenceNumber: shipment.selectedRate?.BookingReferenceNumber || shipment.bookingReferenceNumber
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update the shipment in the local state
                setShipments(prevShipments =>
                    prevShipments.map(s =>
                        s.id === shipment.id
                            ? {
                                ...s,
                                status: result.status,
                                statusLastChecked: new Date().toISOString(),
                                carrierTrackingData: result
                            }
                            : s
                    )
                );

                console.log(`Status updated for shipment ${shipment.id}: ${result.statusDisplay}`);
            } else {
                console.error(`Failed to check status for shipment ${shipment.id}:`, result.error);
            }

        } catch (error) {
            console.error('Error refreshing shipment status:', error);
        } finally {
            setRefreshingStatus(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }
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
                                    <Tab label={`Drafts (${stats.drafts})`} value="draft" />
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
                                                {Object.entries(customers).map(([customerId, customerName]) => (
                                                    <MenuItem key={customerId} value={customerName}>
                                                        {customerName}
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
                                                <TableCell colSpan={10} align="center">
                                                    <CircularProgress />
                                                </TableCell>
                                            </TableRow>
                                        ) : shipments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} align="center">
                                                    No shipments found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            shipments.map((shipment) => (
                                                <TableRow
                                                    hover
                                                    key={shipment.id}
                                                    selected={selected.indexOf(shipment.id) !== -1}
                                                >
                                                    <TableCell
                                                        padding="checkbox"
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        <Checkbox
                                                            checked={selected.indexOf(shipment.id) !== -1}
                                                            onChange={() => handleSelect(shipment.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        <Link to={`/shipment/${shipment.shipmentID || shipment.id}`} className="shipment-link">
                                                            {shipment.shipmentID || shipment.id}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {shipment.shipTo?.customerID ? customers[shipment.shipTo.customerID] || shipment.shipTo?.company || 'N/A' : shipment.shipTo?.company || 'N/A'}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {formatAddress(shipment.shipFrom || shipment.shipfrom, 'Origin')}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {formatAddress(shipment.shipTo || shipment.shipto, 'Destination')}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {carrierData[shipment.id]?.carrier ||
                                                            shipment.selectedRateRef?.carrier ||
                                                            shipment.selectedRate?.carrier ||
                                                            shipment.carrier || 'N/A'}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {capitalizeShipmentType(shipment.shipmentInfo?.shipmentType)}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <StatusChip status={shipment.status} />
                                                            {shipment.status !== 'draft' && (
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleRefreshShipmentStatus(shipment)}
                                                                    disabled={refreshingStatus.has(shipment.id)}
                                                                    sx={{
                                                                        opacity: refreshingStatus.has(shipment.id) ? 0.5 : 0.7,
                                                                        '&:hover': { opacity: 1 }
                                                                    }}
                                                                    title="Refresh status"
                                                                >
                                                                    {refreshingStatus.has(shipment.id) ? (
                                                                        <CircularProgress size={14} />
                                                                    ) : (
                                                                        <RefreshIcon sx={{ fontSize: 14 }} />
                                                                    )}
                                                                </IconButton>
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                        align="right"
                                                    >
                                                        <IconButton
                                                            onClick={(e) => handleActionMenuOpen(e, shipment)}
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
                                rowsPerPageOptions={[10, 25, 50, 100, { label: 'All', value: -1 }]}
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

                        {/* Enhanced Action Menu with conditional options based on shipment status */}
                        <Menu
                            anchorEl={actionMenuAnchorEl}
                            open={Boolean(actionMenuAnchorEl)}
                            onClose={handleActionMenuClose}
                        >
                            {/* View Details - Always available */}
                            <MenuItem onClick={() => {
                                handleActionMenuClose();
                                if (selectedShipment) {
                                    if (selectedShipment.status === 'draft') {
                                        // Navigate to draft editing
                                        navigate(`/create-shipment/shipment-info/${selectedShipment.id}`);
                                    } else {
                                        // Navigate to shipment details
                                        const shipmentId = selectedShipment.shipmentID || selectedShipment.id;
                                        navigate(`/shipment/${shipmentId}`);
                                    }
                                }
                            }}>
                                <ListItemIcon>
                                    <VisibilityIcon fontSize="small" />
                                </ListItemIcon>
                                View Details
                            </MenuItem>

                            {/* Conditional menu items based on shipment status */}
                            {selectedShipment?.status === 'draft' ? (
                                // Draft shipments: Show Delete option
                                <MenuItem onClick={() => {
                                    handleActionMenuClose();
                                    if (selectedShipment) {
                                        handleDeleteDraft(selectedShipment.id);
                                    }
                                }}>
                                    <ListItemIcon>
                                        <DeleteIcon fontSize="small" />
                                    </ListItemIcon>
                                    Delete
                                </MenuItem>
                            ) : (
                                // Courier/Freight shipments: Show Print option
                                <MenuItem onClick={() => {
                                    handleActionMenuClose();
                                    // Handle print label
                                    console.log('Print label for:', selectedShipment?.id);
                                }}>
                                    <ListItemIcon>
                                        <PrintIcon fontSize="small" />
                                    </ListItemIcon>
                                    Print
                                </MenuItem>
                            )}
                        </Menu>
                    </Box>
                </Box>
            </Paper>
        </div>
    );
};

export default Shipments; 