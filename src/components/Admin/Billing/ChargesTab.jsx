import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Tooltip,
    Avatar,
    Autocomplete,
    TextField,
    InputAdornment,
    Stack,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Badge,
    Skeleton,
    Divider,
    Collapse,
    Alert
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    Download as DownloadIcon,
    Clear as ClearIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Close as CloseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    KeyboardArrowDown as ArrowDownwardIcon,
    KeyboardArrowUp as ArrowUpwardIcon,
    CalendarToday as CalendarIcon,
    Assessment as AnalyticsIcon,
    TrendingUp as TrendingUpIcon,
    Money as MoneyIcon,
    Receipt as ReceiptIcon,
    Category as CategoryIcon,
    LocalShipping as ShippingIcon,
    Add as AddIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    LocationOn as LocationIcon,
    OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';

const ChargesTab = () => {
    const { currentUser, userRole } = useAuth();

    // States
    const [loading, setLoading] = useState(false);
    const [charges, setCharges] = useState([]);
    const [error, setError] = useState('');

    // Filter states
    const [filters, setFilters] = useState({
        companyId: 'all',
        customerId: 'all',
        searchValue: '',
        status: 'all',
        dateRange: 'all',
        startDate: null,
        endDate: null
    });

    // Company and customer data
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [connectedCompanies, setConnectedCompanies] = useState([]);

    // Autocomplete states
    const [liveResults, setLiveResults] = useState([]);
    const [showLiveResults, setShowLiveResults] = useState(false);

    // Table states
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [sortField, setSortField] = useState('shipmentDate');
    const [sortDirection, setSortDirection] = useState('desc');

    // Expanded rows state
    const [expandedRows, setExpandedRows] = useState(new Set());

    // Shipment detail modal states
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [shipmentDetailsOpen, setShipmentDetailsOpen] = useState(false);

    // Load available companies based on user role
    const loadAvailableCompanies = useCallback(async () => {
        if (!currentUser) return;

        try {
            let companies = [];

            if (userRole === 'superadmin') {
                // Super admin sees all companies
                const companiesSnapshot = await getDocs(collection(db, 'companies'));
                companies = companiesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else if (userRole === 'admin') {
                // Regular admin sees connected companies
                const usersQuery = query(
                    collection(db, 'users'),
                    where('uid', '==', currentUser.uid)
                );
                const userSnapshot = await getDocs(usersQuery);

                if (!userSnapshot.empty) {
                    const userData = userSnapshot.docs[0].data();
                    const connectedCompanyIds = userData.connectedCompanies?.companies || [];
                    setConnectedCompanies(connectedCompanyIds);

                    if (connectedCompanyIds.length > 0) {
                        // Fetch company details in batches (Firestore 'in' limit is 10)
                        const batches = [];
                        for (let i = 0; i < connectedCompanyIds.length; i += 10) {
                            const batch = connectedCompanyIds.slice(i, i + 10);
                            const companiesQuery = query(
                                collection(db, 'companies'),
                                where('companyID', 'in', batch)
                            );
                            batches.push(getDocs(companiesQuery));
                        }

                        const results = await Promise.all(batches);
                        results.forEach(snapshot => {
                            snapshot.docs.forEach(doc => {
                                companies.push({ id: doc.id, ...doc.data() });
                            });
                        });
                    }
                }
            }

            companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAvailableCompanies(companies);

        } catch (error) {
            console.error('Error loading companies:', error);
            setError('Failed to load companies: ' + error.message);
        }
    }, [currentUser, userRole]);

    // Load customers for selected company
    const loadCustomersForCompany = useCallback(async (companyId) => {
        if (!companyId || companyId === 'all') {
            setAvailableCustomers([]);
            return;
        }

        setLoadingCustomers(true);
        try {
            // Get the selected company data to get the correct companyID format
            const selectedCompany = availableCompanies.find(c => c.companyID === companyId);
            const actualCompanyId = selectedCompany?.companyID || companyId;

            console.log('🔍 Loading customers for company:', companyId, 'actualCompanyId:', actualCompanyId);

            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', actualCompanyId) // Use companyID with capital ID
            );

            const customersSnapshot = await getDocs(customersQuery);
            const customers = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('👥 Found customers for company', actualCompanyId + ':', customers.length);
            customers.forEach(customer => {
                console.log('  - Customer:', customer.customerID, customer.name);
            });

            customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAvailableCustomers(customers);

        } catch (error) {
            console.error('Error loading customers:', error);
            setAvailableCustomers([]);
        } finally {
            setLoadingCustomers(false);
        }
    }, [availableCompanies]);

    // Generate live search results
    const generateLiveShipmentResults = useCallback(() => {
        if (!filters.searchValue.trim() || filters.searchValue.length < 2) {
            setLiveResults([]);
            setShowLiveResults(false);
            return;
        }

        const searchTerm = filters.searchValue.toLowerCase();
        const results = charges
            .filter(charge => {
                const searchableFields = [
                    charge.shipmentID,
                    charge.companyName,
                    charge.customerName,
                    charge.route
                ];
                return searchableFields.some(field =>
                    field && String(field).toLowerCase().includes(searchTerm)
                );
            })
            .slice(0, 10)
            .map(charge => ({
                id: charge.id,
                shipmentID: charge.shipmentID,
                companyName: charge.companyName,
                customerName: charge.customerName,
                route: charge.route
            }));

        setLiveResults(results);
        setShowLiveResults(results.length > 0);
    }, [filters.searchValue, charges]);

    // Load charges data
    const fetchBillingData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            let shipmentsToProcess = [];
            let companyIDs = [];

            // Load companies data for mapping
            const companiesMap = new Map();
            availableCompanies.forEach(company => {
                companiesMap.set(company.companyID, company);
            });

            // Determine which companies to fetch based on user role
            if (userRole === 'superadmin') {
                // Super admin: fetch ALL shipments
                const shipmentsQuery = query(
                    collection(db, 'shipments'),
                    where('status', '!=', 'draft')
                );
                const shipmentsSnapshot = await getDocs(shipmentsQuery);
                shipmentsToProcess = shipmentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Load all companies for super admin
                if (companiesMap.size === 0) {
                    const allCompaniesSnapshot = await getDocs(collection(db, 'companies'));
                    allCompaniesSnapshot.docs.forEach(doc => {
                        const companyData = { id: doc.id, ...doc.data() };
                        companiesMap.set(companyData.companyID, companyData);
                    });
                }
            } else if (userRole === 'admin') {
                // Regular admin: fetch only connected companies' shipments
                companyIDs = connectedCompanies;

                if (companyIDs.length > 0) {
                    // Batch queries for connected companies
                    const batches = [];
                    for (let i = 0; i < companyIDs.length; i += 10) {
                        const batch = companyIDs.slice(i, i + 10);
                        const shipmentsQuery = query(
                            collection(db, 'shipments'),
                            where('companyID', 'in', batch),
                            where('status', '!=', 'draft')
                        );
                        batches.push(getDocs(shipmentsQuery));
                    }

                    const results = await Promise.all(batches);
                    results.forEach(snapshot => {
                        snapshot.docs.forEach(doc => {
                            shipmentsToProcess.push({ id: doc.id, ...doc.data() });
                        });
                    });
                } else {
                    shipmentsToProcess = [];
                }
            }

            console.log(`🚛 Processing ${shipmentsToProcess.length} shipments for charges`);

            // Process shipments to extract charge data
            const shipmentCharges = [];

            for (const shipment of shipmentsToProcess) {
                try {
                    // Get company data
                    const company = companiesMap.get(shipment.companyID);

                    // Get customer data - Enhanced customer loading
                    let customerData = null;
                    const customerId = shipment.customerId || shipment.customerID || shipment.customer?.id;

                    if (customerId) {
                        try {
                            // Try direct document lookup first
                            const customerDocRef = doc(db, 'customers', customerId);
                            const customerDoc = await getDoc(customerDocRef);

                            if (customerDoc.exists()) {
                                customerData = { id: customerDoc.id, ...customerDoc.data() };
                            } else {
                                // Try customerID field lookup
                                const customerQuery = query(
                                    collection(db, 'customers'),
                                    where('customerID', '==', customerId),
                                    limit(1)
                                );
                                const customerSnapshot = await getDocs(customerQuery);

                                if (!customerSnapshot.empty) {
                                    const customerDocFromQuery = customerSnapshot.docs[0];
                                    customerData = { id: customerDocFromQuery.id, ...customerDocFromQuery.data() };
                                }
                            }
                        } catch (error) {
                            console.error('Error loading customer data:', error);
                        }
                    }

                    // Calculate costs and charges
                    const dualRateSystem = shipment.actualRates && shipment.markupRates;
                    let actualCost = 0;
                    let customerCharge = 0;

                    if (dualRateSystem) {
                        actualCost = shipment.actualRates.totalCharges || 0;
                        customerCharge = shipment.markupRates.totalCharges || 0;
                    } else if (shipment.manualRates && Array.isArray(shipment.manualRates)) {
                        customerCharge = shipment.manualRates.reduce((sum, rate) => sum + (parseFloat(rate.cost) || 0), 0);
                        actualCost = customerCharge * 0.85; // Assume 15% markup for manual rates
                    } else if (shipment.selectedRate?.pricing) {
                        customerCharge = shipment.selectedRate.pricing.totalCharges || 0;
                        actualCost = customerCharge * 0.85;
                    }

                    // Skip if no meaningful charge data
                    if (actualCost === 0 && customerCharge === 0) continue;

                    // Get currency
                    const currency = getShipmentCurrency(shipment);

                    // Create route string
                    const route = formatRoute(shipment.shipFrom, shipment.shipTo);

                    // Create charge record
                    const chargeRecord = {
                        id: shipment.id,
                        shipmentID: shipment.shipmentID,
                        companyID: shipment.companyID,
                        companyName: company?.name || shipment.companyName || shipment.companyID,
                        company: company,
                        // Enhanced customer data
                        customerId: customerId,
                        customerName: customerData?.name || customerData?.companyName ||
                            shipment.shipTo?.companyName || shipment.shipTo?.company || 'N/A',
                        customerData: customerData,
                        actualCost: actualCost,
                        customerCharge: customerCharge,
                        margin: customerCharge - actualCost,
                        marginPercent: customerCharge > 0 ? ((customerCharge - actualCost) / customerCharge) * 100 : 0,
                        currency: currency,
                        actualRates: shipment.actualRates,
                        markupRates: shipment.markupRates,
                        manualRates: shipment.manualRates,
                        selectedRate: shipment.selectedRate,
                        route: route,
                        carrier: getCarrierName(shipment),
                        status: getChargeStatus(shipment),
                        shipmentDate: shipment.bookedAt?.toDate?.() || shipment.createdAt?.toDate?.() || new Date(),
                        isQuickShip: shipment.creationMethod === 'quickship',
                        // Store full shipment data for expanded view
                        shipmentData: shipment
                    };

                    shipmentCharges.push(chargeRecord);

                } catch (error) {
                    console.error('Error processing shipment:', shipment.id, error);
                }
            }

            console.log(`💰 Generated ${shipmentCharges.length} charge records`);
            setCharges(shipmentCharges);

        } catch (error) {
            console.error('Error fetching billing data:', error);
            setError('Failed to load billing data: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser, userRole, connectedCompanies, availableCompanies]);

    // Enhanced currency detection
    const getShipmentCurrency = (shipment) => {
        // Priority order for currency detection
        const currencySources = [
            shipment.actualRates?.currency,
            shipment.markupRates?.currency,
            shipment.selectedRate?.pricing?.currency,
            shipment.selectedRate?.currency,
            shipment.manualRates?.[0]?.currency,
            shipment.currency,
            'CAD' // Default fallback
        ];

        for (const currency of currencySources) {
            if (currency && typeof currency === 'string') {
                return currency.toUpperCase();
            }
        }

        return 'CAD';
    };

    // Get carrier name
    const getCarrierName = (shipment) => {
        return shipment.selectedRate?.carrier?.name ||
            shipment.selectedCarrier?.name ||
            shipment.carrier ||
            shipment.selectedRate?.service?.carrier ||
            'Unknown';
    };

    // Get charge status
    const getChargeStatus = (shipment) => {
        if (shipment.invoiceStatus === 'paid') return 'paid';
        if (shipment.invoiceStatus === 'invoiced') return 'invoiced';
        return 'uninvoiced';
    };

    // Format route helper
    const formatRoute = (from, to) => {
        if (!from || !to) return 'N/A';

        const fromCity = from.city || 'N/A';
        const fromState = from.state || from.province || '';
        const toCity = to.city || 'N/A';
        const toState = to.state || to.province || '';

        const fromLocation = fromState ? `${fromCity}, ${fromState}` : fromCity;
        const toLocation = toState ? `${toCity}, ${toState}` : toLocation;

        return `${fromLocation} → ${toLocation}`;
    };

    // Format currency helper with currency display
    const formatCurrency = (amount, currency = 'CAD') => {
        const formatted = new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: currency
        }).format(amount);

        // Check if currency symbol is already included in the formatted string
        const currencyCode = currency.toUpperCase();
        if (formatted.includes(currencyCode) || (currencyCode === 'USD' && formatted.includes('US$'))) {
            return formatted; // Don't duplicate if already present
        }

        return `${formatted} ${currencyCode}`;
    };

    // Apply filters
    const applyFilters = useCallback(() => {
        let filtered = [...charges];

        // Company filter
        if (filters.companyId && filters.companyId !== 'all') {
            filtered = filtered.filter(charge => charge.companyID === filters.companyId);
        }

        // Customer filter (requires company to be selected first)
        if (filters.customerId && filters.customerId !== 'all' && filters.companyId !== 'all') {
            // Find the selected customer to get their customerID
            const selectedCustomer = availableCustomers.find(c => c.id === filters.customerId);
            if (selectedCustomer) {
                filtered = filtered.filter(charge =>
                    charge.customerId === selectedCustomer.customerID ||
                    charge.customerId === selectedCustomer.id ||
                    charge.customerId === filters.customerId ||
                    // Also check if customerName matches
                    charge.customerName === selectedCustomer.name
                );
            }
        }

        // Search filter - comprehensive search across multiple fields
        if (filters.searchValue && filters.searchValue.trim()) {
            const searchTerm = filters.searchValue.toLowerCase().trim();
            filtered = filtered.filter(charge => {
                const searchableFields = [
                    charge.shipmentID,
                    charge.companyName,
                    charge.companyID,
                    charge.customerName,
                    charge.referenceNumber,
                    charge.trackingNumber,
                    charge.carrier,
                    charge.route
                ];

                return searchableFields.some(field =>
                    field && String(field).toLowerCase().includes(searchTerm)
                );
            });
        }

        // Status filter
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(charge => charge.status === filters.status);
        }

        // Date range filter
        if (filters.dateRange !== 'all' || filters.startDate || filters.endDate) {
            const now = new Date();
            let startDate, endDate;

            if (filters.startDate || filters.endDate) {
                // Custom date range
                startDate = filters.startDate;
                endDate = filters.endDate;
            } else {
                // Predefined ranges
                switch (filters.dateRange) {
                    case 'today':
                        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                        break;
                    case 'week':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        endDate = now;
                        break;
                    case 'month':
                        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                        endDate = now;
                        break;
                    case 'quarter':
                        const quarter = Math.floor(now.getMonth() / 3);
                        startDate = new Date(now.getFullYear(), quarter * 3, 1);
                        endDate = now;
                        break;
                    case 'year':
                        startDate = new Date(now.getFullYear(), 0, 1);
                        endDate = now;
                        break;
                    default:
                        break;
                }
            }

            if (startDate || endDate) {
                filtered = filtered.filter(charge => {
                    const chargeDate = charge.shipmentDate;
                    if (startDate && chargeDate < startDate) return false;
                    if (endDate && chargeDate > endDate) return false;
                    return true;
                });
            }
        }

        return filtered;
    }, [charges, filters, availableCustomers]);

    // Get filtered and sorted charges
    const filteredCharges = React.useMemo(() => {
        const filtered = applyFilters();

        // Apply sorting
        return filtered.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle date sorting
            if (sortField === 'shipmentDate') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            }

            // Handle numeric sorting
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Handle string sorting
            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();

            if (sortDirection === 'asc') {
                return aStr.localeCompare(bStr);
            } else {
                return bStr.localeCompare(aStr);
            }
        });
    }, [applyFilters, sortField, sortDirection]);

    // Handle sorting
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Handle row expansion
    const handleRowExpand = (chargeId) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(chargeId)) {
            newExpanded.delete(chargeId);
        } else {
            newExpanded.add(chargeId);
        }
        setExpandedRows(newExpanded);
    };

    // Effects
    useEffect(() => {
        loadAvailableCompanies();
    }, [loadAvailableCompanies]);

    useEffect(() => {
        if (availableCompanies.length > 0) {
            fetchBillingData();
        }
    }, [fetchBillingData, availableCompanies]);

    useEffect(() => {
        loadCustomersForCompany(filters.companyId);
    }, [filters.companyId, loadCustomersForCompany]);

    useEffect(() => {
        generateLiveShipmentResults();
    }, [generateLiveShipmentResults]);

    // Handle filter changes
    const handleCompanyChange = (event) => {
        const companyId = event.target.value;
        setFilters(prev => ({
            ...prev,
            companyId,
            customerId: 'all' // Reset customer when company changes
        }));
    };

    const handleCustomerChange = (event) => {
        setFilters(prev => ({
            ...prev,
            customerId: event.target.value
        }));
    };

    const handleSearchChange = (value) => {
        setFilters(prev => ({
            ...prev,
            searchValue: value
        }));
    };

    const handleDateRangeChange = (event) => {
        const value = event.target.value;
        setFilters(prev => ({
            ...prev,
            dateRange: value,
            // Clear custom dates when selecting predefined range
            ...(value !== 'custom' && { startDate: null, endDate: null })
        }));
    };

    if (loading && charges.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading charges...</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2, fontSize: '12px' }}>
                {error}
            </Alert>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ p: 3 }}>
                {/* Header */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#111827', mb: 0.5 }}>
                        Charges
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                        Real-time shipment charges with advanced filtering
                    </Typography>
                </Box>

                {/* Filters */}
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        {/* Company Filter */}
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiSelect-select': { fontSize: '12px' }
                                }}
                            >
                                <InputLabel>Company</InputLabel>
                                <Select
                                    value={filters.companyId}
                                    onChange={handleCompanyChange}
                                    label="Company"
                                >
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <BusinessIcon sx={{ fontSize: 16, color: '#1976d2' }} />
                                            All Companies
                                        </Box>
                                    </MenuItem>
                                    {availableCompanies.map(company => (
                                        <MenuItem key={company.companyID} value={company.companyID} sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                <Avatar
                                                    src={company.logoURL || company.logo || company.logoUrl}
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        bgcolor: '#f3f4f6',
                                                        fontSize: '10px'
                                                    }}
                                                >
                                                    {company.name ? company.name.charAt(0).toUpperCase() : '?'}
                                                </Avatar>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {company.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {company.companyID}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Customer Filter */}
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl
                                fullWidth
                                size="small"
                                disabled={filters.companyId === 'all' || loadingCustomers}
                                sx={{
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiSelect-select': { fontSize: '12px' }
                                }}
                            >
                                <InputLabel>Customer</InputLabel>
                                <Select
                                    value={filters.customerId}
                                    onChange={handleCustomerChange}
                                    label="Customer"
                                >
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <PersonIcon sx={{ fontSize: 16, color: '#059669' }} />
                                            All Customers
                                        </Box>
                                    </MenuItem>
                                    {availableCustomers.map(customer => (
                                        <MenuItem key={customer.id} value={customer.id} sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                <Avatar
                                                    src={customer.logoURL || customer.logo || customer.logoUrl}
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        bgcolor: '#f3f4f6',
                                                        fontSize: '10px'
                                                    }}
                                                >
                                                    {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                                                </Avatar>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {customer.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {customer.customerID}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Date Range Filter */}
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiSelect-select': { fontSize: '12px' }
                                }}
                            >
                                <InputLabel>Date Range</InputLabel>
                                <Select
                                    value={filters.dateRange}
                                    onChange={handleDateRangeChange}
                                    label="Date Range"
                                >
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>All Time</MenuItem>
                                    <MenuItem value="today" sx={{ fontSize: '12px' }}>Today</MenuItem>
                                    <MenuItem value="week" sx={{ fontSize: '12px' }}>Last 7 Days</MenuItem>
                                    <MenuItem value="month" sx={{ fontSize: '12px' }}>This Month</MenuItem>
                                    <MenuItem value="quarter" sx={{ fontSize: '12px' }}>This Quarter</MenuItem>
                                    <MenuItem value="year" sx={{ fontSize: '12px' }}>This Year</MenuItem>
                                    <MenuItem value="custom" sx={{ fontSize: '12px' }}>Custom Range</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* From Date (Custom Range) */}
                        {filters.dateRange === 'custom' && (
                            <Grid item xs={12} sm={6} md={2}>
                                <DatePicker
                                    label="From Date"
                                    value={filters.startDate}
                                    onChange={(newValue) => setFilters(prev => ({ ...prev, startDate: newValue }))}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            fullWidth: true,
                                            sx: {
                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                '& .MuiInputBase-input': { fontSize: '12px' }
                                            }
                                        }
                                    }}
                                />
                            </Grid>
                        )}

                        {/* To Date (Custom Range) */}
                        {filters.dateRange === 'custom' && (
                            <Grid item xs={12} sm={6} md={2}>
                                <DatePicker
                                    label="To Date"
                                    value={filters.endDate}
                                    onChange={(newValue) => setFilters(prev => ({ ...prev, endDate: newValue }))}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            fullWidth: true,
                                            sx: {
                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                '& .MuiInputBase-input': { fontSize: '12px' }
                                            }
                                        }
                                    }}
                                />
                            </Grid>
                        )}

                        {/* Search */}
                        <Grid item xs={12} sm={6} md={filters.dateRange === 'custom' ? 12 : 4}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search shipments, companies, customers..."
                                value={filters.searchValue}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: '#6b7280', fontSize: '18px' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: filters.searchValue && (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleSearchChange('')}
                                                edge="end"
                                            >
                                                <ClearIcon sx={{ fontSize: '16px' }} />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Grid>
                    </Grid>
                </Paper>

                {/* Results Summary */}
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Showing {filteredCharges.length} of {charges.length} charges
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        sx={{ fontSize: '12px' }}
                        onClick={() => {
                            // TODO: Export functionality
                            console.log('Export charges');
                        }}
                    >
                        Export
                    </Button>
                </Box>

                {/* Charges Table */}
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell
                                        sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                                        onClick={() => handleSort('shipmentID')}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            Shipment ID
                                            {sortField === 'shipmentID' && (
                                                sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: '14px' }} /> : <ArrowDownIcon sx={{ fontSize: '14px' }} />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell
                                        sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                                        onClick={() => handleSort('shipmentDate')}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            Date
                                            {sortField === 'shipmentDate' && (
                                                sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: '14px' }} /> : <ArrowDownIcon sx={{ fontSize: '14px' }} />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Company</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Customer</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Route</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Carrier</TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                                        onClick={() => handleSort('actualCost')}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                            Cost
                                            {sortField === 'actualCost' && (
                                                sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: '14px' }} /> : <ArrowDownIcon sx={{ fontSize: '14px' }} />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                                        onClick={() => handleSort('customerCharge')}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                            Charge
                                            {sortField === 'customerCharge' && (
                                                sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: '14px' }} /> : <ArrowDownIcon sx={{ fontSize: '14px' }} />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                                        onClick={() => handleSort('margin')}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                            Margin
                                            {sortField === 'margin' && (
                                                sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: '14px' }} /> : <ArrowDownIcon sx={{ fontSize: '14px' }} />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: 50 }}>
                                        {/* Expand column */}
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredCharges
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((charge) => (
                                        <React.Fragment key={charge.id}>
                                            <TableRow
                                                hover
                                                sx={{
                                                    '&:hover': { backgroundColor: '#f9fafb' }
                                                }}
                                            >
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            color: '#1976d2',
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                textDecoration: 'underline'
                                                            }
                                                        }}
                                                        onClick={() => handleRowExpand(charge.id)}
                                                    >
                                                        {charge.shipmentID}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    {charge.shipmentDate ? charge.shipmentDate.toLocaleDateString() : 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                        <Avatar
                                                            src={charge.company?.logoURL || charge.company?.logo || charge.company?.logoUrl}
                                                            sx={{
                                                                width: 20,
                                                                height: 20,
                                                                fontSize: '10px',
                                                                bgcolor: charge.company?.logoURL || charge.company?.logo || charge.company?.logoUrl ? 'transparent' : '#f3f4f6',
                                                                color: '#374151',
                                                                mt: 0.1
                                                            }}
                                                        >
                                                            {(!charge.company?.logoURL && !charge.company?.logo && !charge.company?.logoUrl) &&
                                                                (charge.companyName ? charge.companyName.charAt(0).toUpperCase() : '?')}
                                                        </Avatar>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {charge.companyName}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                        <Avatar
                                                            src={charge.customerData?.logoURL || charge.customerData?.logo || charge.customerData?.logoUrl || charge.customerData?.companyLogo}
                                                            sx={{
                                                                width: 20,
                                                                height: 20,
                                                                fontSize: '10px',
                                                                bgcolor: charge.customerData?.logoURL || charge.customerData?.logo || charge.customerData?.logoUrl || charge.customerData?.companyLogo ? 'transparent' : '#f3f4f6',
                                                                color: '#374151',
                                                                mt: 0.1
                                                            }}
                                                        >
                                                            {(!charge.customerData?.logoURL && !charge.customerData?.logo && !charge.customerData?.logoUrl && !charge.customerData?.companyLogo) &&
                                                                (charge.customerName && charge.customerName !== 'N/A' ?
                                                                    charge.customerName.charAt(0).toUpperCase() : 'C')}
                                                        </Avatar>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {charge.customerName}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Box>
                                                        <Typography sx={{ fontSize: '11px', lineHeight: 1.2 }}>
                                                            {charge.route}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    {charge.carrier}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Typography sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                        {formatCurrency(charge.actualCost, charge.currency)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {formatCurrency(charge.customerCharge, charge.currency)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Box>
                                                        <Typography
                                                            sx={{
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                color: charge.margin >= 0 ? '#059669' : '#dc2626'
                                                            }}
                                                        >
                                                            {formatCurrency(charge.margin, charge.currency)}
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                fontSize: '10px',
                                                                color: charge.marginPercent >= 0 ? '#059669' : '#dc2626'
                                                            }}
                                                        >
                                                            {charge.marginPercent.toFixed(1)}%
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Chip
                                                        label={charge.status}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '10px',
                                                            height: '20px',
                                                            backgroundColor: charge.status === 'paid' ? '#d1fae5' :
                                                                charge.status === 'invoiced' ? '#dbeafe' : '#fef3c7',
                                                            color: charge.status === 'paid' ? '#059669' :
                                                                charge.status === 'invoiced' ? '#1d4ed8' : '#d97706'
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'center' }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleRowExpand(charge.id)}
                                                        sx={{ color: '#6b7280' }}
                                                    >
                                                        {expandedRows.has(charge.id) ?
                                                            <ArrowUpwardIcon fontSize="small" /> :
                                                            <AddIcon fontSize="small" />
                                                        }
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>

                                            {/* Expanded Row Content */}
                                            <TableRow>
                                                <TableCell
                                                    colSpan={11}
                                                    sx={{
                                                        paddingBottom: 0,
                                                        paddingTop: 0,
                                                        borderBottom: expandedRows.has(charge.id) ? '1px solid #e2e8f0' : 'none'
                                                    }}
                                                >
                                                    <Collapse in={expandedRows.has(charge.id)} timeout="auto" unmountOnExit>
                                                        <Box sx={{ margin: 2 }}>
                                                            <Grid container spacing={3}>
                                                                {/* Shipment Details */}
                                                                <Grid item xs={12} md={6}>
                                                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                                            SHIPMENT DETAILS
                                                                        </Typography>
                                                                        <Grid container spacing={1}>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Shipment ID:</Typography>
                                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>{charge.shipmentID}</Typography>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Date:</Typography>
                                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                    {charge.shipmentDate ? charge.shipmentDate.toLocaleDateString() : 'N/A'}
                                                                                </Typography>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Status:</Typography>
                                                                                <Box sx={{ mt: 0.5 }}>
                                                                                    <EnhancedStatusChip
                                                                                        status={charge.shipmentData?.statusOverride?.enhancedStatus || charge.shipmentData?.status}
                                                                                        size="small"
                                                                                        compact={true}
                                                                                        displayMode="master"
                                                                                        showTooltip={true}
                                                                                    />
                                                                                    {charge.shipmentData?.statusOverride?.enhancedStatus?.subStatus && (
                                                                                        <Box sx={{ mt: 0.5 }}>
                                                                                            <EnhancedStatusChip
                                                                                                status={charge.shipmentData?.statusOverride.enhancedStatus}
                                                                                                size="small"
                                                                                                compact={false}
                                                                                                displayMode="sub-only"
                                                                                                showTooltip={false}
                                                                                            />
                                                                                        </Box>
                                                                                    )}
                                                                                </Box>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Type:</Typography>
                                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                    {charge.isQuickShip ? 'QuickShip' : 'Standard'}
                                                                                </Typography>
                                                                            </Grid>
                                                                            <Grid item xs={12}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Route:</Typography>
                                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>{charge.route}</Typography>
                                                                            </Grid>
                                                                        </Grid>
                                                                    </Box>
                                                                </Grid>

                                                                {/* Charge Breakdown */}
                                                                <Grid item xs={12} md={6}>
                                                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                                            CHARGE BREAKDOWN
                                                                        </Typography>
                                                                        <Grid container spacing={1}>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Actual Cost:</Typography>
                                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#059669' }}>
                                                                                    {formatCurrency(charge.actualCost, charge.currency)}
                                                                                </Typography>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Customer Charge:</Typography>
                                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                    {formatCurrency(charge.customerCharge, charge.currency)}
                                                                                </Typography>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Margin:</Typography>
                                                                                <Typography sx={{
                                                                                    fontSize: '12px',
                                                                                    fontWeight: 500,
                                                                                    color: charge.margin >= 0 ? '#059669' : '#dc2626'
                                                                                }}>
                                                                                    {formatCurrency(charge.margin, charge.currency)}
                                                                                </Typography>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Margin %:</Typography>
                                                                                <Typography sx={{
                                                                                    fontSize: '12px',
                                                                                    fontWeight: 500,
                                                                                    color: charge.marginPercent >= 0 ? '#059669' : '#dc2626'
                                                                                }}>
                                                                                    {charge.marginPercent.toFixed(1)}%
                                                                                </Typography>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Currency:</Typography>
                                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>{charge.currency}</Typography>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Invoice Status:</Typography>
                                                                                <Chip
                                                                                    label={charge.status}
                                                                                    size="small"
                                                                                    sx={{
                                                                                        fontSize: '10px',
                                                                                        height: '18px',
                                                                                        backgroundColor: charge.status === 'paid' ? '#d1fae5' :
                                                                                            charge.status === 'invoiced' ? '#dbeafe' : '#fef3c7',
                                                                                        color: charge.status === 'paid' ? '#059669' :
                                                                                            charge.status === 'invoiced' ? '#1d4ed8' : '#d97706'
                                                                                    }}
                                                                                />
                                                                            </Grid>
                                                                        </Grid>
                                                                    </Box>
                                                                </Grid>
                                                            </Grid>
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination */}
                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        component="div"
                        count={filteredCharges.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(event, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(parseInt(event.target.value, 10));
                            setPage(0);
                        }}
                        sx={{
                            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                                fontSize: '12px'
                            },
                            '& .MuiTablePagination-select': {
                                fontSize: '12px'
                            }
                        }}
                    />
                </Paper>
            </Box>
        </LocalizationProvider>
    );
};

export default ChargesTab; 