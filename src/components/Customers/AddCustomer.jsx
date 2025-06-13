import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, CircularProgress, Button, Grid, TextField, FormControl, InputLabel, Select, MenuItem, FormHelperText, Stack, Paper, Breadcrumbs, Checkbox, FormControlLabel, Container, Link as MuiLink } from '@mui/material';
import { Home as HomeIcon, NavigateNext as NavigateNextIcon, Save as SaveIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { collection, query, where, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSnackbar } from 'notistack';
import { useCompany } from '../../contexts/CompanyContext';
import { isValidCustomerID } from '../../utils/validationUtils';
import './EditCustomer.css'; // Can reuse styles for now, or create AddCustomer.css

const initialCustomerFormData = {
    customerID: '',
    name: '',
    contactName: '',
    email: '',
    phone: '',
    status: 'active',
    companyID: '',
    mainContact_street: '',
    mainContact_street2: '',
    mainContact_city: '',
    mainContact_state: '',
    mainContact_postalCode: '',
    mainContact_country: 'US',
    mainContact_nickname: 'Main Contact',
};

const AddCustomer = ({ isModal = false, onBackToTable = null, onCustomerCreated = null }) => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { companyIdForAddress } = useCompany();

    const [customerData, setCustomerData] = useState(() => ({
        ...initialCustomerFormData,
        companyID: companyIdForAddress || ''
    }));
    const [saveContactAsDestination, setSaveContactAsDestination] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        // Pre-fill companyID if available from context when component mounts
        if (companyIdForAddress) {
            setCustomerData(prev => ({ ...prev, companyID: companyIdForAddress }));
        }
    }, [companyIdForAddress]);

    const handleInputChange = (event) => {
        const { name, value, type, checked } = event.target;
        if (name === 'saveContactAsDestination') {
            setSaveContactAsDestination(checked);
        } else {
            setCustomerData(prev => ({ ...prev, [name]: value }));
            if (errors[name]) {
                setErrors(prev => ({ ...prev, [name]: null }));
            }
        }
    };

    const validateForm = async () => {
        const newErrors = {};
        if (!customerData.customerID?.trim()) {
            newErrors.customerID = 'Customer ID is required.';
        } else if (!isValidCustomerID(customerData.customerID.trim())) {
            newErrors.customerID = 'Customer ID must be alphanumeric (no spaces or special characters).';
        }

        if (!customerData.name?.trim()) {
            newErrors.name = 'Customer / Company Name is required.';
        }
        if (!customerData.email?.trim()) {
            newErrors.email = 'Main Email is required.';
        } else if (!/^\S+@\S+\.\S+$/.test(customerData.email)) {
            newErrors.email = 'Main Email is invalid.';
        }
        if (!customerData.phone?.trim()) {
            newErrors.phone = 'Main Phone is required.';
        }

        if (saveContactAsDestination) {
            if (!customerData.mainContact_street?.trim()) newErrors.mainContact_street = 'Main Contact Street is required to save as destination.';
            if (!customerData.mainContact_city?.trim()) newErrors.mainContact_city = 'Main Contact City is required to save as destination.';
            if (!customerData.mainContact_state?.trim()) newErrors.mainContact_state = 'Main Contact State is required to save as destination.';
            if (!customerData.mainContact_postalCode?.trim()) newErrors.mainContact_postalCode = 'Main Contact Postal Code is required to save as destination.';
            if (!customerData.mainContact_country?.trim()) newErrors.mainContact_country = 'Main Contact Country is required to save as destination.';
        }

        if (!customerData.companyID) {
            newErrors.companyID = 'System Error: Company association is missing. Please re-login or contact support.';
        }

        if (customerData.customerID && !newErrors.customerID) { // Only check uniqueness if format is valid
            try {
                const q = query(
                    collection(db, 'customers'),
                    where('companyID', '==', customerData.companyID),
                    where('customerID', '==', customerData.customerID.trim())
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    newErrors.customerID = 'This Customer ID is already in use for your company.';
                }
            } catch (error) {
                console.error("Error checking customer ID uniqueness:", error);
                newErrors.customerID = 'Could not verify Customer ID uniqueness. Please try again.';
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!await validateForm()) return;
        setSaving(true);

        const userDefinedCustomerID = customerData.customerID.trim();

        const customerCoreData = {
            customerID: userDefinedCustomerID,
            name: customerData.name?.trim(),
            contactName: customerData.contactName?.trim(),
            email: customerData.email?.trim(),
            phone: customerData.phone?.trim(),
            status: customerData.status,
            companyID: customerData.companyID,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const mainContactAddressDataForBook = {
            addressClass: 'customer',
            addressClassID: userDefinedCustomerID,
            addressType: 'contact',
            nickname: customerData.mainContact_nickname?.trim() || 'Main Contact',
            firstName: customerData.mainContact_firstName?.trim() || customerData.contactName?.split(' ')[0] || '',
            lastName: customerData.mainContact_lastName?.trim() || customerData.contactName?.split(' ').slice(1).join(' ') || '',
            email: customerData.mainContact_email?.trim() || customerData.email?.trim(),
            phone: customerData.mainContact_phone?.trim() || customerData.phone?.trim(),
            companyName: customerData.name?.trim(),
            attention: customerData.contactName?.trim() || customerData.name?.trim(),
            street: customerData.mainContact_street?.trim(),
            street2: customerData.mainContact_street2?.trim(),
            city: customerData.mainContact_city?.trim(),
            state: customerData.mainContact_state?.trim(),
            postalCode: customerData.mainContact_postalCode?.trim(),
            country: customerData.mainContact_country?.trim(),
            isDefault: false,
            companyID: customerData.companyID,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            const newCustomerDocRef = await addDoc(collection(db, 'customers'), customerCoreData);
            const newCustomerFirestoreId = newCustomerDocRef.id;

            mainContactAddressDataForBook.addressClassID = userDefinedCustomerID;
            mainContactAddressDataForBook.firstName = customerData.mainContact_firstName?.trim() || '';
            mainContactAddressDataForBook.lastName = customerData.mainContact_lastName?.trim() || '';
            mainContactAddressDataForBook.email = customerData.mainContact_email?.trim() || '';
            mainContactAddressDataForBook.phone = customerData.mainContact_phone?.trim() || '';
            mainContactAddressDataForBook.name = customerData.mainContact_firstName?.trim() + ' ' + customerData.mainContact_lastName?.trim() || customerData.contactName || customerData.name;
            mainContactAddressDataForBook.contactName = customerData.mainContact_firstName?.trim() + ' ' + customerData.mainContact_lastName?.trim() || customerData.contactName;
            mainContactAddressDataForBook.attention = customerData.mainContact_firstName?.trim() + ' ' + customerData.mainContact_lastName?.trim() || customerData.contactName;
            mainContactAddressDataForBook.companyName = customerData.name;

            await addDoc(collection(db, 'addressBook'), mainContactAddressDataForBook);
            enqueueSnackbar('Customer and main contact created!', { variant: 'success' });

            if (saveContactAsDestination) {
                const destinationAddressData = {
                    ...mainContactAddressDataForBook,
                    addressClassID: userDefinedCustomerID,
                    addressType: 'destination',
                    nickname: 'Primary Destination',
                    isDefault: true,
                };
                destinationAddressData.createdAt = serverTimestamp();
                destinationAddressData.updatedAt = serverTimestamp();
                await addDoc(collection(db, 'addressBook'), destinationAddressData);
                enqueueSnackbar('Main contact also saved as default destination!', { variant: 'info' });
            }

            // Handle navigation based on modal context
            if (isModal && onCustomerCreated) {
                onCustomerCreated(newCustomerFirestoreId);
            } else {
                navigate(`/customers/${newCustomerFirestoreId}`);
            }
        } catch (error) {
            console.error('Error creating customer:', error);
            enqueueSnackbar('Error creating customer: ' + error.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: isModal ? 0 : 2, mb: 4 }}>
            <Box className="add-customer-container" sx={{ p: 0 }}>
                {/* Breadcrumbs - only show when not in modal */}
                {!isModal && (
                    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" sx={{ mb: 2 }}>
                        <MuiLink
                            component={RouterLink}
                            to="/"
                            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                        >
                            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                            Home
                        </MuiLink>
                        <MuiLink
                            component={RouterLink}
                            to="/customers"
                            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                        >
                            Customers
                        </MuiLink>
                        <Typography color="text.primary">Add New Customer</Typography>
                    </Breadcrumbs>
                )}

                <Paper elevation={isModal ? 0 : 3} sx={{ p: { xs: 2, sm: 3, md: 4 }, mb: 4, boxShadow: isModal ? 'none' : undefined }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap' }}>
                        <Typography variant="h4" component="h1" sx={{ mb: { xs: 2, sm: 0 } }}>
                            Create New Customer
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                            <Button
                                variant="outlined"
                                onClick={isModal && onBackToTable ? onBackToTable : () => navigate('/customers')}
                                disabled={saving}
                                startIcon={<ArrowBackIcon />}
                                sx={{ width: '100%' }}
                            >
                                Back to List
                            </Button>
                            <Button variant="contained" color="primary" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} sx={{ width: '100%' }}>
                                {saving ? 'Creating...' : 'Create Customer'}
                            </Button>
                        </Stack>
                    </Box>

                    <Grid container spacing={3}>
                        {/* Customer Core Info */}
                        <Grid item xs={12}><Typography variant="h6">Customer Details</Typography></Grid>
                        <Grid item xs={12} md={6}>
                            <TextField label="Customer ID (Alphanumeric)" name="customerID" value={customerData.customerID} onChange={handleInputChange} error={!!errors.customerID} helperText={errors.customerID} fullWidth required disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField label="Customer / Company Name" name="name" value={customerData.name} onChange={handleInputChange} error={!!errors.name} helperText={errors.name} fullWidth required disabled={saving} />
                        </Grid>

                        <Grid item xs={12} md={4} sx={{ mt: 2 }}>
                            <TextField label="Primary Contact Person" name="contactName" value={customerData.contactName} onChange={handleInputChange} error={!!errors.contactName} helperText={errors.contactName} fullWidth disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField label="Primary Email" name="email" type="email" value={customerData.email} onChange={handleInputChange} error={!!errors.email} helperText={errors.email} fullWidth required disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField label="Primary Phone" name="phone" type="tel" value={customerData.phone} onChange={handleInputChange} error={!!errors.phone} helperText={errors.phone} fullWidth required disabled={saving} />
                        </Grid>

                        <Grid item xs={12} md={6} sx={{ mt: 1 }}>
                            <TextField label="Contact Street" name="mainContact_street" value={customerData.mainContact_street} onChange={handleInputChange} error={!!errors.mainContact_street} helperText={errors.mainContact_street} fullWidth disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField label="Contact Street 2" name="mainContact_street2" value={customerData.mainContact_street2} onChange={handleInputChange} fullWidth disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField label="Contact City" name="mainContact_city" value={customerData.mainContact_city} onChange={handleInputChange} error={!!errors.mainContact_city} helperText={errors.mainContact_city} fullWidth disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField label="Contact State/Province" name="mainContact_state" value={customerData.mainContact_state} onChange={handleInputChange} error={!!errors.mainContact_state} helperText={errors.mainContact_state} fullWidth disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField label="Contact Postal Code" name="mainContact_postalCode" value={customerData.mainContact_postalCode} onChange={handleInputChange} error={!!errors.mainContact_postalCode} helperText={errors.mainContact_postalCode} fullWidth disabled={saving} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth error={!!errors.mainContact_country} disabled={saving}>
                                <InputLabel>Contact Country</InputLabel>
                                <Select name="mainContact_country" value={customerData.mainContact_country || 'US'} onChange={handleInputChange} label="Contact Country">
                                    <MenuItem value="US">United States</MenuItem>
                                    <MenuItem value="CA">Canada</MenuItem>
                                </Select>
                                {errors.mainContact_country && <FormHelperText>{errors.mainContact_country}</FormHelperText>}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField label="Main Contact Address Nickname" name="mainContact_nickname" value={customerData.mainContact_nickname} onChange={handleInputChange} helperText="e.g., Main Office, Billing Address" fullWidth disabled={saving} />
                        </Grid>

                        <Grid item xs={12} sx={{ mt: 2 }}><Typography variant="h6">Additional Customer Settings</Typography></Grid>
                        <Grid item xs={12} md={12}>
                            <FormControl fullWidth error={!!errors.status} disabled={saving}>
                                <InputLabel>Customer Status</InputLabel>
                                <Select name="status" value={customerData.status} onChange={handleInputChange} label="Customer Status">
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                    <MenuItem value="pending">Pending Approval</MenuItem>
                                    <MenuItem value="suspended">Suspended</MenuItem>
                                </Select>
                                {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={<Checkbox checked={saveContactAsDestination} onChange={handleInputChange} name="saveContactAsDestination" color="primary" />}
                                label="Also save main contact & address as a default destination address for shipments."
                                disabled={saving}
                            />
                        </Grid>
                    </Grid>
                </Paper>
            </Box>
        </Container>
    );
};

export default AddCustomer; 