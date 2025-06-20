import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
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
    Menu,
    MenuItem,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Download as DownloadIcon,
    FilterList as FilterIcon,
    MoreVert as MoreVertIcon,
    Receipt as ReceiptIcon,
    CreditCard as CreditCardIcon,
    Close as CloseIcon,
    KeyboardArrowRight as KeyboardArrowRightIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

// Empty invoices array - no placeholder data
const mockInvoices = [];

const Invoices = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [searchQuery, setSearchQuery] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [savedCards] = useState([
        { id: 'card1', last4: '4242', brand: 'Visa' },
        { id: 'card2', last4: '8210', brand: 'Mastercard' }
    ]);

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

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    const handleFilterClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleFilterClose = () => {
        setAnchorEl(null);
    };

    const handleInvoiceClick = (invoice) => {
        setSelectedInvoice(invoice);
    };

    const handleCloseInvoice = () => {
        setSelectedInvoice(null);
    };

    const handlePayNow = () => {
        setShowPaymentDialog(true);
    };

    const handlePaymentSubmit = () => {
        // Handle payment submission
        setShowPaymentDialog(false);
        setSelectedInvoice(prev => ({
            ...prev,
            status: 'Processing'
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Paid':
                return { color: '#2e7d32', bgcolor: '#e8f5e9' };
            case 'Unpaid':
                return { color: '#d32f2f', bgcolor: '#ffebee' };
            case 'Processing':
                return { color: '#ed6c02', bgcolor: '#fff3e0' };
            default:
                return { color: '#1976d2', bgcolor: '#e3f2fd' };
        }
    };

    const filteredInvoices = mockInvoices.filter(invoice =>
        invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                    Invoices
                </Typography>
                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FilterIcon />}
                        onClick={handleFilterClick}
                        sx={{ fontSize: '12px' }}
                    >
                        Filter
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<DownloadIcon />}
                        sx={{
                            fontSize: '12px',
                            bgcolor: '#6b46c1',
                            '&:hover': { bgcolor: '#553c9a' }
                        }}
                    >
                        Export
                    </Button>
                </Stack>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    mb: 3
                }}
            >
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search invoices..."
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
                        ),
                        sx: { fontSize: '12px' }
                    }}
                    sx={{
                        '& .MuiInputBase-input': { fontSize: '12px' }
                    }}
                />
            </Paper>

            <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                }}
            >
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Invoice #</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Amount</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Due Date</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#6b7280' }}>
                                    No invoices found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInvoices
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((invoice) => (
                                    <TableRow
                                        key={invoice.id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => handleInvoiceClick(invoice)}
                                    >
                                        <TableCell sx={{ fontSize: '12px' }}>{invoice.id}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>{invoice.date}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>${invoice.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={invoice.status}
                                                size="small"
                                                sx={{
                                                    fontSize: '11px',
                                                    height: '22px',
                                                    bgcolor: getStatusColor(invoice.status).bgcolor,
                                                    color: getStatusColor(invoice.status).color
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>{invoice.dueDate}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small">
                                                <MoreVertIcon sx={{ fontSize: '18px' }} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
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
                rowsPerPageOptions={[5, 10, 25]}
            />

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleFilterClose}
            >
                <MenuItem onClick={handleFilterClose}>All Invoices</MenuItem>
                <MenuItem onClick={handleFilterClose}>Paid</MenuItem>
                <MenuItem onClick={handleFilterClose}>Pending</MenuItem>
                <MenuItem onClick={handleFilterClose}>Overdue</MenuItem>
            </Menu>

            {/* Invoice Detail Dialog */}
            <InvoiceDetailsDialog
                open={!!selectedInvoice}
                onClose={handleCloseInvoice}
                invoice={selectedInvoice}
            />

            {/* Payment Dialog */}
            <Dialog
                open={showPaymentDialog}
                onClose={() => setShowPaymentDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" component="div">
                            Pay Invoice
                        </Typography>
                        <IconButton onClick={() => setShowPaymentDialog(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Payment Method
                            </Typography>
                            <TextField
                                select
                                fullWidth
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                {savedCards.map((card) => (
                                    <MenuItem key={card.id} value={card.id}>
                                        {card.brand} ending in {card.last4}
                                    </MenuItem>
                                ))}
                                <MenuItem value="new">
                                    <Box sx={{ color: 'primary.main' }}>
                                        + Add new card
                                    </Box>
                                </MenuItem>
                            </TextField>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Amount to Pay
                            </Typography>
                            <Typography variant="h5">
                                ${selectedInvoice?.amount.toFixed(2)}
                            </Typography>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowPaymentDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handlePaymentSubmit}
                        disabled={!paymentMethod}
                        sx={{
                            bgcolor: '#000',
                            '&:hover': { bgcolor: '#333' }
                        }}
                    >
                        Pay Now
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

const InvoiceDetailsDialog = ({ open, onClose, invoice }) => {
    if (!invoice) return null;

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'paid':
                return { color: '#2e7d32', bgcolor: '#e8f5e9' };
            case 'unpaid':
                return { color: '#d32f2f', bgcolor: '#ffebee' };
            case 'processing':
                return { color: '#ed6c02', bgcolor: '#fff3e0' };
            default:
                return { color: '#1976d2', bgcolor: '#e3f2fd' };
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Invoice #{invoice.id}</Typography>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 4 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">Invoice Date</Typography>
                            <Typography>{invoice.date}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">Due Date</Typography>
                            <Typography>{invoice.dueDate}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                            <Chip
                                label={invoice.status}
                                size="small"
                                sx={{
                                    bgcolor: getStatusColor(invoice.status).bgcolor,
                                    color: getStatusColor(invoice.status).color
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">Total Amount</Typography>
                            <Typography variant="h6">${invoice.amount.toFixed(2)}</Typography>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

                {invoice.shipments.map((shipment, index) => (
                    <Box key={shipment.id} sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Shipment #{shipment.id}
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Ship From
                                    </Typography>
                                    <Typography>{shipment.from.name}</Typography>
                                    <Typography>{shipment.from.company}</Typography>
                                    <Typography>{shipment.from.address}</Typography>
                                    <Typography>
                                        {shipment.from.city}, {shipment.from.state} {shipment.from.postalCode}
                                    </Typography>
                                    <Typography>{shipment.from.country}</Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Ship To
                                    </Typography>
                                    <Typography>{shipment.to.name}</Typography>
                                    <Typography>{shipment.to.company}</Typography>
                                    <Typography>{shipment.to.address}</Typography>
                                    <Typography>
                                        {shipment.to.city}, {shipment.to.state} {shipment.to.postalCode}
                                    </Typography>
                                    <Typography>{shipment.to.country}</Typography>
                                </Paper>
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Package Details
                            </Typography>
                            <TableContainer component={Paper} sx={{ mb: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Description</TableCell>
                                            <TableCell>Weight</TableCell>
                                            <TableCell>Dimensions</TableCell>
                                            <TableCell>Declared Value</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {shipment.packages.map((pkg, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{pkg.description}</TableCell>
                                                <TableCell>{pkg.weight}</TableCell>
                                                <TableCell>{pkg.dimensions}</TableCell>
                                                <TableCell>${pkg.declaredValue.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Charges Breakdown
                            </Typography>
                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Freight Charge</TableCell>
                                            <TableCell align="right">${shipment.charges.freight.toFixed(2)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Fuel Surcharge</TableCell>
                                            <TableCell align="right">${shipment.charges.fuel.toFixed(2)}</TableCell>
                                        </TableRow>
                                        {shipment.charges.residentialDelivery && (
                                            <TableRow>
                                                <TableCell>Residential Delivery</TableCell>
                                                <TableCell align="right">${shipment.charges.residentialDelivery.toFixed(2)}</TableCell>
                                            </TableRow>
                                        )}
                                        {shipment.charges.insurance && (
                                            <TableRow>
                                                <TableCell>Insurance</TableCell>
                                                <TableCell align="right">${shipment.charges.insurance.toFixed(2)}</TableCell>
                                            </TableRow>
                                        )}
                                        {shipment.charges.liftgate && (
                                            <TableRow>
                                                <TableCell>Liftgate Service</TableCell>
                                                <TableCell align="right">${shipment.charges.liftgate.toFixed(2)}</TableCell>
                                            </TableRow>
                                        )}
                                        <TableRow>
                                            <TableCell><strong>Total</strong></TableCell>
                                            <TableCell align="right"><strong>${shipment.charges.total.toFixed(2)}</strong></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    sx={{
                        bgcolor: '#000',
                        '&:hover': { bgcolor: '#333' }
                    }}
                >
                    Download Invoice
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default Invoices; 