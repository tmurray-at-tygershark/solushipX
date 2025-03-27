import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Divider
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Key as KeyIcon
} from '@mui/icons-material';
import './EditCustomer.css';

const EditCustomer = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState(null);
    const [formData, setFormData] = useState({
        companyName: '',
        accountNumber: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        status: 'active',
        notes: ''
    });
    const [openResetDialog, setOpenResetDialog] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        // Simulate API call to fetch customer data
        const fetchCustomerData = async () => {
            try {
                // Mock data - replace with actual API call
                const mockCustomer = {
                    id: id,
                    companyName: 'Acme Corporation',
                    accountNumber: 'ACC-123456',
                    contactName: 'John Doe',
                    email: 'john.doe@acme.com',
                    phone: '+1 (555) 123-4567',
                    address: '123 Business Ave, Suite 100',
                    city: 'New York',
                    state: 'NY',
                    zipCode: '10001',
                    country: 'USA',
                    status: 'active',
                    createdAt: '2024-01-15',
                    alternativePhone: '+1 (555) 987-6543',
                    website: 'www.acmecorp.com',
                    taxId: 'TAX-987654321',
                    notes: 'Premium customer since 2020'
                };

                setCustomer(mockCustomer);
                setFormData(mockCustomer);
            } catch (error) {
                console.error('Error fetching customer data:', error);
                setSnackbar({
                    open: true,
                    message: 'Error loading customer data',
                    severity: 'error'
                });
            } finally {
                setLoading(false);
            }
        };

        fetchCustomerData();
    }, [id]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);

        try {
            // Simulate API call to update customer
            await new Promise(resolve => setTimeout(resolve, 1000));

            setSnackbar({
                open: true,
                message: 'Customer updated successfully',
                severity: 'success'
            });

            // Navigate back to customer detail page after successful update
            setTimeout(() => {
                navigate(`/customers/${id}`);
            }, 1500);
        } catch (error) {
            console.error('Error updating customer:', error);
            setSnackbar({
                open: true,
                message: 'Error updating customer',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        try {
            // Simulate API call to reset password
            await new Promise(resolve => setTimeout(resolve, 1000));

            setSnackbar({
                open: true,
                message: 'Password reset link sent successfully',
                severity: 'success'
            });
            setOpenResetDialog(false);
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Error sending password reset link',
                severity: 'error'
            });
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <div className="edit-customer-container">
            <div className="breadcrumb-container">
                <Link to="/" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Home</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Link to="/customers" className="breadcrumb-link">
                    <Typography variant="body2">Customers</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Link to={`/customers/${id}`} className="breadcrumb-link">
                    <Typography variant="body2">{loading ? 'Loading...' : (customer?.companyName || 'Customer Details')}</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Typography variant="body2" className="breadcrumb-current">
                    Edit Customer
                </Typography>
            </div>

            <Paper className="edit-customer-paper">
                <Typography variant="h5" gutterBottom>
                    Edit Customer
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* Company Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Company Information
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Company Name"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Account Number"
                                name="accountNumber"
                                value={formData.accountNumber}
                                onChange={handleInputChange}
                                disabled
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Tax ID"
                                name="taxId"
                                value={formData.taxId}
                                onChange={handleInputChange}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Website"
                                name="website"
                                value={formData.website}
                                onChange={handleInputChange}
                            />
                        </Grid>

                        {/* Contact Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Contact Information
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Contact Name"
                                name="contactName"
                                value={formData.contactName}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Alternative Phone"
                                name="alternativePhone"
                                value={formData.alternativePhone}
                                onChange={handleInputChange}
                            />
                        </Grid>

                        {/* Address Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Address Information
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Street Address"
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="City"
                                name="city"
                                value={formData.city}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="State/Province"
                                name="state"
                                value={formData.state}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="ZIP/Postal Code"
                                name="zipCode"
                                value={formData.zipCode}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Country"
                                name="country"
                                value={formData.country}
                                onChange={handleInputChange}
                                required
                            />
                        </Grid>

                        {/* Additional Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Additional Information
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    label="Status"
                                    required
                                >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="suspended">Suspended</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Button
                                fullWidth
                                variant="outlined"
                                color="primary"
                                startIcon={<KeyIcon />}
                                onClick={() => setOpenResetDialog(true)}
                            >
                                Reset Password
                            </Button>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Notes"
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                multiline
                                rows={4}
                            />
                        </Grid>

                        {/* Form Actions */}
                        <Grid item xs={12}>
                            <Box display="flex" justifyContent="flex-end" gap={2}>
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<CancelIcon />}
                                    onClick={() => navigate(`/customers/${id}`)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<SaveIcon />}
                                    disabled={loading}
                                >
                                    Save Changes
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </form>
            </Paper>

            {/* Reset Password Dialog */}
            <Dialog open={openResetDialog} onClose={() => setOpenResetDialog(false)}>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to send a password reset link to {formData.email}?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenResetDialog(false)}>Cancel</Button>
                    <Button onClick={handleResetPassword} color="primary" variant="contained">
                        Send Reset Link
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default EditCustomer; 