import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    Divider,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';

const InvoiceForm = ({ invoiceId, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [formData, setFormData] = useState({
        invoiceNumber: '',
        companyId: '',
        companyName: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        notes: '',
        terms: '',
        paymentInstructions: '',
        billingAddress: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: '',
        },
        shippingAddress: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: '',
        },
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
            setError('Error fetching companies: ' + err.message);
        }
    };

    const fetchInvoice = async () => {
        try {
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceDoc = await getDoc(invoiceRef);
            if (invoiceDoc.exists()) {
                setFormData({
                    id: invoiceDoc.id,
                    ...invoiceDoc.data()
                });
            }
        } catch (err) {
            setError('Error fetching invoice: ' + err.message);
        }
    };

    const handleCompanyChange = (event) => {
        const companyId = event.target.value;
        const company = companies.find(c => c.id === companyId);
        if (company) {
            setFormData(prev => ({
                ...prev,
                companyId,
                companyName: company.name,
                billingAddress: company.billingAddress || prev.billingAddress,
                shippingAddress: company.shippingAddress || prev.shippingAddress,
            }));
        }
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    description: '',
                    quantity: 1,
                    unitPrice: 0,
                    amount: 0,
                }
            ]
        }));
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index] = {
                ...newItems[index],
                [field]: value
            };

            // Calculate amount
            if (field === 'quantity' || field === 'unitPrice') {
                newItems[index].amount = newItems[index].quantity * newItems[index].unitPrice;
            }

            // Calculate totals
            const subtotal = newItems.reduce((sum, item) => sum + item.amount, 0);
            const tax = subtotal * 0.1; // 10% tax rate
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const invoiceData = {
                ...formData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            if (invoiceId) {
                // Update existing invoice
                await updateDoc(doc(db, 'invoices', invoiceId), invoiceData);
            } else {
                // Create new invoice
                await addDoc(collection(db, 'invoices'), invoiceData);
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError('Error saving invoice: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <Box className="invoice-form-container">
            <Paper className="invoice-form-paper">
                <Typography variant="h5" gutterBottom>
                    {invoiceId ? 'Edit Invoice' : 'Create New Invoice'}
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* Basic Information */}
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Company</InputLabel>
                                <Select
                                    value={formData.companyId}
                                    onChange={handleCompanyChange}
                                    label="Company"
                                    required
                                >
                                    {companies.map(company => (
                                        <MenuItem key={company.id} value={company.id}>
                                            {company.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Invoice Number"
                                value={formData.invoiceNumber}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    invoiceNumber: e.target.value
                                }))}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Status"
                                value={formData.status}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    status: e.target.value
                                }))}
                                required
                            />
                        </Grid>

                        {/* Dates */}
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Issue Date"
                                value={formData.issueDate}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    issueDate: e.target.value
                                }))}
                                required
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Due Date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    dueDate: e.target.value
                                }))}
                                required
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        {/* Items Table */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Items
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Description</TableCell>
                                            <TableCell>Quantity</TableCell>
                                            <TableCell>Unit Price</TableCell>
                                            <TableCell>Amount</TableCell>
                                            <TableCell>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {formData.items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    <TextField
                                                        fullWidth
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                        required
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                                        required
                                                        inputProps={{ min: 1 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        type="number"
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleItemChange(index, 'unitPrice', Number(e.target.value))}
                                                        required
                                                        inputProps={{ min: 0, step: 0.01 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    ${item.amount.toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                    <IconButton
                                                        color="error"
                                                        onClick={() => handleRemoveItem(index)}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Button
                                startIcon={<AddIcon />}
                                onClick={handleAddItem}
                                sx={{ mt: 2 }}
                            >
                                Add Item
                            </Button>
                        </Grid>

                        {/* Totals */}
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Grid container spacing={2} justifyContent="flex-end">
                                <Grid item xs={12} md={3}>
                                    <Typography variant="subtitle1">
                                        Subtotal: ${formData.subtotal.toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Typography variant="subtitle1">
                                        Tax (10%): ${formData.tax.toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Typography variant="h6">
                                        Total: ${formData.total.toFixed(2)}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Grid>

                        {/* Additional Information */}
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Notes"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    notes: e.target.value
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label="Terms & Conditions"
                                value={formData.terms}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    terms: e.target.value
                                }))}
                            />
                        </Grid>

                        {/* Payment Instructions */}
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={2}
                                label="Payment Instructions"
                                value={formData.paymentInstructions}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    paymentInstructions: e.target.value
                                }))}
                            />
                        </Grid>

                        {/* Form Actions */}
                        <Grid item xs={12}>
                            <Box className="form-actions">
                                <Button
                                    variant="outlined"
                                    startIcon={<CancelIcon />}
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Invoice'}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </form>
            </Paper>
        </Box>
    );
};

export default InvoiceForm; 