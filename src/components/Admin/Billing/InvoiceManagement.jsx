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
    Add as AddIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import InvoiceForm from './InvoiceForm';

const InvoiceManagement = () => {
    const { enqueueSnackbar } = useSnackbar();
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
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all invoices
            const invoicesRef = collection(db, 'invoices');
            const invoicesQuery = query(invoicesRef, orderBy('createdAt', 'desc'));
            const invoicesSnapshot = await getDocs(invoicesQuery);

            const invoiceData = invoicesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Ensure consistent field names
                invoiceNumber: doc.data().invoiceNumber || doc.data().number || doc.id,
                companyName: doc.data().companyName || doc.data().company,
                status: doc.data().status || 'pending',
                total: doc.data().total || doc.data().amount || 0,
                issueDate: doc.data().issueDate || doc.data().date || doc.data().createdAt,
                dueDate: doc.data().dueDate || doc.data().due_date,
                createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
            }));

            setInvoices(invoiceData);
            setFilteredInvoices(invoiceData);
            calculateMetrics(invoiceData);

        } catch (err) {
            console.error('Error fetching invoices:', err);
            setError('Failed to load invoices: ' + err.message);
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

    const handleStatusUpdate = async (invoiceId, newStatus) => {
        try {
            await updateDoc(doc(db, 'invoices', invoiceId), {
                status: newStatus,
                updatedAt: new Date()
            });

            enqueueSnackbar('Invoice status updated successfully', { variant: 'success' });
            fetchInvoices(); // Refresh data

        } catch (error) {
            console.error('Error updating invoice status:', error);
            enqueueSnackbar('Failed to update invoice status', { variant: 'error' });
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

    const getStatusColor = (status) => {
        switch (status) {
            case 'paid':
                return { color: '#2e7d32', bgcolor: '#e8f5e9' };
            case 'pending':
                return { color: '#ed6c02', bgcolor: '#fff3e0' };
            case 'overdue':
                return { color: '#d32f2f', bgcolor: '#ffebee' };
            case 'cancelled':
                return { color: '#757575', bgcolor: '#f5f5f5' };
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
        <Box>
            {/* Metrics Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
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
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
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
                                    <MenuItem value="pending">Pending</MenuItem>
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
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Invoice #</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Company</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Issue Date</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Due Date</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Amount</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Status</TableCell>
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
                                                    <Stack direction="row" spacing={1}>
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
                                                        <Tooltip title="Resend Email">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleResendInvoice(invoice);
                                                                }}
                                                            >
                                                                <EmailIcon sx={{ fontSize: '16px' }} />
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