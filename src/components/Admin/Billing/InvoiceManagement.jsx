import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
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
    Chip,
    Button,
    Stack,
    Divider,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tooltip
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Receipt as ReceiptIcon,
    Download as DownloadIcon,
    Email as EmailIcon,
    Visibility as VisibilityIcon,
    AccountBalance as AccountBalanceIcon,
    TrendingUp as TrendingUpIcon,
    Assignment as AssignmentIcon,
    FilterList as FilterListIcon,
    GetApp as GetAppIcon,
    Add as AddIcon,
    Refresh as RefreshIcon,
    Send as SendIcon,
    PictureAsPdf as PdfIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import InvoiceForm from './InvoiceForm';

const InvoiceManagement = () => {
    const { enqueueSnackbar } = useSnackbar();
    const { currentUser, userRole } = useAuth();
    const { connectedCompanies } = useCompany();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [invoices, setInvoices] = useState([]);
    const [filteredInvoices, setFilteredInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [metrics, setMetrics] = useState({
        totalInvoices: 0,
        totalOutstanding: 0,
        totalPaid: 0,
        overdue: 0
    });

    // Manual invoice creation states
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);

    useEffect(() => {
        // Only fetch if we have a userRole and auth is loaded
        if (userRole && currentUser) {
            fetchInvoices();
        }
    }, [userRole, connectedCompanies, currentUser]);

    // Helper functions for shipment data processing
    const getShipmentCurrency = (shipment) => {
        return shipment.currency ||
            shipment.selectedRate?.currency ||
            shipment.markupRates?.currency ||
            shipment.actualRates?.currency ||
            (shipment.shipFrom?.country === 'CA' || shipment.shipTo?.country === 'CA' ? 'CAD' : 'USD') ||
            'USD';
    };

    const getShipmentCharge = (shipment) => {
        if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
            return shipment.manualRates.reduce((sum, rate) => {
                return sum + (parseFloat(rate.charge) || 0);
            }, 0);
        } else {
            return shipment.markupRates?.totalCharges ||
                shipment.totalCharges ||
                shipment.selectedRate?.totalCharges || 0;
        }
    };

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            setError(null);

            // Super admin can proceed without connected companies, regular admin needs them
            if (userRole !== 'superadmin' && (!connectedCompanies || connectedCompanies.length === 0)) {
                setLoading(false);
                return;
            }

            console.log('🔍 Fetching invoice data from shipments for', userRole, 'with', connectedCompanies?.length || 0, 'companies');

            let shipmentsSnapshot;

            // Define all possible invoice statuses to use 'in' filter instead of '!= null'
            const validInvoiceStatuses = [
                'uninvoiced', 'draft', 'invoiced', 'sent', 'viewed',
                'partial_payment', 'paid', 'overdue', 'cancelled'
            ];

            if (userRole === 'superadmin') {
                // Super admin: Fetch ALL shipments with invoice statuses
                shipmentsSnapshot = await getDocs(query(
                    collection(db, 'shipments'),
                    where('status', '!=', 'draft'),
                    where('invoiceStatus', 'in', validInvoiceStatuses), // Use 'in' instead of '!= null'
                    orderBy('createdAt', 'desc')
                ));
            } else {
                // Regular admin: Filter by connected companies
                const companyIDs = (connectedCompanies || []).map(company => company.companyID).filter(Boolean);

                if (companyIDs.length > 0) {
                    // Handle Firestore 'in' query limit of 10
                    if (companyIDs.length <= 10) {
                        shipmentsSnapshot = await getDocs(query(
                            collection(db, 'shipments'),
                            where('companyID', 'in', companyIDs),
                            where('status', '!=', 'draft'),
                            where('invoiceStatus', 'in', validInvoiceStatuses),
                            orderBy('createdAt', 'desc')
                        ));
                    } else {
                        // For more than 10 companies, batch the queries
                        const batches = [];
                        for (let i = 0; i < companyIDs.length; i += 10) {
                            const batch = companyIDs.slice(i, i + 10);
                            batches.push(
                                getDocs(query(
                                    collection(db, 'shipments'),
                                    where('companyID', 'in', batch),
                                    where('status', '!=', 'draft'),
                                    where('invoiceStatus', 'in', validInvoiceStatuses),
                                    orderBy('createdAt', 'desc')
                                ))
                            );
                        }

                        const results = await Promise.all(batches);
                        const allDocs = results.flatMap(result => result.docs);
                        shipmentsSnapshot = { docs: allDocs };
                    }
                } else {
                    shipmentsSnapshot = { docs: [] };
                }
            }

            const shipmentsData = shipmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Convert shipments to invoice-like data structure
            const invoiceData = shipmentsData
                .filter(shipment => shipment.invoiceStatus && shipment.invoiceStatus !== 'uninvoiced') // Only invoiced shipments
                .map(shipment => ({
                    id: shipment.id,
                    invoiceNumber: shipment.shipmentID || shipment.id,
                    shipmentId: shipment.shipmentID || shipment.id,
                    companyName: shipment.shipTo?.companyName || shipment.shipTo?.company || 'Unknown Customer',
                    status: shipment.invoiceStatus,
                    total: getShipmentCharge(shipment),
                    currency: getShipmentCurrency(shipment),
                    issueDate: shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt),
                    dueDate: null, // TODO: Calculate due date based on payment terms
                    createdAt: shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt),
                    shipmentData: shipment // Include full shipment data for reference
                }));

            setInvoices(invoiceData);
            setFilteredInvoices(invoiceData);
            calculateMetrics(invoiceData);

            console.log('📊 Invoice data loaded:', {
                invoices: invoiceData.length,
                shipments: shipmentsData.length
            });

        } catch (err) {
            console.error('Error fetching invoice data from shipments:', err);
            setError('Failed to load invoice data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateMetrics = (invoiceData) => {
        const now = new Date();

        const metrics = {
            totalInvoices: invoiceData.length,
            totalOutstanding: 0,
            totalPaid: 0,
            overdue: 0
        };

        invoiceData.forEach(invoice => {
            if (invoice.status === 'paid') {
                metrics.totalPaid += invoice.total || 0;
            } else {
                metrics.totalOutstanding += invoice.total || 0;

                // Check if overdue
                if (invoice.dueDate && invoice.dueDate < now) {
                    metrics.overdue += invoice.total || 0;
                }
            }
        });

        setMetrics(metrics);
    };

    // 🔄 ENHANCED: Update shipment invoice status directly
    const handleStatusUpdate = async (invoiceId, newStatus, paymentDetails = null, notes = '') => {
        try {
            enqueueSnackbar(`Updating invoice status to ${newStatus}...`, { variant: 'info' });

            // Update the shipment's invoice status directly
            const shipmentRef = doc(db, 'shipments', invoiceId);
            await updateDoc(shipmentRef, {
                invoiceStatus: newStatus,
                updatedAt: new Date(),
                ...(paymentDetails && { paymentDetails }),
                ...(notes && { statusNotes: notes })
            });

            // Find the invoice in our current list to get the shipment ID for display
            const invoice = invoices.find(inv => inv.id === invoiceId);
            const shipmentId = invoice?.shipmentId || invoiceId;

            enqueueSnackbar(
                `Shipment ${shipmentId} invoice status updated to ${newStatus}`,
                { variant: 'success' }
            );

            // Refresh invoice list to show updated data
            fetchInvoices();

        } catch (error) {
            console.error('Error updating invoice status:', error);
            enqueueSnackbar('Failed to update invoice status: ' + error.message, { variant: 'error' });
        }
    };

    // 🔄 NEW: Mark invoice as paid with payment details
    const handleMarkAsPaid = async (invoice) => {
        try {
            const paymentDetails = {
                amount: invoice.total,
                currency: invoice.currency || 'USD',
                method: 'Manual Entry',
                reference: `Payment for ${invoice.invoiceNumber}`,
                recordedBy: 'admin'
            };

            await handleStatusUpdate(invoice.id, 'paid', paymentDetails, 'Payment recorded by admin');
        } catch (error) {
            console.error('Error marking invoice as paid:', error);
            enqueueSnackbar('Failed to mark invoice as paid: ' + error.message, { variant: 'error' });
        }
    };

    // 🔄 NEW: Mark invoice as cancelled
    const handleCancelInvoice = async (invoice) => {
        try {
            await handleStatusUpdate(invoice.id, 'cancelled', null, 'Invoice cancelled by admin');
        } catch (error) {
            console.error('Error cancelling invoice:', error);
            enqueueSnackbar('Failed to cancel invoice: ' + error.message, { variant: 'error' });
        }
    };

    const handleResendInvoice = async (invoice) => {
        try {
            // Call the cloud function to resend the invoice
            const response = await fetch('/api/resend-invoice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    invoiceId: invoice.id,
                    companyId: invoice.companyId
                })
            });

            if (response.ok) {
                enqueueSnackbar('Invoice resent successfully', { variant: 'success' });
            } else {
                throw new Error('Failed to resend invoice');
            }
        } catch (error) {
            console.error('Error resending invoice:', error);
            enqueueSnackbar('Failed to resend invoice', { variant: 'error' });
        }
    };

    // 🔄 NEW: Enhanced regenerate PDF functionality
    const handleRegenerateInvoice = async (invoice) => {
        try {
            const regenerateInvoiceFunction = httpsCallable(functions, 'regenerateInvoice');

            enqueueSnackbar('Regenerating invoice PDF...', { variant: 'info' });

            const result = await regenerateInvoiceFunction({
                invoiceId: invoice.id,
                action: 'regenerate'
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `Invoice ${result.data.invoiceNumber} PDF regenerated successfully`,
                    { variant: 'success' }
                );

                // Refresh invoice list to show updated data
                fetchInvoices();
            } else {
                throw new Error('Failed to regenerate invoice');
            }
        } catch (error) {
            console.error('Error regenerating invoice:', error);
            enqueueSnackbar('Failed to regenerate invoice: ' + error.message, { variant: 'error' });
        }
    };

    // 🔄 NEW: Enhanced resend email functionality
    const handleResendInvoiceEmail = async (invoice) => {
        try {
            const regenerateInvoiceFunction = httpsCallable(functions, 'regenerateInvoice');

            enqueueSnackbar('Resending invoice email...', { variant: 'info' });

            const result = await regenerateInvoiceFunction({
                invoiceId: invoice.id,
                action: 'resend'
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `Invoice ${result.data.invoiceNumber} email resent successfully to ${result.data.emailSentTo}`,
                    { variant: 'success' }
                );

                // Refresh invoice list to show updated data
                fetchInvoices();
            } else {
                throw new Error('Failed to resend invoice email');
            }
        } catch (error) {
            console.error('Error resending invoice email:', error);
            enqueueSnackbar('Failed to resend invoice email: ' + error.message, { variant: 'error' });
        }
    };

    // 🔄 NEW: Combined regenerate and resend
    const handleRegenerateAndResend = async (invoice) => {
        try {
            const regenerateInvoiceFunction = httpsCallable(functions, 'regenerateInvoice');

            enqueueSnackbar('Regenerating PDF and resending email...', { variant: 'info' });

            const result = await regenerateInvoiceFunction({
                invoiceId: invoice.id,
                action: 'both'
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `Invoice ${result.data.invoiceNumber} regenerated and resent successfully`,
                    { variant: 'success' }
                );

                // Refresh invoice list to show updated data
                fetchInvoices();
            } else {
                throw new Error('Failed to regenerate and resend invoice');
            }
        } catch (error) {
            console.error('Error regenerating and resending invoice:', error);
            enqueueSnackbar('Failed to regenerate and resend invoice: ' + error.message, { variant: 'error' });
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const handleStatusFilterChange = (event) => {
        setStatusFilter(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setStatusFilter('');
    };

    const handleInvoiceClick = (invoice) => {
        setSelectedInvoice(invoice);
        setDetailsOpen(true);
    };

    // 🔄 ENHANCED: Support for additional invoice statuses
    const getStatusColor = (status) => {
        switch (status) {
            case 'paid':
                return { color: '#2e7d32', bgcolor: '#e8f5e9' };
            case 'generated':
                return { color: '#1565c0', bgcolor: '#e3f2fd' };
            case 'sent':
                return { color: '#7b1fa2', bgcolor: '#f3e5f5' };
            case 'viewed':
                return { color: '#00796b', bgcolor: '#e0f2f1' };
            case 'pending':
                return { color: '#ed6c02', bgcolor: '#fff3e0' };
            case 'overdue':
                return { color: '#d32f2f', bgcolor: '#ffebee' };
            case 'cancelled':
                return { color: '#757575', bgcolor: '#f5f5f5' };
            case 'refunded':
                return { color: '#f57c00', bgcolor: '#fff8e1' };
            case 'disputed':
                return { color: '#c62828', bgcolor: '#ffebee' };
            case 'draft':
                return { color: '#616161', bgcolor: '#fafafa' };
            default:
                return { color: '#1976d2', bgcolor: '#e3f2fd' };
        }
    };

    const isOverdue = (invoice) => {
        if (!invoice.dueDate) return false;
        const dueDate = invoice.dueDate?.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
        return dueDate < new Date() && invoice.status !== 'paid';
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';

        let date;
        if (dateValue?.toDate) {
            // Firestore Timestamp
            date = dateValue.toDate();
        } else if (dateValue instanceof Date) {
            // JavaScript Date
            date = dateValue;
        } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
            // String or number timestamp
            date = new Date(dateValue);
        } else {
            return 'N/A';
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'N/A';
        }

        return date.toLocaleDateString();
    };

    const handleCreateManualInvoice = () => {
        setEditingInvoiceId(null);
        setCreateInvoiceOpen(true);
    };

    const handleEditInvoice = (invoice) => {
        setEditingInvoiceId(invoice.id);
        setCreateInvoiceOpen(true);
    };

    const handleCloseInvoiceForm = () => {
        setCreateInvoiceOpen(false);
        setEditingInvoiceId(null);
    };

    const handleInvoiceSuccess = () => {
        enqueueSnackbar('Invoice saved successfully', { variant: 'success' });
        setCreateInvoiceOpen(false);
        setEditingInvoiceId(null);
        fetchInvoices(); // Refresh the invoice list
    };

    useEffect(() => {
        let filtered = invoices;

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(invoice =>
                invoice.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                invoice.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                invoice.id.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Status filter
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'overdue') {
                filtered = filtered.filter(invoice => isOverdue(invoice));
            } else {
                filtered = filtered.filter(invoice => invoice.status === statusFilter);
            }
        }

        setFilteredInvoices(filtered);
        setPage(0); // Reset to first page when filters change
    }, [invoices, searchQuery, statusFilter]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
            </Alert>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            {/* Info Alert */}
            <Alert
                severity="info"
                sx={{
                    mb: 3,
                    mx: 2,
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    '& .MuiAlert-message': { fontSize: '12px' }
                }}
            >
                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                    Invoice Management - Shipment-Based Invoicing
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5 }}>
                    Displaying invoiced shipments using the universal invoice status system. Each row represents a shipment with an invoice status.
                </Typography>
            </Alert>

            {/* Metrics Cards */}
            <Grid container spacing={3} sx={{ mb: 4, px: 2 }}>
                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <AssignmentIcon sx={{ color: '#6b46c1', mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Total Invoices
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    {metrics.totalInvoices}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    All time
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                    >
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <AccountBalanceIcon sx={{ color: '#dc2626', mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Outstanding
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    ${metrics.totalOutstanding.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    Unpaid invoices
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                    >
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <TrendingUpIcon sx={{ color: '#16a34a', mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Total Paid
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    ${metrics.totalPaid.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    Collected revenue
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                    >
                        <Card
                            elevation={0}
                            sx={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                background: metrics.overdue > 0 ? '#fef2f2' : 'white'
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <ReceiptIcon sx={{ color: '#ef4444', mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Overdue
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    ${metrics.overdue.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    Past due date
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>
            </Grid>

            {/* Invoices Table */}
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mx: 2 }}>
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#111827' }}>
                            Invoice Management
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<GetAppIcon />}
                                sx={{ fontSize: '12px' }}
                            >
                                Export
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                sx={{ fontSize: '12px' }}
                                onClick={handleCreateManualInvoice}
                            >
                                Create Manual Invoice
                            </Button>
                        </Stack>
                    </Box>

                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={8}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search invoices by number, company, or ID..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ fontSize: '20px', color: '#6b7280' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchQuery && (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={handleClearSearch}>
                                                <ClearIcon sx={{ fontSize: '18px' }} />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '14px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Status Filter</InputLabel>
                                <Select
                                    value={statusFilter}
                                    onChange={handleStatusFilterChange}
                                    label="Status Filter"
                                >
                                    <MenuItem value="all">All Invoices</MenuItem>
                                    <MenuItem value="uninvoiced">Uninvoiced</MenuItem>
                                    <MenuItem value="draft">Draft</MenuItem>
                                    <MenuItem value="invoiced">Invoiced</MenuItem>
                                    <MenuItem value="sent">Sent</MenuItem>
                                    <MenuItem value="viewed">Viewed</MenuItem>
                                    <MenuItem value="partial_payment">Partial Payment</MenuItem>
                                    <MenuItem value="paid">Paid</MenuItem>
                                    <MenuItem value="overdue">Overdue</MenuItem>
                                    <MenuItem value="cancelled">Cancelled</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Shipment ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Customer</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Invoice Date</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Due Date</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Amount</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Invoice Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredInvoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#6b7280' }}>
                                        <ReceiptIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                        <Typography variant="body1">No invoices found</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((invoice) => {
                                        const overdue = isOverdue(invoice);
                                        const displayStatus = overdue ? 'overdue' : invoice.status;

                                        return (
                                            <TableRow
                                                key={invoice.id}
                                                hover
                                                sx={{
                                                    cursor: 'pointer',
                                                    backgroundColor: overdue ? '#fef2f2' : 'inherit'
                                                }}
                                                onClick={() => handleInvoiceClick(invoice)}
                                            >
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {invoice.invoiceNumber}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {invoice.companyName}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {formatDate(invoice.issueDate)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {formatDate(invoice.dueDate)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    ${invoice.total.toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={displayStatus}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '11px',
                                                            height: '22px',
                                                            bgcolor: getStatusColor(displayStatus).bgcolor,
                                                            color: getStatusColor(displayStatus).color,
                                                            textTransform: 'capitalize'
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                                        <Tooltip title="View Details">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleInvoiceClick(invoice);
                                                                }}
                                                            >
                                                                <VisibilityIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Download PDF">
                                                            <IconButton size="small">
                                                                <DownloadIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Regenerate PDF">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRegenerateInvoice(invoice);
                                                                }}
                                                                sx={{ color: '#3b82f6' }}
                                                            >
                                                                <RefreshIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Resend Email">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleResendInvoiceEmail(invoice);
                                                                }}
                                                                sx={{ color: '#10b981' }}
                                                            >
                                                                <SendIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {/* 🔄 NEW: Status-based action buttons */}
                                                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                                            <Tooltip title="Mark as Paid">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMarkAsPaid(invoice);
                                                                    }}
                                                                    sx={{ color: '#059669' }}
                                                                >
                                                                    <AttachMoneyIcon sx={{ fontSize: '16px' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                                                            <Tooltip title="Cancel Invoice">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCancelInvoice(invoice);
                                                                    }}
                                                                    sx={{ color: '#dc2626' }}
                                                                >
                                                                    <CancelIcon sx={{ fontSize: '16px' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip title="Regenerate & Resend">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRegenerateAndResend(invoice);
                                                                }}
                                                                sx={{ color: '#8b5cf6' }}
                                                            >
                                                                <PdfIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
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
                        borderTop: '1px solid #e5e7eb',
                        '& .MuiTablePagination-toolbar': {
                            fontSize: '12px'
                        }
                    }}
                />
            </Paper>

            {/* Invoice Details Dialog */}
            <Dialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6">
                            Invoice {selectedInvoice?.invoiceNumber}
                        </Typography>
                        <IconButton onClick={() => setDetailsOpen(false)} size="small">
                            <ClearIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {selectedInvoice && (
                        <Box>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Company</Typography>
                                    <Typography variant="body1">{selectedInvoice.companyName}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Total Amount</Typography>
                                    <Typography variant="h6">${selectedInvoice.total.toFixed(2)}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Issue Date</Typography>
                                    <Typography variant="body1">{formatDate(selectedInvoice.issueDate)}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Due Date</Typography>
                                    <Typography variant="body1">{formatDate(selectedInvoice.dueDate)}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Payment Terms</Typography>
                                    <Typography variant="body1">{selectedInvoice.paymentTerms}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                                    <Chip
                                        label={isOverdue(selectedInvoice) ? 'overdue' : selectedInvoice.status}
                                        size="small"
                                        sx={{
                                            bgcolor: getStatusColor(isOverdue(selectedInvoice) ? 'overdue' : selectedInvoice.status).bgcolor,
                                            color: getStatusColor(isOverdue(selectedInvoice) ? 'overdue' : selectedInvoice.status).color,
                                            textTransform: 'capitalize'
                                        }}
                                    />
                                </Grid>
                            </Grid>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Line Items ({selectedInvoice.lineItems?.length || 0} shipments)
                            </Typography>

                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Shipment ID</TableCell>
                                            <TableCell>Description</TableCell>
                                            <TableCell>Carrier</TableCell>
                                            <TableCell align="right">Amount</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {selectedInvoice.lineItems?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell sx={{ fontSize: '12px' }}>{item.shipmentId}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{item.description}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{item.carrier}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: '12px' }}>
                                                    ${item.charges.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow>
                                            <TableCell colSpan={3} sx={{ fontWeight: 600 }}>Subtotal</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                ${selectedInvoice.subtotal.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell colSpan={3} sx={{ fontWeight: 600 }}>Tax</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                ${selectedInvoice.tax.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell colSpan={3} sx={{ fontWeight: 700, fontSize: '14px' }}>Total</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: '14px' }}>
                                                ${selectedInvoice.total.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {selectedInvoice && selectedInvoice.status !== 'paid' && (
                        <Button
                            variant="contained"
                            color="success"
                            onClick={() => {
                                handleStatusUpdate(selectedInvoice.id, 'paid');
                                setDetailsOpen(false);
                            }}
                        >
                            Mark as Paid
                        </Button>
                    )}
                    <Button onClick={() => setDetailsOpen(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Manual Invoice Form Dialog */}
            {createInvoiceOpen && (
                <Box sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1300,
                    bgcolor: 'white'
                }}>
                    <InvoiceForm
                        invoiceId={editingInvoiceId}
                        onClose={handleCloseInvoiceForm}
                        onSuccess={handleInvoiceSuccess}
                    />
                </Box>
            )}
        </Box>
    );
};

export default InvoiceManagement; 