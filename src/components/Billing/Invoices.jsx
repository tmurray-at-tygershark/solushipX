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

const originalMockInvoices = [
    {
        id: 'INV-2024-001',
        date: '2024-03-15',
        amount: 2450.75,
        status: 'Unpaid',
        dueDate: '2024-04-15',
        shipments: [
            {
                id: 'SHP-001',
                date: '2024-03-10',
                carrier: 'FedEx',
                service: 'Express',
                cost: 850.25,
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
                    company: 'Acme Corp',
                    address: '456 Enterprise Blvd',
                    city: 'Los Angeles',
                    state: 'CA',
                    postalCode: '90001',
                    country: 'US'
                },
                packages: [
                    {
                        weight: '5.5 lbs',
                        dimensions: '12" x 8" x 6"',
                        declaredValue: 500,
                        description: 'Electronics Equipment'
                    }
                ],
                charges: {
                    freight: 750.00,
                    fuel: 50.25,
                    residentialDelivery: 25.00,
                    insurance: 25.00,
                    total: 850.25
                },
                trackingNumber: 'FDX1234567890'
            },
            {
                id: 'SHP-002',
                date: '2024-03-12',
                carrier: 'UPS',
                service: 'Ground',
                cost: 1600.50,
                from: {
                    name: 'Mike Johnson',
                    company: 'SolushipX Inc.',
                    address: '789 Industrial Park',
                    city: 'Chicago',
                    state: 'IL',
                    postalCode: '60601',
                    country: 'US'
                },
                to: {
                    name: 'Sarah Wilson',
                    company: 'Global Industries',
                    address: '321 Business Center',
                    city: 'Miami',
                    state: 'FL',
                    postalCode: '33101',
                    country: 'US'
                },
                packages: [
                    {
                        weight: '15.2 lbs',
                        dimensions: '24" x 18" x 12"',
                        declaredValue: 1500,
                        description: 'Industrial Parts'
                    },
                    {
                        weight: '8.5 lbs',
                        dimensions: '16" x 12" x 8"',
                        declaredValue: 800,
                        description: 'Spare Components'
                    }
                ],
                charges: {
                    freight: 1400.00,
                    fuel: 150.50,
                    liftgate: 50.00,
                    total: 1600.50
                },
                trackingNumber: 'UPS9876543210'
            }
        ]
    },
    {
        id: 'INV-2024-002',
        date: '2024-03-10',
        amount: 1875.50,
        status: 'Paid',
        dueDate: '2024-04-10',
        shipments: [
            {
                id: 'SHP-003',
                date: '2024-03-05',
                carrier: 'DHL',
                service: 'International',
                cost: 1875.50,
                from: 'New York, NY',
                to: 'London, UK'
            }
        ]
    },
    // Add 8 more mock invoices with similar structure
    {
        id: 'INV-2024-003',
        date: '2024-03-08',
        amount: 950.25,
        status: 'Unpaid',
        dueDate: '2024-04-08',
        shipments: [
            {
                id: 'SHP-004',
                date: '2024-03-03',
                carrier: 'USPS',
                service: 'Priority',
                cost: 950.25,
                from: 'Boston, MA',
                to: 'Seattle, WA'
            }
        ]
    },
    {
        id: 'INV-2024-004',
        date: '2024-03-05',
        amount: 3200.00,
        status: 'Paid',
        dueDate: '2024-04-05',
        shipments: [
            {
                id: 'SHP-005',
                date: '2024-02-28',
                carrier: 'FedEx',
                service: 'Overnight',
                cost: 1600.00,
                from: 'Dallas, TX',
                to: 'San Francisco, CA'
            },
            {
                id: 'SHP-006',
                date: '2024-03-01',
                carrier: 'UPS',
                service: '2-Day',
                cost: 1600.00,
                from: 'Houston, TX',
                to: 'Denver, CO'
            }
        ]
    },
    {
        id: 'INV-2024-005',
        date: '2024-03-03',
        amount: 1250.75,
        status: 'Paid',
        dueDate: '2024-04-03',
        shipments: [
            {
                id: 'SHP-007',
                date: '2024-02-25',
                carrier: 'DHL',
                service: 'Express',
                cost: 1250.75,
                from: 'Miami, FL',
                to: 'Toronto, CA'
            }
        ]
    }
];

// Add more mock invoices
const additionalMockInvoices = Array.from({ length: 20 }, (_, index) => {
    const id = index + 6; // Start from 6 since we already have 5 invoices
    const randomAmount = (Math.random() * 5000 + 500).toFixed(2);
    const randomStatus = ['Paid', 'Unpaid', 'Processing'][Math.floor(Math.random() * 3)];
    const date = new Date(2024, 2, Math.floor(Math.random() * 30) + 1); // Random date in March 2024
    const dueDate = new Date(date);
    dueDate.setDate(date.getDate() + 30); // Due date is 30 days after invoice date

    return {
        id: `INV-2024-${id.toString().padStart(3, '0')}`,
        date: date.toISOString().split('T')[0],
        amount: parseFloat(randomAmount),
        status: randomStatus,
        dueDate: dueDate.toISOString().split('T')[0],
        shipments: [
            {
                id: `SHP-${(id * 2).toString().padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                carrier: ['FedEx', 'UPS', 'DHL', 'USPS'][Math.floor(Math.random() * 4)],
                service: ['Express', 'Ground', 'Priority', '2-Day', 'Overnight'][Math.floor(Math.random() * 5)],
                cost: parseFloat(randomAmount),
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
                    name: ['Sarah Wilson', 'Mike Brown', 'Emily Davis', 'David Lee'][Math.floor(Math.random() * 4)],
                    company: ['Tech Corp', 'Global Industries', 'Acme Inc.', 'Enterprise LLC'][Math.floor(Math.random() * 4)],
                    address: ['789 Market St', '456 Park Ave', '321 Main St', '654 Business Blvd'][Math.floor(Math.random() * 4)],
                    city: ['San Francisco', 'Chicago', 'Boston', 'Miami', 'Seattle'][Math.floor(Math.random() * 5)],
                    state: ['CA', 'IL', 'MA', 'FL', 'WA'][Math.floor(Math.random() * 5)],
                    postalCode: ['94105', '60601', '02110', '33101', '98101'][Math.floor(Math.random() * 5)],
                    country: 'US'
                },
                packages: [
                    {
                        weight: `${(Math.random() * 50 + 1).toFixed(1)} lbs`,
                        dimensions: `${Math.floor(Math.random() * 24 + 6)}" x ${Math.floor(Math.random() * 18 + 6)}" x ${Math.floor(Math.random() * 12 + 4)}"`,
                        declaredValue: Math.floor(Math.random() * 2000 + 100),
                        description: ['Electronics', 'Office Supplies', 'Medical Equipment', 'Industrial Parts'][Math.floor(Math.random() * 4)]
                    }
                ],
                charges: {
                    freight: parseFloat((randomAmount * 0.8).toFixed(2)),
                    fuel: parseFloat((randomAmount * 0.1).toFixed(2)),
                    residentialDelivery: Math.random() > 0.5 ? parseFloat((randomAmount * 0.05).toFixed(2)) : null,
                    insurance: Math.random() > 0.5 ? parseFloat((randomAmount * 0.03).toFixed(2)) : null,
                    liftgate: Math.random() > 0.7 ? parseFloat((randomAmount * 0.02).toFixed(2)) : null,
                    total: parseFloat(randomAmount)
                },
                trackingNumber: `${['FDX', 'UPS', 'DHL', 'USPS'][Math.floor(Math.random() * 4)]}${Math.floor(Math.random() * 1000000000)}`
            }
        ]
    };
});

const mockInvoices = [...originalMockInvoices, ...additionalMockInvoices];

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
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Invoices
                </Typography>
                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        startIcon={<FilterIcon />}
                        onClick={handleFilterClick}
                    >
                        Filter
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        sx={{
                            bgcolor: '#000',
                            '&:hover': { bgcolor: '#333' }
                        }}
                    >
                        Export
                    </Button>
                </Stack>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    border: '1px solid #eee',
                    borderRadius: 2,
                    mb: 3
                }}
            >
                <TextField
                    fullWidth
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                        endAdornment: searchQuery && (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={handleClearSearch}>
                                    <ClearIcon />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            </Paper>

            <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                    border: '1px solid #eee',
                    borderRadius: 2
                }}
            >
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Invoice #</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Due Date</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredInvoices
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((invoice) => (
                                <TableRow
                                    key={invoice.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => handleInvoiceClick(invoice)}
                                >
                                    <TableCell>{invoice.id}</TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={invoice.status}
                                            size="small"
                                            sx={{
                                                bgcolor: getStatusColor(invoice.status).bgcolor,
                                                color: getStatusColor(invoice.status).color
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>{invoice.dueDate}</TableCell>
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