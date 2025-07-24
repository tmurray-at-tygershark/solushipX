import React, { useState, useEffect, useRef } from 'react';
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
    Tabs,
    Tab,
    TextField,
    Stack,
    Menu,
    Switch,
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
} from '@mui/icons-material';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { collection, query, where, getDocs, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import EDIUploader from './EDIUploader';
import EDIResults from './EDIResults';
import EDIMapping from './EDIMapping';
import PaymentTerms from './PaymentTerms';
import InvoiceManagement from './InvoiceManagement';
import ChargesTab from './ChargesTab';
import AdminBreadcrumb from '../AdminBreadcrumb';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateTimeForBilling } from '../../../utils/dateUtils';

// Import Sales Commission Module
import SalesCommissionsTab from './SalesCommissions/SalesCommissionsTab';
import GenerateInvoicesPage from './GenerateInvoicesPage';
import BulkInvoiceGenerator from './BulkInvoiceGenerator';
import APProcessing from './APProcessing';

const BillingDashboard = ({ initialTab = 'overview' }) => {
    const { currentUser, userRole } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const params = new URLSearchParams(location.search);

    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [connectedCompanies, setConnectedCompanies] = useState([]);
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        outstandingBalance: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        uninvoicedCharges: 0,
        monthlyRevenue: 0,
        growthRate: 0,
        totalCompanies: 0,
        avgTicketSize: 0,
        conversionRate: 0,
        topCarrier: '',
        revenueGrowth: 0,
        profitMargin: 0,
    });
    const [invoices, setInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
    // Enhanced filtering system
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [selectedCustomerId, setSelectedCustomerId] = useState('all');
    const [searchValue, setSearchValue] = useState('');
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [liveResults, setLiveResults] = useState([]);
    const [showLiveResults, setShowLiveResults] = useState(false);
    const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
    const [allShipments, setAllShipments] = useState([]);
    const [expandedShipments, setExpandedShipments] = useState(new Set());

    // Legacy filters (keep for backward compatibility)
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [customerName, setCustomerName] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('');
    const [selectedUploadId, setSelectedUploadId] = useState(params.uploadId || null);
    const [showEdiResults, setShowEdiResults] = useState(!!params.uploadId);
    const [ediProcessedItems, setEdiProcessedItems] = useState([]);
    const [ediLoading, setEdiLoading] = useState(false);
    const [ediDialogOpen, setEdiDialogOpen] = useState(false);
    const [timeRange, setTimeRange] = useState('all'); // Default to 'all' to show everything
    const [revenueTrends, setRevenueTrends] = useState([]);
    const [revenueByCompany, setRevenueByCompany] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [ediFiles, setEdiFiles] = useState([]);
    const fileInputRef = useRef(null);
    const { enqueueSnackbar } = useSnackbar();
    const [companies, setCompanies] = useState([]);

    // Computed filtered invoices
    const filteredInvoices = invoices.filter(invoice => {
        const searchStr = searchTerm.toLowerCase();
        return (
            (invoice.number || invoice.id || '').toLowerCase().includes(searchStr) ||
            (invoice.company || invoice.companyName || '').toLowerCase().includes(searchStr) ||
            (invoice.status || '').toLowerCase().includes(searchStr)
        );
    });

    // Handle initial tab and URL params
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }

        // If we have an uploadId in the URL, show EDI results
        if (params.uploadId) {
            setSelectedUploadId(params.uploadId);
            setShowEdiResults(true);
            setActiveTab('edi');
        }
    }, [initialTab, params.uploadId]);

    // Listen for path changes to update the active tab
    useEffect(() => {
        const path = location.pathname;
        // Remove console.log for production
        // console.log('BillingDashboard path listener:', path);

        if (path.includes('/admin/billing/payment-terms')) {
            setActiveTab('payment-terms');
        } else if (path.includes('/admin/billing/ap-processing')) {
            setActiveTab('ap-processing');
        } else if (path.includes('/admin/billing/generate')) {
            // Handle generate tab properly
            setActiveTab('generate');
        } else if (path.includes('/admin/billing/business')) {
            setActiveTab('business');
        } else if (path.includes('/admin/billing/payments')) {
            setActiveTab('payments');
        } else if (path.includes('/admin/billing/commissions')) {
            setActiveTab('commissions');
        } else if (path.includes('/admin/billing/overview')) {
            setActiveTab('overview');
        } else if (path.includes('/admin/billing/charges')) {
            setActiveTab('charges');
        } else if (path.startsWith('/admin/billing') &&
            !path.includes('/generate') &&
            !path.includes('/invoice/') &&
            !path.includes('/payment-terms') &&
            !path.includes('/charges') &&
            !path.includes('/edi') &&
            !path.includes('/edi-mapping')) {
            setActiveTab('invoices');
        }
    }, [location.pathname]);

    useEffect(() => {
        fetchConnectedCompanies();
        fetchBillingData();
        fetchEdiHistory();
    }, [timeRange, currentUser]);

    // Load companies when connected companies change
    useEffect(() => {
        loadAvailableCompanies();
    }, [connectedCompanies, userRole, currentUser]);

    // Load customers when company selection changes
    useEffect(() => {
        loadCustomersForCompany(selectedCompanyId);
    }, [selectedCompanyId]);

    // Load all shipments for search functionality
    useEffect(() => {
        const loadShipmentsForSearch = async () => {
            if (!currentUser || userRole === 'user') return;

            try {
                let shipmentsQuery;

                if (userRole === 'superadmin') {
                    shipmentsQuery = query(
                        collection(db, 'shipments'),
                        orderBy('createdAt', 'desc'),
                        limit(500)
                    );
                } else if (userRole === 'admin') {
                    const connectedCompanyIds = availableCompanies.map(c => c.companyID);
                    if (connectedCompanyIds.length > 0) {
                        shipmentsQuery = query(
                            collection(db, 'shipments'),
                            where('companyID', 'in', connectedCompanyIds.slice(0, 10)),
                            orderBy('createdAt', 'desc'),
                            limit(500)
                        );
                    } else {
                        setAllShipments([]);
                        return;
                    }
                }

                const snapshot = await getDocs(shipmentsQuery);
                const shipments = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setAllShipments(shipments);

            } catch (error) {
                console.error('Error loading shipments for search:', error);
                setAllShipments([]);
            }
        };

        loadShipmentsForSearch();
    }, [currentUser, userRole, availableCompanies]);

    const fetchConnectedCompanies = async () => {
        try {
            if (!currentUser) return;

            let companies = [];

            if (userRole === 'superadmin') {
                // Super admin can see all companies
                const companiesSnapshot = await getDocs(collection(db, 'companies'));
                companies = companiesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else if (userRole === 'admin') {
                // Regular admin sees connected companies
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const userData = userDoc.data();

                if (userData?.connectedCompanies && userData.connectedCompanies.length > 0) {
                    const companyQueries = userData.connectedCompanies.map(companyId =>
                        getDoc(doc(db, 'companies', companyId))
                    );
                    const companyDocs = await Promise.all(companyQueries);
                    companies = companyDocs
                        .filter(doc => doc.exists())
                        .map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }

            setConnectedCompanies(companies);
            console.log('🏢 Connected companies for', userRole, ':', companies.length);
        } catch (error) {
            console.error('❌ Error fetching connected companies:', error);
        }
    };

    // Load available companies for filtering
    const loadAvailableCompanies = async () => {
        if (!currentUser || userRole === 'user') return;

        setLoadingCompanies(true);
        try {
            let companiesQuery;

            if (userRole === 'superadmin') {
                // Super admins can see all companies
                companiesQuery = query(collection(db, 'companies'));
            } else if (userRole === 'admin') {
                // Admins can see their connected companies
                const connectedCompanyIds = connectedCompanies.map(c => c.companyID);
                if (connectedCompanyIds.length > 0) {
                    companiesQuery = query(
                        collection(db, 'companies'),
                        where('companyID', 'in', connectedCompanyIds)
                    );
                } else {
                    setAvailableCompanies([]);
                    return;
                }
            }

            const companiesSnapshot = await getDocs(companiesQuery);
            const companies = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAvailableCompanies(companies);

        } catch (error) {
            console.error('Error loading companies:', error);
            setAvailableCompanies([]);
        } finally {
            setLoadingCompanies(false);
        }
    };

    // Load customers for selected company
    const loadCustomersForCompany = async (companyId) => {
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
    };

    // Generate live shipment results for autocomplete
    const generateLiveShipmentResults = (searchTerm, shipments) => {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        const normalizedTerm = searchTerm.toLowerCase();
        const results = [];

        shipments.slice(0, 100).forEach(shipment => {
            const searchableFields = [
                shipment.shipmentID,
                shipment.id,
                shipment.referenceNumber,
                shipment.trackingNumber,
                shipment.companyID,
                shipment.shipTo?.companyName,
                shipment.shipFrom?.companyName,
                shipment.carrier
            ];

            const matches = searchableFields.some(field =>
                field && String(field).toLowerCase().includes(normalizedTerm)
            );

            if (matches) {
                results.push({
                    type: 'shipment',
                    shipmentId: shipment.shipmentID || shipment.id,
                    documentId: shipment.id,
                    shipment: shipment,
                    route: `${shipment.shipFrom?.city || 'N/A'} → ${shipment.shipTo?.city || 'N/A'}`,
                    status: shipment.status,
                    companyName: shipment.shipFrom?.companyName || 'N/A',
                    score: String(shipment.shipmentID || shipment.id).toLowerCase().startsWith(normalizedTerm) ? 10 : 5
                });
            }
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);
    };

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Super admin can proceed without connected companies, regular admin needs them
            if (userRole !== 'superadmin' && connectedCompanies.length === 0) {
                setLoading(false);
                return;
            }

            console.log('🔍 Fetching billing data for', userRole, 'with', connectedCompanies.length, 'companies');

            // Helper function to get shipment currency
            const getShipmentCurrency = (shipment) => {
                // Try to extract currency from multiple sources
                return shipment.currency ||
                    shipment.selectedRate?.currency ||
                    shipment.markupRates?.currency ||
                    shipment.actualRates?.currency ||
                    (shipment.shipFrom?.country === 'CA' || shipment.shipTo?.country === 'CA' ? 'CAD' : 'USD') ||
                    'USD'; // Default fallback
            };

            // Helper function to calculate metrics (extracted for reuse)
            function calculateMetrics(invoicesData, shipmentsData) {
                // Calculate uninvoiced charges by currency from shipments with enhanced QuickShip support
                const uninvoicedChargesByCurrency = { USD: 0, CAD: 0 };

                shipmentsData
                    .filter(shipment => !shipment.invoiceStatus || shipment.invoiceStatus === 'uninvoiced')
                    .forEach(shipment => {
                        let charge = 0;
                        const currency = getShipmentCurrency(shipment);

                        // Enhanced charge extraction to handle QuickShip orders (matching table logic)
                        if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
                            // Sum up customer charges from manual rates
                            charge = shipment.manualRates.reduce((sum, rate) => {
                                return sum + (parseFloat(rate.charge) || 0);
                            }, 0);

                        } else {
                            // Use dual rate system for regular shipments
                            charge = shipment.markupRates?.totalCharges ||
                                shipment.totalCharges ||
                                shipment.selectedRate?.totalCharges || 0;
                        }

                        uninvoicedChargesByCurrency[currency] = (uninvoicedChargesByCurrency[currency] || 0) + charge;
                    });

                const uninvoicedCharges = uninvoicedChargesByCurrency.USD + uninvoicedChargesByCurrency.CAD;

                // Update state with real data
                setInvoices(invoicesData);

                // Calculate comprehensive metrics from real data by currency
                const totalRevenueByCurrency = { USD: 0, CAD: 0 };
                const outstandingBalanceByCurrency = { USD: 0, CAD: 0 };

                invoicesData.forEach(invoice => {
                    const currency = invoice.currency || 'USD';
                    const amount = invoice.total || invoice.amount || 0;

                    if (invoice.status === 'paid') {
                        totalRevenueByCurrency[currency] = (totalRevenueByCurrency[currency] || 0) + amount;
                    } else if (invoice.status === 'pending' || invoice.status === 'unpaid') {
                        outstandingBalanceByCurrency[currency] = (outstandingBalanceByCurrency[currency] || 0) + amount;
                    }
                });

                const totalRevenue = totalRevenueByCurrency.USD + totalRevenueByCurrency.CAD;
                const outstandingBalance = outstandingBalanceByCurrency.USD + outstandingBalanceByCurrency.CAD;

                const paidInvoices = invoicesData.filter(invoice => invoice.status === 'paid').length;
                const pendingInvoices = invoicesData.filter(invoice =>
                    invoice.status === 'pending' || invoice.status === 'unpaid').length;

                // Calculate monthly revenue by currency (current month)
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const monthlyRevenueByCurrency = { USD: 0, CAD: 0 };
                invoicesData
                    .filter(invoice => {
                        if (!invoice.createdAt) return false;
                        const invoiceDate = invoice.createdAt.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
                        return invoiceDate.getMonth() === currentMonth &&
                            invoiceDate.getFullYear() === currentYear &&
                            invoice.status === 'paid';
                    })
                    .forEach(invoice => {
                        const currency = invoice.currency || 'USD';
                        const amount = invoice.total || invoice.amount || 0;
                        monthlyRevenueByCurrency[currency] = (monthlyRevenueByCurrency[currency] || 0) + amount;
                    });

                const monthlyRevenue = monthlyRevenueByCurrency.USD + monthlyRevenueByCurrency.CAD;

                // Calculate advanced metrics
                const totalCharges = shipmentsData.reduce((sum, shipment) => {
                    let charge = 0;
                    if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
                        charge = shipment.manualRates.reduce((sum, rate) => sum + (parseFloat(rate.charge) || 0), 0);
                    } else {
                        charge = shipment.markupRates?.totalCharges || shipment.totalCharges || shipment.selectedRate?.totalCharges || 0;
                    }
                    return sum + charge;
                }, 0);

                const totalCosts = shipmentsData.reduce((sum, shipment) => {
                    let cost = 0;
                    if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
                        cost = shipment.manualRates.reduce((sum, rate) => sum + (parseFloat(rate.cost) || 0), 0);
                    } else {
                        cost = shipment.actualRates?.totalCharges || shipment.totalCharges || shipment.selectedRate?.totalCharges || 0;
                    }
                    return sum + cost;
                }, 0);

                const avgTicketSize = shipmentsData.length > 0 ? totalCharges / shipmentsData.length : 0;
                const profitMargin = totalCharges > 0 ? ((totalCharges - totalCosts) / totalCharges) * 100 : 0;

                // Find top carrier
                const carrierRevenue = {};
                shipmentsData.forEach(shipment => {
                    const carrier = shipment.selectedCarrier || shipment.carrier || 'Unknown';
                    let charge = 0;
                    if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
                        charge = shipment.manualRates.reduce((sum, rate) => sum + (parseFloat(rate.charge) || 0), 0);
                    } else {
                        charge = shipment.markupRates?.totalCharges || shipment.totalCharges || shipment.selectedRate?.totalCharges || 0;
                    }
                    carrierRevenue[carrier] = (carrierRevenue[carrier] || 0) + charge;
                });

                const topCarrier = Object.keys(carrierRevenue).reduce((a, b) =>
                    carrierRevenue[a] > carrierRevenue[b] ? a : b, 'N/A');

                // Calculate last month for growth comparison
                const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

                const lastMonthRevenue = invoicesData
                    .filter(invoice => {
                        if (!invoice.createdAt) return false;
                        const invoiceDate = invoice.createdAt.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
                        return invoiceDate.getMonth() === lastMonth &&
                            invoiceDate.getFullYear() === lastMonthYear &&
                            invoice.status === 'paid';
                    })
                    .reduce((sum, invoice) => sum + (invoice.total || invoice.amount || 0), 0);

                const revenueGrowth = lastMonthRevenue > 0 ?
                    ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

                setMetrics({
                    totalRevenue,
                    totalRevenueByCurrency,
                    outstandingBalance,
                    outstandingBalanceByCurrency,
                    paidInvoices,
                    pendingInvoices,
                    uninvoicedCharges,
                    uninvoicedChargesByCurrency,
                    monthlyRevenue,
                    monthlyRevenueByCurrency,
                    growthRate: revenueGrowth,
                    totalCompanies: userRole === 'superadmin' ? shipmentsData.map(s => s.companyID).filter((v, i, a) => a.indexOf(v) === i).length : connectedCompanies.length,
                    avgTicketSize,
                    conversionRate: 85.7, // This would need to be calculated from actual conversion data
                    topCarrier,
                    revenueGrowth,
                    profitMargin,
                });

                // Prepare revenue trends data
                const trends = prepareRevenueTrends(invoicesData);
                setRevenueTrends(trends);

                // Prepare revenue by company data
                const companyRevenue = prepareCompanyRevenue(invoicesData);
                setRevenueByCompany(companyRevenue);
            }

            let shipmentsSnapshot;

            if (userRole === 'superadmin') {
                // Super admin: Fetch ALL shipments and invoices
                console.log('🔒 Super admin mode: Fetching ALL data');
                const [invoicesSnapshot, allShipmentsSnapshot] = await Promise.all([
                    getDocs(query(
                        collection(db, 'invoices'),
                        where('createdAt', '>=', getStartDate(timeRange)),
                        orderBy('createdAt', 'desc')
                    )),
                    getDocs(query(
                        collection(db, 'shipments'),
                        where('status', '!=', 'draft'),
                        orderBy('createdAt', 'desc')
                    ))
                ]);

                const invoicesData = invoicesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const shipmentsData = allShipmentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('📊 Super admin data loaded:', {
                    invoices: invoicesData.length,
                    shipments: shipmentsData.length
                });

                // Continue with metrics calculation using all data
                calculateMetrics(invoicesData, shipmentsData);
                return;
            }



            // Regular admin: Filter by connected companies (existing logic)
            const companyIDs = connectedCompanies.map(company => company.companyID).filter(Boolean);
            console.log('👤 Regular admin mode: Filtering by connected companies:', companyIDs);

            // Fetch invoices, companies, and shipments filtered by connected companies
            const [invoicesSnapshot, shipmentsSnapshotFiltered] = await Promise.all([
                getDocs(query(
                    collection(db, 'invoices'),
                    where('createdAt', '>=', getStartDate(timeRange)),
                    orderBy('createdAt', 'desc')
                )),
                // Filter shipments by connected companies
                companyIDs.length > 0 ? getDocs(query(
                    collection(db, 'shipments'),
                    where('companyID', 'in', companyIDs.slice(0, 10)), // Firestore 'in' limit is 10
                    where('status', '!=', 'draft'),
                    orderBy('createdAt', 'desc')
                )) : { docs: [] }
            ]);
            shipmentsSnapshot = shipmentsSnapshotFiltered;

            const invoicesData = invoicesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            let shipmentsData = shipmentsSnapshot.docs?.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) || [];

            // If we have more than 10 companies, fetch additional shipments
            if (companyIDs.length > 10) {
                const remainingCompanyIDs = companyIDs.slice(10);
                const additionalBatches = [];

                for (let i = 0; i < remainingCompanyIDs.length; i += 10) {
                    const batch = remainingCompanyIDs.slice(i, i + 10);
                    additionalBatches.push(
                        getDocs(query(
                            collection(db, 'shipments'),
                            where('companyID', 'in', batch),
                            where('status', '!=', 'draft'),
                            orderBy('createdAt', 'desc')
                        ))
                    );
                }

                const additionalResults = await Promise.all(additionalBatches);
                additionalResults.forEach(snapshot => {
                    shipmentsData.push(...snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })));
                });
            }

            console.log('📊 Regular admin data loaded:', {
                invoices: invoicesData.length,
                shipments: shipmentsData.length,
                companies: connectedCompanies.length
            });

            // Use the same helper function for consistency
            calculateMetrics(invoicesData, shipmentsData);

        } catch (err) {
            console.error('Error fetching billing data:', err);
            setError('Failed to load billing data. Please try again.');
            enqueueSnackbar('Error loading billing data: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchEdiHistory = async () => {
        try {
            setEdiLoading(true);
            // Query for processed EDI files from the default database
            const ediRef = collection(db, 'ediResults');
            const q = query(
                ediRef,
                orderBy('processedAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);

            // Create an array to hold all the promises for fetching upload status
            const uploadPromises = snapshot.docs.map(async (docSnapshot) => {
                const resultData = docSnapshot.data();
                const uploadId = resultData.uploadId || docSnapshot.id;

                // Also fetch the processing status from the ediUploads collection
                try {
                    const uploadRef = doc(db, 'ediUploads', uploadId);
                    const uploadDoc = await getDoc(uploadRef);

                    if (uploadDoc.exists()) {
                        const uploadData = uploadDoc.data();
                        return {
                            id: docSnapshot.id,
                            uploadId: uploadId,
                            fileName: resultData.fileName || 'Unknown File',
                            processedAt: resultData.processedAt,
                            uploadedAt: uploadData.uploadedAt,
                            formattedUploadDate: uploadData.uploadedAt ? new Date(uploadData.uploadedAt.toDate()).toLocaleString() :
                                (resultData.processedAt ? new Date(resultData.processedAt.toDate()).toLocaleString() : 'N/A'),
                            processingStatus: uploadData.processingStatus || 'completed',
                            recordCount: resultData.records ? resultData.records.length :
                                (resultData.shipments ? resultData.shipments.length : 0),
                            carrier: resultData.carrier || uploadData.carrier || '',
                            ...resultData
                        };
                    } else {
                        // If upload document doesn't exist, use data from results
                        return {
                            id: docSnapshot.id,
                            uploadId: uploadId,
                            fileName: resultData.fileName || 'Unknown File',
                            processedAt: resultData.processedAt,
                            uploadedAt: resultData.processedAt,
                            formattedUploadDate: resultData.processedAt ? new Date(resultData.processedAt.toDate()).toLocaleString() : 'N/A',
                            processingStatus: 'completed', // Default to completed if no status found
                            recordCount: resultData.records ? resultData.records.length :
                                (resultData.shipments ? resultData.shipments.length : 0),
                            carrier: resultData.carrier || '',
                            ...resultData
                        };
                    }
                } catch (err) {
                    console.error(`Error fetching upload data for ${uploadId}:`, err);
                    // Return partial data if upload fetch fails
                    return {
                        id: docSnapshot.id,
                        uploadId: uploadId,
                        fileName: resultData.fileName || 'Unknown File',
                        processedAt: resultData.processedAt,
                        uploadedAt: resultData.processedAt,
                        formattedUploadDate: resultData.processedAt ? new Date(resultData.processedAt.toDate()).toLocaleString() : 'N/A',
                        processingStatus: 'unknown',
                        recordCount: resultData.records ? resultData.records.length :
                            (resultData.shipments ? resultData.shipments.length : 0),
                        carrier: resultData.carrier || '',
                        ...resultData
                    };
                }
            });

            // Wait for all the promises to resolve
            const ediData = await Promise.all(uploadPromises);
            console.log('Processed EDI history data:', ediData);

            setEdiProcessedItems(ediData);
        } catch (error) {
            console.error('Error fetching EDI history:', error);
        } finally {
            setEdiLoading(false);
        }
    };

    const checkStuckEdis = async () => {
        try {
            setEdiLoading(true);

            // First try with axios
            try {
                // Call the cloud function to diagnose queue
                const response = await axios.get('https://checkediuploads-xedyh5vw7a-uc.a.run.app?action=diagnoseQueue');

                // Check if there are any stuck files
                const { stuckQueued = [], stuckProcessing = [] } = response.data || {};
                const totalStuck = (stuckQueued?.length || 0) + (stuckProcessing?.length || 0);

                if (totalStuck === 0) {
                    enqueueSnackbar("No stuck EDI uploads found!", { variant: 'success' });
                } else {
                    // Show confirmation dialog
                    if (window.confirm(`Found ${totalStuck} stuck EDI uploads. Do you want to attempt to fix them?`)) {
                        // Fix stuck uploads
                        const fixResponse = await axios.get('https://checkediuploads-xedyh5vw7a-uc.a.run.app?action=fixStuckQueue&limit=5');
                        enqueueSnackbar(`Fixed ${fixResponse.data?.fixedDocuments?.length || 0} stuck uploads. They should start processing shortly.`,
                            { variant: 'success' });

                        // Refresh the list after fixing
                        setTimeout(() => {
                            fetchEdiHistory();
                        }, 3000);
                    }
                }
            } catch (axiosError) {
                console.error('Axios error checking stuck EDIs:', axiosError);

                // Fallback to direct fetch if axios fails due to CORS
                try {
                    const response = await fetch('https://checkediuploads-xedyh5vw7a-uc.a.run.app?action=diagnoseQueue', {
                        method: 'GET',
                        mode: 'cors',
                        headers: {
                            'Accept': 'application/json',
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`API returned status: ${response.status}`);
                    }

                    const data = await response.json();

                    // Check if there are any stuck files
                    const { stuckQueued = [], stuckProcessing = [] } = data || {};
                    const totalStuck = (stuckQueued?.length || 0) + (stuckProcessing?.length || 0);

                    if (totalStuck === 0) {
                        enqueueSnackbar("No stuck EDI uploads found!", { variant: 'success' });
                    } else {
                        // Show confirmation dialog
                        if (window.confirm(`Found ${totalStuck} stuck EDI uploads. Do you want to attempt to fix them?`)) {
                            // Fix stuck uploads
                            const fixResponse = await fetch('https://checkediuploads-xedyh5vw7a-uc.a.run.app?action=fixStuckQueue&limit=5', {
                                method: 'GET',
                                mode: 'cors',
                                headers: {
                                    'Accept': 'application/json',
                                }
                            });

                            if (!fixResponse.ok) {
                                throw new Error(`Fix API returned status: ${fixResponse.status}`);
                            }

                            const fixData = await fixResponse.json();
                            enqueueSnackbar(`Fixed ${fixData?.fixedDocuments?.length || 0} stuck uploads. They should start processing shortly.`,
                                { variant: 'success' });

                            // Refresh the list after fixing
                            setTimeout(() => {
                                fetchEdiHistory();
                            }, 3000);
                        }
                    }
                } catch (fetchError) {
                    console.error('Fetch error checking stuck EDIs:', fetchError);
                    enqueueSnackbar('Error checking stuck EDIs. The Cloud Function may be experiencing issues. Please try again later.',
                        { variant: 'error' });
                }
            }
        } catch (error) {
            console.error('Error checking stuck EDIs:', error);
            enqueueSnackbar('Error checking stuck EDIs. The feature may require a database index to be created first.',
                { variant: 'error' });
        } finally {
            setEdiLoading(false);
        }
    };

    const getStartDate = (range) => {
        const now = new Date();
        switch (range) {
            case 'week':
                return new Date(now.setDate(now.getDate() - 7));
            case 'month':
                return new Date(now.setMonth(now.getMonth() - 1));
            case 'year':
                return new Date(now.setFullYear(now.getFullYear() - 1));
            default:
                return new Date(now.setDate(now.getDate() - 7));
        }
    };

    const prepareRevenueTrends = (invoices) => {
        if (!invoices || invoices.length === 0) return [];

        const trends = {};
        invoices.forEach(invoice => {
            if (invoice.createdAt && invoice.createdAt.toDate) {
                const date = invoice.createdAt.toDate().toLocaleDateString();
                trends[date] = (trends[date] || 0) + (invoice.status === 'paid' ? (invoice.total || invoice.amount || 0) : 0);
            }
        });

        return Object.entries(trends).map(([date, amount]) => ({
            date,
            revenue: amount
        }));
    };

    const prepareCompanyRevenue = (invoices) => {
        if (!invoices || invoices.length === 0) return [];

        const revenue = {};
        invoices.forEach(invoice => {
            if (invoice.status === 'paid') {
                const companyName = invoice.companyName || invoice.company || 'Unknown Company';
                revenue[companyName] = (revenue[companyName] || 0) + (invoice.total || invoice.amount || 0);
            }
        });

        return Object.entries(revenue).map(([company, amount]) => ({
            company,
            revenue: amount
        }));
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'paid':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'unpaid':
                return { color: '#f59e0b', bgcolor: '#fff7ed' };
            case 'processing':
                return { color: '#1976d2', bgcolor: '#f5f9ff' };
            case 'overdue':
                return { color: '#b71c1c', bgcolor: '#fef2f2' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    const handleExport = () => {
        // Implement actual export functionality
        try {
            const dataToExport = invoices.map(invoice => ({
                'Invoice Number': invoice.number || invoice.id,
                'Company': invoice.company || invoice.companyName,
                'Date': invoice.date,
                'Due Date': invoice.dueDate,
                'Amount': invoice.amount || invoice.total,
                'Status': invoice.status
            }));

            const csvContent = "data:text/csv;charset=utf-8,"
                + "Invoice Number,Company,Date,Due Date,Amount,Status\n"
                + dataToExport.map(row => Object.values(row).join(",")).join("\n");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `invoices_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            enqueueSnackbar('Invoice data exported successfully', { variant: 'success' });
        } catch (error) {
            console.error('Export error:', error);
            enqueueSnackbar('Failed to export data', { variant: 'error' });
        }
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        switch (newValue) {
            case 'overview':
                navigate('/admin/billing/overview');
                break;
            case 'charges':
                navigate('/admin/billing/charges');
                break;
            case 'invoices':
                navigate('/admin/billing');
                break;
            case 'ap-processing':
                navigate('/admin/billing/ap-processing');
                break;
            case 'generate':
                navigate('/admin/billing/generate');
                break;
            case 'business':
                navigate('/admin/billing/business');
                break;
            case 'payment-terms':
                navigate('/admin/billing/payment-terms');
                break;
            case 'payments':
                navigate('/admin/billing/payments');
                break;
            case 'bulk':
                // Don't navigate - handle internally 
                break;
            default:
                navigate('/admin/billing');
        }
    };

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            // Implement search logic here using the filter states
            const invoicesRef = collection(db, 'invoices');
            let q = query(invoicesRef);

            if (fromDate && toDate) {
                q = query(q, where('date', '>=', fromDate), where('date', '<=', toDate));
            }

            if (customerName) {
                q = query(q, where('customerName', '==', customerName));
            }

            if (paymentStatus) {
                q = query(q, where('status', '==', paymentStatus));
            }

            const querySnapshot = await getDocs(q);
            const invoiceData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInvoices(invoiceData);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
        setLoading(false);
    };

    const handleReset = () => {
        setFromDate(null);
        setToDate(null);
        setCustomerName('');
        setInvoiceNumber('');
        setPaymentStatus('');
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
        setPage(0);
    };

    const handleInvoiceClick = (invoice) => {
        setSelectedInvoice(invoice);
        setDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleFiles = (files) => {
        const newFiles = Array.from(files).map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            status: 'pending'
        }));
        setEdiFiles(prev => [...prev, ...newFiles]);
        // Here you would typically start processing the files
    };

    const handleFileInputChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const onButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleEdiUploadComplete = (uploadId) => {
        fetchEdiHistory();
        setSelectedUploadId(uploadId);
        setShowEdiResults(true);
        navigate(`/admin/billing/edi/${uploadId}`);
    };

    const handleCloseEdiResults = (refreshNeeded) => {
        setShowEdiResults(false);
        setSelectedUploadId(null);
        navigate('/admin/billing/edi');

        // Refresh the EDI history when returning from results
        if (refreshNeeded) {
            fetchEdiHistory();
        }
    };

    const handleViewEdiResults = (uploadId) => {
        console.log('Viewing results for upload ID:', uploadId);
        setSelectedUploadId(uploadId);
        setShowEdiResults(true);
        navigate(`/admin/billing/edi/${uploadId}`);
    };

    const getProcessingStatusChip = (status) => {
        const statusInfo = {
            'processing': { label: 'Processing', color: '#f59e0b', bgcolor: '#fff7ed' },
            'completed': { label: 'Completed', color: '#059669', bgcolor: '#ecfdf5' },
            'failed': { label: 'Failed', color: '#dc2626', bgcolor: '#fef2f2' },
            'queued': { label: 'Queued', color: '#6366f1', bgcolor: '#eef2ff' },
        };

        const info = statusInfo[status] || { label: status || 'Unknown', color: '#6b7280', bgcolor: '#f9fafb' };

        return (
            <Chip
                label={info.label}
                size="small"
                sx={{ color: info.color, bgcolor: info.bgcolor, fontWeight: 600, fontSize: '11px' }}
            />
        );
    };

    const handleExportCharges = (charges) => {
        if (!charges || charges.length === 0) {
            enqueueSnackbar('No data to export', { variant: 'warning' });
            return;
        }

        const csvData = charges.map(charge => ({
            'Shipment ID': charge.shipmentID,
            'Company': charge.companyName,
            'Route': charge.route,
            'Carrier': charge.carrier,
            'Actual Cost': charge.actualCost,
            'Customer Charge': charge.customerCharge,
            'Profit': charge.customerCharge - charge.actualCost,
            'Status': charge.status,
            'Date': charge.shipmentDate.toLocaleDateString()
        }));

        const csv = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map(row => Object.values(row).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `company-charges-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        enqueueSnackbar('Charges exported successfully', { variant: 'success' });
    };

    // Enterprise Global Company Charges Table Component
    const GlobalCompanyChargesTable = ({ timeRange, filters, expandedShipments, onToggleExpanded }) => {
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

        useEffect(() => {
            // Super admin can proceed without connected companies, regular admin needs them
            if (userRole !== 'superadmin' && connectedCompanies.length === 0) return;
            fetchCharges();
        }, [timeRange, connectedCompanies, userRole]);

        useEffect(() => {
            applyFilters();
        }, [filters, charges]);

        const fetchCharges = async () => {
            setLoading(true);
            try {
                console.log('🔍 Fetching enterprise charges for', userRole, 'with', connectedCompanies.length, 'companies');

                // Create company lookup map
                const companyMap = {};
                connectedCompanies.forEach(company => {
                    companyMap[company.companyID] = company;
                });

                // For super admin, always load all companies for proper display
                if (userRole === 'superadmin') {
                    console.log('🔒 Super admin: Loading all companies for proper display');
                    const allCompaniesSnapshot = await getDocs(collection(db, 'companies'));
                    const allCompanies = allCompaniesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log('🏢 All companies loaded for super admin:', allCompanies.length);
                    allCompanies.forEach(company => {
                        if (company.companyID) {
                            companyMap[company.companyID] = company;
                        }
                    });
                    console.log('🗺️ Company map populated with', Object.keys(companyMap).length, 'companies');
                }

                const shipmentCharges = [];

                // Super admin approach: Fetch ALL shipments and filter locally (like Generate Invoices page)
                if (userRole === 'superadmin') {
                    console.log('🔒 Super admin mode: Fetching ALL shipments');

                    const shipmentsRef = collection(db, 'shipments');

                    console.log('⏰ Current time range filter:', timeRange);

                    // Use the same query structure as Generate Invoices page for consistency
                    let q = query(
                        shipmentsRef,
                        where('status', '!=', 'draft'),
                        orderBy('status'),
                        orderBy('createdAt', 'desc')
                    );

                    // Apply time range filter for super admin (only if a specific range is selected)
                    if (timeRange === 'week') {
                        const startDate = new Date();
                        startDate.setDate(startDate.getDate() - 7);
                        console.log('📅 Applying week filter from:', startDate);
                        q = query(
                            shipmentsRef,
                            where('status', '!=', 'draft'),
                            where('createdAt', '>=', startDate),
                            orderBy('status'),
                            orderBy('createdAt', 'desc')
                        );
                    } else if (timeRange === 'month') {
                        const startDate = new Date();
                        startDate.setMonth(startDate.getMonth() - 1);
                        console.log('📅 Applying month filter from:', startDate);
                        q = query(
                            shipmentsRef,
                            where('status', '!=', 'draft'),
                            where('createdAt', '>=', startDate),
                            orderBy('status'),
                            orderBy('createdAt', 'desc')
                        );
                    } else if (timeRange === 'year') {
                        const startDate = new Date();
                        startDate.setFullYear(startDate.getFullYear() - 1);
                        console.log('📅 Applying year filter from:', startDate);
                        q = query(
                            shipmentsRef,
                            where('status', '!=', 'draft'),
                            where('createdAt', '>=', startDate),
                            orderBy('status'),
                            orderBy('createdAt', 'desc')
                        );
                    } else if (timeRange === 'all' || !timeRange) {
                        console.log('📅 No time filter applied, fetching ALL shipments (timeRange:', timeRange, ')');
                    } else {
                        console.log('📅 Unknown timeRange:', timeRange, '- defaulting to no filter');
                    }

                    const snapshot = await getDocs(q);
                    const allShipments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    console.log('📦 Super admin: Found', allShipments.length, 'total shipments');
                    console.log('📦 Super admin: Sample shipment companies:', allShipments.slice(0, 5).map(s => s.companyID));

                    // Process all shipments for super admin
                    allShipments.forEach(shipment => {
                        processShipmentCharges(shipment, shipmentCharges, companyMap);
                    });

                    console.log('💰 Super admin: Processed charges for', shipmentCharges.length, 'shipments');

                } else {
                    // Regular admin approach: Filter by connected companies (existing logic)
                    const companyIDs = connectedCompanies.map(company => company.companyID).filter(Boolean);
                    if (companyIDs.length === 0) {
                        setCharges([]);
                        setLoading(false);
                        return;
                    }

                    console.log('👤 Regular admin mode: Filtering by connected companies:', companyIDs);

                    // Fetch shipments in batches (Firestore 'in' limit is 10)
                    const batches = [];
                    for (let i = 0; i < companyIDs.length; i += 10) {
                        const batch = companyIDs.slice(i, i + 10);
                        const shipmentsRef = collection(db, 'shipments');
                        let q = query(
                            shipmentsRef,
                            where('companyID', 'in', batch),
                            where('status', '!=', 'draft'),
                            orderBy('createdAt', 'desc')
                        );

                        // Apply time range filter
                        if (timeRange === 'week') {
                            const startDate = new Date();
                            startDate.setDate(startDate.getDate() - 7);
                            q = query(
                                shipmentsRef,
                                where('companyID', 'in', batch),
                                where('status', '!=', 'draft'),
                                where('createdAt', '>=', startDate),
                                orderBy('createdAt', 'desc')
                            );
                        } else if (timeRange === 'month') {
                            const startDate = new Date();
                            startDate.setMonth(startDate.getMonth() - 1);
                            q = query(
                                shipmentsRef,
                                where('companyID', 'in', batch),
                                where('status', '!=', 'draft'),
                                where('createdAt', '>=', startDate),
                                orderBy('createdAt', 'desc')
                            );
                        } else if (timeRange === 'year') {
                            const startDate = new Date();
                            startDate.setFullYear(startDate.getFullYear() - 1);
                            q = query(
                                shipmentsRef,
                                where('companyID', 'in', batch),
                                where('status', '!=', 'draft'),
                                where('createdAt', '>=', startDate),
                                orderBy('createdAt', 'desc')
                            );
                        }

                        batches.push(getDocs(q));
                    }

                    const results = await Promise.all(batches);

                    results.forEach(snapshot => {
                        snapshot.docs.forEach(doc => {
                            const shipment = { id: doc.id, ...doc.data() };
                            processShipmentCharges(shipment, shipmentCharges, companyMap);
                        });
                    });
                }

                // Helper function to extract currency from shipment data
                function getShipmentCurrency(shipment) {
                    // Priority order for currency detection (matching GenerateInvoicesPage logic)
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
                    // Default fallback
                    return 'CAD';
                }

                // Helper function to process shipment charges
                function processShipmentCharges(shipment, shipmentCharges, companyMap) {
                    // Enhanced charge extraction
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
                        const company = companyMap[shipment.companyID];

                        let shipmentDate;
                        if (shipment.creationMethod === 'quickship' && shipment.bookedAt) {
                            shipmentDate = shipment.bookedAt.toDate ? shipment.bookedAt.toDate() : new Date(shipment.bookedAt);
                        } else {
                            shipmentDate = shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);
                        }

                        // Extract currency from shipment data
                        const currency = getShipmentCurrency(shipment);

                        shipmentCharges.push({
                            id: shipment.id,
                            shipmentID: shipment.shipmentID,
                            companyID: shipment.companyID,
                            customerId: shipment.customerId || shipment.customerID || shipment.shipTo?.addressClassID || null, // Add customer ID from shipment
                            customerName: shipment.customerName || shipment.customer?.name || null, // Add customer name if available
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
                            route: formatRoute(shipment),
                            carrier: shipment.selectedCarrier || shipment.carrier || 'N/A',
                            shipmentData: shipment
                        });
                    }
                }

                console.log('💰 Enterprise charges loaded:', shipmentCharges.length);
                setCharges(shipmentCharges);
            } catch (error) {
                console.error('❌ Error fetching enterprise charges:', error);
            } finally {
                setLoading(false);
            }
        };

        const applyFilters = () => {
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
                        charge.customerId === filters.customerId
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

        const formatRoute = (shipment) => {
            const from = shipment.shipFrom || {};
            const to = shipment.shipTo || {};

            const fromCity = from.city || 'N/A';
            const fromState = from.state || from.province || '';
            const toCity = to.city || 'N/A';
            const toState = to.state || to.province || '';

            const fromLocation = fromState ? `${fromCity}, ${fromState}` : fromCity;
            const toLocation = toState ? `${toCity}, ${toState}` : toCity;

            return `${fromLocation} → ${toLocation}`;
        };

        const formatCurrency = (amount, currency = 'CAD') => {
            return new Intl.NumberFormat('en-CA', {
                style: 'currency',
                currency: currency
            }).format(amount);
        };

        const getChargeBreakdown = (rates, isQuickShip = false, manualRates = null) => {
            // Handle QuickShip manual rates
            if (isQuickShip && manualRates && Array.isArray(manualRates)) {
                return manualRates.map(rate => ({
                    name: rate.chargeName || rate.code || 'Unknown',
                    amount: parseFloat(rate.charge) || 0,
                    cost: parseFloat(rate.cost) || 0,
                    currency: rate.chargeCurrency || rate.currency || 'CAD'
                }));
            }

            // Handle regular shipment rates
            if (!rates || !rates.charges) return [];

            return rates.charges.map(charge => ({
                name: charge.chargeName || charge.name || 'Unknown',
                amount: charge.chargeAmount || charge.amount || 0,
                cost: charge.actualAmount || charge.amount || 0,
                currency: charge.currency || rates.currency || 'CAD'
            }));
        };

        const ChargeTooltip = ({ amount, rates, title, isQuickShip = false, manualRates = null }) => {
            const breakdown = getChargeBreakdown(rates, isQuickShip, manualRates);

            return (
                <Tooltip
                    title={
                        <Box sx={{ p: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>
                                {title} {isQuickShip ? '(QuickShip Manual)' : ''}
                            </Typography>
                            {breakdown.length > 0 ? (
                                breakdown.map((charge, index) => (
                                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                            {charge.name}:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                            {formatCurrency(charge.amount, charge.currency)}
                                        </Typography>
                                    </Box>
                                ))
                            ) : (
                                <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                    No breakdown available
                                </Typography>
                            )}
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                    Total:
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                    {formatCurrency(amount, rates?.currency || (manualRates?.[0]?.chargeCurrency) || 'CAD')}
                                </Typography>
                            </Box>
                        </Box>
                    }
                    arrow
                    placement="top"
                >
                    <Box sx={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                        {formatCurrency(amount, rates?.currency || (manualRates?.[0]?.chargeCurrency) || 'CAD')}
                    </Box>
                </Tooltip>
            );
        };

        const handleShipmentClick = async (shipment) => {
            // Fetch full shipment details
            try {
                const shipmentDoc = await getDocs(query(
                    collection(db, 'shipments'),
                    where('shipmentID', '==', shipment.shipmentID)
                ));

                if (!shipmentDoc.empty) {
                    const fullShipmentData = { id: shipmentDoc.docs[0].id, ...shipmentDoc.docs[0].data() };
                    setSelectedShipment(fullShipmentData);
                    setShipmentDetailsOpen(true);
                }
            } catch (error) {
                console.error('Error fetching shipment details:', error);
            }
        };

        const handleCompanyClick = (company) => {
            setSelectedCompany(company);
            setCompanyDetailsOpen(true);
        };

        const handleExportCharges = () => {
            if (charges.length === 0) {
                enqueueSnackbar('No data to export', { variant: 'warning' });
                return;
            }

            const csvData = charges.map(charge => ({
                'Shipment ID': charge.shipmentID,
                'Company': charge.companyName,
                'Route': charge.route,
                'Carrier': charge.carrier,
                'Actual Cost': charge.actualCost,
                'Customer Charge': charge.customerCharge,
                'Profit': charge.customerCharge - charge.actualCost,
                'Status': charge.status,
                'Date': charge.shipmentDate.toLocaleDateString()
            }));

            const csv = [
                Object.keys(csvData[0]).join(','),
                ...csvData.map(row => Object.values(row).join(','))
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `company-charges-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);

            enqueueSnackbar('Charges exported successfully', { variant: 'success' });
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

        return (
            <>
                {/* Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} md={3}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="h6" sx={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                                    {filteredCharges.length}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    Total Shipments
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="h6" sx={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>
                                    ${filteredCharges.reduce((sum, c) => sum + c.customerCharge, 0).toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    Total Revenue
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="h6" sx={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                                    ${filteredCharges.reduce((sum, c) => sum + c.actualCost, 0).toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    Total Costs
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="h6" sx={{ fontSize: '24px', fontWeight: 700, color: '#7c3aed' }}>
                                    {filteredCharges.length > 0 ? (filteredCharges.reduce((sum, c) => sum + c.marginPercent, 0) / filteredCharges.length).toFixed(1) : 0}%
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    Avg Margin
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Action Bar */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Showing {Math.min(page * rowsPerPage + 1, filteredCharges.length)} - {Math.min((page + 1) * rowsPerPage, filteredCharges.length)} of {filteredCharges.length} charges
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

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <SortableTableCell field="shipmentID">
                                    Shipment ID
                                </SortableTableCell>
                                <SortableTableCell field="shipmentDate">
                                    Date
                                </SortableTableCell>
                                <SortableTableCell field="companyName">
                                    Company
                                </SortableTableCell>
                                <SortableTableCell field="route">
                                    Route
                                </SortableTableCell>
                                <SortableTableCell field="carrier">
                                    Carrier
                                </SortableTableCell>
                                <SortableTableCell field="actualCost">
                                    Cost
                                </SortableTableCell>
                                <SortableTableCell field="customerCharge">
                                    Charge
                                </SortableTableCell>
                                <SortableTableCell field="marginPercent">
                                    Margin
                                </SortableTableCell>
                                <SortableTableCell field="status">
                                    Status
                                </SortableTableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} align="center">
                                        <Box sx={{ py: 3 }}>
                                            <CircularProgress size={24} />
                                            <Typography sx={{ mt: 1, fontSize: '12px' }}>Loading enterprise charges...</Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : filteredCharges.length > 0 ? (
                                filteredCharges
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((charge) => (
                                        <TableRow key={charge.id} hover sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => handleShipmentClick(charge)}
                                                    sx={{
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        color: '#3b82f6',
                                                        '&:hover': { textDecoration: 'underline' },
                                                        minWidth: 'auto'
                                                    }}
                                                >
                                                    {charge.shipmentID}
                                                </Button>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                {charge.shipmentDate.toLocaleDateString()}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => handleCompanyClick(charge.company)}
                                                    sx={{
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        color: '#3b82f6',
                                                        '&:hover': { textDecoration: 'underline' },
                                                        justifyContent: 'flex-start',
                                                        minWidth: 'auto',
                                                        padding: 0
                                                    }}
                                                    disabled={!charge.company}
                                                >
                                                    {charge.companyName}
                                                </Button>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', maxWidth: '120px' }}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    {charge.route.split(' → ').map((location, index, array) => (
                                                        <Typography
                                                            key={index}
                                                            sx={{
                                                                fontSize: '12px',
                                                                lineHeight: 1.2,
                                                                color: index === 0 ? '#374151' : '#6b7280'
                                                            }}
                                                        >
                                                            {location}
                                                            {index < array.length - 1 && (
                                                                <Typography component="span" sx={{ fontSize: '10px', color: '#9ca3af', mx: 0.5 }}>
                                                                    ↓
                                                                </Typography>
                                                            )}
                                                        </Typography>
                                                    ))}
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                {charge.carrier}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, verticalAlign: 'top' }}>
                                                <Typography sx={{ fontSize: '12px', color: '#059669' }}>
                                                    ${charge.actualCost.toFixed(2)} {charge.currency}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, verticalAlign: 'top' }}>
                                                <Typography sx={{ fontSize: '12px', color: '#000000' }}>
                                                    ${charge.customerCharge.toFixed(2)} {charge.currency}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: charge.margin >= 0 ? '#059669' : '#dc2626' }}>
                                                        ${charge.margin.toFixed(2)} {charge.currency}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        {charge.marginPercent.toFixed(1)}%
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                                {getStatusChip(charge.status)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={9} align="center">
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
                                    <Typography sx={{ fontSize: '12px' }}>{selectedShipment.status}</Typography>
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
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Email:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>{selectedCompany.email}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Phone:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>{selectedCompany.phone}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Website:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>{selectedCompany.website}</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>Address:</Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {selectedCompany.address}<br />
                                        {selectedCompany.city}, {selectedCompany.province} {selectedCompany.postalCode}
                                    </Typography>
                                </Grid>
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCompanyDetailsOpen(false)} size="small">Close</Button>
                    </DialogActions>
                </Dialog>
            </>
        );
    };

    if (loading) {
        return (
            <Box className="billing-loading">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box className="billing-error">
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    return (
        <Box className="admin-billing-dashboard" sx={{ width: '100%', height: '100%' }}>
            <Box sx={{ px: 3, py: 2, mb: 3, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, fontSize: '22px' }}>
                    Billing Management
                </Typography>
                {/* Breadcrumb */}
                <AdminBreadcrumb currentPage="Billing" />
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, px: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            minHeight: 48,
                            fontWeight: 500,
                            fontSize: '12px'
                        }
                    }}
                >
                    <Tab label="Overview" value="overview" />
                    <Tab label="Invoices" value="invoices" />
                    <Tab label="AP Processing" value="ap-processing" />
                    <Tab label="Charges" value="charges" />
                    <Tab label="Generate Invoices" value="generate" />
                    <Tab label="Auto-Invoice Gen" value="bulk" />
                    <Tab label="Business Invoicing" value="business" />
                    <Tab label="Payment Terms" value="payment-terms" />
                    <Tab label="Received Payments" value="payments" />
                    <Tab label="Sales Commissions" value="commissions" />
                </Tabs>
            </Box>

            {activeTab === 'charges' && <ChargesTab />}

            {activeTab === 'overview' && (
                <>
                    {loading ? (
                        <>
                            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827', mb: 3, px: 2 }}>
                                Billing Overview
                            </Typography>
                            <Grid container spacing={3} sx={{ mb: 4, px: 2 }}>
                                {[1, 2, 3, 4].map((item) => (
                                    <Grid item xs={12} md={3} key={item}>
                                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                            <CardContent sx={{ p: 3 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                    <Skeleton variant="circular" width={32} height={32} />
                                                    <Box sx={{ textAlign: 'right' }}>
                                                        <Skeleton width={60} height={16} />
                                                        <Skeleton width={40} height={12} />
                                                    </Box>
                                                </Box>
                                                <Skeleton width={120} height={40} sx={{ mb: 1 }} />
                                                <Skeleton width={100} height={16} />
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                            <Grid container spacing={3} sx={{ mb: 4, px: 2 }}>
                                {[1, 2].map((item) => (
                                    <Grid item xs={12} md={6} key={item}>
                                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                            <CardContent sx={{ p: 3 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                    <Skeleton variant="circular" width={28} height={28} />
                                                    <Skeleton width={80} height={16} />
                                                </Box>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={6}>
                                                        <Skeleton width={60} height={30} sx={{ mb: 1 }} />
                                                        <Skeleton width={80} height={14} />
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Skeleton width={60} height={30} sx={{ mb: 1 }} />
                                                        <Skeleton width={80} height={14} />
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                <Box sx={{ p: 3 }}>
                                    <Skeleton width={250} height={24} sx={{ mb: 1 }} />
                                    <Skeleton width={400} height={16} sx={{ mb: 3 }} />
                                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                        <Skeleton width={120} height={40} />
                                        <Skeleton width={120} height={40} />
                                        <Skeleton width={100} height={40} />
                                    </Box>
                                    {[1, 2, 3, 4, 5].map((row) => (
                                        <Box key={row} sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                            <Skeleton width={120} height={20} />
                                            <Skeleton width={150} height={20} />
                                            <Skeleton width={200} height={20} />
                                            <Skeleton width={100} height={20} />
                                            <Skeleton width={80} height={20} />
                                            <Skeleton width={80} height={20} />
                                            <Skeleton width={80} height={20} />
                                            <Skeleton width={80} height={20} />
                                            <Skeleton width={80} height={20} />
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        </>
                    ) : (
                        <>
                            {/* Enterprise Financial KPIs */}
                            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827', mb: 3, px: 2 }}>
                                Billing Overview
                            </Typography>

                            {/* Primary KPIs */}
                            <Grid container spacing={3} sx={{ mb: 4, px: 2 }}>
                                <Grid item xs={12} md={3}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <MoneyIcon sx={{ color: '#0284c7', fontSize: 32 }} />
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="body2" sx={{ color: metrics.revenueGrowth >= 0 ? '#059669' : '#dc2626', fontSize: '11px', fontWeight: 600 }}>
                                                        {metrics.revenueGrowth >= 0 ? '+' : ''}{metrics.revenueGrowth.toFixed(1)}% MoM
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#0284c7', fontSize: '10px' }}>
                                                        {connectedCompanies.length} companies
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '24px', mb: 0.5 }}>
                                                ${(metrics.totalRevenueByCurrency?.USD || 0).toLocaleString()} USD
                                            </Typography>
                                            <Typography variant="h5" sx={{ color: '#374151', fontWeight: 600, fontSize: '18px', mb: 1 }}>
                                                ${(metrics.totalRevenueByCurrency?.CAD || 0).toLocaleString()} CAD
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#0f172a', fontSize: '12px', fontWeight: 500 }}>
                                                Total Revenue (YTD)
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <AccountBalanceIcon sx={{ color: '#d97706', fontSize: 32 }} />
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="body2" sx={{ color: '#d97706', fontSize: '11px', fontWeight: 600 }}>
                                                        {metrics.profitMargin.toFixed(1)}% Margin
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#d97706', fontSize: '10px' }}>
                                                        ${metrics.avgTicketSize.toFixed(0)} avg
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '24px', mb: 0.5 }}>
                                                ${(metrics.uninvoicedChargesByCurrency?.USD || 0).toLocaleString()} USD
                                            </Typography>
                                            <Typography variant="h5" sx={{ color: '#374151', fontWeight: 600, fontSize: '18px', mb: 1 }}>
                                                ${(metrics.uninvoicedChargesByCurrency?.CAD || 0).toLocaleString()} CAD
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#0f172a', fontSize: '12px', fontWeight: 500 }}>
                                                Uninvoiced Charges
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <SpeedIcon sx={{ color: '#059669', fontSize: 32 }} />
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="body2" sx={{ color: '#059669', fontSize: '11px', fontWeight: 600 }}>
                                                        {metrics.conversionRate}% Rate
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#059669', fontSize: '10px' }}>
                                                        Performance
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '24px', mb: 0.5 }}>
                                                ${(metrics.monthlyRevenueByCurrency?.USD || 0).toLocaleString()} USD
                                            </Typography>
                                            <Typography variant="h5" sx={{ color: '#374151', fontWeight: 600, fontSize: '18px', mb: 1 }}>
                                                ${(metrics.monthlyRevenueByCurrency?.CAD || 0).toLocaleString()} CAD
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#0f172a', fontSize: '12px', fontWeight: 500 }}>
                                                Monthly Revenue
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                            </Grid>

                            {/* Operational Metrics */}
                            <Grid container spacing={3} sx={{ mb: 4, px: 2 }}>
                                <Grid item xs={12} md={6}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <AssessmentIcon sx={{ color: '#6366f1', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#6366f1', fontSize: '11px' }}>
                                                    Invoice Status
                                                </Typography>
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="h5" sx={{ color: '#059669', fontWeight: 700, fontSize: '24px' }}>
                                                        {metrics.paidInvoices}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                        Paid Invoices
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="h5" sx={{ color: '#dc2626', fontWeight: 700, fontSize: '24px' }}>
                                                        {metrics.pendingInvoices}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                        Pending Invoices
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <TimelineIcon sx={{ color: '#10b981', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#10b981', fontSize: '11px' }}>
                                                    Financial Health
                                                </Typography>
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="h5" sx={{ color: '#7c3aed', fontWeight: 700, fontSize: '24px' }}>
                                                        {metrics.profitMargin.toFixed(1)}%
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                        Profit Margin
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="h5" sx={{ color: '#f59e0b', fontWeight: 700, fontSize: '24px' }}>
                                                        ${(metrics.totalRevenue / Math.max(connectedCompanies.length, 1)).toFixed(0)}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                        Revenue per Company
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>




                        </>
                    )}
                </>
            )}

            {activeTab === 'invoices' && (
                <InvoiceManagement />
            )}

            {activeTab === 'ap-processing' && (
                <APProcessing />
            )}

            {activeTab === 'payment-terms' && (
                <PaymentTerms />
            )}

            {activeTab === 'generate' && (
                <GenerateInvoicesPage />
            )}

            {activeTab === 'bulk' && (
                <BulkInvoiceGenerator />
            )}

            {activeTab === 'business' && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>Business Invoicing</Typography>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Business invoicing functionality will be available here.
                        </Typography>
                    </Paper>
                </Box>
            )}

            {activeTab === 'payments' && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>Received Payments</Typography>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Payment tracking functionality will be available here.
                        </Typography>
                    </Paper>
                </Box>
            )}

            {activeTab === 'commissions' && (
                <SalesCommissionsTab />
            )}

            <Dialog
                open={detailsOpen}
                onClose={handleCloseDetails}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>Invoice Details</Typography>
                        <IconButton onClick={handleCloseDetails} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedInvoice && (
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5" sx={{ fontSize: '18px' }}>{selectedInvoice.number || selectedInvoice.id}</Typography>
                                    <Chip
                                        label={selectedInvoice.status}
                                        size="small"
                                        sx={{
                                            color: getStatusColor(selectedInvoice.status).color,
                                            bgcolor: getStatusColor(selectedInvoice.status).bgcolor,
                                            fontWeight: 600,
                                            fontSize: '11px',
                                            borderRadius: '6px',
                                        }}
                                    />
                                </Box>
                                <Divider />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '11px' }}>Company</Typography>
                                <Typography variant="body1" sx={{ fontSize: '12px' }}>{selectedInvoice.company || selectedInvoice.companyName}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '11px' }}>Invoice Date</Typography>
                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                    {selectedInvoice.date ? new Date(selectedInvoice.date).toLocaleDateString() : 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '11px' }}>Due Date</Typography>
                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                    {selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '11px' }}>Amount</Typography>
                                <Typography variant="body1" sx={{ fontSize: '12px' }}>${(selectedInvoice.amount || selectedInvoice.total || 0).toFixed(2)}</Typography>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDetails} size="small" sx={{ fontSize: '12px' }}>Close</Button>
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={() => {/* Handle download */ }}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Download Invoice
                    </Button>
                </DialogActions>
            </Dialog>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleMenuClose} sx={{ fontSize: '12px' }}>View Details</MenuItem>
                <MenuItem onClick={handleMenuClose} sx={{ fontSize: '12px' }}>Edit Invoice</MenuItem>
                <MenuItem onClick={handleMenuClose} sx={{ fontSize: '12px' }}>Download PDF</MenuItem>
                <MenuItem onClick={handleMenuClose} sx={{ fontSize: '12px' }}>Send to Customer</MenuItem>
                <MenuItem onClick={handleMenuClose} sx={{ fontSize: '12px' }}>Mark as Paid</MenuItem>
                <MenuItem onClick={handleMenuClose} sx={{ fontSize: '12px' }}>Cancel Invoice</MenuItem>
            </Menu>

            <Dialog
                open={ediDialogOpen}
                onClose={() => setEdiDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Upload EDI File</DialogTitle>
                <DialogContent>
                    <EDIUploader
                        onUploadComplete={handleEdiUploadComplete}
                        onClose={() => setEdiDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default BillingDashboard; 