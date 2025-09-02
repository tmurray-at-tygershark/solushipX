import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Typography,
    Box,
    Divider,
    Chip
} from '@mui/material';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import { formatCurrency } from '../../../utils/currencyUtils';

/**
 * ✅ STREAMLINED MARK AS PAID DIALOG
 * Combines payment status update + payment details entry in one popup
 * Reduces 5-step workflow to 2 clicks: Action Button → Mark As Paid → Save
 */
const MarkAsPaidDialog = ({
    open,
    onClose,
    invoice,
    onSuccess
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);

    // Payment form state
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState('cheque');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentCurrency, setPaymentCurrency] = useState('CAD');

    // Initialize form when dialog opens
    useEffect(() => {
        if (open && invoice) {
            // Pre-populate payment amount with invoice total (formatted to 2 decimal places)
            const totalAmount = invoice.total || 0;
            setPaymentAmount(totalAmount.toFixed(2));
            setPaymentCurrency(invoice.currency || 'CAD');
            // Generate default reference
            setPaymentReference(`Payment for ${invoice.invoiceNumber || 'Invoice'}`);
        }
    }, [open, invoice]);

    const handleSave = async () => {
        if (!invoice) return;

        // Validation
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            enqueueSnackbar('Please enter a valid payment amount', { variant: 'error' });
            return;
        }

        if (!paymentReference.trim()) {
            enqueueSnackbar('Please enter a payment reference', { variant: 'error' });
            return;
        }

        setLoading(true);
        try {
            // Prepare payment details for status tracking
            const paymentDetails = {
                amount: amount,
                currency: paymentCurrency,
                method: paymentType,
                reference: paymentReference.trim(),
                recordedBy: 'admin',
                recordedAt: new Date()
            };

            // Prepare payment record for payments array
            const paymentRecord = {
                type: paymentType,
                amount: amount,
                currency: paymentCurrency,
                reference: paymentReference.trim(),
                recordedBy: 'admin',
                recordedAt: new Date()
            };

            // Update invoice status and add payment to payments array
            const invoiceRef = doc(db, 'invoices', invoice.id);
            await updateDoc(invoiceRef, {
                status: 'paid',
                paymentStatus: 'paid',
                updatedAt: new Date(),
                paymentDetails: paymentDetails,
                statusNotes: 'Payment recorded via Mark As Paid dialog',
                // Add payment to the payments array
                payments: arrayUnion(paymentRecord)
            });

            enqueueSnackbar(
                `Invoice ${invoice.invoiceNumber} marked as paid with ${formatCurrency(amount, true, paymentCurrency)} payment`,
                { variant: 'success' }
            );

            // Trigger success callback to refresh data
            if (onSuccess) {
                onSuccess();
            }

            handleClose();

        } catch (error) {
            console.error('Error marking invoice as paid:', error);
            enqueueSnackbar('Failed to mark invoice as paid: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Reset form
        setPaymentAmount('');
        setPaymentType('cheque');
        setPaymentReference('');
        setPaymentCurrency('CAD');
        onClose();
    };

    if (!invoice) return null;

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                }
            }}
        >
            <DialogTitle sx={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#111827',
                borderBottom: '1px solid #e5e7eb',
                p: 3
            }}>
                Mark Invoice as Paid
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {/* Invoice Summary */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                        Invoice Summary
                    </Typography>
                    <Box sx={{
                        bgcolor: '#f8fafc',
                        p: 2,
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                    }}>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>Invoice Number</Typography>
                                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                                    {invoice.invoiceNumber}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>Total Amount</Typography>
                                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                                    {formatCurrency(invoice.total, true, invoice.currency)}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>Customer</Typography>
                                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                                    {invoice.customerName || 'N/A'}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>Current Status</Typography>
                                <Chip
                                    label={invoice.paymentStatus || invoice.status || 'Outstanding'}
                                    size="small"
                                    sx={{
                                        fontSize: '11px',
                                        backgroundColor: '#fef3c7',
                                        color: '#92400e',
                                        textTransform: 'capitalize'
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Payment Details Form */}
                <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                    Payment Details
                </Typography>

                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Payment Amount"
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            onBlur={(e) => {
                                // Format to 2 decimal places on blur
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                    setPaymentAmount(value.toFixed(2));
                                }
                            }}
                            variant="outlined"
                            size="small"
                            required
                            inputProps={{
                                min: 0.01,
                                step: 0.01,
                                style: { fontSize: '14px' }
                            }}
                            sx={{
                                '& .MuiInputLabel-root': { fontSize: '14px' },
                                '& .MuiInputBase-input': { fontSize: '14px' }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '14px' }}>Currency</InputLabel>
                            <Select
                                value={paymentCurrency}
                                onChange={(e) => setPaymentCurrency(e.target.value)}
                                label="Currency"
                                sx={{ fontSize: '14px' }}
                            >
                                <MenuItem value="CAD" sx={{ fontSize: '14px' }}>CAD</MenuItem>
                                <MenuItem value="USD" sx={{ fontSize: '14px' }}>USD</MenuItem>
                                <MenuItem value="EUR" sx={{ fontSize: '14px' }}>EUR</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '14px' }}>Payment Method</InputLabel>
                            <Select
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value)}
                                label="Payment Method"
                                sx={{ fontSize: '14px' }}
                            >
                                <MenuItem value="cheque" sx={{ fontSize: '14px' }}>Cheque</MenuItem>
                                <MenuItem value="eft" sx={{ fontSize: '14px' }}>EFT</MenuItem>
                                <MenuItem value="wire" sx={{ fontSize: '14px' }}>Wire Transfer</MenuItem>
                                <MenuItem value="cash" sx={{ fontSize: '14px' }}>Cash</MenuItem>
                                <MenuItem value="credit_card" sx={{ fontSize: '14px' }}>Credit Card</MenuItem>
                                <MenuItem value="other" sx={{ fontSize: '14px' }}>Other</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Reference / Cheque #"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            variant="outlined"
                            size="small"
                            required
                            placeholder="e.g., Cheque #12345"
                            sx={{
                                '& .MuiInputLabel-root': { fontSize: '14px' },
                                '& .MuiInputBase-input': { fontSize: '14px' }
                            }}
                        />
                    </Grid>
                </Grid>

                {/* Result Preview */}
                <Box sx={{
                    mt: 3,
                    p: 2,
                    bgcolor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px'
                }}>
                    <Typography sx={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>
                        ✅ This will mark the invoice as PAID and record the payment details above.
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={{
                p: 3,
                borderTop: '1px solid #e5e7eb',
                gap: 1
            }}>
                <Button
                    onClick={handleClose}
                    size="small"
                    sx={{
                        fontSize: '12px',
                        color: '#6b7280'
                    }}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    size="small"
                    disabled={loading}
                    sx={{
                        fontSize: '12px',
                        bgcolor: '#059669',
                        '&:hover': {
                            bgcolor: '#047857'
                        }
                    }}
                >
                    {loading ? 'Marking as Paid...' : 'Mark as Paid'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MarkAsPaidDialog;
