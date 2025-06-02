import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, TablePagination, TextField, InputAdornment, IconButton,
    Button, Chip, Typography, Toolbar, Menu, MenuItem, FormControl,
    InputLabel, Select, Stack, Dialog, DialogTitle, DialogContent,
    DialogActions, Tabs, Tab, Checkbox, CircularProgress, ListItemIcon,
    Grid, Tooltip, Badge, Skeleton, Alert, Fade, Collapse, Card,
    CardContent, Avatar, Divider, Switch, FormControlLabel, Drawer,
    List, ListItem, ListItemText, ListItemButton, ListItemAvatar,
    SpeedDial, SpeedDialAction, SpeedDialIcon, Autocomplete, Slider,
    ToggleButton, ToggleButtonGroup, LinearProgress, Popover,
    Breadcrumbs, TableSortLabel
} from '@mui/material';
import {
    Search, FilterList, GetApp, Clear, Sort, Add, CalendarToday,
    MoreVert, Visibility, Print, Delete, Home, NavigateNext, Refresh,
    LocalShipping, Flight, Timer, CheckCircle, Cancel, Schedule,
    TrendingUp, AttachMoney, Map, Analytics, BookmarkBorder, Bookmark,
    ViewColumn, ViewList, ViewModule, Timeline, Speed, Download,
    CloudDownload, PictureAsPdf, TableChart, Assignment, SaveAlt,
    AutoAwesome, Insights, LocationOn, Business, Person, Phone,
    Email, DateRange, FilterAlt, SearchOff, DarkMode, LightMode,
    Settings, ArrowUpward, ArrowDownward, SwapVert, ContentCopy,
    Share, QrCode, Label, Inventory, BarChart, PieChart,
    Warning, Today
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import './EnhancedShipments.css';

// Extend dayjs with relativeTime plugin
dayjs.extend(relativeTime);

// AI-powered search engine
class SmartSearchEngine {
    constructor() {
        this.searchIndex = {};
        this.synonyms = {
            'delivered': ['completed', 'received', 'arrived'],
            'transit': ['shipping', 'on the way', 'en route', 'traveling'],
            'pending': ['waiting', 'processing', 'preparing'],
            'fedex': ['federal express', 'fdx'],
            'ups': ['united parcel service'],
            'freight': ['cargo', 'bulk', 'heavy'],
            'courier': ['parcel', 'package', 'express']
        };
    }

    buildIndex(shipments) {
        this.searchIndex = {};
        shipments.forEach(shipment => {
            const searchableText = this.extractSearchableText(shipment);
            const tokens = this.tokenize(searchableText);
            tokens.forEach(token => {
                if (!this.searchIndex[token]) {
                    this.searchIndex[token] = new Set();
                }
                this.searchIndex[token].add(shipment.id);
            });
        });
    }

    extractSearchableText(shipment) {
        const fields = [
            shipment.shipmentID,
            shipment.id,
            shipment.status,
            shipment.carrier,
            shipment.shipmentType,
            shipment.trackingNumber,
            shipment.shipTo?.company,
            shipment.shipTo?.city,
            shipment.shipTo?.state,
            shipment.shipFrom?.company,
            shipment.shipFrom?.city,
            shipment.shipFrom?.state,
            shipment.selectedRateRef?.carrier,
            shipment.selectedRateRef?.service
        ];

        return fields.filter(Boolean).join(' ').toLowerCase();
    }

    tokenize(text) {
        return text.split(/\s+/).filter(token => token.length > 2);
    }

    search(query, shipments) {
        if (!query) return shipments;

        const queryTokens = this.tokenize(query.toLowerCase());
        const expandedTokens = this.expandWithSynonyms(queryTokens);

        const matchingIds = new Set();
        expandedTokens.forEach(token => {
            if (this.searchIndex[token]) {
                this.searchIndex[token].forEach(id => matchingIds.add(id));
            }
        });

        // Also do fuzzy matching
        const fuzzyMatches = shipments.filter(shipment => {
            const searchableText = this.extractSearchableText(shipment);
            return queryTokens.some(token => searchableText.includes(token));
        });

        fuzzyMatches.forEach(match => matchingIds.add(match.id));

        return shipments.filter(shipment => matchingIds.has(shipment.id));
    }

    expandWithSynonyms(tokens) {
        const expanded = new Set(tokens);
        tokens.forEach(token => {
            Object.entries(this.synonyms).forEach(([key, synonymList]) => {
                if (key === token || synonymList.includes(token)) {
                    expanded.add(key);
                    synonymList.forEach(syn => expanded.add(syn));
                }
            });
        });
        return Array.from(expanded);
    }
}

// Enhanced Status Chip with animations
const EnhancedStatusChip = React.memo(({ status, showAnimation = true }) => {
    const getStatusConfig = (status) => {
        const configs = {
            'draft': { color: '#64748b', bgcolor: '#f1f5f9', icon: <Assignment />, pulse: false },
            'pending': { color: '#d97706', bgcolor: '#fef3c7', icon: <Schedule />, pulse: true },
            'scheduled': { color: '#7c3aed', bgcolor: '#ede9fe', icon: <CalendarToday />, pulse: false },
            'booked': { color: '#2563eb', bgcolor: '#dbeafe', icon: <CheckCircle />, pulse: false },
            'awaiting shipment': { color: '#ea580c', bgcolor: '#fed7aa', icon: <LocalShipping />, pulse: true },
            'in transit': { color: '#7c2d92', bgcolor: '#f3e8ff', icon: <Flight />, pulse: true },
            'delivered': { color: '#16a34a', bgcolor: '#dcfce7', icon: <CheckCircle />, pulse: false },
            'cancelled': { color: '#dc2626', bgcolor: '#fee2e2', icon: <Cancel />, pulse: false }
        };

        const normalizedStatus = status?.toLowerCase() || 'unknown';
        const config = configs[normalizedStatus] || configs['draft'];

        return {
            ...config,
            label: status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'
        };
    };

    const config = getStatusConfig(status);

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={showAnimation && config.pulse ? 'pulse-animation' : ''}
        >
            <Chip
                icon={config.icon}
                label={config.label}
                sx={{
                    color: config.color,
                    bgcolor: config.bgcolor,
                    borderRadius: '16px',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: '28px',
                    '& .MuiChip-icon': {
                        fontSize: '16px',
                        color: config.color
                    }
                }}
                size="small"
            />
        </motion.div>
    );
});

// Advanced Analytics Dashboard
const AnalyticsDashboard = ({ shipments }) => {
    const stats = useMemo(() => {
        const total = shipments.length;
        const byStatus = shipments.reduce((acc, s) => {
            acc[s.status] = (acc[s.status] || 0) + 1;
            return acc;
        }, {});

        const byCarrier = shipments.reduce((acc, s) => {
            const carrier = s.carrier || 'Unknown';
            acc[carrier] = (acc[carrier] || 0) + 1;
            return acc;
        }, {});

        const avgTransitTime = shipments
            .filter(s => s.deliveredAt && s.createdAt)
            .reduce((sum, s) => {
                const transit = dayjs(s.deliveredAt).diff(dayjs(s.createdAt), 'day');
                return sum + transit;
            }, 0) / shipments.filter(s => s.deliveredAt).length || 0;

        return { total, byStatus, byCarrier, avgTransitTime };
    }, [shipments]);

    return (
        <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Total Shipments
                                </Typography>
                                <Typography variant="h4" fontWeight="bold">
                                    {stats.total}
                                </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: '#3b82f6', width: 48, height: 48 }}>
                                <Inventory />
                            </Avatar>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    In Transit
                                </Typography>
                                <Typography variant="h4" fontWeight="bold">
                                    {stats.byStatus['in transit'] || 0}
                                </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: '#8b5cf6', width: 48, height: 48 }}>
                                <LocalShipping />
                            </Avatar>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Delivered Today
                                </Typography>
                                <Typography variant="h4" fontWeight="bold">
                                    {shipments.filter(s =>
                                        s.deliveredAt && dayjs(s.deliveredAt).isSame(dayjs(), 'day')
                                    ).length}
                                </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: '#10b981', width: 48, height: 48 }}>
                                <CheckCircle />
                            </Avatar>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Avg Transit Time
                                </Typography>
                                <Typography variant="h4" fontWeight="bold">
                                    {stats.avgTransitTime.toFixed(1)} days
                                </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: '#f59e0b', width: 48, height: 48 }}>
                                <Speed />
                            </Avatar>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );
};

// Smart Filter Component
const SmartFilters = ({ filters, onFiltersChange, customers, carriers }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <Card elevation={0} sx={{ mb: 3, border: '1px solid #e2e8f0' }}>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                        <FilterAlt /> Smart Filters
                    </Typography>
                    <Switch
                        checked={expanded}
                        onChange={(e) => setExpanded(e.target.checked)}
                        size="small"
                    />
                </Box>

                <Collapse in={expanded}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Autocomplete
                                multiple
                                options={['draft', 'pending', 'in transit', 'delivered', 'cancelled']}
                                value={filters.statuses || []}
                                onChange={(e, value) => onFiltersChange({ ...filters, statuses: value })}
                                renderInput={(params) => (
                                    <TextField {...params} label="Status" size="small" />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip
                                            variant="outlined"
                                            label={option}
                                            size="small"
                                            {...getTagProps({ index })}
                                        />
                                    ))
                                }
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Autocomplete
                                multiple
                                options={carriers}
                                value={filters.carriers || []}
                                onChange={(e, value) => onFiltersChange({ ...filters, carriers: value })}
                                renderInput={(params) => (
                                    <TextField {...params} label="Carriers" size="small" />
                                )}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DateRangePicker
                                    value={filters.dateRange || [null, null]}
                                    onChange={(value) => onFiltersChange({ ...filters, dateRange: value })}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            fullWidth: true
                                        }
                                    }}
                                />
                            </LocalizationProvider>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Transit Time</InputLabel>
                                <Select
                                    value={filters.transitTime || 'all'}
                                    onChange={(e) => onFiltersChange({ ...filters, transitTime: e.target.value })}
                                    label="Transit Time"
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="1">Next Day</MenuItem>
                                    <MenuItem value="2">2 Days</MenuItem>
                                    <MenuItem value="3">3 Days</MenuItem>
                                    <MenuItem value="5">5+ Days</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <Box display="flex" gap={2} alignItems="center">
                                <Typography variant="body2" color="text.secondary">
                                    Quick Filters:
                                </Typography>
                                <Chip
                                    label="Today's Shipments"
                                    onClick={() => onFiltersChange({
                                        ...filters,
                                        dateRange: [dayjs().startOf('day'), dayjs().endOf('day')]
                                    })}
                                    icon={<Today />}
                                    variant="outlined"
                                    size="small"
                                />
                                <Chip
                                    label="Delayed"
                                    onClick={() => onFiltersChange({
                                        ...filters,
                                        delayed: true
                                    })}
                                    icon={<Warning />}
                                    variant="outlined"
                                    size="small"
                                    color="warning"
                                />
                                <Chip
                                    label="High Value"
                                    onClick={() => onFiltersChange({
                                        ...filters,
                                        value: [1000, null]
                                    })}
                                    icon={<AttachMoney />}
                                    variant="outlined"
                                    size="small"
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </Collapse>
            </CardContent>
        </Card>
    );
};

// Main Enhanced Shipments Component
const EnhancedShipments = () => {
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyLoading } = useCompany();
    const navigate = useNavigate();

    // State management
    const [shipments, setShipments] = useState([]);
    const [allShipments, setAllShipments] = useState([]);
    const [customers, setCustomers] = useState({});
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selected, setSelected] = useState([]);

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState({
        statuses: [],
        carriers: [],
        dateRange: [null, null],
        transitTime: 'all',
        delayed: false,
        value: [null, null]
    });
    const [sortConfig, setSortConfig] = useState({ field: 'createdAt', direction: 'desc' });

    // UI states
    const [viewMode, setViewMode] = useState('table'); // table, grid, timeline
    const [darkMode, setDarkMode] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(true);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [columnVisibility, setColumnVisibility] = useState({
        id: true,
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
        type: true,
        status: true,
        value: false,
        transit: true,
        tracking: false
    });

    // Initialize search engine
    const searchEngine = useRef(new SmartSearchEngine()).current;

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Build search index when shipments change
    useEffect(() => {
        searchEngine.buildIndex(allShipments);
    }, [allShipments, searchEngine]);

    // Enhanced shipment filtering
    const filteredShipments = useMemo(() => {
        let result = [...allShipments];

        // Apply smart search
        if (debouncedSearch) {
            result = searchEngine.search(debouncedSearch, result);
        }

        // Apply status filters
        if (filters.statuses.length > 0) {
            result = result.filter(s => filters.statuses.includes(s.status?.toLowerCase()));
        }

        // Apply carrier filters
        if (filters.carriers.length > 0) {
            result = result.filter(s => filters.carriers.includes(s.carrier));
        }

        // Apply date range filter
        if (filters.dateRange[0] && filters.dateRange[1]) {
            result = result.filter(s => {
                const shipmentDate = dayjs(s.createdAt);
                return shipmentDate.isAfter(filters.dateRange[0]) &&
                    shipmentDate.isBefore(filters.dateRange[1]);
            });
        }

        // Apply transit time filter
        if (filters.transitTime !== 'all') {
            result = result.filter(s => {
                const transit = s.transitDays || 0;
                switch (filters.transitTime) {
                    case '1': return transit <= 1;
                    case '2': return transit <= 2;
                    case '3': return transit <= 3;
                    case '5': return transit >= 5;
                    default: return true;
                }
            });
        }

        // Apply delayed filter
        if (filters.delayed) {
            result = result.filter(s => {
                if (!s.estimatedDelivery || s.status === 'delivered') return false;
                return dayjs().isAfter(dayjs(s.estimatedDelivery));
            });
        }

        // Apply value filter
        if (filters.value[0] || filters.value[1]) {
            result = result.filter(s => {
                const value = s.value || 0;
                const min = filters.value[0] || 0;
                const max = filters.value[1] || Infinity;
                return value >= min && value <= max;
            });
        }

        // Apply sorting
        result.sort((a, b) => {
            const aVal = a[sortConfig.field];
            const bVal = b[sortConfig.field];
            const modifier = sortConfig.direction === 'asc' ? 1 : -1;

            if (aVal < bVal) return -1 * modifier;
            if (aVal > bVal) return 1 * modifier;
            return 0;
        });

        return result;
    }, [allShipments, debouncedSearch, filters, sortConfig, searchEngine]);

    // Paginated shipments
    const paginatedShipments = useMemo(() => {
        const start = page * rowsPerPage;
        const end = start + rowsPerPage;
        return filteredShipments.slice(start, end);
    }, [filteredShipments, page, rowsPerPage]);

    // Load shipments from database
    const loadShipments = useCallback(async () => {
        if (!companyIdForAddress || companyLoading) return;

        setLoading(true);
        try {
            const shipmentsRef = collection(db, 'shipments');
            const q = query(
                shipmentsRef,
                where('companyID', '==', companyIdForAddress),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const shipmentsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
                };
            });

            setAllShipments(shipmentsData);

            // Extract unique carriers
            const uniqueCarriers = [...new Set(shipmentsData.map(s => s.carrier).filter(Boolean))];
            setCarriers(uniqueCarriers);

        } catch (error) {
            console.error('Error loading shipments:', error);
        } finally {
            setLoading(false);
        }
    }, [companyIdForAddress, companyLoading]);

    // Load customers
    const loadCustomers = useCallback(async () => {
        try {
            const customersRef = collection(db, 'customers');
            const snapshot = await getDocs(customersRef);
            const customersMap = {};
            snapshot.forEach(doc => {
                const customer = doc.data();
                customersMap[customer.customerID] = customer.name;
            });
            setCustomers(customersMap);
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }, []);

    // Initial load
    useEffect(() => {
        if (!authLoading && !companyLoading) {
            loadShipments();
            loadCustomers();
        }
    }, [authLoading, companyLoading, loadShipments, loadCustomers]);

    // Handle sort
    const handleSort = (field) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Export functionality
    const handleExport = (format) => {
        const data = selected.length > 0
            ? filteredShipments.filter(s => selected.includes(s.id))
            : filteredShipments;

        switch (format) {
            case 'csv':
                exportToCSV(data);
                break;
            case 'excel':
                exportToExcel(data);
                break;
            case 'pdf':
                exportToPDF(data);
                break;
            default:
                break;
        }
    };

    const exportToCSV = (data) => {
        // Implementation for CSV export
        console.log('Exporting to CSV:', data.length, 'shipments');
    };

    const exportToExcel = (data) => {
        // Implementation for Excel export
        console.log('Exporting to Excel:', data.length, 'shipments');
    };

    const exportToPDF = (data) => {
        // Implementation for PDF export
        console.log('Exporting to PDF:', data.length, 'shipments');
    };

    // Quick actions
    const quickActions = [
        { icon: <Add />, name: 'Create Shipment', action: () => navigate('/create-shipment') },
        { icon: <Download />, name: 'Export', action: () => setExportDialogOpen(true) },
        { icon: <Refresh />, name: 'Refresh', action: loadShipments },
        { icon: <BarChart />, name: 'Analytics', action: () => setShowAnalytics(!showAnalytics) }
    ];

    return (
        <Box className={`enhanced-shipments ${darkMode ? 'dark-mode' : ''}`}>
            {/* Header */}
            <Paper elevation={0} className="shipments-header">
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="h4" fontWeight="bold" gutterBottom>
                            Shipments
                        </Typography>
                        <Breadcrumbs separator={<NavigateNext />}>
                            <Link to="/" className="breadcrumb-link">
                                <Home sx={{ mr: 0.5 }} fontSize="small" />
                                Home
                            </Link>
                            <Typography color="text.primary">Shipments</Typography>
                        </Breadcrumbs>
                    </Box>

                    <Box display="flex" gap={2} alignItems="center">
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(e, mode) => mode && setViewMode(mode)}
                            size="small"
                        >
                            <ToggleButton value="table">
                                <ViewList />
                            </ToggleButton>
                            <ToggleButton value="grid">
                                <ViewModule />
                            </ToggleButton>
                            <ToggleButton value="timeline">
                                <Timeline />
                            </ToggleButton>
                        </ToggleButtonGroup>

                        <IconButton onClick={() => setDarkMode(!darkMode)}>
                            {darkMode ? <LightMode /> : <DarkMode />}
                        </IconButton>

                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => navigate('/create-shipment')}
                            className="create-shipment-btn"
                        >
                            Create Shipment
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* Analytics Dashboard */}
            <Collapse in={showAnalytics}>
                <AnalyticsDashboard shipments={allShipments} />
            </Collapse>

            {/* Smart Search Bar */}
            <Paper elevation={0} className="smart-search-bar">
                <Box display="flex" gap={2} alignItems="center">
                    <TextField
                        fullWidth
                        placeholder="Search by ID, customer, location, carrier, or any keyword..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery && (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setSearchQuery('')} size="small">
                                        <Clear />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                        className="search-input"
                    />

                    <Chip
                        icon={<AutoAwesome />}
                        label="AI Search"
                        color="primary"
                        variant="outlined"
                    />
                </Box>

                {/* Search suggestions */}
                {searchQuery && (
                    <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                        <Typography variant="caption" color="text.secondary">
                            Suggestions:
                        </Typography>
                        {['delivered today', 'fedex shipments', 'high priority', 'delayed'].map(suggestion => (
                            <Chip
                                key={suggestion}
                                label={suggestion}
                                size="small"
                                onClick={() => setSearchQuery(suggestion)}
                                className="suggestion-chip"
                            />
                        ))}
                    </Box>
                )}
            </Paper>

            {/* Smart Filters */}
            <SmartFilters
                filters={filters}
                onFiltersChange={setFilters}
                customers={Object.values(customers)}
                carriers={carriers}
            />

            {/* Results Summary */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                    Showing {paginatedShipments.length} of {filteredShipments.length} shipments
                    {selected.length > 0 && ` (${selected.length} selected)`}
                </Typography>

                <Box display="flex" gap={1}>
                    {selected.length > 0 && (
                        <>
                            <Button size="small" startIcon={<Label />}>
                                Print Labels
                            </Button>
                            <Button size="small" startIcon={<Download />}>
                                Export Selected
                            </Button>
                            <Button size="small" startIcon={<Share />}>
                                Share
                            </Button>
                        </>
                    )}
                </Box>
            </Box>

            {/* Main Content Area */}
            {loading ? (
                <ShipmentsLoadingSkeleton />
            ) : (
                <AnimatePresence mode="wait">
                    {viewMode === 'table' && (
                        <ShipmentsTable
                            shipments={paginatedShipments}
                            selected={selected}
                            onSelect={setSelected}
                            columnVisibility={columnVisibility}
                            onColumnVisibilityChange={setColumnVisibility}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            customers={customers}
                        />
                    )}

                    {viewMode === 'grid' && (
                        <ShipmentsGrid
                            shipments={paginatedShipments}
                            selected={selected}
                            onSelect={setSelected}
                            customers={customers}
                        />
                    )}

                    {viewMode === 'timeline' && (
                        <ShipmentsTimeline
                            shipments={paginatedShipments}
                            customers={customers}
                        />
                    )}
                </AnimatePresence>
            )}

            {/* Pagination */}
            <TablePagination
                component="div"
                count={filteredShipments.length}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100, { label: 'All', value: -1 }]}
                className="enhanced-pagination"
            />

            {/* Speed Dial for Quick Actions */}
            <SpeedDial
                ariaLabel="Quick actions"
                sx={{ position: 'fixed', bottom: 16, right: 16 }}
                icon={<SpeedDialIcon />}
            >
                {quickActions.map(action => (
                    <SpeedDialAction
                        key={action.name}
                        icon={action.icon}
                        tooltipTitle={action.name}
                        onClick={action.action}
                    />
                ))}
            </SpeedDial>
        </Box>
    );
};

// Table View Component
const ShipmentsTable = ({ shipments, selected, onSelect, columnVisibility, onColumnVisibilityChange, sortConfig, onSort, customers }) => {
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            onSelect(shipments.map(s => s.id));
        } else {
            onSelect([]);
        }
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
                selected.slice(selectedIndex + 1)
            );
        }

        onSelect(newSelected);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
        >
            <Paper elevation={0} className="enhanced-table-container">
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

                                {columnVisibility.id && (
                                    <TableCell>
                                        <TableSortLabel
                                            active={sortConfig.field === 'id'}
                                            direction={sortConfig.direction}
                                            onClick={() => onSort('id')}
                                        >
                                            Shipment ID
                                        </TableSortLabel>
                                    </TableCell>
                                )}

                                {columnVisibility.customer && (
                                    <TableCell>Customer</TableCell>
                                )}

                                {columnVisibility.origin && (
                                    <TableCell>Origin</TableCell>
                                )}

                                {columnVisibility.destination && (
                                    <TableCell>Destination</TableCell>
                                )}

                                {columnVisibility.carrier && (
                                    <TableCell>Carrier</TableCell>
                                )}

                                {columnVisibility.status && (
                                    <TableCell>Status</TableCell>
                                )}

                                {columnVisibility.transit && (
                                    <TableCell>
                                        <TableSortLabel
                                            active={sortConfig.field === 'createdAt'}
                                            direction={sortConfig.direction}
                                            onClick={() => onSort('createdAt')}
                                        >
                                            Ship Date
                                        </TableSortLabel>
                                    </TableCell>
                                )}

                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {shipments.map((shipment) => (
                                <TableRow
                                    key={shipment.id}
                                    hover
                                    selected={selected.includes(shipment.id)}
                                    className="enhanced-table-row"
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selected.includes(shipment.id)}
                                            onChange={() => handleSelect(shipment.id)}
                                        />
                                    </TableCell>

                                    {columnVisibility.id && (
                                        <TableCell>
                                            <Link
                                                to={`/shipment/${shipment.shipmentID || shipment.id}`}
                                                className="shipment-link"
                                            >
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <QrCode fontSize="small" />
                                                    {shipment.shipmentID || shipment.id}
                                                </Box>
                                            </Link>
                                        </TableCell>
                                    )}

                                    {columnVisibility.customer && (
                                        <TableCell>
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Avatar sx={{ width: 32, height: 32 }}>
                                                    {(customers[shipment.shipTo?.customerID] || shipment.shipTo?.company || 'U')[0]}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2">
                                                        {customers[shipment.shipTo?.customerID] || shipment.shipTo?.company || 'N/A'}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {shipment.shipTo?.customerID}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                    )}

                                    {columnVisibility.origin && (
                                        <TableCell>
                                            <LocationDisplay location={shipment.shipFrom} />
                                        </TableCell>
                                    )}

                                    {columnVisibility.destination && (
                                        <TableCell>
                                            <LocationDisplay location={shipment.shipTo} />
                                        </TableCell>
                                    )}

                                    {columnVisibility.carrier && (
                                        <TableCell>
                                            <CarrierDisplay carrier={shipment.carrier || shipment.selectedRateRef?.carrier} />
                                        </TableCell>
                                    )}

                                    {columnVisibility.status && (
                                        <TableCell>
                                            <EnhancedStatusChip status={shipment.status} />
                                        </TableCell>
                                    )}

                                    {columnVisibility.transit && (
                                        <TableCell>
                                            <Typography variant="body2">
                                                {dayjs(shipment.createdAt).format('MMM D, YYYY')}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {dayjs(shipment.createdAt).fromNow()}
                                            </Typography>
                                        </TableCell>
                                    )}

                                    <TableCell align="right">
                                        <ShipmentActions shipment={shipment} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </motion.div>
    );
};

// Helper Components
const LocationDisplay = ({ location }) => {
    if (!location) return <Typography variant="body2" color="text.secondary">N/A</Typography>;

    return (
        <Box>
            <Box display="flex" alignItems="center" gap={0.5}>
                <LocationOn fontSize="small" color="action" />
                <Typography variant="body2">
                    {location.city}, {location.state}
                </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
                {location.postalCode}
            </Typography>
        </Box>
    );
};

const CarrierDisplay = ({ carrier }) => {
    const getCarrierLogo = (carrierName) => {
        // Map carrier names to logo URLs
        const logos = {
            'fedex': '/images/carriers/fedex.png',
            'ups': '/images/carriers/ups.png',
            'usps': '/images/carriers/usps.png',
            'dhl': '/images/carriers/dhl.png'
        };

        return logos[carrierName?.toLowerCase()] || null;
    };

    const logo = getCarrierLogo(carrier);

    return (
        <Box display="flex" alignItems="center" gap={1}>
            {logo ? (
                <img src={logo} alt={carrier} style={{ height: 24, width: 'auto' }} />
            ) : (
                <LocalShipping fontSize="small" color="action" />
            )}
            <Typography variant="body2">{carrier || 'N/A'}</Typography>
        </Box>
    );
};

const ShipmentActions = ({ shipment }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const navigate = useNavigate();

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const actions = [
        {
            label: 'View Details',
            icon: <Visibility />,
            action: () => navigate(`/shipment/${shipment.shipmentID || shipment.id}`)
        },
        {
            label: 'Track Shipment',
            icon: <Timeline />,
            action: () => console.log('Track:', shipment.id)
        },
        {
            label: 'Print Label',
            icon: <Print />,
            action: () => console.log('Print:', shipment.id),
            disabled: shipment.status === 'draft'
        },
        {
            label: 'Copy Tracking',
            icon: <ContentCopy />,
            action: () => {
                navigator.clipboard.writeText(shipment.trackingNumber || '');
                console.log('Copied tracking number');
            },
            disabled: !shipment.trackingNumber
        }
    ];

    return (
        <>
            <IconButton size="small" onClick={handleClick}>
                <MoreVert />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                {actions.map((action) => (
                    <MenuItem
                        key={action.label}
                        onClick={() => {
                            action.action();
                            handleClose();
                        }}
                        disabled={action.disabled}
                    >
                        <ListItemIcon>{action.icon}</ListItemIcon>
                        <ListItemText>{action.label}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

const ShipmentsLoadingSkeleton = () => (
    <Paper elevation={0}>
        <TableContainer>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell><Skeleton /></TableCell>
                        <TableCell><Skeleton /></TableCell>
                        <TableCell><Skeleton /></TableCell>
                        <TableCell><Skeleton /></TableCell>
                        <TableCell><Skeleton /></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton /></TableCell>
                            <TableCell><Skeleton /></TableCell>
                            <TableCell><Skeleton /></TableCell>
                            <TableCell><Skeleton /></TableCell>
                            <TableCell><Skeleton /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Paper>
);

// Placeholder components for Grid and Timeline views
const ShipmentsGrid = ({ shipments, selected, onSelect, customers }) => (
    <Grid container spacing={2}>
        {shipments.map(shipment => (
            <Grid item xs={12} sm={6} md={4} key={shipment.id}>
                <Card>
                    <CardContent>
                        <Typography variant="h6">{shipment.shipmentID}</Typography>
                        <EnhancedStatusChip status={shipment.status} />
                    </CardContent>
                </Card>
            </Grid>
        ))}
    </Grid>
);

const ShipmentsTimeline = ({ shipments, customers }) => (
    <Box>
        <Typography>Timeline view coming soon...</Typography>
    </Box>
);

export default EnhancedShipments; 