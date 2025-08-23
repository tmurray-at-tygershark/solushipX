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
    Container,
    Chip,
    Stack,
    Avatar
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    Save as SaveIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase';
import { useSnackbar } from 'notistack';

const InvoiceForm = ({ invoiceId, onClose, onSuccess }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [previewSrc, setPreviewSrc] = useState('');
    const [companies, setCompanies] = useState([]);
    const [customers, setCustomers] = useState([]);
    // Removed tab navigation per requirements

    const [formData, setFormData] = useState({
        invoiceNumber: '',
        carrierInvoiceNumber: '',
        companyId: '',
        companyName: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paymentStatus: 'outstanding',
        currency: 'CAD',
        total: 0,
        paymentTerms: 'Net 30',
        paymentInstructions: '',
        fileUrl: '',
        customerId: '',
        customerName: '',
        shipmentIds: [],
        payments: []
    });

    const [shipmentInput, setShipmentInput] = useState('');
    const [paymentType, setPaymentType] = useState('cheque');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentCurrency, setPaymentCurrency] = useState('CAD');

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

    const fetchCustomers = async (companyId) => {
        try {
            if (!companyId) { setCustomers([]); return; }
            const customersRef = collection(db, 'customers');
            const q = query(customersRef, where('companyID', '==', companyId));
            const qs = await getDocs(q);
            const data = qs.docs.map(d => ({ id: d.id, ...d.data() }));
            setCustomers(data);
        } catch (err) {
            console.error('Error fetching customers:', err);
            setCustomers([]);
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
            fetchCustomers(value.companyID || value.companyId || value.id);
            // Clear selected customer when company changes
            setFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
        }
    };

    const handleCustomerChange = (event, value) => {
        if (value) {
            setFormData(prev => ({
                ...prev,
                customerId: value.customerID || value.id,
                customerName: value.name || value.customerName || value.companyName || ''
            }));
        }
    };

    // Helper: add shipment IDs from text (handles splitting and de-duping)
    const addShipmentIds = (raw) => {
        const parts = (Array.isArray(raw) ? raw.join(' ') : String(raw || ''))
            .split(/[\s,;]+/)
            .map(s => s.trim())
            .filter(Boolean);
        if (parts.length === 0) return;
        setFormData(prev => {
            const existing = new Set(prev.shipmentIds || []);
            parts.forEach(p => existing.add(p));
            return { ...prev, shipmentIds: Array.from(existing) };
        });
    };

    const removeShipmentId = (id) => {
        setFormData(prev => ({
            ...prev,
            shipmentIds: (prev.shipmentIds || []).filter(s => s !== id)
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
    const selectedCustomer = customers.find(c => (c.customerID || c.id) === formData.customerId);

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

                    {/* Tab Navigation removed per requirements */}

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleSave}
                            disabled={loading || !formData.companyId || !formData.customerId}
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
                        {/* Invoice Details (moved to top; only requested fields) */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Invoice Details
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
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
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Carrier Invoice Number"
                                        value={formData.carrierInvoiceNumber}
                                        onChange={(e) => setFormData(prev => ({ ...prev, carrierInvoiceNumber: e.target.value }))}
                                        variant="outlined"
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Date Sent"
                                        type="date"
                                        value={formData.issueDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                                        variant="outlined"
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
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
                                <Grid item xs={12} sm={6}>
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
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Payment Status</InputLabel>
                                        <Select
                                            value={formData.paymentStatus}
                                            onChange={(e) => setFormData(prev => ({ ...prev, paymentStatus: e.target.value }))}
                                            label="Payment Status"
                                            sx={{ fontSize: '14px' }}
                                        >
                                            <MenuItem value="outstanding">Outstanding</MenuItem>
                                            <MenuItem value="paid">Paid</MenuItem>
                                            <MenuItem value="partial">Partially Paid</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Total"
                                        type="number"
                                        value={formData.total}
                                        onChange={(e) => setFormData(prev => ({ ...prev, total: Number(e.target.value || 0) }))}
                                        variant="outlined"
                                        size="small"
                                        inputProps={{ min: 0, step: 0.01 }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Currency</InputLabel>
                                        <Select
                                            value={formData.currency}
                                            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                            label="Currency"
                                            sx={{ fontSize: '14px' }}
                                        >
                                            <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
                                            <MenuItem value="USD">USD - US Dollar</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </Box>

                        {/* Company Selection */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Company
                            </Typography>
                            <Autocomplete
                                options={companies}
                                getOptionLabel={(option) => option.name || option.companyName || ''}
                                value={selectedCompany || null}
                                onChange={handleCompanyChange}
                                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                renderOption={(props, option) => (
                                    <li {...props}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar sx={{ width: 20, height: 20, fontSize: '11px' }} src={option.logos?.light || option.logoUrl || ''}>
                                                {(option.name || option.companyName || 'C').substring(0, 1).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px' }}>{option.name || option.companyName}</Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{option.companyID || option.companyId}</Typography>
                                            </Box>
                                        </Box>
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Select company..."
                                        variant="outlined"
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                    />
                                )}
                                sx={{ mb: 2 }}
                            />
                        </Box>

                        {/* Customer Selection (Master Customer) */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Customer
                            </Typography>
                            <Autocomplete
                                options={customers}
                                getOptionLabel={(option) => option.name || option.customerName || option.companyName || ''}
                                value={selectedCustomer || null}
                                onChange={handleCustomerChange}
                                disabled={!selectedCompany}
                                isOptionEqualToValue={(opt, val) => (opt.customerID || opt.id) === (val.customerID || val.id)}
                                renderOption={(props, option) => (
                                    <li {...props}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar sx={{ width: 20, height: 20, fontSize: '11px' }} src={option.logo || ''}>
                                                {(option.name || option.customerName || 'C').substring(0, 1).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px' }}>{option.name || option.customerName || option.companyName}</Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{option.customerID || option.id}</Typography>
                                            </Box>
                                        </Box>
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Select customer..."
                                        variant="outlined"
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                    />
                                )}
                                sx={{ mb: 2 }}
                            />
                        </Box>

                        {/* Invoice File Upload */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>Invoice File</Typography>
                            <Button variant="outlined" size="small" component="label" sx={{ mr: 2, fontSize: '12px' }}>
                                Upload PDF
                                <input
                                    hidden
                                    accept="application/pdf"
                                    type="file"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            // Show local preview immediately while upload happens
                                            const localUrl = URL.createObjectURL(file);
                                            setPreviewSrc(localUrl);
                                            const app = getApp();
                                            const customStorage = getStorage(app, 'gs://solushipx.firebasestorage.app');
                                            const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                                            const storageRef = ref(customStorage, `manual-invoices/${safeName}`);
                                            const task = uploadBytesResumable(storageRef, file, { contentType: file.type || 'application/pdf' });
                                            await new Promise((resolve, reject) => {
                                                task.on('state_changed', () => { }, (err) => reject(err), () => resolve(null));
                                            });
                                            const url = await getDownloadURL(task.snapshot.ref);
                                            setFormData(prev => ({ ...prev, fileUrl: url }));
                                            setPreviewSrc(url);
                                            enqueueSnackbar('Invoice PDF uploaded', { variant: 'success' });
                                        } catch (err) {
                                            enqueueSnackbar('Failed to upload PDF', { variant: 'error' });
                                        }
                                    }}
                                />
                            </Button>
                            {formData.fileUrl && (
                                <Button href={formData.fileUrl} target="_blank" rel="noopener" size="small" sx={{ fontSize: '12px' }}>View PDF</Button>
                            )}
                            <Typography variant="body2" sx={{ color: '#6b7280', mt: 1, fontSize: '12px' }}>
                                Upload the exact PDF sent to the customer.
                            </Typography>
                        </Box>

                        {/* Shipment IDs (chip input) */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Shipment IDs
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <TextField
                                    fullWidth
                                    placeholder="Type a shipment ID and press Enter, or paste multiple"
                                    value={shipmentInput}
                                    onChange={(e) => setShipmentInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (shipmentInput && shipmentInput.trim()) {
                                                addShipmentIds(shipmentInput);
                                                setShipmentInput('');
                                            }
                                        }
                                    }}
                                    onPaste={(e) => {
                                        const text = e.clipboardData?.getData('text');
                                        if (text) {
                                            e.preventDefault();
                                            addShipmentIds(text);
                                            setShipmentInput('');
                                        }
                                    }}
                                    variant="outlined"
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                />
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                    {(formData.shipmentIds || []).map((sid) => (
                                        <Chip key={sid} label={sid} onDelete={() => removeShipmentId(sid)} size="small" sx={{ fontSize: '11px' }} />
                                    ))}
                                </Stack>
                            </Box>
                        </Box>

                        {/* Payments (chips) */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Payments
                            </Typography>
                            <Grid container spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                <Grid item xs={5}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Type</InputLabel>
                                        <Select
                                            value={paymentType}
                                            onChange={(e) => setPaymentType(e.target.value)}
                                            label="Type"
                                            sx={{ fontSize: '14px' }}
                                        >
                                            <MenuItem value="cheque">Cheque</MenuItem>
                                            <MenuItem value="etransfer">E-Transfer</MenuItem>
                                            <MenuItem value="wire">Wire</MenuItem>
                                            <MenuItem value="cash">Cash</MenuItem>
                                            <MenuItem value="credit_card">Credit Card</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={5}>
                                    <TextField
                                        fullWidth
                                        label="Amount"
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const amt = Number(paymentAmount);
                                                if (!isNaN(amt) && amt > 0) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        payments: [...(prev.payments || []), { type: paymentType, amount: amt, currency: paymentCurrency }]
                                                    }));
                                                    setPaymentAmount('');
                                                }
                                            }
                                        }}
                                        variant="outlined"
                                        size="small"
                                        inputProps={{ min: 0, step: 0.01 }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '14px' } }}
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Curr</InputLabel>
                                        <Select
                                            value={paymentCurrency}
                                            onChange={(e) => setPaymentCurrency(e.target.value)}
                                            label="Curr"
                                            sx={{ fontSize: '14px' }}
                                        >
                                            <MenuItem value="CAD">CAD</MenuItem>
                                            <MenuItem value="USD">USD</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
                                {(formData.payments || []).map((pmt, idx) => (
                                    <Chip
                                        key={`${pmt.type}-${idx}`}
                                        label={`${pmt.type} ${pmt.currency || 'CAD'}$${Number(pmt.amount || 0).toFixed(2)}`}
                                        onDelete={() => setFormData(prev => ({ ...prev, payments: prev.payments.filter((_, i) => i !== idx) }))}
                                        size="small"
                                        sx={{ fontSize: '11px' }}
                                    />
                                ))}
                            </Stack>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Paid: {(formData.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formData.currency}
                                {' '}• Balance: {(Number(formData.total || 0) - (formData.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formData.currency}
                            </Typography>
                        </Box>
                        {/* Notes removed per requirements */}
                    </Container>
                </Box>

                {/* Right Panel - PDF Preview */}
                <Box sx={{
                    width: '50%',
                    bgcolor: 'white',
                    borderLeft: '1px solid #e5e7eb',
                    overflow: 'auto',
                    p: 3
                }}>
                    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                        <Paper elevation={2} sx={{ p: 0, border: '1px solid #e5e7eb', height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(previewSrc || formData.fileUrl) ? (
                                <iframe title="invoice-pdf-preview" src={previewSrc || formData.fileUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
                            ) : (
                                <Typography sx={{ color: '#6b7280', fontSize: '12px' }}>Preview pending (upload PDF to preview)</Typography>
                            )}
                        </Paper>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default InvoiceForm; 