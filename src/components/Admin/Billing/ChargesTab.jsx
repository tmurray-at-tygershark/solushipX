import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import chargesService from '../../../services/chargesService';
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
    Popover,
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
    Check as CheckIcon,
    Cancel as CancelIcon,
    KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    getDoc,
    doc,
    startAfter,
    limitToLast,
    startAt,
    endAt,
    getCountFromServer,
    updateDoc
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';
import { useNavigate } from 'react-router-dom';
import invoiceStatusService from '../../../services/invoiceStatusService';

const ChargesTab = () => {
    const { currentUser, userRole } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Core table state
    const [charges, setCharges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [sortField, setSortField] = useState('shipmentDate');
    const [sortDirection, setSortDirection] = useState('desc');

    // Expanded rows and lazy loading
    const [expandedShipments, setExpandedShipments] = useState(new Set());
    const [expandedData, setExpandedData] = useState(new Map()); // Cache for expanded row data
    const [loadingExpanded, setLoadingExpanded] = useState(new Set()); // Track loading states

    // Filter states with debouncing
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [selectedCustomerId, setSelectedCustomerId] = useState('all');
    const [searchValue, setSearchValue] = useState('');
    const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [timeRange, setTimeRange] = useState('all'); // Default to all time to show existing data

    // Cached reference data
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [companyCache, setCompanyCache] = useState(new Map());
    const [customerCache, setCustomerCache] = useState(new Map());
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Summary metrics (calculated from server-side aggregation)
    const [metrics, setMetrics] = useState({
        totalShipments: { USD: 0, CAD: 0 },
        totalRevenue: { USD: 0, CAD: 0 },
        totalCosts: { USD: 0, CAD: 0 }
    });
    const [loadingMetrics, setLoadingMetrics] = useState(false);

    // Dialog states
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [shipmentDetailsOpen, setShipmentDetailsOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyDetailsOpen, setCompanyDetailsOpen] = useState(false);

    // Pagination refs
    const lastDocRef = useRef(null);
    const [hasMore, setHasMore] = useState(true);

    // Selection state for bulk operations
    const [selectedCharges, setSelectedCharges] = useState(new Set());

    // Inline editing state
    const [editingInvoiceStatus, setEditingInvoiceStatus] = useState(null);
    const [editingStatusValue, setEditingStatusValue] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);

    // Popover state for status dropdown
    const [statusPopoverAnchor, setStatusPopoverAnchor] = useState(null);
    const [popoverChargeId, setPopoverChargeId] = useState(null);

    const navigate = useNavigate();

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchValue(searchValue);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchValue]);

    // This component now relies on chargesService for all data fetching and processing.
    // The following functions are now simplified to call the service.

    const fetchChargesPage = useCallback(async (pageNum = 0, resetData = false) => {
        if (!userRole || (userRole !== 'superadmin' && userRole !== 'admin')) {
            console.warn('Access denied: User does not have admin privileges');
            return;
        }

        setLoading(true);
        try {
            const filters = {
                startDate: fromDate,
                endDate: toDate,
                invoiceStatus: statusFilter || 'all',
                sortField: sortField,
                sortDirection: sortDirection,
                companyId: selectedCompanyId !== 'all' ? selectedCompanyId : null,
                customerId: selectedCustomerId !== 'all' ? selectedCustomerId : null,
                searchTerm: debouncedSearchValue,
            };

            const connectedCompanies = userRole === 'superadmin' ? [] : (await chargesService.fetchConnectedCompanies(currentUser.uid));

            const result = await chargesService.fetchCharges({
                page: pageNum,
                pageSize: rowsPerPage,
                filters,
                userRole,
                connectedCompanies,
                lastDoc: resetData ? null : lastDocRef.current,
            });

            const processedCharges = result.charges; // The service now returns fully processed charges

            if (resetData) {
                setCharges(processedCharges);
            } else {
                setCharges(prev => [...prev, ...processedCharges]);
            }

            setTotalCount(result.totalCount);
            setHasMore(result.hasMore);
            lastDocRef.current = result.lastDoc;
        } catch (error) {
            console.error('Error fetching charges:', error);
            enqueueSnackbar('Failed to load charges', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [userRole, fromDate, toDate, statusFilter, sortField, sortDirection, selectedCompanyId, selectedCustomerId, debouncedSearchValue, rowsPerPage, currentUser]);

    // Load available companies for filters (minimal data)
    const loadAvailableCompanies = useCallback(async () => {
        if (loadingCompanies || !currentUser) return;
        setLoadingCompanies(true);
        try {
            const companyIds = await chargesService.fetchConnectedCompanies(currentUser.uid, userRole);
            const companiesQuery = query(
                collection(db, 'companies'),
                ...(userRole !== 'superadmin' ? [where('companyID', 'in', companyIds.slice(0, 10))] : []),
                orderBy('name')
            );
            const snapshot = await getDocs(companiesQuery);
            const companies = snapshot.docs.map(doc => ({
                id: doc.id,
                companyID: doc.data().companyID,
                name: doc.data().name,
                logoUrl: doc.data().logoUrl || doc.data().logo,
            }));
            setAvailableCompanies(companies);
        } catch (error) {
            console.error('Error loading available companies:', error);
        } finally {
            setLoadingCompanies(false);
        }
    }, [currentUser, userRole, loadingCompanies]);

    // Load customers for selected company
    const loadCustomersForCompany = useCallback(async (companyId) => {
        if (!companyId || companyId === 'all') {
            setAvailableCustomers([]);
            return;
        }
        setLoadingCustomers(true);
        try {
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', companyId),
                orderBy('name')
            );
            const snapshot = await getDocs(customersQuery);
            const customers = snapshot.docs.map(doc => ({
                id: doc.id,
                customerID: doc.data().customerID,
                name: doc.data().name,
                companyName: doc.data().companyName,
                logoUrl: doc.data().logoUrl || doc.data().logo,
            }));
            setAvailableCustomers(customers);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoadingCustomers(false);
        }
    }, []);


    // All data processing is now handled by the service, so we can remove
    // processChargesMinimal, loadCompanyDataBatch, and loadCustomerDataBatch from this component.

    // Lazy load expanded row data on demand
    const loadExpandedData = useCallback(async (chargeId) => {
        if (expandedData.has(chargeId) || loadingExpanded.has(chargeId)) {
            return; // Already loaded or loading
        }

        setLoadingExpanded(prev => new Set(prev).add(chargeId));

        try {
            // Load full shipment data with detailed breakdown
            const shipmentDoc = await getDoc(doc(db, 'shipments', chargeId));

            if (shipmentDoc.exists()) {
                const shipmentData = shipmentDoc.data();

                // Process detailed charge breakdown
                const detailedData = {
                    shipmentData: shipmentData,
                    chargeBreakdown: processChargeBreakdown(shipmentData),
                    addressInfo: {
                        from: shipmentData.shipFrom || shipmentData.origin,
                        to: shipmentData.shipTo || shipmentData.destination
                    },
                    shipmentInfo: {
                        weight: shipmentData.totalWeight ||
                            (shipmentData.packages?.reduce((sum, pkg) => sum + (pkg.weight || 0), 0)) || 0,
                        pieces: shipmentData.totalPieces || shipmentData.packages?.length || 0,
                        carrier: shipmentData.selectedCarrier || shipmentData.carrier,
                        service: getServiceName(shipmentData),
                        status: shipmentData.status,
                        subStatus: shipmentData.subStatus
                    }
                };

                setExpandedData(prev => new Map(prev).set(chargeId, detailedData));
            }

        } catch (error) {
            console.error(`Error loading expanded data for ${chargeId}:`, error);
        } finally {
            setLoadingExpanded(prev => {
                const newSet = new Set(prev);
                newSet.delete(chargeId);
                return newSet;
            });
        }
    }, [expandedData, loadingExpanded]);

    // Process charge breakdown for expanded view
    const processChargeBreakdown = (shipmentData) => {
        if (shipmentData.manualRates && Array.isArray(shipmentData.manualRates)) {
            // QuickShip manual rates
            return {
                type: 'manual',
                charges: shipmentData.manualRates.map(rate => ({
                    name: rate.chargeName,
                    cost: parseFloat(rate.cost) || 0,
                    charge: parseFloat(rate.charge) || 0,
                    currency: rate.chargeCurrency || rate.currency
                }))
            };
        } else if (shipmentData.markupRates?.charges && shipmentData.actualRates?.charges) {
            // CreateShipmentX markup rates
            return {
                type: 'markup',
                charges: shipmentData.markupRates.charges.map(markupCharge => {
                    const actualCharge = shipmentData.actualRates.charges.find(ac => ac.name === markupCharge.name);
                    return {
                        name: markupCharge.name,
                        cost: actualCharge ? parseFloat(actualCharge.amount) || 0 : 0,
                        charge: parseFloat(markupCharge.amount) || 0,
                        currency: markupCharge.currency || shipmentData.currency
                    };
                })
            };
        }

        return {
            type: 'summary',
            charges: []
        };
    };

    // Enterprise-grade data fetching with real pagination
    const calculateMetrics = useCallback(async () => {
        setLoadingMetrics(true);
        try {
            // Build filters from state
            const filters = {
                startDate: fromDate,
                endDate: toDate,
                invoiceStatus: statusFilter || 'all',
                companyId: selectedCompanyId !== 'all' ? selectedCompanyId : null,
                customerId: selectedCustomerId !== 'all' ? selectedCustomerId : null,
                searchTerm: debouncedSearchValue
            };

            // Get connected companies for regular admins
            const connectedCompanies = userRole === 'superadmin' ? [] : (await chargesService.fetchConnectedCompanies(currentUser.uid));

            // Calculate metrics using the service (queries ALL data)
            const serverMetrics = await chargesService.calculateMetrics({
                filters,
                userRole,
                connectedCompanies
            });

            // Update state with server-calculated metrics
            setMetrics({
                totalShipments: {
                    USD: serverMetrics.totalShipments.USD,
                    CAD: serverMetrics.totalShipments.CAD
                },
                totalRevenue: {
                    USD: serverMetrics.totalRevenue.USD,
                    CAD: serverMetrics.totalRevenue.CAD
                },
                totalCosts: {
                    USD: serverMetrics.totalCosts.USD,
                    CAD: serverMetrics.totalCosts.CAD
                }
            });
        } catch (error) {
            console.error('Error calculating metrics:', error);
            enqueueSnackbar('Failed to calculate metrics', { variant: 'error' });
        } finally {
            setLoadingMetrics(false);
        }
    }, [userRole, fromDate, toDate, statusFilter, selectedCompanyId,
        selectedCustomerId, debouncedSearchValue, currentUser]);

    // Handle time range changes to set date filters
    useEffect(() => {
        const now = new Date();
        switch (timeRange) {
            case 'week':
                setFromDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
                setToDate(now);
                break;
            case '30days':
                setFromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
                setToDate(now);
                break;
            case 'year':
                setFromDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
                setToDate(now);
                break;
            case 'all':
            default:
                setFromDate(null);
                setToDate(null);
                break;
        }
    }, [timeRange]);

    // Main data loading effect
    useEffect(() => {
        if (userRole !== 'superadmin' && userRole !== 'admin') return;

        // Reset and fetch first page when filters change
        lastDocRef.current = null;
        fetchChargesPage(0, true);
    }, [
        userRole,
        sortField,
        sortDirection,
        selectedCompanyId,
        selectedCustomerId,
        debouncedSearchValue,
        fromDate,
        toDate,
        statusFilter,
        rowsPerPage
    ]);

    // Handle page changes
    useEffect(() => {
        if (page > 0 && hasMore) {
            fetchChargesPage(page, false);
        }
    }, [page, hasMore]);

    // Service level cache for QuickShip lookups
    const [serviceLevelCache, setServiceLevelCache] = useState(new Map());

    // Invoice status management
    const [invoiceStatuses, setInvoiceStatuses] = useState([]);
    const [invoiceStatusOptions, setInvoiceStatusOptions] = useState([]);

    // Load service levels for QuickShip shipments
    const loadServiceLevels = useCallback(async () => {
        if (serviceLevelCache.size > 0) return; // Already loaded

        try {
            const serviceLevelsQuery = query(
                collection(db, 'serviceLevels'),
                where('enabled', '==', true)
            );
            const snapshot = await getDocs(serviceLevelsQuery);

            const newCache = new Map();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                newCache.set(data.code, data.label);
            });



            setServiceLevelCache(newCache);
        } catch (error) {
            console.error('Error loading service levels:', error);
        }
    }, [serviceLevelCache.size]);

    // Load invoice statuses
    const loadInvoiceStatuses = useCallback(async () => {
        try {
            const statuses = await invoiceStatusService.loadInvoiceStatuses();
            setInvoiceStatuses(statuses);

            // Create filter options from dynamic invoice statuses
            const dynamicOptions = statuses
                .filter(status => status.enabled) // Only show enabled statuses in filter
                .map(status => ({
                    value: status.statusCode,
                    label: status.statusLabel
                }));

            setInvoiceStatusOptions([
                { value: '', label: 'All Statuses' },
                ...dynamicOptions
            ]);
        } catch (error) {
            console.error('Error loading invoice statuses:', error);
            // Fallback to basic options if loading fails
            setInvoiceStatusOptions([
                { value: '', label: 'All Statuses' },
                { value: 'uninvoiced', label: 'Uninvoiced' },
                { value: 'invoiced', label: 'Invoiced' },
                { value: 'paid', label: 'Paid' }
            ]);
        }
    }, []);

    // Load reference data on component mount
    useEffect(() => {
        if (currentUser && (userRole === 'superadmin' || userRole === 'admin')) {
            loadAvailableCompanies();
            loadServiceLevels(); // Load service levels for QuickShip lookups
            loadInvoiceStatuses(); // Load dynamic invoice statuses
        }
    }, [currentUser, userRole, loadServiceLevels, loadInvoiceStatuses]);

    // Refresh expanded data when service level cache is updated
    useEffect(() => {
        if (serviceLevelCache.size > 0 && expandedData.size > 0) {
            // Clear expanded data to force reload with new service level labels
            setExpandedData(new Map());
        }
    }, [serviceLevelCache.size]);

    // Load customers when company changes
    useEffect(() => {
        if (selectedCompanyId !== 'all') {
            loadCustomersForCompany(selectedCompanyId);
        } else {
            setAvailableCustomers([]);
        }
    }, [selectedCompanyId]);

    // Calculate metrics when filters change
    useEffect(() => {
        if (userRole === 'superadmin' || userRole === 'admin') {
            calculateMetrics();
        }
    }, [
        userRole,
        fromDate,
        toDate,
        statusFilter,
        selectedCompanyId,
        selectedCustomerId,
        debouncedSearchValue
    ]);

    // Utility functions
    const safeParseDate = (dateValue) => {
        if (!dateValue) return new Date();
        try {
            if (dateValue && typeof dateValue.toDate === 'function') {
                return dateValue.toDate();
            }
            if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
                return new Date(dateValue.seconds * 1000);
            }
            const date = new Date(dateValue);
            return !isNaN(date.getTime()) ? date : new Date();
        } catch (error) {
            return new Date();
        }
    };

    const safeFormatDate = (dateValue) => {
        if (!dateValue) return 'N/A';
        try {
            const date = safeParseDate(dateValue);
            return date.toLocaleDateString('en-US', {
                year: '2-digit',
                month: 'numeric',
                day: 'numeric'
            });
        } catch (error) {
            return 'N/A';
        }
    };

    const getShipmentCurrency = (shipment) => {
        return shipment.markupRates?.currency ||
            shipment.currency ||
            shipment.selectedRate?.currency ||
            shipment.actualRates?.currency ||
            (shipment.manualRates?.[0]?.chargeCurrency) ||
            'CAD';
    };

    const formatRoute = (shipment) => {
        const from = shipment.shipFrom || shipment.origin;
        const to = shipment.shipTo || shipment.destination;

        if (!from || !to) return 'N/A';

        const fromCity = from.city || 'Unknown';
        const fromState = from.state || from.province || '';
        const toCity = to.city || 'Unknown';
        const toState = to.state || to.province || '';

        return `${fromCity}, ${fromState} →\n${toCity}, ${toState}`;
    };

    const formatCurrency = (amount, currency = 'CAD') => {
        const formatted = new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: currency
        }).format(amount);

        const currencyCode = currency.toUpperCase();
        if (formatted.includes(currencyCode) || (currencyCode === 'USD' && formatted.includes('US$'))) {
            return formatted;
        }
        return `${formatted} ${currencyCode}`;
    };

    // Event handlers
    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
        setPage(0); // Reset to first page
    };

    const handleToggleExpanded = async (chargeId) => {
        const newExpanded = new Set(expandedShipments);

        if (newExpanded.has(chargeId)) {
            newExpanded.delete(chargeId);
        } else {
            newExpanded.add(chargeId);
            // Lazy load expanded data
            await loadExpandedData(chargeId);
        }

        setExpandedShipments(newExpanded);
    };

    const handleCopyShipmentId = async (shipmentId, event) => {
        if (event) event.stopPropagation();
        try {
            await navigator.clipboard.writeText(shipmentId);
            enqueueSnackbar(`Shipment ID ${shipmentId} copied to clipboard`, { variant: 'success' });
        } catch (error) {
            console.error('Failed to copy shipment ID:', error);
            enqueueSnackbar('Failed to copy shipment ID', { variant: 'error' });
        }
    };

    const handleRefresh = () => {
        setPage(0);
        setExpandedData(new Map());
        setExpandedShipments(new Set());
        setSelectedCharges(new Set());
        lastDocRef.current = null;
        fetchChargesPage(0, true);
    };

    const handleSelectAllClick = (event) => {
        if (event.target.checked) {
            const newSelected = new Set(charges.map(charge => charge.id));
            setSelectedCharges(newSelected);
        } else {
            setSelectedCharges(new Set());
        }
    };

    const handleSelectClick = (chargeId) => {
        const newSelected = new Set(selectedCharges);
        if (newSelected.has(chargeId)) {
            newSelected.delete(chargeId);
        } else {
            newSelected.add(chargeId);
        }
        setSelectedCharges(newSelected);
    };

    const handleBulkInvoice = async () => {
        if (selectedCharges.size === 0) {
            enqueueSnackbar('No charges selected', { variant: 'warning' });
            return;
        }

        // Navigate to invoice generation with selected charges
        const chargeIds = Array.from(selectedCharges);
        navigate('/admin/billing/generate', {
            state: { preSelectedCharges: chargeIds }
        });
    };

    const handleExport = () => {
        // Export current page data only for performance
        const csvData = charges.map(charge => ({
            'Shipment ID': charge.shipmentID,
            'Company': charge.companyName,
            'Company ID': charge.companyID,
            'Customer': charge.customerName,
            'Route': charge.route.replace('\n', ' '),
            'Carrier': charge.carrierName,
            'Service': charge.serviceName,
            'Actual Cost': charge.actualCost.toFixed(2),
            'Customer Charge': charge.customerCharge.toFixed(2),
            'Margin': charge.margin.toFixed(2),
            'Margin %': charge.marginPercent.toFixed(1) + '%',
            'Status': charge.status,
            'Date': safeFormatDate(charge.shipmentDate),
            'Currency': charge.currency,
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
        a.download = `charges-export-page-${page + 1}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        enqueueSnackbar(`Charges exported successfully (Page ${page + 1})`, { variant: 'success' });
    };

    // Inline editing handlers
    const handleStartEditInvoiceStatus = (chargeId, currentInvoiceStatus, event) => {
        setPopoverChargeId(chargeId);
        setEditingStatusValue(currentInvoiceStatus);
        setStatusPopoverAnchor(event.currentTarget);
    };

    const handleCancelEditInvoiceStatus = () => {
        setEditingInvoiceStatus(null);
        setEditingStatusValue('');
        setSavingStatus(false);
        setStatusPopoverAnchor(null);
        setPopoverChargeId(null);
    };

    const handleClosePopover = () => {
        setStatusPopoverAnchor(null);
        setPopoverChargeId(null);
        setEditingStatusValue('');
    };

    const handleSaveInvoiceStatus = async (chargeId, newStatusValue = null) => {
        const statusToSave = newStatusValue || editingStatusValue;
        const currentCharge = charges.find(c => c.id === chargeId);
        // Compare with the charge's current invoice status, not the shipment delivery status
        if (!statusToSave || statusToSave === currentCharge?.status) {
            handleClosePopover();
            return;
        }

        setSavingStatus(true);
        try {
            // Update the charge status in the database
            const charge = charges.find(c => c.id === chargeId);
            if (!charge) {
                throw new Error('Charge not found');
            }

            console.log(`Updating invoice status for shipment ${charge.shipmentID} from "${currentCharge?.status}" to "${statusToSave}"`);

            // Find the actual Firestore document that contains this shipmentID
            const shipmentsQuery = query(
                collection(db, 'shipments'),
                where('shipmentID', '==', charge.shipmentID),
                limit(1)
            );

            const querySnapshot = await getDocs(shipmentsQuery);

            if (querySnapshot.empty) {
                throw new Error(`No shipment document found with shipmentID: ${charge.shipmentID}`);
            }

            // Get the actual document ID (not the shipmentID field)
            const shipmentDoc = querySnapshot.docs[0];
            const actualDocumentId = shipmentDoc.id;

            console.log(`Found shipment document ID: ${actualDocumentId} for shipmentID: ${charge.shipmentID}`);

            // Update using the actual document ID
            const shipmentRef = doc(db, 'shipments', actualDocumentId);
            await updateDoc(shipmentRef, {
                invoiceStatus: statusToSave,
                updatedAt: new Date(),
                updatedBy: currentUser.email
            });

            console.log(`Successfully updated shipment document ${actualDocumentId} (shipmentID: ${charge.shipmentID}) invoiceStatus to "${statusToSave}"`);

            // Verify the update by reading the document back
            const updatedShipment = await getDoc(shipmentRef);
            if (updatedShipment.exists()) {
                const shipmentData = updatedShipment.data();
                console.log(`Verified: shipment ${charge.shipmentID} now has invoiceStatus: "${shipmentData.invoiceStatus}"`);
            }

            // Update local state - charge.status represents invoice status, not shipment delivery status
            setCharges(prevCharges =>
                prevCharges.map(c =>
                    c.id === chargeId
                        ? { ...c, status: statusToSave }
                        : c
                )
            );

            enqueueSnackbar('Invoice status updated successfully', { variant: 'success' });
            handleClosePopover();

            // Force refresh of the charges data to ensure consistency
            setTimeout(() => {
                console.log('Refreshing charges data after invoice status update');
                fetchChargesPage(page, true);
            }, 1000);

        } catch (error) {
            console.error('Error updating invoice status:', error);
            enqueueSnackbar('Failed to update invoice status', { variant: 'error' });
        } finally {
            setSavingStatus(false);
        }
    };

    // Keyboard event handler for inline editing
    const handleKeyDown = (event, chargeId) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSaveInvoiceStatus(chargeId);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            handleCancelEditInvoiceStatus();
        }
    };

    const getSortIcon = (field) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? '↑' : '↓';
    };



    // Helper function to extract service name from shipment data
    const getServiceName = (shipmentData) => {
        // For QuickShip shipments, look up service level code in serviceLevels collection
        if (shipmentData?.creationMethod === 'quickship') {
            const serviceLevelCode = shipmentData?.shipmentInfo?.serviceLevel;

            if (serviceLevelCode && serviceLevelCache.has(serviceLevelCode)) {
                return serviceLevelCache.get(serviceLevelCode);
            }
            // Fallback to the code itself if not found in cache
            return serviceLevelCode || 'N/A';
        }

        // Priority order for service extraction (non-QuickShip):
        // 1. Universal format in selectedRate
        if (shipmentData?.selectedRate?.service?.name) {
            return shipmentData.selectedRate.service.name;
        }

        // 2. Legacy service fields in selectedRate
        if (shipmentData?.selectedRate?.serviceName) {
            return shipmentData.selectedRate.serviceName;
        }

        // 3. Direct service field on shipment
        if (shipmentData?.service) {
            return shipmentData.service;
        }

        // 4. Service from markupRates or actualRates
        if (shipmentData?.markupRates?.service) {
            return shipmentData.markupRates.service;
        }

        if (shipmentData?.actualRates?.service) {
            return shipmentData.actualRates.service;
        }

        // 5. Check for service in shipmentInfo
        if (shipmentData?.shipmentInfo?.service) {
            return shipmentData.shipmentInfo.service;
        }

        // 6. Check selectedRate for other service fields
        if (shipmentData?.selectedRate?.Service) {
            return shipmentData.selectedRate.Service;
        }

        // 7. Check for LTL-specific service fields
        if (shipmentData?.selectedRate?.serviceLevel) {
            const serviceLevel = shipmentData.selectedRate.serviceLevel;
            // Replace "any" with "Standard Service"
            if (serviceLevel && serviceLevel.toLowerCase() === 'any') {
                return 'Standard Service';
            }
            return serviceLevel;
        }

        return 'N/A';
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

    // Render expanded row content
    const renderExpandedContent = (charge) => {
        const data = expandedData.get(charge.id);
        const isLoading = loadingExpanded.has(charge.id);

        if (isLoading) {
            return (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography sx={{ mt: 1, fontSize: '12px', color: '#6b7280' }}>
                        Loading detailed information...
                    </Typography>
                </Box>
            );
        }

        if (!data) {
            return (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                        No detailed data available
                    </Typography>
                </Box>
            );
        }

        return (
            <Box sx={{ margin: 2 }}>
                <Grid container spacing={3}>
                    {/* Shipment Information */}
                    <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                SHIPMENT INFORMATION
                            </Typography>
                            <Box sx={{ fontSize: '11px', color: '#6b7280' }}>
                                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>ID:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>{charge.shipmentID}</Typography>
                                </Box>
                                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Date:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>{safeFormatDate(charge.shipmentDate)}</Typography>
                                </Box>
                                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Carrier:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>{data.shipmentInfo.carrier || 'N/A'}</Typography>
                                </Box>
                                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Service:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>{data.shipmentInfo.service || 'N/A'}</Typography>
                                </Box>
                                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Status:</Typography>
                                    <EnhancedStatusChip
                                        status={data.shipmentInfo.status || 'unknown'}
                                        subStatus={data.shipmentInfo.subStatus}
                                        size="small"
                                        sx={{ fontSize: '10px', height: '18px' }}
                                    />
                                </Box>
                                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Weight:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        {(data.shipmentInfo.weight && data.shipmentInfo.weight > 0) ? `${data.shipmentInfo.weight.toLocaleString()} lbs` : 'N/A'}
                                    </Typography>
                                </Box>
                                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 500, mr: 1 }}>Pieces:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        {data.shipmentInfo.pieces || 'N/A'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Address Information */}
                    <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                ADDRESS INFORMATION
                            </Typography>
                            <Box sx={{ fontSize: '11px', color: '#6b7280' }}>
                                <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 0.5 }}>From:</Typography>
                                <Typography sx={{ fontSize: '11px' }}>
                                    {data.addressInfo.from?.companyName || data.addressInfo.from?.company || 'Unknown Company'}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', mb: 1 }}>
                                    {data.addressInfo.from?.street || 'No address'}<br />
                                    {data.addressInfo.from?.city}, {data.addressInfo.from?.state || data.addressInfo.from?.province} {data.addressInfo.from?.postalCode} {data.addressInfo.from?.country || ''}
                                </Typography>

                                <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 0.5, mt: 1 }}>To:</Typography>
                                <Typography sx={{ fontSize: '11px' }}>
                                    {data.addressInfo.to?.companyName || data.addressInfo.to?.company || charge.customerName || 'Unknown Customer'}
                                </Typography>
                                <Typography sx={{ fontSize: '11px' }}>
                                    {data.addressInfo.to?.street || 'No address'}<br />
                                    {data.addressInfo.to?.city}, {data.addressInfo.to?.state || data.addressInfo.to?.province} {data.addressInfo.to?.postalCode} {data.addressInfo.to?.country || ''}
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Charge Breakdown */}
                    <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                CHARGE BREAKDOWN
                            </Typography>
                            <Box sx={{ color: '#000000' }}>
                                {data.chargeBreakdown.charges.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {data.chargeBreakdown.charges.map((chargeItem, index) => {
                                            const profit = chargeItem.charge - chargeItem.cost;
                                            return (
                                                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.5 }}>
                                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                        {chargeItem.name}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {formatCurrency(chargeItem.cost, chargeItem.currency)} | {formatCurrency(chargeItem.charge, chargeItem.currency)}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#228B22', fontWeight: 500 }}>
                                                            +{formatCurrency(profit, chargeItem.currency)}
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
                                                    {formatCurrency(charge.actualCost, charge.currency)} | {formatCurrency(charge.customerCharge, charge.currency)}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#228B22', fontWeight: 600 }}>
                                                    +{formatCurrency(charge.margin, charge.currency)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Typography sx={{ fontSize: '11px', fontStyle: 'italic', color: '#6b7280' }}>
                                        No detailed charge breakdown available
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        );
    };

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
                            onClick={handleRefresh}
                            sx={{ fontSize: '11px' }}
                        >
                            Refresh
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={handleExport}
                            disabled={charges.length === 0}
                            sx={{ fontSize: '11px' }}
                        >
                            Export Page
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
                                    <MenuItem value="week" sx={{ fontSize: '12px' }}>Last 7 Days</MenuItem>
                                    <MenuItem value="30days" sx={{ fontSize: '12px' }}>Last 30 Days</MenuItem>
                                    <MenuItem value="year" sx={{ fontSize: '12px' }}>Last Year</MenuItem>
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>All Time</MenuItem>
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
                                }}
                                options={availableCompanies}
                                getOptionLabel={(option) => option.name || option.companyID}
                                isOptionEqualToValue={(option, value) => option.companyID === value?.companyID}
                                loading={loadingCompanies}
                                renderOption={(props, option) => (
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
                                            {option.logoUrl ? (
                                                <img
                                                    src={option.logoUrl}
                                                    alt="Company"
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'contain',
                                                        borderRadius: '3px'
                                                    }}
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.nextSibling.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div style={{
                                                fontSize: '8px',
                                                fontWeight: 600,
                                                color: '#6b7280',
                                                lineHeight: 1,
                                                display: option.logoUrl ? 'none' : 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '100%',
                                                height: '100%'
                                            }}>
                                                {(option.name || option.companyID || 'CO')[0].toUpperCase()}
                                            </div>
                                        </Box>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {option.name || option.companyID}
                                            </Typography>
                                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                Company ID: {option.companyID}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
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
                                    {invoiceStatusOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Summary Cards with Currency Breakdown */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', mb: 1 }}>
                                    Total Shipments
                                </Typography>
                                {loadingMetrics ? (
                                    <Skeleton variant="text" width={100} height={24} />
                                ) : (
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
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', mb: 1 }}>
                                    Total Revenue
                                </Typography>
                                {loadingMetrics ? (
                                    <Skeleton variant="text" width={120} height={24} />
                                ) : (
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
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', mb: 1 }}>
                                    Total Costs
                                </Typography>
                                {loadingMetrics ? (
                                    <Skeleton variant="text" width={120} height={24} />
                                ) : (
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
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Status/Count Display and Bulk Actions */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Showing {Math.min(page * rowsPerPage + 1, totalCount || 0)} - {Math.min((page + 1) * rowsPerPage, totalCount || 0)} of {(totalCount || 0).toLocaleString()} total charges
                        </Typography>
                        {selectedCharges.size > 0 && (
                            <Chip
                                label={`${selectedCharges.size} selected`}
                                size="small"
                                color="primary"
                                onDelete={() => setSelectedCharges(new Set())}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {selectedCharges.size > 0 && (
                            <>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<ReceiptIcon />}
                                    onClick={handleBulkInvoice}
                                    sx={{ fontSize: '11px' }}
                                >
                                    Generate Invoice
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EditIcon />}
                                    onClick={() => enqueueSnackbar('Bulk edit coming soon', { variant: 'info' })}
                                    sx={{ fontSize: '11px' }}
                                >
                                    Update Status
                                </Button>
                            </>
                        )}
                        {debouncedSearchValue && (
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6366f1' }}>
                                Search: "{debouncedSearchValue}"
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* Optimized Charges Table */}
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox" sx={{ backgroundColor: '#f8fafc' }}>
                                        <Checkbox
                                            size="small"
                                            indeterminate={selectedCharges.size > 0 && selectedCharges.size < charges.length}
                                            checked={charges.length > 0 && selectedCharges.size === charges.length}
                                            onChange={handleSelectAllClick}
                                        />
                                    </TableCell>
                                    <SortableTableCell field="shipmentID">ID</SortableTableCell>
                                    <SortableTableCell field="shipmentDate">Date</SortableTableCell>
                                    <SortableTableCell field="companyName">Company</SortableTableCell>
                                    <SortableTableCell field="customerName">Customer</SortableTableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc' }}>
                                        Carrier
                                    </TableCell>
                                    <SortableTableCell field="actualCost">Cost</SortableTableCell>
                                    <SortableTableCell field="customerCharge">Quoted</SortableTableCell>
                                    <SortableTableCell field="actualCharge">Actual</SortableTableCell>
                                    <SortableTableCell field="margin">Profit</SortableTableCell>
                                    <SortableTableCell field="status">Shipment Status</SortableTableCell>
                                    <SortableTableCell field="invoiceStatus">Invoice Status</SortableTableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc', width: 40 }}>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    // Optimized skeleton loading
                                    Array.from({ length: rowsPerPage }).map((_, index) => (
                                        <TableRow key={`skeleton-${index}`}>
                                            {Array.from({ length: 12 }).map((_, cellIndex) => (
                                                <TableCell key={cellIndex} sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Skeleton variant="text" width={cellIndex === 0 ? 120 : cellIndex < 3 ? 100 : 80} height={16} />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : charges.length > 0 ? (
                                    charges.map((charge) => (
                                        <React.Fragment key={charge.id}>
                                            <TableRow
                                                hover
                                                sx={{
                                                    '&:hover': { backgroundColor: '#f8fafc' },
                                                    backgroundColor: selectedCharges.has(charge.id) ? '#f0f4ff' : 'inherit'
                                                }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        size="small"
                                                        checked={selectedCharges.has(charge.id)}
                                                        onChange={() => handleSelectClick(charge.id)}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography
                                                            component="span"
                                                            sx={{
                                                                fontSize: '12px',
                                                                color: '#3b82f6',
                                                                cursor: 'pointer',
                                                                '&:hover': { textDecoration: 'underline' }
                                                            }}
                                                            onClick={(event) => handleToggleExpanded(charge.id)}
                                                        >
                                                            {charge.shipmentID}
                                                        </Typography>
                                                        <Tooltip title="Copy Shipment ID">
                                                            <IconButton
                                                                size="small"
                                                                sx={{ p: 0.25, color: '#6b7280' }}
                                                                onClick={(event) => handleCopyShipmentId(charge.shipmentID, event)}
                                                            >
                                                                <CopyIcon sx={{ fontSize: '14px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    {safeFormatDate(charge.shipmentDate)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
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
                                                            {charge.companyLogo ? (
                                                                <img
                                                                    src={charge.companyLogo}
                                                                    alt="Company"
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'contain',
                                                                        borderRadius: '3px'
                                                                    }}
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div style={{
                                                                fontSize: '8px',
                                                                fontWeight: 600,
                                                                color: '#6b7280',
                                                                lineHeight: 1,
                                                                display: charge.companyLogo ? 'none' : 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '100%',
                                                                height: '100%'
                                                            }}>
                                                                {(charge.companyName || 'CO')[0].toUpperCase()}
                                                            </div>
                                                        </Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {charge.companyName}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
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
                                                            {charge.customerLogo ? (
                                                                <img
                                                                    src={charge.customerLogo}
                                                                    alt="Customer"
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'contain',
                                                                        borderRadius: '3px'
                                                                    }}
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div style={{
                                                                fontSize: '8px',
                                                                fontWeight: 600,
                                                                color: '#6b7280',
                                                                lineHeight: 1,
                                                                display: charge.customerLogo ? 'none' : 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '100%',
                                                                height: '100%'
                                                            }}>
                                                                {(charge.customerName || 'CU')[0].toUpperCase()}
                                                            </div>
                                                        </Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {charge.customerName}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        {charge.carrierName}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', color: '#059669' }}>
                                                    {charge.actualCost > 0 ? formatCurrency(charge.actualCost, charge.currency) : '$0.00'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', color: '#000000' }}>
                                                    {charge.customerCharge > 0 ? formatCurrency(charge.customerCharge, charge.currency) : '$0.00'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', color: '#dc2626' }}>
                                                    {charge.actualCharge > 0 ? formatCurrency(charge.actualCharge, charge.currency) : (
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            TBD
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Typography sx={{ fontSize: '12px', color: charge.margin > 0 ? '#228B22' : '#6b7280', fontWeight: 600 }}>
                                                        {charge.margin !== 0 ? formatCurrency(charge.margin, charge.currency) : '$0.00'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                        {/* Top row: Manual Override Indicator + Master Status */}
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            {/* Manual Override Indicator - Small Bold M */}
                                                            {charge.hasManualOverride && (
                                                                <Tooltip title="Status manually overridden">
                                                                    <Box sx={{
                                                                        width: '12px',
                                                                        height: '12px',
                                                                        backgroundColor: '#e5e7eb',
                                                                        color: '#374151',
                                                                        borderRadius: '2px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: '8px',
                                                                        fontWeight: 'bold',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        M
                                                                    </Box>
                                                                </Tooltip>
                                                            )}
                                                            <EnhancedStatusChip
                                                                status={charge.shipmentStatus}
                                                                subStatus={charge.shipmentSubStatus}
                                                                size="small"
                                                                compact={true}
                                                                displayMode="master"
                                                                showTooltip={true}
                                                                sx={{ fontSize: '10px', height: '18px' }}
                                                            />
                                                        </Box>

                                                        {/* Bottom row: Sub-status if available */}
                                                        {charge.shipmentSubStatus && (
                                                            <Box sx={{ pl: charge.hasManualOverride ? 2 : 0 }}>
                                                                <EnhancedStatusChip
                                                                    status={charge.shipmentStatus}
                                                                    subStatus={charge.shipmentSubStatus}
                                                                    size="small"
                                                                    compact={false}
                                                                    displayMode="sub-only"
                                                                    showTooltip={false}
                                                                    sx={{ fontSize: '9px', height: '16px' }}
                                                                />
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                    {/* Invoice Status (NOT shipment delivery status) - with dropdown arrow */}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        {(() => {
                                                            // charge.status = invoice status (invoiced, paid, etc.)
                                                            // charge.shipmentStatus = delivery status (in transit, delivered, etc.)
                                                            const statusCode = charge.status || 'uninvoiced';
                                                            const dynamicStatus = invoiceStatuses.find(s => s.statusCode === statusCode);

                                                            if (dynamicStatus) {
                                                                return (
                                                                    <React.Fragment>
                                                                        <Chip
                                                                            label={dynamicStatus.statusLabel}
                                                                            size="small"
                                                                            sx={{
                                                                                fontSize: '11px',
                                                                                height: '20px',
                                                                                fontWeight: 500,
                                                                                color: dynamicStatus.fontColor || '#ffffff',
                                                                                backgroundColor: dynamicStatus.color || '#6b7280',
                                                                                border: '1px solid rgba(0,0,0,0.1)',
                                                                                cursor: 'default'
                                                                            }}
                                                                        />
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={(e) => handleStartEditInvoiceStatus(charge.id, charge.status || 'uninvoiced', e)}
                                                                            sx={{
                                                                                p: 0.5,
                                                                                color: '#6b7280',
                                                                                '&:hover': {
                                                                                    backgroundColor: '#f3f4f6',
                                                                                    color: '#374151'
                                                                                }
                                                                            }}
                                                                        >
                                                                            <ArrowDownIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </React.Fragment>
                                                                );
                                                            } else {
                                                                // Fallback for unknown statuses
                                                                return (
                                                                    <React.Fragment>
                                                                        <Chip
                                                                            label={statusCode}
                                                                            size="small"
                                                                            sx={{
                                                                                fontSize: '11px',
                                                                                height: '20px',
                                                                                fontWeight: 500,
                                                                                color: '#ffffff',
                                                                                backgroundColor: '#6b7280',
                                                                                border: '1px solid rgba(0,0,0,0.1)',
                                                                                cursor: 'default'
                                                                            }}
                                                                        />
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={(e) => handleStartEditInvoiceStatus(charge.id, charge.status || 'uninvoiced', e)}
                                                                            sx={{
                                                                                p: 0.5,
                                                                                color: '#6b7280',
                                                                                '&:hover': {
                                                                                    backgroundColor: '#f3f4f6',
                                                                                    color: '#374151'
                                                                                }
                                                                            }}
                                                                        >
                                                                            <ArrowDownIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </React.Fragment>
                                                                );
                                                            }
                                                        })()}
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', width: 40 }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleToggleExpanded(charge.id)}
                                                        sx={{ color: '#6b7280' }}
                                                    >
                                                        {expandedShipments.has(charge.id) ?
                                                            <ArrowUpIcon fontSize="small" /> :
                                                            <AddIcon fontSize="small" />
                                                        }
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>

                                            {/* Lazy-loaded expanded content */}
                                            <TableRow>
                                                <TableCell colSpan={11} sx={{ paddingBottom: 0, paddingTop: 0, borderBottom: expandedShipments.has(charge.id) ? '1px solid #e2e8f0' : 'none' }}>
                                                    <Collapse in={expandedShipments.has(charge.id)} timeout="auto" unmountOnExit>
                                                        {renderExpandedContent(charge)}
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={11} align="center">
                                            <Box sx={{ py: 6, textAlign: 'center' }}>
                                                <BusinessIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                                <Typography variant="body1" sx={{ fontSize: '14px', color: '#374151', mb: 1 }}>
                                                    No charges found
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {timeRange !== 'all' ? 'Try expanding the time range or adjusting filters' : 'No shipments with charges available'}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {/* Optimized Pagination */}
                        <TablePagination
                            component="div"
                            count={totalCount}
                            page={page}
                            onPageChange={handlePageChange}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={handleRowsPerPageChange}
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

                {/* Floating Status Popover */}
                <Popover
                    open={Boolean(statusPopoverAnchor)}
                    anchorEl={statusPopoverAnchor}
                    onClose={handleClosePopover}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    PaperProps={{
                        sx: {
                            p: 2,
                            minWidth: 320,
                            maxWidth: 400,
                            border: '1px solid #e5e7eb',
                            borderRadius: 2,
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Header with current status */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Change Invoice Status
                            </Typography>
                            <IconButton
                                size="small"
                                onClick={handleClosePopover}
                                sx={{ p: 0.5, color: '#6b7280' }}
                            >
                                <CancelIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        {/* Current status display */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Current:</Typography>
                            {(() => {
                                const currentStatus = invoiceStatuses.find(s => s.statusCode === editingStatusValue);
                                return (
                                    <Chip
                                        label={currentStatus?.statusLabel || editingStatusValue}
                                        size="small"
                                        sx={{
                                            fontSize: '11px',
                                            height: '20px',
                                            fontWeight: 500,
                                            color: currentStatus?.fontColor || '#ffffff',
                                            backgroundColor: currentStatus?.color || '#6b7280',
                                            border: '1px solid rgba(0,0,0,0.1)'
                                        }}
                                    />
                                );
                            })()}
                        </Box>

                        {/* Status options grid */}
                        <Box sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                            p: 2,
                            border: '1px solid #e5e7eb',
                            borderRadius: 1,
                            backgroundColor: '#f9fafb'
                        }}>
                            {invoiceStatuses.filter(status => status.enabled).map((status) => (
                                <Chip
                                    key={status.statusCode}
                                    label={status.statusLabel}
                                    size="small"
                                    onClick={async () => {
                                        // Only save if it's a different status
                                        if (status.statusCode !== editingStatusValue) {
                                            setEditingStatusValue(status.statusCode);
                                            await handleSaveInvoiceStatus(popoverChargeId, status.statusCode);
                                        }
                                    }}
                                    disabled={savingStatus}
                                    sx={{
                                        fontSize: '11px',
                                        height: '24px',
                                        fontWeight: 500,
                                        color: status.fontColor || '#ffffff',
                                        backgroundColor: status.color || '#6b7280',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        cursor: savingStatus ? 'not-allowed' : 'pointer',
                                        opacity: editingStatusValue === status.statusCode ? 1 : (savingStatus ? 0.5 : 0.8),
                                        transform: editingStatusValue === status.statusCode ? 'scale(1.05)' : 'scale(1)',
                                        '&:hover': {
                                            opacity: savingStatus ? 0.5 : 1,
                                            transform: savingStatus ? 'scale(1)' : 'scale(1.05)',
                                            transition: 'all 0.2s'
                                        }
                                    }}
                                />
                            ))}
                        </Box>

                        {/* Loading indicator when saving */}
                        {savingStatus && (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1 }}>
                                <CircularProgress size={16} />
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    Saving...
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Popover>
            </Box>
        </LocalizationProvider>
    );
};

export default ChargesTab; 