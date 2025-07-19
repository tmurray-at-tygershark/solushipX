import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    Card,
    CardContent,
    Button,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    TextField,
    Stack,
    Checkbox,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Alert,
    Autocomplete,
    Badge,
    Skeleton,
    InputAdornment,
    ListItemText,
    Collapse,
    ListItemIcon,
    ExpandLess,
    ExpandMore,
    Avatar,
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    Receipt as ReceiptIcon,
    Payment as PaymentIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Download as DownloadIcon,
    Visibility as ViewIcon,
    Edit as EditIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    Add as AddIcon,
    MoreVert as MoreVertIcon,
    CalendarToday as CalendarIcon,
    Business as BusinessIcon,
    Close as CloseIcon,
    CloudUpload as CloudUploadIcon,
    Description as FileIcon,
    InsertDriveFile as DocumentIcon,
    HealthAndSafety as HealthAndSafetyIcon,
    Assessment as AssessmentIcon,
    Speed as SpeedIcon,
    AccountBalance as AccountBalanceIcon,
    Timeline as TimelineIcon,
    Clear as ClearIcon,
    Refresh as RefreshIcon,
    KeyboardArrowUp as ArrowUpIcon,
    Remove as MinusIcon,
    ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { collection, query, where, getDocs, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';
import { useNavigate } from 'react-router-dom';

const ChargesTab = () => {
    const { currentUser, userRole } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // State management
    const [charges, setCharges] = useState([]);
    const [filteredCharges, setFilteredCharges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [sortField, setSortField] = useState('shipmentDate');
    const [sortDirection, setSortDirection] = useState('desc');
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [shipmentDetailsOpen, setShipmentDetailsOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyDetailsOpen, setCompanyDetailsOpen] = useState(false);
    const [expandedShipments, setExpandedShipments] = useState(new Set());

    // Filter states
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [selectedCustomerId, setSelectedCustomerId] = useState('all');
    const [searchValue, setSearchValue] = useState('');
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [timeRange, setTimeRange] = useState('all');

    // Data loading states
    const [connectedCompanies, setConnectedCompanies] = useState([]);
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Create filters object for consistency with original implementation
    const filters = {
        companyId: selectedCompanyId,
        customerId: selectedCustomerId,
        searchValue: searchValue,
        fromDate: fromDate,
        toDate: toDate,
        status: statusFilter
    };

    // Safe date parsing function that returns Date object
    const safeParseDate = (dateValue) => {
        if (!dateValue) return new Date();

        try {
            // Handle Firestore Timestamp
            if (dateValue && typeof dateValue.toDate === 'function') {
                return dateValue.toDate();
            }

            // Handle timestamp objects with seconds
            if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
                return new Date(dateValue.seconds * 1000);
            }

            // Handle regular Date objects or date strings
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                return date;
            }

            return new Date();
        } catch (error) {
            console.warn('Date parsing error:', error);
            return new Date();
        }
    };

    // Safe date formatting function
    const safeFormatDate = (dateValue) => {
        if (!dateValue) return 'N/A';

        try {
            const date = safeParseDate(dateValue);
            // Format as MM/DD/YY (2-digit year)
            return date.toLocaleDateString('en-US', {
                year: '2-digit',
                month: 'numeric',
                day: 'numeric'
            });
        } catch (error) {
            console.warn('Date formatting error:', error);
            return 'N/A';
        }
    };

    const navigate = useNavigate();

    // Copy shipment ID to clipboard
    const handleCopyShipmentId = async (shipmentId, event) => {
        if (event) {
            event.stopPropagation();
        }
        try {
            await navigator.clipboard.writeText(shipmentId);
            enqueueSnackbar(`Shipment ID ${shipmentId} copied to clipboard`, { variant: 'success' });
        } catch (error) {
            console.error('Failed to copy shipment ID:', error);
            enqueueSnackbar('Failed to copy shipment ID', { variant: 'error' });
        }
    };

    // Handle shipment ID click to expand row
    const handleShipmentClick = (chargeId, event) => {
        // Prevent event propagation to avoid conflicts
        if (event) {
            event.stopPropagation();
        }
        handleToggleExpanded(chargeId);
    };

    // Format route for stacked display
    const formatRoute = (shipmentData) => {
        if (!shipmentData) return 'N/A';

        const fromLocation = shipmentData.shipFrom || shipmentData.origin;
        const toLocation = shipmentData.shipTo || shipmentData.destination;

        if (!fromLocation || !toLocation) return 'N/A';

        const fromCity = fromLocation.city || 'Unknown';
        const fromState = fromLocation.state || fromLocation.province || '';
        const toCity = toLocation.city || 'Unknown';
        const toState = toLocation.state || toLocation.province || '';

        return `${fromCity}, ${fromState} →\n${toCity}, ${toState}`;
    };

    // Fetch connected companies function
    const fetchConnectedCompanies = async () => {
        if (!currentUser || userRole === 'user') return [];

        try {
            if (userRole === 'superadmin') {
                // Super admins see all companies
                const companiesSnapshot = await getDocs(collection(db, 'companies'));
                const companies = companiesSnapshot.docs.map(doc => doc.data().companyID).filter(Boolean);
                return companies;
            } else if (userRole === 'admin') {
                // Regular admins see connected companies
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const userData = userDoc.data();
                return userData?.connectedCompanies || [];
            }
        } catch (error) {
            console.error('Error fetching connected companies:', error);
            return [];
        }
        return [];
    };

    const loadAvailableCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const connectedCompanies = await fetchConnectedCompanies();
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            const allCompanies = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            let availableCompanies = [];
            if (userRole === 'superadmin') {
                availableCompanies = allCompanies;
            } else {
                availableCompanies = allCompanies.filter(company =>
                    connectedCompanies.includes(company.id) ||
                    connectedCompanies.includes(company.companyID)
                );
            }

            // Sort companies by name
            availableCompanies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAvailableCompanies(availableCompanies);
        } catch (error) {
            console.error('Error loading available companies:', error);
            setAvailableCompanies([]);
        } finally {
            setLoadingCompanies(false);
        }
    };

    const loadCustomersForCompany = async (companyId) => {
        if (!companyId || companyId === 'all') {
            setAvailableCustomers([]);
            return;
        }

        setLoadingCustomers(true);
        try {
            const selectedCompany = availableCompanies.find(c => c.companyID === companyId);
            const actualCompanyId = selectedCompany?.companyID || companyId;

            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', actualCompanyId)
            );

            const customersSnapshot = await getDocs(customersQuery);
            const customers = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAvailableCustomers(customers);

        } catch (error) {
            console.error('Error loading customers:', error);
            setAvailableCustomers([]);
        } finally {
            setLoadingCustomers(false);
        }
    };

    // Enhanced query to fetch shipments with charges
    const fetchCharges = useCallback(async () => {
        if (!userRole || (userRole !== 'superadmin' && userRole !== 'admin')) {
            console.warn('Access denied: User does not have admin privileges');
            return;
        }

        setLoading(true);
        try {
            // Fetch connected companies for current admin
            const connectedCompanies = await fetchConnectedCompanies();

            // Load available companies for filtering
            await loadAvailableCompanies();

            // Query shipments with charges - EXCLUDE ARCHIVED SHIPMENTS
            const shipmentsRef = collection(db, 'shipments');
            let q;

            if (userRole === 'superadmin') {
                // Super admin sees all shipments except archived
                q = query(
                    shipmentsRef,
                    where('status', '!=', 'archived'),
                    orderBy('status'),
                    orderBy('createdAt', 'desc')
                );
            } else {
                // Regular admin sees connected companies only, except archived
                if (connectedCompanies.length === 0) {
                    console.warn('No connected companies found for admin');
                    setCharges([]);
                    setFilteredCharges([]);
                    return;
                }

                // Use batched queries for connected companies
                const batchSize = 10; // Firestore 'in' query limit
                const batches = [];

                for (let i = 0; i < connectedCompanies.length; i += batchSize) {
                    const batch = connectedCompanies.slice(i, i + batchSize);
                    const batchQuery = query(
                        shipmentsRef,
                        where('companyID', 'in', batch),
                        where('status', '!=', 'archived'),
                        orderBy('status'),
                        orderBy('createdAt', 'desc')
                    );
                    batches.push(batchQuery);
                }

                q = batches; // Handle multiple queries below
            }

            let shipmentsData = [];

            if (Array.isArray(q)) {
                // Handle batched queries for regular admin
                const batchPromises = q.map(batchQuery => getDocs(batchQuery));
                const batchResults = await Promise.all(batchPromises);

                batchResults.forEach(querySnapshot => {
                    querySnapshot.forEach(doc => {
                        shipmentsData.push({ id: doc.id, ...doc.data() });
                    });
                });
            } else {
                // Handle single query for super admin
                const querySnapshot = await getDocs(q);
                shipmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            console.log(`📊 Loaded ${shipmentsData.length} non-archived shipments with potential charges`);

            // Build company map for better performance
            const companyMap = {};
            connectedCompanies.forEach(companyId => {
                // This will be populated during company data loading
                companyMap[companyId] = { name: companyId }; // Fallback
            });

            // Load company data for proper logo display
            const uniqueCompanyIds = [...new Set(shipmentsData.map(shipment => shipment.companyID).filter(Boolean))];
            const companyDataMap = {};

            if (uniqueCompanyIds.length > 0) {
                try {
                    const companiesRef = collection(db, 'companies');
                    const companyQueries = [];

                    // Handle company ID batching for Firestore 'in' queries
                    const companyBatchSize = 10;
                    for (let i = 0; i < uniqueCompanyIds.length; i += companyBatchSize) {
                        const batch = uniqueCompanyIds.slice(i, i + companyBatchSize);
                        const companyQuery = query(companiesRef, where('companyID', 'in', batch));
                        companyQueries.push(companyQuery);
                    }

                    const companyResults = await Promise.all(companyQueries.map(q => getDocs(q)));
                    companyResults.forEach(querySnapshot => {
                        querySnapshot.forEach(doc => {
                            const company = doc.data();
                            if (company.companyID) {
                                companyDataMap[company.companyID] = company;
                                companyMap[company.companyID] = company; // Update the main map too
                            }
                        });
                    });

                    console.log(`🏢 Loaded ${Object.keys(companyDataMap).length} companies for charge display`);
                } catch (error) {
                    console.error('Error loading companies:', error);
                }
            }

            // Process shipment charges
            const shipmentCharges = [];
            shipmentsData.forEach(shipment => {
                processShipmentCharges(shipment, shipmentCharges, companyDataMap);
            });

            console.log(`💰 Generated ${shipmentCharges.length} charge records from shipments`);

            // Load customer data for proper display
            const uniqueCustomerIds = [...new Set(shipmentCharges.map(charge => charge.customerId).filter(Boolean))];
            const customerMap = {};

            if (uniqueCustomerIds.length > 0) {
                try {
                    const customersRef = collection(db, 'customers');
                    const customerQueries = [];

                    // Handle customer ID batching for Firestore 'in' queries
                    const customerBatchSize = 10;
                    for (let i = 0; i < uniqueCustomerIds.length; i += customerBatchSize) {
                        const batch = uniqueCustomerIds.slice(i, i + customerBatchSize);
                        const customerQuery = query(customersRef, where('customerID', 'in', batch));
                        customerQueries.push(customerQuery);
                    }

                    const customerResults = await Promise.all(customerQueries.map(q => getDocs(q)));
                    customerResults.forEach(querySnapshot => {
                        querySnapshot.forEach(doc => {
                            const customer = doc.data();
                            if (customer.customerID) {
                                customerMap[customer.customerID] = customer;
                            }
                        });
                    });

                    console.log(`👥 Loaded ${Object.keys(customerMap).length} customers for charge display`);
                } catch (error) {
                    console.error('Error loading customers:', error);
                }
            }

            // Enhance charges with customer data
            shipmentCharges.forEach(charge => {
                if (charge.customerId && customerMap[charge.customerId]) {
                    charge.customerData = customerMap[charge.customerId];
                    charge.customerName = customerMap[charge.customerId].name;
                }
            });

            setCharges(shipmentCharges);
            setFilteredCharges(shipmentCharges);

        } catch (error) {
            console.error('Error fetching charges:', error);
            setCharges([]);
            setFilteredCharges([]);
        } finally {
            setLoading(false);
        }
    }, [userRole]);

    // Fetch charges when timeRange or connected companies change
    useEffect(() => {
        if (userRole !== 'superadmin' && userRole !== 'admin') return;
        fetchCharges();
    }, [fetchCharges, timeRange, userRole]);

    // Apply filters when filters or charges change
    useEffect(() => {
        applyFilters();
    }, [filters, charges]);

    // Load connected companies and initial data
    useEffect(() => {
        if (currentUser && (userRole === 'superadmin' || userRole === 'admin')) {
            loadAvailableCompanies();
        }
    }, [currentUser, userRole]);

    // Load customers when company selection changes
    useEffect(() => {
        if (selectedCompanyId !== 'all') {
            loadCustomersForCompany(selectedCompanyId);
        }
    }, [selectedCompanyId, availableCompanies]);

    // Helper function to get shipment currency
    function getShipmentCurrency(shipment) {
        if (shipment.markupRates?.currency) {
            return shipment.markupRates.currency;
        }
        if (shipment.currency) {
            return shipment.currency;
        }
        if (shipment.selectedRate?.pricing?.currency) {
            return shipment.selectedRate.pricing.currency;
        }
        if (shipment.selectedRate?.currency) {
            return shipment.selectedRate.currency;
        }
        if (shipment.actualRates?.currency) {
            return shipment.actualRates.currency;
        }
        // Check manual rates for QuickShip
        if (shipment.manualRates && Array.isArray(shipment.manualRates) && shipment.manualRates.length > 0) {
            const firstRate = shipment.manualRates[0];
            if (firstRate.chargeCurrency || firstRate.currency) {
                return firstRate.chargeCurrency || firstRate.currency;
            }
        }
        return 'CAD';
    }

    // Helper function to process shipment charges
    function processShipmentCharges(shipment, shipmentCharges, companyDataMap) {
        let actualCost = 0;
        let customerCharge = 0;

        if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
            actualCost = shipment.manualRates.reduce((sum, rate) => sum + (parseFloat(rate.cost) || 0), 0);
            customerCharge = shipment.manualRates.reduce((sum, rate) => sum + (parseFloat(rate.charge) || 0), 0);
        } else {
            actualCost = shipment.actualRates?.totalCharges || shipment.totalCharges || shipment.selectedRate?.totalCharges || 0;
            customerCharge = shipment.markupRates?.totalCharges || shipment.totalCharges || shipment.selectedRate?.totalCharges || 0;
        }

        if (customerCharge > 0) {
            const company = companyDataMap[shipment.companyID] || {
                name: shipment.companyName || shipment.companyID,
                companyID: shipment.companyID
            };

            let shipmentDate;
            if (shipment.creationMethod === 'quickship' && shipment.bookedAt) {
                shipmentDate = safeParseDate(shipment.bookedAt);
            } else {
                shipmentDate = safeParseDate(shipment.createdAt);
            }

            const currency = getShipmentCurrency(shipment);

            // Enhanced customer ID extraction
            const customerId = shipment.customerID ||
                shipment.customerId ||
                shipment.shipTo?.customerID ||
                shipment.shipTo?.addressClassID ||
                null;

            // Enhanced customer name extraction  
            const customerName = shipment.customerName ||
                shipment.customer?.name ||
                shipment.shipTo?.companyName ||
                shipment.shipTo?.company ||
                null;

            shipmentCharges.push({
                id: shipment.id,
                shipmentID: shipment.shipmentID,
                companyID: shipment.companyID,
                customerId: customerId,
                customerData: null, // Will be populated later
                customerName: customerName,
                companyName: company?.name || shipment.companyName || shipment.companyID,
                company: company,
                actualCost: actualCost,
                customerCharge: customerCharge,
                margin: customerCharge - actualCost,
                marginPercent: customerCharge > 0 ? ((customerCharge - actualCost) / customerCharge) * 100 : 0,
                currency: currency,
                actualRates: shipment.actualRates,
                markupRates: shipment.markupRates,
                manualRates: shipment.manualRates,
                isQuickShip: shipment.creationMethod === 'quickship',
                status: shipment.invoiceStatus || 'uninvoiced',
                shipmentDate: shipmentDate,
                shipmentData: shipment // Store full shipment data for expanded view
            });
        }
    }

    const applyFilters = () => {
        let filtered = [...charges];

        // Company filter
        if (filters.companyId && filters.companyId !== 'all') {
            filtered = filtered.filter(charge => charge.companyID === filters.companyId);
        }

        // Customer filter (requires company to be selected first)
        if (filters.customerId && filters.customerId !== 'all' && filters.companyId !== 'all') {
            const selectedCustomer = availableCustomers.find(c => c.id === filters.customerId);
            if (selectedCustomer) {
                filtered = filtered.filter(charge =>
                    charge.customerId === selectedCustomer.customerID ||
                    charge.customerId === selectedCustomer.id ||
                    charge.customerData?.customerID === selectedCustomer.customerID ||
                    charge.customerData?.id === selectedCustomer.id
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
                    charge.route,
                    charge.status
                ];

                return searchableFields.some(field =>
                    field && String(field).toLowerCase().includes(searchTerm)
                );
            });
        }

        // Status filter
        if (filters.status && filters.status !== '') {
            filtered = filtered.filter(charge => charge.status === filters.status);
        }

        // Date filters
        if (filters.fromDate) {
            const fromDate = new Date(filters.fromDate);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(charge => charge.shipmentDate >= fromDate);
        }

        if (filters.toDate) {
            const toDate = new Date(filters.toDate);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(charge => charge.shipmentDate <= toDate);
        }

        // Sort the filtered results
        filtered.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];

            if (sortField === 'shipmentDate') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        setFilteredCharges(filtered);
        setPage(0); // Reset to first page when filters change
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Format currency
    const formatCurrency = (amount, currency = 'CAD') => {
        const formatted = new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: currency
        }).format(amount);

        const currencyCode = currency.toUpperCase();
        // Prevent duplication like "US$204.17 USD"
        if (formatted.includes(currencyCode) || (currencyCode === 'USD' && formatted.includes('US$'))) {
            return formatted;
        }
        return `${formatted} ${currencyCode}`;
    };

    const handleCompanyClick = (company) => {
        setSelectedCompany(company);
        setCompanyDetailsOpen(true);
    };

    // Toggle expansion for a shipment row
    const handleToggleExpanded = (chargeId) => {
        const newExpanded = new Set(expandedShipments);
        if (newExpanded.has(chargeId)) {
            newExpanded.delete(chargeId);
        } else {
            newExpanded.add(chargeId);
        }
        setExpandedShipments(newExpanded);
    };

    // Calculate metrics by currency
    const getMetricsByCurrency = () => {
        const usdCharges = filteredCharges.filter(c => c.currency.toUpperCase() === 'USD');
        const cadCharges = filteredCharges.filter(c => c.currency.toUpperCase() === 'CAD');

        return {
            totalShipments: {
                USD: usdCharges.length,
                CAD: cadCharges.length
            },
            totalRevenue: {
                USD: usdCharges.reduce((sum, c) => sum + c.customerCharge, 0),
                CAD: cadCharges.reduce((sum, c) => sum + c.customerCharge, 0)
            },
            totalCosts: {
                USD: usdCharges.reduce((sum, c) => sum + c.actualCost, 0),
                CAD: cadCharges.reduce((sum, c) => sum + c.actualCost, 0)
            },
            avgMargin: {
                USD: usdCharges.length > 0 ? (usdCharges.reduce((sum, c) => sum + c.marginPercent, 0) / usdCharges.length) : 0,
                CAD: cadCharges.length > 0 ? (cadCharges.reduce((sum, c) => sum + c.marginPercent, 0) / cadCharges.length) : 0
            }
        };
    };

    const getStatusChip = (status) => {
        const statusColors = {
            'paid': { color: '#065f46', bgcolor: '#d1fae5' },
            'invoiced': { color: '#1e40af', bgcolor: '#dbeafe' },
            'uninvoiced': { color: '#92400e', bgcolor: '#fef3c7' },
            'overdue': { color: '#dc2626', bgcolor: '#fee2e2' }
        };

        const colors = statusColors[status] || { color: '#6b7280', bgcolor: '#f3f4f6' };

        return (
            <Chip
                label={status}
                size="small"
                sx={{
                    ...colors,
                    fontWeight: 600,
                    fontSize: '11px',
                    textTransform: 'capitalize'
                }}
            />
        );
    };

    const handleExport = () => {
        const csvData = filteredCharges.map(charge => ({
            'Shipment ID': charge.shipmentID,
            'Company': charge.companyName,
            'Company ID': charge.companyID,
            'Route': charge.route,
            'Carrier': charge.carrier,
            'Actual Cost': charge.actualCost.toFixed(2),
            'Customer Charge': charge.customerCharge.toFixed(2),
            'Margin': charge.margin.toFixed(2),
            'Margin %': charge.marginPercent.toFixed(1) + '%',
            'Status': charge.status,
            'Date': charge.shipmentDate.toLocaleDateString(),
            'Type': charge.isQuickShip ? 'QuickShip' : 'Regular'
        }));

        const csvContent = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map(row => Object.values(row).map(value =>
                typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            ).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enterprise-charges-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        enqueueSnackbar('Charges exported successfully', { variant: 'success' });
    };

    const getSortIcon = (field) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const SortableTableCell = ({ field, children, align = 'left' }) => (
        <TableCell
            sx={{
                backgroundColor: '#f8fafc',
                fontWeight: 600,
                color: '#374151',
                fontSize: '12px',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { backgroundColor: '#f1f5f9' }
            }}
            align={align}
            onClick={() => handleSort(field)}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
                {children}
                {getSortIcon(field) && (
                    <Typography sx={{ ml: 0.5, fontSize: '10px', color: '#6366f1' }}>
                        {getSortIcon(field)}
                    </Typography>
                )}
            </Box>
        </TableCell>
    );

    const metrics = getMetricsByCurrency();

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box className="admin-billing-charges">
                {/* Header with Title and Action Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
                        Charges
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={fetchCharges}
                            sx={{ fontSize: '11px' }}
                        >
                            Refresh
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={handleExport}
                            disabled={filteredCharges.length === 0}
                            sx={{ fontSize: '11px' }}
                        >
                            Export CSV
                        </Button>
                    </Box>
                </Box>

                {/* Enhanced Filters */}
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                        Filters
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Time Range</InputLabel>
                                <Select
                                    value={timeRange}
                                    onChange={(e) => setTimeRange(e.target.value)}
                                    label="Time Range"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>All Time</MenuItem>
                                    <MenuItem value="week" sx={{ fontSize: '12px' }}>Last 7 Days</MenuItem>
                                    <MenuItem value="month" sx={{ fontSize: '12px' }}>Last 30 Days</MenuItem>
                                    <MenuItem value="year" sx={{ fontSize: '12px' }}>Last Year</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Autocomplete
                                value={availableCompanies.find(c => c.companyID === selectedCompanyId) || null}
                                onChange={(event, newValue) => {
                                    const companyId = newValue ? newValue.companyID : 'all';
                                    setSelectedCompanyId(companyId);
                                    setSelectedCustomerId('all');
                                    if (companyId !== 'all') {
                                        loadCustomersForCompany(companyId);
                                    }
                                }}
                                options={availableCompanies}
                                getOptionLabel={(option) => option.name || option.companyID}
                                isOptionEqualToValue={(option, value) => option.companyID === value?.companyID}
                                loading={loadingCompanies}
                                renderOption={(props, option) => {
                                    const logoUrl = option.logoUrl || option.logo || option.companyLogo || option.logoURL || option.companyLogoUrl;
                                    const companyName = option.name || option.companyName || option.companyID || 'CO';
                                    const companyId = option.companyID || option.id;

                                    return (
                                        <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                            <Box sx={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: '4px',
                                                backgroundColor: '#f3f4f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                mr: 1
                                            }}>
                                                {logoUrl ? (
                                                    <img
                                                        src={logoUrl}
                                                        alt="Company"
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'contain',
                                                            borderRadius: '3px'
                                                        }}
                                                        onError={(e) => {
                                                            const parent = e.target.parentNode;
                                                            e.target.remove();
                                                            parent.innerHTML = `<div style="font-size: 8px; font-weight: 600; color: #6b7280; line-height: 1; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${companyName[0].toUpperCase()}</div>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        fontSize: '8px',
                                                        fontWeight: 600,
                                                        color: '#6b7280',
                                                        lineHeight: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '100%',
                                                        height: '100%'
                                                    }}>
                                                        {companyName[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {companyName}
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Company ID: {companyId}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Company"
                                        size="small"
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '12px' }
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Autocomplete
                                value={availableCustomers.find(c => c.id === selectedCustomerId) || null}
                                onChange={(event, newValue) => {
                                    setSelectedCustomerId(newValue ? newValue.id : 'all');
                                }}
                                options={availableCustomers}
                                getOptionLabel={(option) => option.name || option.customerID}
                                isOptionEqualToValue={(option, value) => option.id === value?.id}
                                loading={loadingCustomers}
                                disabled={selectedCompanyId === 'all'}
                                renderOption={(props, option) => {
                                    const logoUrl = option.logoUrl || option.logo || option.customerLogo || option.logoURL || option.customerLogoUrl;
                                    const customerName = option.name || option.customerName || option.customerID || 'CU';

                                    return (
                                        <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                            <Box sx={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: '4px',
                                                backgroundColor: '#f3f4f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                mr: 1
                                            }}>
                                                {logoUrl ? (
                                                    <img
                                                        src={logoUrl}
                                                        alt="Customer"
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'contain',
                                                            borderRadius: '3px'
                                                        }}
                                                        onError={(e) => {
                                                            const parent = e.target.parentNode;
                                                            e.target.remove();
                                                            parent.innerHTML = `<div style="font-size: 8px; font-weight: 600; color: #6b7280; line-height: 1; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${customerName[0].toUpperCase()}</div>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        fontSize: '8px',
                                                        fontWeight: 600,
                                                        color: '#6b7280',
                                                        lineHeight: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '100%',
                                                        height: '100%'
                                                    }}>
                                                        {customerName[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </Box>
                                            {customerName}
                                        </Box>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Customer"
                                        size="small"
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '12px' }
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <TextField
                                label="Search"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                size="small"
                                fullWidth
                                InputProps={{
                                    startAdornment: <SearchIcon sx={{ fontSize: '16px', mr: 1, color: '#6b7280' }} />,
                                    sx: { fontSize: '12px' }
                                }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Search shipments..."
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                <Select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    label="Status"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="" sx={{ fontSize: '12px' }}>All Statuses</MenuItem>
                                    <MenuItem value="uninvoiced" sx={{ fontSize: '12px' }}>Uninvoiced</MenuItem>
                                    <MenuItem value="invoiced" sx={{ fontSize: '12px' }}>Invoiced</MenuItem>
                                    <MenuItem value="paid" sx={{ fontSize: '12px' }}>Paid</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Summary Cards with Currency Breakdown - MOVED BELOW FILTERS */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', mb: 1 }}>
                                    Total Shipments
                                </Typography>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 'bold', color: '#000000', mr: 1 }}>
                                            USD:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '14px', color: '#000000' }}>
                                            {(metrics.totalShipments.USD || 0).toLocaleString()}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 'bold', color: '#000000', mr: 1 }}>
                                            CAD:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '14px', color: '#000000' }}>
                                            {(metrics.totalShipments.CAD || 0).toLocaleString()}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', mb: 1 }}>
                                    Total Revenue
                                </Typography>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 'bold', color: '#000000', mr: 1 }}>
                                            USD:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '14px', color: '#000000' }}>
                                            ${(metrics.totalRevenue.USD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 'bold', color: '#000000', mr: 1 }}>
                                            CAD:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '14px', color: '#000000' }}>
                                            ${(metrics.totalRevenue.CAD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', mb: 1 }}>
                                    Total Costs
                                </Typography>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 'bold', color: '#000000', mr: 1 }}>
                                            USD:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '14px', color: '#000000' }}>
                                            ${(metrics.totalCosts.USD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 'bold', color: '#000000', mr: 1 }}>
                                            CAD:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '14px', color: '#000000' }}>
                                            ${(metrics.totalCosts.CAD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Status/Count Display */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Showing {Math.min(page * rowsPerPage + 1, filteredCharges.length)} - {Math.min((page + 1) * rowsPerPage, filteredCharges.length)} of {filteredCharges.length} charges
                    </Typography>
                </Box>

                {/* Charges Table */}
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <SortableTableCell field="shipmentID">
                                        ID
                                    </SortableTableCell>
                                    <SortableTableCell field="shipmentDate">
                                        Date
                                    </SortableTableCell>
                                    <SortableTableCell field="companyName">
                                        Company
                                    </SortableTableCell>
                                    <SortableTableCell field="customerName">
                                        Customer
                                    </SortableTableCell>
                                    <SortableTableCell field="route">
                                        Route
                                    </SortableTableCell>
                                    <SortableTableCell field="carrier">
                                        Carrier / Service
                                    </SortableTableCell>
                                    <SortableTableCell field="actualCost">
                                        Cost
                                    </SortableTableCell>
                                    <SortableTableCell field="customerCharge">
                                        Charge
                                    </SortableTableCell>
                                    <SortableTableCell field="profit">
                                        Profit
                                    </SortableTableCell>
                                    <SortableTableCell field="status">
                                        Status
                                    </SortableTableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc' }}>

                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    // Skeleton Loading Rows
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <TableRow key={`skeleton-${index}`}>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Skeleton variant="rectangular" width={20} height={20} sx={{ borderRadius: '4px' }} />
                                                    <Skeleton variant="text" width={120} height={16} />
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Skeleton variant="text" width={80} height={16} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Skeleton variant="rectangular" width={20} height={20} sx={{ borderRadius: '4px' }} />
                                                    <Skeleton variant="text" width={100} height={16} />
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Skeleton variant="rectangular" width={20} height={20} sx={{ borderRadius: '4px' }} />
                                                    <Skeleton variant="text" width={90} height={16} />
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Skeleton variant="text" width={70} height={32} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Skeleton variant="text" width={80} height={32} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Skeleton variant="text" width={70} height={16} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Skeleton variant="text" width={80} height={16} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Skeleton variant="text" width={100} height={16} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: '12px' }} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left', width: 40 }}>
                                                <Skeleton variant="circular" width={24} height={24} />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredCharges.length > 0 ? (
                                    filteredCharges.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((charge) => (
                                        <React.Fragment key={charge.id}>
                                            <TableRow hover sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography
                                                            component="span"
                                                            sx={{
                                                                fontSize: '12px',
                                                                color: '#3b82f6',
                                                                cursor: 'pointer',
                                                                '&:hover': { textDecoration: 'underline' }
                                                            }}
                                                            onClick={(event) => handleShipmentClick(charge.id, event)}
                                                        >
                                                            {charge.shipmentID}
                                                        </Typography>
                                                        <Tooltip title="Copy Shipment ID">
                                                            <IconButton
                                                                size="small"
                                                                sx={{
                                                                    p: 0.25,
                                                                    color: '#6b7280',
                                                                    '&:hover': { color: '#374151' }
                                                                }}
                                                                onClick={(event) => handleCopyShipmentId(charge.shipmentID, event)}
                                                            >
                                                                <CopyIcon sx={{ fontSize: '14px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    {charge.shipmentDate ? new Date(charge.shipmentDate).toLocaleDateString() : 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box sx={{
                                                            width: 20,
                                                            height: 20,
                                                            borderRadius: '4px',
                                                            backgroundColor: '#f3f4f6',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {(() => {
                                                                const company = charge.company;
                                                                const logoUrl = company?.logoUrl || company?.logo || company?.companyLogo || company?.logoURL || company?.companyLogoUrl;
                                                                const companyName = company?.name || charge.companyName || charge.companyID || 'CO';

                                                                if (logoUrl) {
                                                                    return (
                                                                        <img
                                                                            src={logoUrl}
                                                                            alt="Company"
                                                                            style={{
                                                                                width: '100%',
                                                                                height: '100%',
                                                                                objectFit: 'contain',
                                                                                borderRadius: '3px'
                                                                            }}
                                                                            onError={(e) => {
                                                                                const parent = e.target.parentNode;
                                                                                e.target.remove();
                                                                                parent.innerHTML = `<div style="font-size: 8px; font-weight: 600; color: #6b7280; line-height: 1; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${companyName[0].toUpperCase()}</div>`;
                                                                            }}
                                                                        />
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div style={{
                                                                            fontSize: '8px',
                                                                            fontWeight: 600,
                                                                            color: '#6b7280',
                                                                            lineHeight: 1,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            width: '100%',
                                                                            height: '100%'
                                                                        }}>
                                                                            {companyName[0].toUpperCase()}
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                        </Box>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                fontSize: '12px',
                                                                cursor: userRole === 'superadmin' ? 'pointer' : 'default',
                                                                '&:hover': userRole === 'superadmin' ? { textDecoration: 'underline' } : {}
                                                            }}
                                                            onClick={userRole === 'superadmin' ? () => handleCompanyClick(charge.company) : undefined}
                                                        >
                                                            {charge.companyName}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box sx={{
                                                            width: 20,
                                                            height: 20,
                                                            borderRadius: '4px',
                                                            backgroundColor: '#f3f4f6',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {(() => {
                                                                const customer = charge.customerData;
                                                                const logoUrl = customer?.logoUrl || customer?.logo || customer?.companyLogo || customer?.logoURL || customer?.companyLogoUrl;
                                                                const customerName = charge.customerName || customer?.name || 'CU';

                                                                if (logoUrl) {
                                                                    return (
                                                                        <img
                                                                            src={logoUrl}
                                                                            alt="Customer"
                                                                            style={{
                                                                                width: '100%',
                                                                                height: '100%',
                                                                                objectFit: 'contain',
                                                                                borderRadius: '3px'
                                                                            }}
                                                                            onError={(e) => {
                                                                                const parent = e.target.parentNode;
                                                                                e.target.remove();
                                                                                parent.innerHTML = `<div style="font-size: 8px; font-weight: 600; color: #6b7280; line-height: 1; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${customerName[0].toUpperCase()}</div>`;
                                                                            }}
                                                                        />
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div style={{
                                                                            fontSize: '8px',
                                                                            fontWeight: 600,
                                                                            color: '#6b7280',
                                                                            lineHeight: 1,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            width: '100%',
                                                                            height: '100%'
                                                                        }}>
                                                                            {customerName[0].toUpperCase()}
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                        </Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {charge.customerName || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    <Typography sx={{ fontSize: '12px', whiteSpace: 'pre-line' }}>
                                                        {formatRoute(charge.shipmentData)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        {charge.shipmentData?.selectedCarrier ||
                                                            charge.shipmentData?.carrier ||
                                                            charge.shipmentData?.selectedRate?.carrier?.name ||
                                                            charge.shipmentData?.selectedRate?.carrierName ||
                                                            'N/A'}<br />
                                                        <Typography component="span" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {charge.shipmentData?.selectedRate?.service?.name ||
                                                                charge.shipmentData?.service ||
                                                                charge.shipmentData?.serviceLevel ||
                                                                'Standard'}
                                                        </Typography>
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left', color: '#059669' }}>
                                                    {formatCurrency(charge.actualCost, charge.currency)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left', color: '#000000' }}>
                                                    {formatCurrency(charge.customerCharge, charge.currency)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    <Typography sx={{ fontSize: '12px', color: '#228B22', fontWeight: 600 }}>
                                                        {formatCurrency(
                                                            isNaN(charge.margin)
                                                                ? (charge.customerCharge || 0) - (charge.actualCost || 0)
                                                                : charge.margin,
                                                            charge.currency
                                                        )}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left' }}>
                                                    <EnhancedStatusChip
                                                        status={charge.shipmentData?.status || charge.status || 'unknown'}
                                                        subStatus={charge.shipmentData?.subStatus || charge.subStatus}
                                                        sx={{ fontSize: '10px' }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', textAlign: 'left', width: 40 }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleToggleExpanded(charge.id)}
                                                        sx={{
                                                            color: '#6b7280',
                                                            '&:hover': { backgroundColor: 'rgba(107, 114, 128, 0.1)' }
                                                        }}
                                                    >
                                                        {expandedShipments.has(charge.id) ?
                                                            <ArrowUpIcon fontSize="small" /> :
                                                            <AddIcon fontSize="small" />
                                                        }
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell colSpan={10} sx={{ paddingBottom: 0, paddingTop: 0, borderBottom: expandedShipments.has(charge.id) ? '1px solid #e2e8f0' : 'none' }}>
                                                    <Collapse in={expandedShipments.has(charge.id)} timeout="auto" unmountOnExit>
                                                        <Box sx={{ margin: 2 }}>
                                                            {/* Horizontal 3-Column Layout */}
                                                            <Grid container spacing={3}>

                                                                {/* SHIPMENT INFORMATION (Column 1/3) */}
                                                                <Grid item xs={12} md={4}>
                                                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1, textAlign: 'left' }}>
                                                                            SHIPMENT INFORMATION
                                                                        </Typography>
                                                                        <Box sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                            <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>ID:</Typography>
                                                                                <Typography sx={{ fontSize: '11px' }}>{charge.shipmentID}</Typography>
                                                                            </Box>
                                                                            <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Date:</Typography>
                                                                                <Typography sx={{ fontSize: '11px' }}>
                                                                                    {safeFormatDate(charge.shipmentData?.shipmentDate || charge.shipmentData?.createdAt || charge.shipmentDate)}
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Carrier:</Typography>
                                                                                <Typography sx={{ fontSize: '11px' }}>
                                                                                    {charge.shipmentData?.selectedCarrier || charge.shipmentData?.carrier || 'N/A'}
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Service:</Typography>
                                                                                <Typography sx={{ fontSize: '11px' }}>
                                                                                    {charge.shipmentData?.selectedRate?.service?.name || charge.shipmentData?.service || 'N/A'}
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Status:</Typography>
                                                                                <EnhancedStatusChip
                                                                                    status={charge.shipmentData?.status || charge.status || 'unknown'}
                                                                                    subStatus={charge.shipmentData?.subStatus || charge.subStatus}
                                                                                    size="small"
                                                                                    sx={{ fontSize: '10px', height: '18px' }}
                                                                                />
                                                                            </Box>
                                                                            <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Weight:</Typography>
                                                                                <Typography sx={{ fontSize: '11px' }}>
                                                                                    {(() => {
                                                                                        const weight = charge.shipmentData?.totalWeight ||
                                                                                            (charge.shipmentData?.packages &&
                                                                                                charge.shipmentData.packages.reduce((total, pkg) => total + (pkg.weight || 0), 0)) ||
                                                                                            0;
                                                                                        return weight > 0 ? `${weight.toLocaleString()} lbs` : 'N/A';
                                                                                    })()}
                                                                                </Typography>
                                                                            </Box>
                                                                            <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Pieces:</Typography>
                                                                                <Typography sx={{ fontSize: '11px' }}>
                                                                                    {charge.shipmentData?.totalPieces ||
                                                                                        (charge.shipmentData?.packages && charge.shipmentData.packages.length) ||
                                                                                        'N/A'}
                                                                                </Typography>
                                                                            </Box>
                                                                        </Box>
                                                                    </Box>
                                                                </Grid>

                                                                {/* ADDRESS INFORMATION (Column 2/3) */}
                                                                <Grid item xs={12} md={4}>
                                                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1, textAlign: 'left' }}>
                                                                            ADDRESS INFORMATION
                                                                        </Typography>
                                                                        <Box sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                            <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 0.5 }}>From:</Typography>
                                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                                {charge.shipmentData?.shipFrom?.companyName ||
                                                                                    charge.shipmentData?.shipFrom?.company ||
                                                                                    charge.shipmentData?.shipFrom?.name ||
                                                                                    charge.companyName ||
                                                                                    'Unknown Company'}
                                                                            </Typography>
                                                                            <Typography sx={{ fontSize: '11px', mb: 1 }}>
                                                                                {charge.shipmentData?.shipFrom?.street || 'No address'}<br />
                                                                                {charge.shipmentData?.shipFrom?.city}, {charge.shipmentData?.shipFrom?.state || charge.shipmentData?.shipFrom?.province} {charge.shipmentData?.shipFrom?.postalCode}
                                                                            </Typography>

                                                                            <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 0.5, mt: 1 }}>To:</Typography>
                                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                                {charge.shipmentData?.shipTo?.companyName ||
                                                                                    charge.shipmentData?.shipTo?.company ||
                                                                                    charge.shipmentData?.shipTo?.name ||
                                                                                    charge.customerData?.name ||
                                                                                    charge.customerName ||
                                                                                    'Unknown Customer'}
                                                                            </Typography>
                                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                                {charge.shipmentData?.shipTo?.street || 'No address'}<br />
                                                                                {charge.shipmentData?.shipTo?.city}, {charge.shipmentData?.shipTo?.state || charge.shipmentData?.shipTo?.province} {charge.shipmentData?.shipTo?.postalCode}
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                </Grid>

                                                                {/* CHARGE BREAKDOWN (Column 3/3) */}
                                                                <Grid item xs={12} md={4}>
                                                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1, textAlign: 'left' }}>
                                                                            CHARGE BREAKDOWN
                                                                        </Typography>
                                                                        <Box sx={{ color: '#000000' }}>
                                                                            {(() => {
                                                                                // Check for QuickShip manual rates first
                                                                                if (charge.shipmentData?.manualRates && Array.isArray(charge.shipmentData.manualRates)) {
                                                                                    let totalCost = 0;
                                                                                    let totalCharge = 0;

                                                                                    return (
                                                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                                            {charge.shipmentData.manualRates.map((rate, index) => {
                                                                                                const cost = parseFloat(rate.cost) || 0;
                                                                                                const chargeAmount = parseFloat(rate.charge) || 0;
                                                                                                const profit = chargeAmount - cost;

                                                                                                totalCost += cost;
                                                                                                totalCharge += chargeAmount;

                                                                                                return (
                                                                                                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.5 }}>
                                                                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                                                                            {rate.chargeName}
                                                                                                        </Typography>
                                                                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                                                                {formatCurrency(cost, charge.currency)} | {formatCurrency(chargeAmount, charge.currency)}
                                                                                                            </Typography>
                                                                                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#228B22', fontWeight: 500 }}>
                                                                                                                +{formatCurrency(profit, charge.currency)}
                                                                                                            </Typography>
                                                                                                        </Box>
                                                                                                    </Box>
                                                                                                );
                                                                                            })}

                                                                                            {/* Total row */}
                                                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pt: 1, mt: 1, borderTop: '1px solid #e5e7eb' }}>
                                                                                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                                                    TOTAL
                                                                                                </Typography>
                                                                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                                                        {formatCurrency(totalCost, charge.currency)} | {formatCurrency(totalCharge, charge.currency)}
                                                                                                    </Typography>
                                                                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#228B22', fontWeight: 600 }}>
                                                                                                        +{formatCurrency(totalCharge - totalCost, charge.currency)}
                                                                                                    </Typography>
                                                                                                </Box>
                                                                                            </Box>
                                                                                        </Box>
                                                                                    );
                                                                                }

                                                                                // Check for CreateShipmentX markup rates
                                                                                if (charge.markupRates && charge.markupRates.charges && Array.isArray(charge.markupRates.charges)) {
                                                                                    let totalCost = 0;
                                                                                    let totalCharge = 0;

                                                                                    return (
                                                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                                            {charge.markupRates.charges.map((markupCharge, index) => {
                                                                                                const actualCharge = charge.actualRates?.charges?.find(ac => ac.name === markupCharge.name);
                                                                                                const cost = actualCharge ? parseFloat(actualCharge.amount) || 0 : 0;
                                                                                                const chargeAmount = parseFloat(markupCharge.amount) || 0;
                                                                                                const profit = chargeAmount - cost;

                                                                                                totalCost += cost;
                                                                                                totalCharge += chargeAmount;

                                                                                                return (
                                                                                                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.5 }}>
                                                                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                                                                            {markupCharge.name}
                                                                                                        </Typography>
                                                                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                                                                {formatCurrency(cost, charge.currency)} | {formatCurrency(chargeAmount, charge.currency)}
                                                                                                            </Typography>
                                                                                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#228B22', fontWeight: 500 }}>
                                                                                                                +{formatCurrency(profit, charge.currency)}
                                                                                                            </Typography>
                                                                                                        </Box>
                                                                                                    </Box>
                                                                                                );
                                                                                            })}

                                                                                            {/* Total row */}
                                                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pt: 1, mt: 1, borderTop: '1px solid #e5e7eb' }}>
                                                                                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                                                    TOTAL
                                                                                                </Typography>
                                                                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                                                        {formatCurrency(totalCost, charge.currency)} | {formatCurrency(totalCharge, charge.currency)}
                                                                                                    </Typography>
                                                                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#228B22', fontWeight: 600 }}>
                                                                                                        +{formatCurrency(totalCharge - totalCost, charge.currency)}
                                                                                                    </Typography>
                                                                                                </Box>
                                                                                            </Box>
                                                                                        </Box>
                                                                                    );
                                                                                }

                                                                                // If no detailed charges available
                                                                                return (
                                                                                    <Typography sx={{ fontSize: '11px', fontStyle: 'italic', color: '#6b7280' }}>
                                                                                        No detailed charge breakdown available
                                                                                    </Typography>
                                                                                );
                                                                            })()}
                                                                        </Box>
                                                                    </Box>
                                                                </Grid>
                                                            </Grid>
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center">
                                            <Box sx={{ py: 6, textAlign: 'center' }}>
                                                <BusinessIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                                <Typography variant="body1" sx={{ fontSize: '14px', color: '#374151', mb: 1 }}>
                                                    No charges found
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {Object.values(filters).some(v => v) ? 'Try adjusting your filters' : 'No shipments with charges available'}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        <TablePagination
                            component="div"
                            count={filteredCharges.length}
                            page={page}
                            onPageChange={(e, newPage) => setPage(newPage)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => {
                                setRowsPerPage(parseInt(e.target.value, 10));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50, 100]}
                            sx={{
                                borderTop: '1px solid #e5e7eb',
                                '& .MuiTablePagination-selectLabel': { fontSize: '12px' },
                                '& .MuiTablePagination-displayedRows': { fontSize: '12px' },
                                '& .MuiSelect-select': { fontSize: '12px' }
                            }}
                        />
                    </TableContainer>
                </Paper>

                {/* Shipment Details Dialog */}
                <Dialog
                    open={shipmentDetailsOpen}
                    onClose={() => setShipmentDetailsOpen(false)}
                    maxWidth="lg"
                    fullWidth
                >
                    <DialogTitle>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Shipment Details: {selectedShipment?.shipmentID}
                            </Typography>
                            <IconButton onClick={() => setShipmentDetailsOpen(false)} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {selectedShipment && (
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>From:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {selectedShipment.shipFrom?.company || selectedShipment.shipFrom?.name}<br />
                                        {selectedShipment.shipFrom?.address}<br />
                                        {selectedShipment.shipFrom?.city}, {selectedShipment.shipFrom?.state || selectedShipment.shipFrom?.province} {selectedShipment.shipFrom?.postalCode}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>To:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {selectedShipment.shipTo?.company || selectedShipment.shipTo?.name}<br />
                                        {selectedShipment.shipTo?.address}<br />
                                        {selectedShipment.shipTo?.city}, {selectedShipment.shipTo?.state || selectedShipment.shipTo?.province} {selectedShipment.shipTo?.postalCode}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Status:</Typography>
                                    <EnhancedStatusChip status={selectedShipment.status} subStatus={selectedShipment.subStatus} />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Carrier:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>{selectedShipment.selectedCarrier || selectedShipment.carrier}</Typography>
                                </Grid>
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShipmentDetailsOpen(false)} size="small">Close</Button>
                    </DialogActions>
                </Dialog>

                {/* Company Details Dialog */}
                <Dialog
                    open={companyDetailsOpen}
                    onClose={() => setCompanyDetailsOpen(false)}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Company Details: {selectedCompany?.name}
                            </Typography>
                            <IconButton onClick={() => setCompanyDetailsOpen(false)} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {selectedCompany && (
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Company ID:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>{selectedCompany.companyID}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Status:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>{selectedCompany.status || 'Active'}</Typography>
                                </Grid>
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCompanyDetailsOpen(false)} size="small">Close</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </LocalizationProvider>
    );
};

export default ChargesTab; 