import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Autocomplete,
    Divider,
    Card,
    CardContent,
    AppBar,
    Toolbar,
    Container
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    Save as SaveIcon,
    Send as SendIcon,
    Visibility as PreviewIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';

const InvoiceForm = ({ invoiceId, onClose, onSuccess }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [activeTab, setActiveTab] = useState('Invoice PDF');

    const [formData, setFormData] = useState({
        invoiceNumber: `INV-${Date.now()}`,
        companyId: '',
        companyName: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        currency: 'CAD',
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        notes: '',
        paymentTerms: 'Net 30',
        paymentInstructions: '',
    });

    useEffect(() => {
        fetchCompanies();
        if (invoiceId) {
            fetchInvoice();
        }
    }, [invoiceId]);

    const fetchCompanies = async () => {
        try {
            const companiesRef = collection(db, 'companies');
            const querySnapshot = await getDocs(companiesRef);
            const companiesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCompanies(companiesData);
        } catch (err) {
            console.error('Error fetching companies:', err);
        }
    };

    const fetchInvoice = async () => {
        try {
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceDoc = await getDoc(invoiceRef);
            if (invoiceDoc.exists()) {
                const data = invoiceDoc.data();
                setFormData({
                    ...data,
                    issueDate: data.issueDate?.toDate ? data.issueDate.toDate().toISOString().split('T')[0] : data.issueDate,
                    dueDate: data.dueDate?.toDate ? data.dueDate.toDate().toISOString().split('T')[0] : data.dueDate,
                });
            }
        } catch (err) {
            console.error('Error fetching invoice:', err);
        }
    };

    const handleCompanyChange = (event, value) => {
        if (value) {
            setFormData(prev => ({
                ...prev,
                companyId: value.id,
                companyName: value.name || value.companyName
            }));
        }
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    id: Date.now(),
                    description: '',
                    quantity: 1,
                    unitPrice: 0,
                    amount: 0
                }
            ]
        }));
    };

    const removeItem = (itemId) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId)
        }));
        calculateTotals();
    };

    const updateItem = (itemId, field, value) => {
        setFormData(prev => {
            const newItems = prev.items.map(item => {
                if (item.id === itemId) {
                    const updatedItem = { ...item, [field]: value };
                    // Calculate amount if quantity or unitPrice changed
                    if (field === 'quantity' || field === 'unitPrice') {
                        updatedItem.amount = Number(updatedItem.quantity) * Number(updatedItem.unitPrice);
                    }
                    return updatedItem;
                }
                return item;
            });

            // Calculate totals
            const subtotal = newItems.reduce((sum, item) => sum + Number(item.amount), 0);
            const tax = subtotal * 0.13; // 13% tax
            const total = subtotal + tax;

            return {
                ...prev,
                items: newItems,
                subtotal,
                tax,
                total
            };
        });
    };

    const calculateTotals = () => {
        const subtotal = formData.items.reduce((sum, item) => sum + Number(item.amount), 0);
        const tax = subtotal * 0.13; // 13% tax
        const total = subtotal + tax;

        setFormData(prev => ({
            ...prev,
            subtotal,
            tax,
            total
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const invoiceData = {
                ...formData,
                issueDate: new Date(formData.issueDate),
                dueDate: new Date(formData.dueDate),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (invoiceId) {
                await updateDoc(doc(db, 'invoices', invoiceId), invoiceData);
                enqueueSnackbar('Invoice updated successfully', { variant: 'success' });
            } else {
                await addDoc(collection(db, 'invoices'), invoiceData);
                enqueueSnackbar('Invoice created successfully', { variant: 'success' });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving invoice:', error);
            enqueueSnackbar('Error saving invoice', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: formData.currency
        }).format(amount);
    };

    const selectedCompany = companies.find(c => c.id === formData.companyId);

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc' }}>
            {/* Top Navigation Bar */}
            <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e5e7eb' }}>
                <Toolbar sx={{ px: 3 }}>
                    <IconButton
                        edge="start"
                        onClick={onClose}
                        sx={{ mr: 2, color: '#6b7280' }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ color: '#111827', fontWeight: 600, flexGrow: 1, fontSize: '18px' }}>
                        {invoiceId ? 'Edit Invoice' : 'Create Invoice'}
                    </Typography>

                    {/* Tab Navigation */}
                    <Box sx={{ display: 'flex', gap: 1, mr: 3 }}>
                        {['Invoice PDF', 'Email', 'Payment page'].map((tab) => (
                            <Button
                                key={tab}
                                variant={activeTab === tab ? 'contained' : 'text'}
                                size="small"
                                onClick={() => setActiveTab(tab)}
                                sx={{
                                    fontSize: '12px',
                                    textTransform: 'none',
                                    bgcolor: activeTab === tab ? '#3b82f6' : 'transparent',
                                    color: activeTab === tab ? 'white' : '#6b7280',
                                    '&:hover': {
                                        bgcolor: activeTab === tab ? '#2563eb' : '#f3f4f6'
                                    }
                                }}
                            >
                                {tab}
                            </Button>
                        ))}
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PreviewIcon />}
                            sx={{ fontSize: '12px', textTransform: 'none' }}
                        >
                            Hide preview
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleSave}
                            disabled={loading || !formData.companyId || formData.items.length === 0}
                            startIcon={<SaveIcon />}
                            sx={{ fontSize: '12px', textTransform: 'none' }}
                        >
                            {loading ? 'Saving...' : 'Save invoice'}
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Main Content Area */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left Panel - Form */}
                <Box sx={{ width: '50%', overflow: 'auto', p: 3 }}>
                    <Container maxWidth="sm">
                        {/* Customer Section */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Customer
                            </Typography>
                            <Autocomplete
                                options={companies}
                                getOptionLabel={(option) => option.name || option.companyName || ''}
                                value={selectedCompany || null}
                                onChange={handleCompanyChange}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Find or add a customer..."
                                        variant="outlined"
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                )}
                                sx={{ mb: 2 }}
                            />
                        </Box>

                        {/* Currency Section */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Currency
                            </Typography>
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <Select
                                    value={formData.currency}
                                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                    sx={{ fontSize: '14px' }}
                                >
                                    <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
                                    <MenuItem value="USD">USD - US Dollar</MenuItem>
                                </Select>
                            </FormControl>
                            <Typography variant="body2" sx={{ color: '#6b7280', mt: 1, fontSize: '12px' }}>
                                Selecting a new currency will clear all items from the invoice.
                            </Typography>
                        </Box>

                        {/* Items Section */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Items
                            </Typography>

                            {formData.items.map((item, index) => (
                                <Card key={item.id} sx={{ mb: 2, border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    placeholder="Description"
                                                    value={item.description}
                                                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                    variant="outlined"
                                                    size="small"
                                                    sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                                />
                                            </Grid>
                                            <Grid item xs={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Quantity"
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                                    variant="outlined"
                                                    size="small"
                                                    inputProps={{ min: 1 }}
                                                    sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                                />
                                            </Grid>
                                            <Grid item xs={4}>
                                                <TextField
                                                    fullWidth
                                                    label="Unit Price"
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                                                    variant="outlined"
                                                    size="small"
                                                    inputProps={{ min: 0, step: 0.01 }}
                                                    sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                                />
                                            </Grid>
                                            <Grid item xs={4}>
                                                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '14px' }}>
                                                    {formatCurrency(item.amount)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={1}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => removeItem(item.id)}
                                                    sx={{ color: '#ef4444' }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            ))}

                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={addItem}
                                sx={{
                                    fontSize: '14px',
                                    textTransform: 'none',
                                    borderStyle: 'dashed',
                                    py: 1.5,
                                    width: '100%'
                                }}
                            >
                                Add item
                            </Button>
                        </Box>

                        {/* Invoice Details */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Invoice Details
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Invoice Number"
                                        value={formData.invoiceNumber}
                                        onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                                        variant="outlined"
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Issue Date"
                                        type="date"
                                        value={formData.issueDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                                        variant="outlined"
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Due Date"
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                        variant="outlined"
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Payment Terms</InputLabel>
                                        <Select
                                            value={formData.paymentTerms}
                                            onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                                            label="Payment Terms"
                                            sx={{ fontSize: '14px' }}
                                        >
                                            <MenuItem value="Due on Receipt">Due on Receipt</MenuItem>
                                            <MenuItem value="Net 15">Net 15</MenuItem>
                                            <MenuItem value="Net 30">Net 30</MenuItem>
                                            <MenuItem value="Net 45">Net 45</MenuItem>
                                            <MenuItem value="Net 60">Net 60</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </Box>

                        {/* Notes */}
                        <Box sx={{ mb: 4 }}>
                            <TextField
                                fullWidth
                                label="Notes"
                                multiline
                                rows={3}
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Additional notes or instructions..."
                                variant="outlined"
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                            />
                        </Box>
                    </Container>
                </Box>

                {/* Right Panel - Live Preview */}
                <Box sx={{
                    width: '50%',
                    bgcolor: 'white',
                    borderLeft: '1px solid #e5e7eb',
                    overflow: 'auto',
                    p: 3
                }}>
                    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
                        {/* Invoice Preview */}
                        <Paper elevation={2} sx={{ p: 4, border: '1px solid #e5e7eb' }}>
                            {/* Header */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
                                        Invoice
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                        Invoice number: {formData.invoiceNumber}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                        Date of issue: {new Date(formData.issueDate).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                        Due date: {new Date(formData.dueDate).toLocaleDateString()}
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
                                        SolushipX
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                        Logistics Platform
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Bill To */}
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                    Bill to
                                </Typography>
                                {selectedCompany ? (
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedCompany.name || selectedCompany.companyName}
                                        </Typography>
                                        {selectedCompany.email && (
                                            <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                                {selectedCompany.email}
                                            </Typography>
                                        )}
                                        {selectedCompany.address && (
                                            <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                                {selectedCompany.address}
                                            </Typography>
                                        )}
                                        {(selectedCompany.city || selectedCompany.province) && (
                                            <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                                {selectedCompany.city}, {selectedCompany.province} {selectedCompany.postalCode}
                                            </Typography>
                                        )}
                                    </Box>
                                ) : (
                                    <Typography variant="body2" sx={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                        Please select a customer
                                    </Typography>
                                )}
                            </Box>

                            {/* Invoice Date */}
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                                {formData.currency}${formData.total.toFixed(2)} due {new Date(formData.dueDate).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </Typography>

                            {/* Items Table */}
                            {formData.items.length > 0 ? (
                                <TableContainer sx={{ mb: 3 }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>
                                                    Description
                                                </TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>
                                                    Qty
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>
                                                    Unit price
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>
                                                    Amount
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {formData.items.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        {item.description || 'Description'}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        {item.quantity}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        {formatCurrency(item.unitPrice)}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        {formatCurrency(item.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>
                                    <Typography variant="body2">
                                        Add items to see them here
                                    </Typography>
                                </Box>
                            )}

                            {/* Totals */}
                            <Box sx={{ ml: 'auto', width: 250 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2">Subtotal</Typography>
                                    <Typography variant="body2">{formatCurrency(formData.subtotal)}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2">Tax (13%)</Typography>
                                    <Typography variant="body2">{formatCurrency(formData.tax)}</Typography>
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        Total
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {formatCurrency(formData.total)}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Notes */}
                            {formData.notes && (
                                <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e5e7eb' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                        Notes
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                        {formData.notes}
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default InvoiceForm; 