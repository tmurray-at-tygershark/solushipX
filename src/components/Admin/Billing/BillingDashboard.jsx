import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    Receipt as ReceiptIcon,
    Payment as PaymentIcon,
    TrendingUp as TrendingUpIcon,
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
} from 'recharts';
import { collection, query, where, getDocs, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import EDIUploader from './EDIUploader';
import EDIResults from './EDIResults';
import EDIMapping from './EDIMapping';
import PaymentTerms from './PaymentTerms';
import AdminBreadcrumb from '../AdminBreadcrumb';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useSnackbar } from 'notistack';

const BillingDashboard = ({ initialTab = 'invoices' }) => {
    const navigate = useNavigate();
    const params = useParams();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [customerName, setCustomerName] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('');
    const [customerNotify, setCustomerNotify] = useState('');
    const [displayCancelled, setDisplayCancelled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('month');
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        outstandingBalance: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
    });
    const [revenueTrends, setRevenueTrends] = useState([]);
    const [revenueByCompany, setRevenueByCompany] = useState([]);
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [ediFiles, setEdiFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = React.useRef(null);
    const [selectedUploadId, setSelectedUploadId] = useState(params.uploadId || null);
    const [showEdiResults, setShowEdiResults] = useState(!!params.uploadId);
    const [ediProcessedItems, setEdiProcessedItems] = useState([]);
    const [ediLoading, setEdiLoading] = useState(false);
    const [ediDialogOpen, setEdiDialogOpen] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

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
        } else if (path.includes('/admin/billing/edi-mapping')) {
            setActiveTab('edi-mapping');
        } else if (path.includes('/admin/billing/edi')) {
            setActiveTab('edi');
        } else if (path.includes('/admin/billing/generate')) {
            // Handle generate tab properly
            setActiveTab('generate');
        } else if (path.includes('/admin/billing/business')) {
            setActiveTab('business');
        } else if (path.includes('/admin/billing/payments')) {
            setActiveTab('payments');
        } else if (path.includes('/admin/billing/overview')) {
            setActiveTab('overview');
        } else if (path.startsWith('/admin/billing') &&
            !path.includes('/generate') &&
            !path.includes('/invoice/') &&
            !path.includes('/payment-terms') &&
            !path.includes('/edi') &&
            !path.includes('/edi-mapping')) {
            setActiveTab('invoices');
        }
    }, [location.pathname]);

    useEffect(() => {
        fetchBillingData();
        fetchEdiHistory();
    }, [timeRange]);

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            setError(null);
            const invoicesRef = collection(db, 'invoices');
            const startDate = getStartDate(timeRange);

            // Fetch invoices within the selected time range
            const q = query(
                invoicesRef,
                where('createdAt', '>=', startDate),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const invoicesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Update state with real data
            setInvoices(invoicesData);

            // Calculate metrics from real data
            const totalRevenue = invoicesData.reduce((sum, invoice) =>
                sum + (invoice.status === 'paid' ? (invoice.total || invoice.amount || 0) : 0), 0);

            const outstandingBalance = invoicesData.reduce((sum, invoice) =>
                sum + (invoice.status === 'pending' || invoice.status === 'unpaid' ? (invoice.total || invoice.amount || 0) : 0), 0);

            const paidInvoices = invoicesData.filter(invoice => invoice.status === 'paid').length;
            const pendingInvoices = invoicesData.filter(invoice =>
                invoice.status === 'pending' || invoice.status === 'unpaid').length;

            setMetrics({
                totalRevenue,
                outstandingBalance,
                paidInvoices,
                pendingInvoices,
            });

            // Prepare revenue trends data
            const trends = prepareRevenueTrends(invoicesData);
            setRevenueTrends(trends);

            // Prepare revenue by company data
            const companyRevenue = prepareCompanyRevenue(invoicesData);
            setRevenueByCompany(companyRevenue);

            // Set recent invoices
            setRecentInvoices(invoicesData.slice(0, 5));

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
            case 'invoices':
                navigate('/admin/billing');
                break;
            case 'edi':
                if (selectedUploadId && showEdiResults) {
                    navigate(`/admin/billing/edi/${selectedUploadId}`);
                } else {
                    navigate('/admin/billing/edi');
                    setShowEdiResults(false);
                }
                break;
            case 'edi-mapping':
                navigate('/admin/billing/edi-mapping');
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
        setCustomerNotify('');
        setDisplayCancelled(false);
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

    const filteredInvoices = invoices.filter(invoice => {
        const searchStr = searchTerm.toLowerCase();
        return (
            (invoice.number || invoice.id || '').toLowerCase().includes(searchStr) ||
            (invoice.company || invoice.companyName || '').toLowerCase().includes(searchStr) ||
            (invoice.status || '').toLowerCase().includes(searchStr)
        );
    });

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
        return (
            <Chip
                label={status || 'Unknown'}
                size="small"
                color={
                    status === 'completed' ? 'success' :
                        status === 'failed' ? 'error' :
                            status === 'processing' ? 'primary' :
                                status === 'queued' ? 'warning' : 'default'
                }
                sx={{ minWidth: '90px' }}
            />
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
        <Box className="admin-billing-dashboard">
            <Box sx={{ mb: 4 }}>
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

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
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
                    <Tab label="EDI Processing" value="edi" />
                    <Tab label="EDI Mapping" value="edi-mapping" />
                    <Tab label="Generate Invoices" value="generate" />
                    <Tab label="Business Invoicing" value="business" />
                    <Tab label="Payment Terms" value="payment-terms" />
                    <Tab label="Received Payments" value="payments" />
                </Tabs>
            </Box>

            {activeTab === 'overview' && (
                <>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                            <CircularProgress />
                            <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading billing overview...</Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6} lg={3}>
                                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140, border: '1px solid #e5e7eb' }}>
                                    <Typography component="h2" variant="h6" color="primary" gutterBottom sx={{ fontSize: '14px' }}>
                                        Total Revenue
                                    </Typography>
                                    <Typography component="p" variant="h4" sx={{ fontSize: '32px' }}>
                                        ${metrics.totalRevenue.toLocaleString()}
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6} lg={3}>
                                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140, border: '1px solid #e5e7eb' }}>
                                    <Typography component="h2" variant="h6" color="primary" gutterBottom sx={{ fontSize: '14px' }}>
                                        Outstanding Balance
                                    </Typography>
                                    <Typography component="p" variant="h4" sx={{ fontSize: '32px' }}>
                                        ${metrics.outstandingBalance.toLocaleString()}
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6} lg={3}>
                                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140, border: '1px solid #e5e7eb' }}>
                                    <Typography component="h2" variant="h6" color="primary" gutterBottom sx={{ fontSize: '14px' }}>
                                        Paid Invoices
                                    </Typography>
                                    <Typography component="p" variant="h4" sx={{ fontSize: '32px' }}>
                                        {metrics.paidInvoices}
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6} lg={3}>
                                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140, border: '1px solid #e5e7eb' }}>
                                    <Typography component="h2" variant="h6" color="primary" gutterBottom sx={{ fontSize: '14px' }}>
                                        Pending Invoices
                                    </Typography>
                                    <Typography component="p" variant="h4" sx={{ fontSize: '32px' }}>
                                        {metrics.pendingInvoices}
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </>
            )}

            {activeTab === 'invoices' && (
                <>
                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>Search Invoices</Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6} md={3}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        label="From Date"
                                        value={fromDate}
                                        onChange={setFromDate}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                fullWidth
                                                size="small"
                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                            />
                                        )}
                                    />
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        label="To Date"
                                        value={toDate}
                                        onChange={setToDate}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                fullWidth
                                                size="small"
                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                            />
                                        )}
                                    />
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Customer Name</InputLabel>
                                    <Select
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        label="Customer Name"
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                                        {/* Add customer options dynamically */}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Invoice Number"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    sx={{
                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                        '& .MuiInputBase-input': { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Payment Status</InputLabel>
                                    <Select
                                        value={paymentStatus}
                                        onChange={(e) => setPaymentStatus(e.target.value)}
                                        label="Payment Status"
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                                        <MenuItem value="paid" sx={{ fontSize: '12px' }}>Paid</MenuItem>
                                        <MenuItem value="pending" sx={{ fontSize: '12px' }}>Pending</MenuItem>
                                        <MenuItem value="unpaid" sx={{ fontSize: '12px' }}>Unpaid</MenuItem>
                                        <MenuItem value="overdue" sx={{ fontSize: '12px' }}>Overdue</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                                <Stack direction="row" spacing={2}>
                                    <Button
                                        variant="contained"
                                        onClick={handleSearch}
                                        startIcon={<SearchIcon />}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Search
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={handleReset}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Reset
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>Customer Invoice List</Typography>
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    placeholder="Search invoices..."
                                    size="small"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: '16px' }} />,
                                        endAdornment: searchTerm && (
                                            <IconButton size="small" onClick={() => setSearchTerm('')}>
                                                <CloseIcon sx={{ fontSize: '16px' }} />
                                            </IconButton>
                                        ),
                                        sx: { fontSize: '12px' }
                                    }}
                                    sx={{
                                        width: 250,
                                        '& .MuiInputBase-input': { fontSize: '12px' }
                                    }}
                                />
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={handleExport}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Export
                                </Button>
                            </Stack>
                        </Box>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Invoice #</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Date</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Due Date</TableCell>
                                        <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Amount</TableCell>
                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                        <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 3 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography sx={{ mt: 1, fontSize: '12px' }}>Loading invoices...</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredInvoices.length > 0 ? (
                                        filteredInvoices
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((invoice) => {
                                                const statusColor = getStatusColor(invoice.status);
                                                return (
                                                    <TableRow
                                                        key={invoice.id}
                                                        hover
                                                        onClick={() => handleInvoiceClick(invoice)}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        <TableCell sx={{ fontSize: '12px' }}>{invoice.number || invoice.id}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{invoice.company || invoice.companyName}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            {invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontSize: '12px' }}>
                                                            ${(invoice.amount || invoice.total || 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={invoice.status || 'Unknown'}
                                                                size="small"
                                                                sx={{
                                                                    color: statusColor.color,
                                                                    bgcolor: statusColor.bgcolor,
                                                                    fontWeight: 600,
                                                                    fontSize: '11px',
                                                                    borderRadius: '6px',
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMenuOpen(e);
                                                                }}
                                                            >
                                                                <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 3 }}>
                                                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                        {searchTerm ? 'No invoices match your search criteria' : 'No invoices found'}
                                                    </Typography>
                                                    {!searchTerm && (
                                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', mt: 1 }}>
                                                            Invoices will appear here once they are created
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            component="div"
                            count={filteredInvoices.length}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            rowsPerPageOptions={[10, 25, 50, 100]}
                            sx={{
                                '& .MuiTablePagination-selectLabel': { fontSize: '12px' },
                                '& .MuiTablePagination-displayedRows': { fontSize: '12px' },
                                '& .MuiSelect-select': { fontSize: '12px' }
                            }}
                        />
                    </Paper>
                </>
            )}

            {activeTab === 'edi' && (
                <>
                    {showEdiResults ? (
                        <Box sx={{ mb: 3 }}>
                            <EDIResults
                                uploadId={selectedUploadId}
                                onClose={handleCloseEdiResults}
                            />
                        </Box>
                    ) : (
                        <>
                            <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                                    <Grid item xs>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>EDI Processing</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                Upload and manage EDI files
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item>
                                        <Button
                                            variant="outlined"
                                            color="primary"
                                            size="small"
                                            onClick={checkStuckEdis}
                                            disabled={ediLoading}
                                            startIcon={ediLoading ? <CircularProgress size={16} /> : <HealthAndSafetyIcon />}
                                            sx={{ mr: 1, fontSize: '12px' }}
                                        >
                                            Check Stuck Uploads
                                        </Button>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={() => setEdiDialogOpen(true)}
                                            size="small"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Upload EDI File
                                        </Button>
                                    </Grid>
                                </Grid>
                            </Paper>

                            <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                                <TableContainer>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>File Name</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Upload Date</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Records</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                                <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {ediLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center">
                                                        <Box sx={{ py: 3 }}>
                                                            <CircularProgress size={24} />
                                                            <Typography sx={{ mt: 1, fontSize: '12px' }}>Loading EDI history...</Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ) : ediProcessedItems.length > 0 ? (
                                                ediProcessedItems.map((item) => (
                                                    <TableRow key={item.id} hover>
                                                        <TableCell sx={{ fontSize: '12px' }}>{item.fileName}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{item.carrier || 'Not specified'}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            {item.formattedUploadDate}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{item.recordCount || '0'}</TableCell>
                                                        <TableCell>
                                                            {getProcessingStatusChip(item.processingStatus)}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Button
                                                                size="small"
                                                                onClick={() => handleViewEdiResults(item.uploadId)}
                                                                disabled={item.processingStatus === 'queued'}
                                                                sx={{ fontSize: '12px' }}
                                                            >
                                                                View Results
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center">
                                                        <Box sx={{ py: 3 }}>
                                                            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                                No EDI files processed yet
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', mt: 1 }}>
                                                                Upload your first EDI file to get started
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </>
                    )}
                </>
            )}

            {activeTab === 'edi-mapping' && (
                <Box sx={{ mb: 3 }}>
                    <EDIMapping />
                </Box>
            )}

            {activeTab === 'payment-terms' && (
                <PaymentTerms />
            )}

            {activeTab === 'generate' && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>Generate Invoices</Typography>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Invoice generation functionality will be available here.
                        </Typography>
                    </Paper>
                </Box>
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