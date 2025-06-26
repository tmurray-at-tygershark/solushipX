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
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import EDIUploader from './EDIUploader';
import EDIResults from './EDIResults';
import EDIMapping from './EDIMapping';
import PaymentTerms from './PaymentTerms';
import InvoiceManagement from './InvoiceManagement';
import AdminBreadcrumb from '../AdminBreadcrumb';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateTimeForBilling } from '../../../utils/dateUtils';

// Import Sales Commission Module
import SalesCommissionsTab from './SalesCommissions/SalesCommissionsTab';

const BillingDashboard = ({ initialTab = 'invoices' }) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const params = new URLSearchParams(location.search);

    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        outstandingBalance: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        uninvoicedCharges: 0,
        monthlyRevenue: 0,
        growthRate: 0,
    });
    const [invoices, setInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
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
    const [timeRange, setTimeRange] = useState('month');
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
        } else if (path.includes('/admin/billing/commissions')) {
            setActiveTab('commissions');
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

            // Fetch both invoices, companies, and shipments
            const [invoicesSnapshot, companiesSnapshot, shipmentsSnapshot] = await Promise.all([
                getDocs(query(
                    collection(db, 'invoices'),
                    where('createdAt', '>=', getStartDate(timeRange)),
                    orderBy('createdAt', 'desc')
                )),
                getDocs(collection(db, 'companies')),
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

            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const shipmentsData = shipmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate uninvoiced charges from shipments
            const uninvoicedCharges = shipmentsData
                .filter(shipment => !shipment.invoiceStatus || shipment.invoiceStatus === 'uninvoiced')
                .reduce((total, shipment) => {
                    const charge = shipment.markupRates?.totalCharges ||
                        shipment.totalCharges ||
                        shipment.selectedRate?.totalCharges || 0;
                    return total + charge;
                }, 0);

            // Update state with real data
            setInvoices(invoicesData);
            setCompanies(companiesData);

            // Calculate metrics from real data
            const totalRevenue = invoicesData.reduce((sum, invoice) =>
                sum + (invoice.status === 'paid' ? (invoice.total || invoice.amount || 0) : 0), 0);

            const outstandingBalance = invoicesData.reduce((sum, invoice) =>
                sum + (invoice.status === 'pending' || invoice.status === 'unpaid' ? (invoice.total || invoice.amount || 0) : 0), 0);

            const paidInvoices = invoicesData.filter(invoice => invoice.status === 'paid').length;
            const pendingInvoices = invoicesData.filter(invoice =>
                invoice.status === 'pending' || invoice.status === 'unpaid').length;

            // Calculate monthly revenue (current month)
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const monthlyRevenue = invoicesData
                .filter(invoice => {
                    if (!invoice.createdAt) return false;
                    const invoiceDate = invoice.createdAt.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
                    return invoiceDate.getMonth() === currentMonth &&
                        invoiceDate.getFullYear() === currentYear &&
                        invoice.status === 'paid';
                })
                .reduce((sum, invoice) => sum + (invoice.total || invoice.amount || 0), 0);

            setMetrics({
                totalRevenue,
                outstandingBalance,
                paidInvoices,
                pendingInvoices,
                uninvoicedCharges,
                monthlyRevenue,
                growthRate: 12.5, // This could be calculated from historical data
            });

            // Prepare revenue trends data
            const trends = prepareRevenueTrends(invoicesData);
            setRevenueTrends(trends);

            // Prepare revenue by company data
            const companyRevenue = prepareCompanyRevenue(invoicesData);
            setRevenueByCompany(companyRevenue);

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

    // Global Company Charges Table Component
    const GlobalCompanyChargesTable = ({ timeRange, filters, onExport }) => {
        const [charges, setCharges] = useState([]);
        const [localCompanies, setLocalCompanies] = useState([]);
        const [loading, setLoading] = useState(true);
        const [page, setPage] = useState(0);
        const [rowsPerPage, setRowsPerPage] = useState(25);
        const [selectedShipment, setSelectedShipment] = useState(null);
        const [shipmentDetailsOpen, setShipmentDetailsOpen] = useState(false);
        const [selectedCompany, setSelectedCompany] = useState(null);
        const [companyDetailsOpen, setCompanyDetailsOpen] = useState(false);

        useEffect(() => {
            const fetchCharges = async () => {
                setLoading(true);
                try {
                    console.log('🔍 Fetching global company charges...');

                    // Query all shipments across companies
                    const shipmentsRef = collection(db, 'shipments');
                    let q = query(shipmentsRef, where('status', '!=', 'draft'), orderBy('createdAt', 'desc'));

                    // Apply time range filter
                    if (timeRange === 'week') {
                        const startDate = new Date();
                        startDate.setDate(startDate.getDate() - 7);
                        q = query(shipmentsRef, where('status', '!=', 'draft'), where('createdAt', '>=', startDate), orderBy('createdAt', 'desc'));
                    } else if (timeRange === 'month') {
                        const startDate = new Date();
                        startDate.setMonth(startDate.getMonth() - 1);
                        q = query(shipmentsRef, where('status', '!=', 'draft'), where('createdAt', '>=', startDate), orderBy('createdAt', 'desc'));
                    }

                    const [shipmentsSnapshot, companiesSnapshot] = await Promise.all([
                        getDocs(q),
                        getDocs(collection(db, 'companies'))
                    ]);

                    console.log('📦 Found shipments:', shipmentsSnapshot.size);
                    console.log('🏢 Found companies:', companiesSnapshot.size);

                    // Create company lookup map
                    const companyMap = {};
                    const companiesList = [];
                    companiesSnapshot.docs.forEach(doc => {
                        const company = { id: doc.id, ...doc.data() };
                        companyMap[company.companyID] = company;
                        companiesList.push(company);
                    });
                    setLocalCompanies(companiesList);

                    const shipmentCharges = [];

                    shipmentsSnapshot.docs.forEach(doc => {
                        const shipment = { id: doc.id, ...doc.data() };

                        // Get both actual cost and customer charge from dual rate system
                        const actualCost = shipment.actualRates?.totalCharges ||
                            shipment.totalCharges ||
                            shipment.selectedRate?.totalCharges || 0;

                        const customerCharge = shipment.markupRates?.totalCharges ||
                            shipment.totalCharges ||
                            shipment.selectedRate?.totalCharges || 0;

                        if (customerCharge > 0) {
                            const company = companyMap[shipment.companyID];

                            shipmentCharges.push({
                                id: shipment.id,
                                shipmentID: shipment.shipmentID,
                                companyID: shipment.companyID,
                                companyName: company?.name || shipment.companyName || shipment.companyID,
                                company: company,
                                actualCost: actualCost,
                                customerCharge: customerCharge,
                                actualRates: shipment.actualRates,
                                markupRates: shipment.markupRates,
                                status: shipment.invoiceStatus || 'uninvoiced',
                                shipmentDate: shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt),
                                route: formatRoute(shipment),
                                carrier: shipment.selectedCarrier || shipment.carrier || 'N/A',
                                shipmentData: shipment
                            });
                        }
                    });

                    console.log('💰 Found charges:', shipmentCharges.length);

                    // Apply filters
                    let filteredCharges = shipmentCharges;

                    if (filters.companyName) {
                        filteredCharges = filteredCharges.filter(charge =>
                            charge.companyName.toLowerCase().includes(filters.companyName.toLowerCase()) ||
                            charge.companyID.toLowerCase().includes(filters.companyName.toLowerCase())
                        );
                    }

                    if (filters.status) {
                        filteredCharges = filteredCharges.filter(charge => charge.status === filters.status);
                    }

                    if (filters.fromDate) {
                        filteredCharges = filteredCharges.filter(charge => charge.shipmentDate >= filters.fromDate);
                    }

                    if (filters.toDate) {
                        filteredCharges = filteredCharges.filter(charge => charge.shipmentDate <= filters.toDate);
                    }

                    console.log('🔍 Filtered charges:', filteredCharges.length);
                    setCharges(filteredCharges);
                } catch (error) {
                    console.error('❌ Error fetching global charges:', error);
                } finally {
                    setLoading(false);
                }
            };

            fetchCharges();
        }, [timeRange, filters]);

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

        const getChargeBreakdown = (rates) => {
            if (!rates || !rates.charges) return [];

            return rates.charges.map(charge => ({
                name: charge.chargeName || charge.name || 'Unknown',
                amount: charge.chargeAmount || charge.amount || 0,
                currency: charge.currency || rates.currency || 'CAD'
            }));
        };

        const ChargeTooltip = ({ amount, rates, title }) => {
            const breakdown = getChargeBreakdown(rates);

            return (
                <Tooltip
                    title={
                        <Box sx={{ p: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>
                                {title}
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
                                    {formatCurrency(amount, rates?.currency || 'CAD')}
                                </Typography>
                            </Box>
                        </Box>
                    }
                    arrow
                    placement="top"
                >
                    <Box sx={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                        {formatCurrency(amount, rates?.currency || 'CAD')}
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

        return (
            <>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Shipment ID
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Company
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Route
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Carrier
                                </TableCell>
                                <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Actual Cost
                                </TableCell>
                                <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Customer Charge
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Status
                                </TableCell>
                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                    Date
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        <Box sx={{ py: 3 }}>
                                            <CircularProgress size={24} />
                                            <Typography sx={{ mt: 1, fontSize: '12px' }}>Loading charges...</Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : charges.length > 0 ? (
                                charges
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((charge) => (
                                        <TableRow key={charge.id} hover>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => handleShipmentClick(charge)}
                                                    sx={{
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        color: '#3b82f6',
                                                        '&:hover': { textDecoration: 'underline' }
                                                    }}
                                                >
                                                    {charge.shipmentID}
                                                </Button>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => handleCompanyClick(charge.company)}
                                                    sx={{
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        color: '#3b82f6',
                                                        '&:hover': { textDecoration: 'underline' }
                                                    }}
                                                    disabled={!charge.company}
                                                >
                                                    {charge.companyName}
                                                </Button>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {charge.route}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {charge.carrier}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                <ChargeTooltip
                                                    amount={charge.actualCost}
                                                    rates={charge.actualRates}
                                                    title="Actual Cost Breakdown"
                                                />
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                <ChargeTooltip
                                                    amount={charge.customerCharge}
                                                    rates={charge.markupRates}
                                                    title="Customer Charge Breakdown"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {getStatusChip(charge.status)}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {charge.shipmentDate.toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        <Box sx={{ py: 3 }}>
                                            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                No charges found for selected filters
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={charges.length}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        sx={{
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
                    <Tab label="Sales Commissions" value="commissions" />
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
                        <>
                            {/* Enhanced Metrics Cards */}
                            <Grid container spacing={3} sx={{ mb: 4 }}>
                                <Grid item xs={12} md={3}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <MoneyIcon sx={{ color: '#16a34a', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#16a34a', fontSize: '11px' }}>
                                                    +12.5% from last year
                                                </Typography>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '28px', mb: 1 }}>
                                                ${metrics.totalRevenue.toLocaleString()}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                Total Revenue (YTD)
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <ReceiptIcon sx={{ color: '#dc2626', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#dc2626', fontSize: '11px' }}>
                                                    {metrics.pendingInvoices} pending invoices
                                                </Typography>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '28px', mb: 1 }}>
                                                ${metrics.outstandingBalance.toLocaleString()}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                Outstanding Balance
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <PaymentIcon sx={{ color: '#3b82f6', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#3b82f6', fontSize: '11px' }}>
                                                    {metrics.paidInvoices} of {metrics.paidInvoices + metrics.pendingInvoices} invoices
                                                </Typography>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '28px', mb: 1 }}>
                                                {metrics.paidInvoices + metrics.pendingInvoices > 0 ?
                                                    Math.round((metrics.paidInvoices / (metrics.paidInvoices + metrics.pendingInvoices)) * 100) : 0}%
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                Collection Rate
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <TrendingUpIcon sx={{ color: '#8b5cf6', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#8b5cf6', fontSize: '11px' }}>
                                                    Based on paid invoices
                                                </Typography>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '28px', mb: 1 }}>
                                                ${metrics.paidInvoices > 0 ? Math.round(metrics.totalRevenue / metrics.paidInvoices).toLocaleString() : 0}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                Avg Invoice Value
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            {/* Second Row - Additional Metrics */}
                            <Grid container spacing={3} sx={{ mb: 4 }}>
                                <Grid item xs={12} md={4}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <ReceiptIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#f59e0b', fontSize: '11px' }}>
                                                    Ready for invoicing
                                                </Typography>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '28px', mb: 1 }}>
                                                ${metrics.uninvoicedCharges?.toLocaleString() || 0}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                Not Invoiced Total
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <MoneyIcon sx={{ color: '#10b981', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#10b981', fontSize: '11px' }}>
                                                    Current month
                                                </Typography>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '28px', mb: 1 }}>
                                                ${metrics.monthlyRevenue?.toLocaleString() || 0}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                Monthly Revenue
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                <TrendingUpIcon sx={{ color: '#6366f1', fontSize: 28 }} />
                                                <Typography variant="body2" sx={{ color: '#6366f1', fontSize: '11px' }}>
                                                    Growth indicator
                                                </Typography>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: '28px', mb: 1 }}>
                                                {metrics.growthRate || '+12.5'}%
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                Revenue Growth
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            {/* Global Company Charges Table */}
                            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mb: 4 }}>
                                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#111827' }}>
                                                Global Company Charges
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                                View and filter charges across all companies
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                                <InputLabel sx={{ fontSize: '12px' }}>Time Range</InputLabel>
                                                <Select
                                                    value={timeRange}
                                                    onChange={(e) => setTimeRange(e.target.value)}
                                                    label="Time Range"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    <MenuItem value="week" sx={{ fontSize: '12px' }}>Last 7 Days</MenuItem>
                                                    <MenuItem value="month" sx={{ fontSize: '12px' }}>Last 30 Days</MenuItem>
                                                    <MenuItem value="year" sx={{ fontSize: '12px' }}>Last Year</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                    </Box>

                                    {/* Filter Section */}
                                    <Grid container spacing={2} sx={{ mb: 2 }}>
                                        <Grid item xs={12} md={3}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Company Name"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                                <Select
                                                    value={paymentStatus}
                                                    onChange={(e) => setPaymentStatus(e.target.value)}
                                                    label="Status"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                                                    <MenuItem value="invoiced" sx={{ fontSize: '12px' }}>Invoiced</MenuItem>
                                                    <MenuItem value="uninvoiced" sx={{ fontSize: '12px' }}>Uninvoiced</MenuItem>
                                                    <MenuItem value="paid" sx={{ fontSize: '12px' }}>Paid</MenuItem>
                                                    <MenuItem value="overdue" sx={{ fontSize: '12px' }}>Overdue</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
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
                                        <Grid item xs={12} md={3}>
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
                                    </Grid>
                                </Box>

                                <GlobalCompanyChargesTable
                                    timeRange={timeRange}
                                    filters={{
                                        companyName: customerName,
                                        status: paymentStatus,
                                        fromDate,
                                        toDate
                                    }}
                                />
                            </Paper>

                            {/* Revenue Analytics */}
                            <Grid container spacing={3}>
                                <Grid item xs={12} lg={8}>
                                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '12px', height: 400 }}>
                                        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, fontSize: '16px', color: '#111827' }}>
                                            Revenue Trends
                                        </Typography>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={revenueTrends}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fontSize: 11 }}
                                                    stroke="#6b7280"
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 11 }}
                                                    stroke="#6b7280"
                                                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                                                />
                                                <ChartTooltip
                                                    contentStyle={{
                                                        backgroundColor: 'white',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '8px',
                                                        fontSize: '12px'
                                                    }}
                                                    formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="revenue"
                                                    stroke="#3b82f6"
                                                    strokeWidth={3}
                                                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} lg={4}>
                                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '12px', height: 400 }}>
                                        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, fontSize: '16px', color: '#111827' }}>
                                            Top Companies by Revenue
                                        </Typography>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={revenueByCompany.slice(0, 8)} layout="horizontal">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                <XAxis
                                                    type="number"
                                                    tick={{ fontSize: 11 }}
                                                    stroke="#6b7280"
                                                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="company"
                                                    tick={{ fontSize: 10 }}
                                                    stroke="#6b7280"
                                                    width={80}
                                                />
                                                <ChartTooltip
                                                    contentStyle={{
                                                        backgroundColor: 'white',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '8px',
                                                        fontSize: '12px'
                                                    }}
                                                    formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                                                />
                                                <Bar
                                                    dataKey="revenue"
                                                    fill="#8b5cf6"
                                                    radius={[0, 4, 4, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </>
                    )}
                </>
            )}

            {activeTab === 'invoices' && (
                <InvoiceManagement />
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