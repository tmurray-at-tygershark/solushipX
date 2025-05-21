import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    CircularProgress,
    Typography,
    Box,
    FormHelperText
} from '@mui/material';
import { useSnackbar } from 'notistack';

const NET_TERMS_OPTIONS = [0, 15, 30, 45, 60, 75, 90];

const EditPaymentTermsDialog = ({ open, onClose, onSave, companyData }) => {
    const { enqueueSnackbar } = useSnackbar();

    const initialFormState = useMemo(() => ({
        creditLimit: 0,
        netTerms: 30,
        enablePaymentReminders: true,
        onCreditHold: false,
        lateFeePercentage: 0,
        discountPercentage: 0,
        discountDays: 0,
        notes: ''
    }), []);

    const [formData, setFormData] = useState(initialFormState);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (open && companyData) {
            if (companyData.paymentTerms && Object.keys(companyData.paymentTerms).length > 0) {
                setFormData({
                    creditLimit: companyData.paymentTerms.creditLimit !== undefined ? companyData.paymentTerms.creditLimit : initialFormState.creditLimit,
                    netTerms: NET_TERMS_OPTIONS.includes(companyData.paymentTerms.netTerms) ? companyData.paymentTerms.netTerms : initialFormState.netTerms,
                    enablePaymentReminders: companyData.paymentTerms.enablePaymentReminders !== undefined ? companyData.paymentTerms.enablePaymentReminders : initialFormState.enablePaymentReminders,
                    onCreditHold: companyData.paymentTerms.onCreditHold !== undefined ? companyData.paymentTerms.onCreditHold : initialFormState.onCreditHold,
                    lateFeePercentage: companyData.paymentTerms.lateFeePercentage !== undefined ? companyData.paymentTerms.lateFeePercentage : initialFormState.lateFeePercentage,
                    discountPercentage: companyData.paymentTerms.discountPercentage !== undefined ? companyData.paymentTerms.discountPercentage : initialFormState.discountPercentage,
                    discountDays: companyData.paymentTerms.discountDays !== undefined ? companyData.paymentTerms.discountDays : initialFormState.discountDays,
                    notes: companyData.paymentTerms.notes || initialFormState.notes
                });
            } else {
                setFormData(initialFormState);
            }
        } else if (!open) {
            setFormData(initialFormState);
            setErrors({});
        }
    }, [open, companyData, initialFormState]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : Number(value)) : value)
        }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (formData.creditLimit < 0) {
            newErrors.creditLimit = 'Credit limit cannot be negative.';
        }
        if (formData.lateFeePercentage < 0 || formData.lateFeePercentage > 100) {
            newErrors.lateFeePercentage = 'Late fee must be between 0 and 100.';
        }
        if (formData.discountPercentage < 0 || formData.discountPercentage > 100) {
            newErrors.discountPercentage = 'Discount percentage must be between 0 and 100.';
        }
        if (formData.discountDays < 0) {
            newErrors.discountDays = 'Discount days cannot be negative.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            enqueueSnackbar('Please correct the form errors.', { variant: 'warning' });
            return;
        }
        setLoading(true);
        try {
            await onSave(companyData.id, {
                creditLimit: parseFloat(formData.creditLimit) || 0,
                netTerms: parseInt(formData.netTerms, 10),
                enablePaymentReminders: formData.enablePaymentReminders,
                onCreditHold: formData.onCreditHold,
                lateFeePercentage: parseFloat(formData.lateFeePercentage) || 0,
                discountPercentage: parseFloat(formData.discountPercentage) || 0,
                discountDays: parseInt(formData.discountDays, 10) || 0,
                notes: formData.notes || ''
            });
            onClose();
        } catch (err) {
            console.error("Error saving payment terms:", err);
            enqueueSnackbar('Failed to save payment terms: ' + (err.message || 'Unknown error'), { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!companyData && open) {
        return (
            <Dialog open={open} onClose={onClose}>
                <DialogTitle>Loading Company Data...</DialogTitle>
                <DialogContent><CircularProgress /></DialogContent>
            </Dialog>
        );
    }
    if (!companyData && !open) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Edit Payment Terms for: {companyData?.name || 'Company'}</DialogTitle>
            <DialogContent>
                <Box component="form" noValidate autoComplete="off" sx={{ mt: 1 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Credit Limit ($)"
                                name="creditLimit"
                                type="number"
                                value={formData.creditLimit ?? ''}
                                onChange={handleChange}
                                fullWidth
                                InputProps={{ inputProps: { min: 0 } }}
                                error={!!errors.creditLimit}
                                helperText={errors.creditLimit}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.netTerms}>
                                <InputLabel id="net-terms-label">Net Terms (Days)</InputLabel>
                                <Select
                                    labelId="net-terms-label"
                                    name="netTerms"
                                    value={formData.netTerms ?? 30}
                                    label="Net Terms (Days)"
                                    onChange={handleChange}
                                >
                                    {NET_TERMS_OPTIONS.map(term => (
                                        <MenuItem key={term} value={term}>{term === 0 ? 'Due on Receipt' : `Net ${term}`}</MenuItem>
                                    ))}
                                </Select>
                                {errors.netTerms && <FormHelperText>{errors.netTerms}</FormHelperText>}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Late Fee Percentage (%)"
                                name="lateFeePercentage"
                                type="number"
                                value={formData.lateFeePercentage ?? ''}
                                onChange={handleChange}
                                fullWidth
                                InputProps={{ inputProps: { min: 0, max: 100 } }}
                                helperText={errors.lateFeePercentage || "0 for no late fee"}
                                error={!!errors.lateFeePercentage}
                            />
                        </Grid>
                        <Grid item xs={12} sx={{ mt: 1, mb: 0 }}>
                            <Typography variant="subtitle2" gutterBottom>Early Payment Discount</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Discount Percentage (%)"
                                name="discountPercentage"
                                type="number"
                                value={formData.discountPercentage ?? ''}
                                onChange={handleChange}
                                fullWidth
                                InputProps={{ inputProps: { min: 0, max: 100 } }}
                                helperText={errors.discountPercentage || "0 for no discount"}
                                error={!!errors.discountPercentage}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Discount if Paid Within (Days)"
                                name="discountDays"
                                type="number"
                                value={formData.discountDays ?? ''}
                                onChange={handleChange}
                                fullWidth
                                InputProps={{ inputProps: { min: 0 } }}
                                helperText={errors.discountDays || "0 for no discount window"}
                                error={!!errors.discountDays}
                            />
                        </Grid>

                        <Grid item xs={12} sx={{ mt: 1 }}>
                            <FormControlLabel
                                control={<Checkbox checked={formData.enablePaymentReminders || false} onChange={handleChange} name="enablePaymentReminders" />}
                                label="Enable Automated Payment Reminders"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={<Checkbox checked={formData.onCreditHold || false} onChange={handleChange} name="onCreditHold" color="error" />}
                                label="Place Company on Credit Hold"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Internal Notes (Optional)"
                                name="notes"
                                value={formData.notes || ''}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={3}
                            />
                        </Grid>
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" color="primary" disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : 'Save Terms'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditPaymentTermsDialog; 