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
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const generateMockInvoices = () => {
    const carriers = ['FedEx', 'UPS', 'DHL', 'USPS'];
    const services = ['Express', 'Ground', 'Priority', '2-Day', 'Overnight'];
    const statuses = ['Paid', 'Unpaid', 'Processing', 'Overdue'];
    const companies = ['Acme Corp', 'Global Industries', 'Tech Solutions', 'Retail Giants', 'Logistics Pro'];

    return Array.from({ length: 40 }, (_, index) => {
        const id = index + 1;
        const amount = (Math.random() * 5000 + 500).toFixed(2);
        const cost = (amount * 0.7).toFixed(2);
        const tax = (amount * 0.1).toFixed(2);
        const date = new Date(2024, 2, Math.floor(Math.random() * 30) + 1);
        const dueDate = new Date(date);
        dueDate.setDate(date.getDate() + 30);

        return {
            id: `INV-2024-${id.toString().padStart(3, '0')}`,
            number: `INV-${id.toString().padStart(6, '0')}`,
            date: date.toISOString().split('T')[0],
            dueDate: dueDate.toISOString().split('T')[0],
            company: companies[Math.floor(Math.random() * companies.length)],
            amount: parseFloat(amount),
            cost: parseFloat(cost),
            tax: parseFloat(tax),
            status: statuses[Math.floor(Math.random() * statuses.length)],
            currency: 'USD',
            shipments: [
                {
                    id: `SHP-${id.toString().padStart(3, '0')}`,
                    carrier: carriers[Math.floor(Math.random() * carriers.length)],
                    service: services[Math.floor(Math.random() * services.length)],
                    trackingNumber: `${carriers[Math.floor(Math.random() * carriers.length)]}${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                    from: {
                        name: 'John Smith',
                        company: 'SolushipX Inc.',
                        address: '123 Business Ave, Suite 100',
                        city: 'New York',
                        state: 'NY',
                        postalCode: '10001',
                        country: 'US'
                    },
                    to: {
                        name: 'Jane Doe',
                        company: companies[Math.floor(Math.random() * companies.length)],
                        address: '456 Enterprise Blvd',
                        city: 'Los Angeles',
                        state: 'CA',
                        postalCode: '90001',
                        country: 'US'
                    }
                }
            ]
        };
    });
};

const BillingDashboard = () => {
    const [activeTab, setActiveTab] = useState('invoices');
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
    const [invoices, setInvoices] = useState(generateMockInvoices());
    const [anchorEl, setAnchorEl] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [ediFiles, setEdiFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        fetchBillingData();
    }, [timeRange]);

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            const invoicesRef = collection(db, 'invoices');
            const startDate = getStartDate(timeRange);

            // Fetch invoices within the selected time range
            const q = query(
                invoicesRef,
                where('createdAt', '>=', startDate),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const invoices = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate metrics
            const totalRevenue = invoices.reduce((sum, invoice) =>
                sum + (invoice.status === 'paid' ? invoice.total : 0), 0);

            const outstandingBalance = invoices.reduce((sum, invoice) =>
                sum + (invoice.status === 'pending' ? invoice.total : 0), 0);

            const paidInvoices = invoices.filter(invoice => invoice.status === 'paid').length;
            const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending').length;

            setMetrics({
                totalRevenue,
                outstandingBalance,
                paidInvoices,
                pendingInvoices,
            });

            // Prepare revenue trends data
            const trends = prepareRevenueTrends(invoices);
            setRevenueTrends(trends);

            // Prepare revenue by company data
            const companyRevenue = prepareCompanyRevenue(invoices);
            setRevenueByCompany(companyRevenue);

            // Set recent invoices
            setRecentInvoices(invoices.slice(0, 5));

        } catch (err) {
            setError('Error fetching billing data: ' + err.message);
        } finally {
            setLoading(false);
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
        const trends = {};
        invoices.forEach(invoice => {
            const date = invoice.createdAt.toDate().toLocaleDateString();
            trends[date] = (trends[date] || 0) + (invoice.status === 'paid' ? invoice.total : 0);
        });

        return Object.entries(trends).map(([date, amount]) => ({
            date,
            revenue: amount
        }));
    };

    const prepareCompanyRevenue = (invoices) => {
        const revenue = {};
        invoices.forEach(invoice => {
            if (invoice.status === 'paid') {
                revenue[invoice.companyName] = (revenue[invoice.companyName] || 0) + invoice.total;
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
        // Implement export functionality
        console.log('Exporting billing data...');
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
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
            invoice.number.toLowerCase().includes(searchStr) ||
            invoice.company.toLowerCase().includes(searchStr) ||
            invoice.status.toLowerCase().includes(searchStr)
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
                <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
                    Billing Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Manage invoices, EDI processing, and payment tracking
                </Typography>
            </Box>

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
                            fontWeight: 500
                        }
                    }}
                >
                    <Tab label="Invoices" value="invoices" />
                    <Tab label="EDI Processing" value="edi" />
                    <Tab label="Generate Invoices" value="generate" />
                    <Tab label="Generate Business Invoices" value="business" />
                    <Tab label="Not Invoiced" value="not-invoiced" />
                    <Tab label="Pay Invoices" value="pay" />
                    <Tab label="Received Payments" value="payments" />
                </Tabs>
            </Box>

            {activeTab === 'invoices' && (
                <>
                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #eee' }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Search Invoices</Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6} md={3}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        label="From Date"
                                        value={fromDate}
                                        onChange={setFromDate}
                                        renderInput={(params) => <TextField {...params} fullWidth />}
                                    />
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        label="To Date"
                                        value={toDate}
                                        onChange={setToDate}
                                        renderInput={(params) => <TextField {...params} fullWidth />}
                                    />
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Customer Name</InputLabel>
                                    <Select
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        label="Customer Name"
                                    >
                                        <MenuItem value="">All</MenuItem>
                                        {/* Add customer options dynamically */}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    label="Invoice Number"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Payment Status</InputLabel>
                                    <Select
                                        value={paymentStatus}
                                        onChange={(e) => setPaymentStatus(e.target.value)}
                                        label="Payment Status"
                                    >
                                        <MenuItem value="">All</MenuItem>
                                        <MenuItem value="paid">Paid</MenuItem>
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="overdue">Overdue</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Customer Notify</InputLabel>
                                    <Select
                                        value={customerNotify}
                                        onChange={(e) => setCustomerNotify(e.target.value)}
                                        label="Customer Notify"
                                    >
                                        <MenuItem value="">All</MenuItem>
                                        <MenuItem value="notified">Notified</MenuItem>
                                        <MenuItem value="not-notified">Not Notified</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
                                <FormControl component="fieldset">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography>Display Cancelled</Typography>
                                        <Switch
                                            checked={displayCancelled}
                                            onChange={(e) => setDisplayCancelled(e.target.checked)}
                                        />
                                    </Stack>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                                <Stack direction="row" spacing={2}>
                                    <Button
                                        variant="contained"
                                        onClick={handleSearch}
                                        startIcon={<SearchIcon />}
                                    >
                                        Search
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={handleReset}
                                    >
                                        Reset
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Paper elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">Customer Invoice List</Typography>
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    placeholder="Search invoices..."
                                    size="small"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                                        endAdornment: searchTerm && (
                                            <IconButton size="small" onClick={() => setSearchTerm('')}>
                                                <CloseIcon />
                                            </IconButton>
                                        )
                                    }}
                                    sx={{ width: 250 }}
                                />
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={handleExport}
                                >
                                    Export
                                </Button>
                            </Stack>
                        </Box>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Invoice #</TableCell>
                                        <TableCell>Company</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Due Date</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                        <TableCell align="right">Cost</TableCell>
                                        <TableCell align="right">Tax</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredInvoices
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
                                                    <TableCell>{invoice.number}</TableCell>
                                                    <TableCell>{invoice.company}</TableCell>
                                                    <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                                                    <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                                                    <TableCell align="right">${invoice.amount.toFixed(2)}</TableCell>
                                                    <TableCell align="right">${invoice.cost.toFixed(2)}</TableCell>
                                                    <TableCell align="right">${invoice.tax.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={invoice.status}
                                                            size="small"
                                                            sx={{
                                                                color: statusColor.color,
                                                                bgcolor: statusColor.bgcolor,
                                                                fontWeight: 600,
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
                                                            <MoreVertIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    {filteredInvoices.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} align="center">
                                                <Box sx={{ py: 3 }}>
                                                    <Typography variant="body1" color="text.secondary">
                                                        No invoices found
                                                    </Typography>
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
                        />
                    </Paper>

                    <Dialog
                        open={detailsOpen}
                        onClose={handleCloseDetails}
                        maxWidth="md"
                        fullWidth
                    >
                        <DialogTitle>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6">Invoice Details</Typography>
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
                                            <Typography variant="h5">{selectedInvoice.number}</Typography>
                                            <Chip
                                                label={selectedInvoice.status}
                                                size="small"
                                                sx={{
                                                    color: getStatusColor(selectedInvoice.status).color,
                                                    bgcolor: getStatusColor(selectedInvoice.status).bgcolor,
                                                    fontWeight: 600,
                                                    borderRadius: '6px',
                                                }}
                                            />
                                        </Box>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Company</Typography>
                                        <Typography variant="body1">{selectedInvoice.company}</Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Invoice Date</Typography>
                                        <Typography variant="body1">
                                            {new Date(selectedInvoice.date).toLocaleDateString()}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Due Date</Typography>
                                        <Typography variant="body1">
                                            {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                                        <Typography variant="body1">${selectedInvoice.amount.toFixed(2)}</Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Shipment Details</Typography>
                                        <Divider />
                                        {selectedInvoice.shipments.map((shipment) => (
                                            <Box key={shipment.id} sx={{ mt: 2 }}>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2" color="text.secondary">
                                                            Tracking Number
                                                        </Typography>
                                                        <Typography variant="body1">{shipment.trackingNumber}</Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2" color="text.secondary">
                                                            Carrier & Service
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {shipment.carrier} - {shipment.service}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2" color="text.secondary">From</Typography>
                                                        <Typography variant="body1">
                                                            {shipment.from.name}<br />
                                                            {shipment.from.company}<br />
                                                            {shipment.from.address}<br />
                                                            {shipment.from.city}, {shipment.from.state} {shipment.from.postalCode}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2" color="text.secondary">To</Typography>
                                                        <Typography variant="body1">
                                                            {shipment.to.name}<br />
                                                            {shipment.to.company}<br />
                                                            {shipment.to.address}<br />
                                                            {shipment.to.city}, {shipment.to.state} {shipment.to.postalCode}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        ))}
                                    </Grid>
                                </Grid>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleCloseDetails}>Close</Button>
                            <Button
                                variant="contained"
                                startIcon={<DownloadIcon />}
                                onClick={() => {/* Handle download */ }}
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
                        <MenuItem onClick={handleMenuClose}>View Details</MenuItem>
                        <MenuItem onClick={handleMenuClose}>Edit Invoice</MenuItem>
                        <MenuItem onClick={handleMenuClose}>Download PDF</MenuItem>
                        <MenuItem onClick={handleMenuClose}>Send to Customer</MenuItem>
                        <MenuItem onClick={handleMenuClose}>Mark as Paid</MenuItem>
                        <MenuItem onClick={handleMenuClose}>Cancel Invoice</MenuItem>
                    </Menu>
                </>
            )}

            {activeTab === 'edi' && (
                <>
                    <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #eee' }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Search EDI</Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6} md={3}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        label="From Date"
                                        value={fromDate}
                                        onChange={setFromDate}
                                        renderInput={(params) => <TextField {...params} fullWidth />}
                                    />
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        label="To Date"
                                        value={toDate}
                                        onChange={setToDate}
                                        renderInput={(params) => <TextField {...params} fullWidth />}
                                    />
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    label="Invoice #"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    InputProps={{
                                        endAdornment: (
                                            <IconButton size="small">
                                                <SearchIcon />
                                            </IconButton>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>File Name</InputLabel>
                                    <Select
                                        value=""
                                        label="File Name"
                                    >
                                        <MenuItem value="">
                                            <em>Any</em>
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Carrier</InputLabel>
                                    <Select
                                        value=""
                                        label="Carrier"
                                    >
                                        <MenuItem value="">
                                            <em>Any</em>
                                        </MenuItem>
                                        <MenuItem value="fedex">FedEx</MenuItem>
                                        <MenuItem value="ups">UPS</MenuItem>
                                        <MenuItem value="usps">USPS</MenuItem>
                                        <MenuItem value="dhl">DHL</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value=""
                                        label="Status"
                                    >
                                        <MenuItem value="">
                                            <em>Any</em>
                                        </MenuItem>
                                        <MenuItem value="processed">Processed</MenuItem>
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="failed">Failed</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Paper
                        elevation={0}
                        sx={{
                            border: '1px solid #eee',
                            borderRadius: 1,
                            mb: 3,
                            p: 3,
                            backgroundColor: dragActive ? 'action.hover' : 'background.paper',
                            transition: 'background-color 0.3s ease'
                        }}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                p: 4,
                                border: '2px dashed',
                                borderColor: dragActive ? 'primary.main' : 'divider',
                                borderRadius: 1,
                                cursor: 'pointer',
                            }}
                            onClick={onButtonClick}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.csv,.xlsx,.xls"
                                onChange={handleFileInputChange}
                                style={{ display: 'none' }}
                            />
                            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                Drop EDI files here
                            </Typography>
                            <Typography variant="body2" color="text.secondary" align="center">
                                or click to select files (PDF, CSV, Excel)
                            </Typography>
                        </Box>
                    </Paper>

                    {ediFiles.length > 0 && (
                        <Paper elevation={0} sx={{ border: '1px solid #eee' }}>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>File Name</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Size</TableCell>
                                            <TableCell>Upload Date</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {ediFiles.map((file, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <DocumentIcon color="primary" />
                                                        {file.name}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{file.type || 'Unknown'}</TableCell>
                                                <TableCell>{(file.size / 1024).toFixed(2)} KB</TableCell>
                                                <TableCell>{new Date(file.lastModified).toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={file.status}
                                                        size="small"
                                                        color={file.status === 'processed' ? 'success' :
                                                            file.status === 'failed' ? 'error' : 'warning'}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <IconButton size="small">
                                                        <MoreVertIcon />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </>
            )}
        </Box>
    );
};

export default BillingDashboard; 