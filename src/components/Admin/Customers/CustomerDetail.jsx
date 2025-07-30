import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Button,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Alert,
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
    Switch,
    IconButton,
    Tooltip,
    Avatar,
    Card,
    CardContent,
    Divider
} from '@mui/material';
import {
    Edit as EditIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    LocationOn as LocationOnIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    ContentCopy as ContentCopyIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../../firebase/firebase';
import { formatDateString } from '../../../utils/dateUtils';
import { useSnackbar } from 'notistack';

import AdminBreadcrumb from '../AdminBreadcrumb';
import AddressForm from '../../AddressBook/AddressForm';

const CustomerDetail = () => {
    const { id: customerFirestoreId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();

    const [customer, setCustomer] = useState(null);
    const [company, setCompany] = useState(null);
    const [mainContact, setMainContact] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddAddressDialog, setShowAddAddressDialog] = useState(false);
    const [showViewAddressesDialog, setShowViewAddressesDialog] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('[CustomerDetail] Starting data fetch for customerFirestoreId:', customerFirestoreId);

            // First try to fetch customer by document ID (for backward compatibility)
            let customerData = null;
            try {
                const customerDocRef = doc(db, 'customers', customerFirestoreId);
                const customerDoc = await getDoc(customerDocRef);
                if (customerDoc.exists()) {
                    customerData = { id: customerDoc.id, ...customerDoc.data() };
                }
            } catch (docError) {
                console.log('[CustomerDetail] Document ID lookup failed, trying customerID lookup');
            }

            // If not found by document ID, try to fetch by customerID field
            if (!customerData) {
                const customerQuery = query(
                    collection(db, 'customers'),
                    where('customerID', '==', customerFirestoreId)
                );
                const customerSnapshot = await getDocs(customerQuery);
                if (!customerSnapshot.empty) {
                    const customerDoc = customerSnapshot.docs[0];
                    customerData = { id: customerDoc.id, ...customerDoc.data() };
                }
            }

            if (!customerData) {
                setError('Customer not found');
                setLoading(false);
                return;
            }

            setCustomer(customerData);
            console.log('[CustomerDetail] Customer data loaded:', customerData);

            // Fetch company details
            if (customerData.companyID) {
                try {
                    const companyQuery = query(
                        collection(db, 'companies'),
                        where('companyID', '==', customerData.companyID)
                    );
                    const companySnapshot = await getDocs(companyQuery);
                    if (!companySnapshot.empty) {
                        const companyData = { id: companySnapshot.docs[0].id, ...companySnapshot.docs[0].data() };
                        setCompany(companyData);
                        console.log('[CustomerDetail] Company data loaded:', companyData);
                    }
                } catch (companyErr) {
                    console.error('[CustomerDetail] Error fetching company details:', companyErr);
                }
            }

            // Fetch address book records
            if (customerData.customerID) {
                try {
                    const addressBookQuery = query(
                        collection(db, 'addressBook'),
                        where('addressClass', '==', 'customer'),
                        where('addressClassID', '==', customerData.customerID)
                    );
                    const addressBookSnapshot = await getDocs(addressBookQuery);
                    const addressesData = addressBookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Separate main contact from other addresses
                    const mainContactData = addressesData.find(addr => addr.addressType === 'contact');
                    const otherAddresses = addressesData.filter(addr => addr.addressType !== 'contact');

                    setMainContact(mainContactData);
                    setAddresses(otherAddresses);
                    console.log('[CustomerDetail] Main contact loaded:', mainContactData);
                    console.log('[CustomerDetail] Addresses loaded:', otherAddresses);
                } catch (addressErr) {
                    console.error('[CustomerDetail] Error fetching addresses:', addressErr);
                }
            }

        } catch (error) {
            console.error('[CustomerDetail] Error fetching data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [customerFirestoreId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Check if we should show the add address dialog from navigation state
    useEffect(() => {
        if (location.state?.showAddAddressDialog) {
            setShowAddAddressDialog(true);
            // Clear the state so it doesn't trigger again
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate, location.pathname]);

    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            enqueueSnackbar(`${label} copied to clipboard`, { variant: 'success' });
        } catch (error) {
            enqueueSnackbar(`Failed to copy ${label}`, { variant: 'error' });
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'inactive':
                return { color: '#dc2626', bgcolor: '#fef2f2' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    const formatAddress = (address) => {
        if (!address) return 'No address provided';

        const parts = [
            address.street || address.address1,
            address.street2 || address.address2,
            address.city,
            address.state || address.stateProv,
            address.postalCode || address.zipPostal,
            address.country
        ].filter(Boolean);

        return parts.join(', ');
    };

    const handleAddAddress = () => {
        setShowViewAddressesDialog(false); // Close view dialog if open
        setShowAddAddressDialog(true);
    };

    const handleAddressFormSuccess = (addressId) => {
        setShowAddAddressDialog(false);
        enqueueSnackbar('Address added successfully!', { variant: 'success' });
        // Refresh the data to show the new address
        fetchData();
    };

    const handleAddressFormCancel = () => {
        setShowAddAddressDialog(false);
    };

    const handleViewAddresses = () => {
        setShowViewAddressesDialog(true);
    };

    const handleCloseViewAddresses = () => {
        setShowViewAddressesDialog(false);
    };

    // Delete customer handlers
    const handleDeleteClick = () => {
        setDeleteConfirmOpen(true);
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmOpen(false);
    };

    const handleDeleteConfirm = async () => {
        if (!customer) return;

        setDeleteLoading(true);
        try {
            const functions = getFunctions();
            const adminDeleteCustomer = httpsCallable(functions, 'adminDeleteCustomer');

            const result = await adminDeleteCustomer({
                customerId: customer.id
            });

            enqueueSnackbar(result.data.message, { variant: 'success' });

            // Navigate back to customer list
            navigate('/admin/customers');

        } catch (error) {
            console.error('Error deleting customer:', error);
            const errorMessage = error.message || 'Failed to delete customer';
            enqueueSnackbar(errorMessage, { variant: 'error' });
        } finally {
            setDeleteLoading(false);
            setDeleteConfirmOpen(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    Error loading customer: {error}
                </Alert>
            </Box>
        );
    }

    if (!customer) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning">
                    Customer not found
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                            Customer Details
                        </Typography>
                        <AdminBreadcrumb />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/admin/customers/${customerFirestoreId}/edit`)}
                            sx={{ fontSize: '12px' }}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={handleDeleteClick}
                            sx={{ fontSize: '12px' }}
                        >
                            Delete
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Content Section */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Grid container spacing={3}>
                    {/* Customer Overview */}
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                <Avatar
                                    src={customer.logoUrl}
                                    sx={{
                                        width: 64,
                                        height: 64,
                                        bgcolor: '#3b82f6',
                                        fontSize: '24px',
                                        border: '2px solid #e5e7eb'
                                    }}
                                >
                                    {customer.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                                        {customer.name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Chip
                                            label={customer.status || 'Unknown'}
                                            size="small"
                                            sx={{
                                                ...getStatusColor(customer.status),
                                                fontSize: '11px',
                                                fontWeight: 500
                                            }}
                                        />
                                        {customer.customerID && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    ID: {customer.customerID}
                                                </Typography>
                                                <Tooltip title="Copy Customer ID">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyToClipboard(customer.customerID, 'Customer ID')}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            </Box>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Company
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        {company ? company.name : customer.companyID || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Created
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        {customer.createdAt ? formatDateString(customer.createdAt) : 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Last Updated
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        {customer.updatedAt ? formatDateString(customer.updatedAt) : 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Total Addresses
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            {addresses.length + (mainContact ? 1 : 0)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<LocationOnIcon />}
                                            onClick={handleViewAddresses}
                                            sx={{
                                                fontSize: '10px',
                                                borderColor: '#d1d5db',
                                                color: '#374151',
                                                padding: '2px 8px',
                                                minWidth: 'auto',
                                                '&:hover': {
                                                    borderColor: '#9ca3af',
                                                    backgroundColor: '#f9fafb'
                                                }
                                            }}
                                        >
                                            View
                                        </Button>

                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<AddIcon />}
                                            onClick={handleAddAddress}
                                            sx={{
                                                fontSize: '10px',
                                                backgroundColor: '#3b82f6',
                                                padding: '2px 8px',
                                                minWidth: 'auto',
                                                '&:hover': { backgroundColor: '#2563eb' }
                                            }}
                                        >
                                            Add
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Main Contact Information */}
                        <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <PersonIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                                <Typography variant="h6" sx={{ color: '#111827', fontWeight: 600, fontSize: '16px' }}>
                                    Main Contact Information
                                </Typography>
                            </Box>

                            {customer.mainContactName || customer.mainContactAddress1 || customer.mainContactCity ? (
                                <Grid container spacing={3}>
                                    {customer.mainContactName && (
                                        <Grid item xs={12} sm={6}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <PersonIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Contact Name
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', ml: 3 }}>
                                                {customer.mainContactName}
                                            </Typography>
                                        </Grid>
                                    )}

                                    {customer.mainContactCompany && (
                                        <Grid item xs={12} sm={6}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <BusinessIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Company
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', ml: 3 }}>
                                                {customer.mainContactCompany}
                                            </Typography>
                                        </Grid>
                                    )}

                                    {(customer.mainContactAddress1 || customer.mainContactCity) && (
                                        <Grid item xs={12}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <LocationOnIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Address
                                                </Typography>
                                            </Box>
                                            <Box sx={{ ml: 3 }}>
                                                {customer.mainContactAddress1 && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                                        {customer.mainContactAddress1}
                                                    </Typography>
                                                )}
                                                {customer.mainContactAddress2 && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                                        {customer.mainContactAddress2}
                                                    </Typography>
                                                )}
                                                {(customer.mainContactCity || customer.mainContactState || customer.mainContactPostalCode) && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                                        {[customer.mainContactCity, customer.mainContactState, customer.mainContactPostalCode].filter(Boolean).join(', ')}
                                                    </Typography>
                                                )}
                                                {customer.mainContactCountry && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        {customer.mainContactCountry === 'CA' ? 'Canada' :
                                                            customer.mainContactCountry === 'US' ? 'United States' :
                                                                customer.mainContactCountry === 'MX' ? 'Mexico' : customer.mainContactCountry}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Grid>
                                    )}

                                    {customer.mainContactPhone && (
                                        <Grid item xs={12} sm={6}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <PhoneIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Phone
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', ml: 3 }}>
                                                {customer.mainContactPhone}
                                            </Typography>
                                        </Grid>
                                    )}

                                    {customer.mainContactEmail && (
                                        <Grid item xs={12} sm={6}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <EmailIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Email
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', ml: 3 }}>
                                                {customer.mainContactEmail}
                                            </Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            ) : (
                                <Alert severity="info" sx={{ fontSize: '12px' }}>
                                    No main contact information available. <span style={{ color: '#3b82f6', cursor: 'pointer' }} onClick={() => navigate(`/admin/customers/${customerFirestoreId}/edit`)}>Add contact information</span>
                                </Alert>
                            )}
                        </Paper>

                        {/* Billing Address Information */}
                        <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <LocationOnIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                                <Typography variant="h6" sx={{ color: '#111827', fontWeight: 600, fontSize: '16px' }}>
                                    Billing Address Information
                                </Typography>
                            </Box>

                            {customer.billingAddress1 || customer.billingCity || customer.billingContactName ? (
                                <Grid container spacing={3}>
                                    {customer.billingContactName && (
                                        <Grid item xs={12} sm={6}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <PersonIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Billing Contact
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', ml: 3 }}>
                                                {customer.billingContactName}
                                            </Typography>
                                        </Grid>
                                    )}

                                    {customer.billingCompanyName && (
                                        <Grid item xs={12} sm={6}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <BusinessIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Billing Company
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', ml: 3 }}>
                                                {customer.billingCompanyName}
                                            </Typography>
                                        </Grid>
                                    )}

                                    {(customer.billingAddress1 || customer.billingCity) && (
                                        <Grid item xs={12}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <LocationOnIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Billing Address
                                                </Typography>
                                            </Box>
                                            <Box sx={{ ml: 3 }}>
                                                {customer.billingAddress1 && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                                        {customer.billingAddress1}
                                                    </Typography>
                                                )}
                                                {customer.billingAddress2 && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                                        {customer.billingAddress2}
                                                    </Typography>
                                                )}
                                                {(customer.billingCity || customer.billingState || customer.billingPostalCode) && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                                        {[customer.billingCity, customer.billingState, customer.billingPostalCode].filter(Boolean).join(', ')}
                                                    </Typography>
                                                )}
                                                {customer.billingCountry && (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        {customer.billingCountry === 'CA' ? 'Canada' :
                                                            customer.billingCountry === 'US' ? 'United States' :
                                                                customer.billingCountry === 'MX' ? 'Mexico' : customer.billingCountry}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Grid>
                                    )}

                                    {customer.billingPhone && (
                                        <Grid item xs={12} sm={6}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <PhoneIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    Billing Phone
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', ml: 3 }}>
                                                {customer.billingPhone}
                                            </Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            ) : (
                                <Alert severity="info" sx={{ fontSize: '12px' }}>
                                    No billing address information available. <span style={{ color: '#3b82f6', cursor: 'pointer' }} onClick={() => navigate(`/admin/customers/${customerFirestoreId}/edit`)}>Add billing information</span>
                                </Alert>
                            )}
                        </Paper>


                    </Grid>

                    {/* Sidebar */}
                    <Grid item xs={12} md={4}>
                        {/* Company Information */}
                        {company && (
                            <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827', mb: 3 }}>
                                    Company Owner
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                    <Avatar
                                        src={company.logoUrl}
                                        sx={{
                                            width: 40,
                                            height: 40,
                                            bgcolor: '#3b82f6',
                                            fontSize: '14px',
                                            border: '1px solid #e5e7eb'
                                        }}
                                    >
                                        {company.name.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                            Company Name
                                        </Typography>
                                        <Typography
                                            sx={{
                                                fontSize: '12px',
                                                color: '#3b82f6',
                                                cursor: 'pointer',
                                                '&:hover': { textDecoration: 'underline' }
                                            }}
                                            onClick={() => navigate(`/admin/companies/${company.id}`)}
                                        >
                                            {company.name}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ mb: 2 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Company ID
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            {company.companyID}
                                        </Typography>
                                        <Tooltip title="Copy Company ID">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleCopyToClipboard(company.companyID, 'Company ID')}
                                            >
                                                <ContentCopyIcon sx={{ fontSize: '12px' }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                                <Box sx={{ mb: 2 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Status
                                    </Typography>
                                    <Chip
                                        label={company.status || 'Unknown'}
                                        size="small"
                                        sx={{
                                            ...getStatusColor(company.status),
                                            fontSize: '11px',
                                            fontWeight: 500
                                        }}
                                    />
                                </Box>
                                {company.website && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                            Website
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            <a
                                                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#3b82f6', textDecoration: 'none' }}
                                            >
                                                {company.website}
                                            </a>
                                        </Typography>
                                    </Box>
                                )}

                            </Paper>
                        )}


                    </Grid>
                </Grid>
            </Box>

            {/* Add Address Dialog */}
            <Dialog
                open={showAddAddressDialog}
                onClose={handleAddressFormCancel}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <LocationOnIcon sx={{ color: '#3b82f6' }} />
                    <Box>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                            Add Address for {customer?.name}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Customer ID: {customer?.customerID}
                        </Typography>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 3 }}>
                        <AddressForm
                            onCancel={handleAddressFormCancel}
                            onSuccess={handleAddressFormSuccess}
                            isModal={true}
                            // Pre-populate with customer information
                            initialData={{
                                addressClass: 'customer',
                                addressClassID: customer?.customerID,
                                addressType: 'destination'
                            }}
                        />
                    </Box>
                </DialogContent>
            </Dialog>

            {/* View Addresses Dialog */}
            <Dialog
                open={showViewAddressesDialog}
                onClose={handleCloseViewAddresses}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <LocationOnIcon sx={{ color: '#3b82f6' }} />
                        <Box>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                                Addresses for {customer?.name}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                {addresses.length + (mainContact ? 1 : 0)} total addresses
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={handleCloseViewAddresses} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    {(addresses.length > 0 || mainContact) ? (
                        <Grid container spacing={2}>
                            {/* Main Contact Address */}
                            {mainContact && (
                                <Grid item xs={12} md={6}>
                                    <Card sx={{ border: '1px solid #e5e7eb', height: '100%' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <Chip
                                                    label="Main Contact"
                                                    size="small"
                                                    sx={{
                                                        bgcolor: '#3b82f6',
                                                        color: 'white',
                                                        fontSize: '10px'
                                                    }}
                                                />
                                            </Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', mb: 1 }}>
                                                {mainContact.nickname || mainContact.companyName || 'Main Contact'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                {`${mainContact.firstName || ''} ${mainContact.lastName || ''}`.trim() || 'N/A'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                {mainContact.email || 'No email'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                {mainContact.phone || 'No phone'}
                                            </Typography>
                                            <Divider sx={{ my: 1 }} />
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {formatAddress(mainContact)}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            )}

                            {/* Other Addresses */}
                            {addresses.map((address) => (
                                <Grid item xs={12} md={6} key={address.id}>
                                    <Card sx={{ border: '1px solid #e5e7eb', height: '100%' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <Chip
                                                    label={address.addressType || 'Destination'}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: '#10b981',
                                                        color: 'white',
                                                        fontSize: '10px'
                                                    }}
                                                />
                                            </Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', mb: 1 }}>
                                                {address.nickname || address.companyName || 'Destination Address'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                {`${address.firstName || ''} ${address.lastName || ''}`.trim() || 'N/A'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                {address.email || 'No email'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                {address.phone || 'No phone'}
                                            </Typography>
                                            <Divider sx={{ my: 1 }} />
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {formatAddress(address)}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <LocationOnIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                            <Typography sx={{ fontSize: '16px', color: '#6b7280', mb: 1 }}>
                                No addresses found
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                Click "Add" to create the first address for this customer
                            </Typography>
                        </Box>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 2, borderTop: '1px solid #e5e7eb' }}>
                    <Button
                        onClick={handleAddAddress}
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        Add Address
                    </Button>
                    <Button
                        onClick={handleCloseViewAddresses}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={handleDeleteCancel}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                    Delete Customer
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px', mb: 2 }}>
                        Are you sure you want to delete this customer? This action cannot be undone.
                    </Typography>
                    {customer && (
                        <Box sx={{
                            p: 2,
                            bgcolor: '#f8fafc',
                            border: '1px solid #e5e7eb',
                            borderRadius: 1
                        }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                Customer Details:
                            </Typography>
                            <Typography sx={{ fontSize: '12px' }}>
                                <strong>Name:</strong> {customer.name}
                            </Typography>
                            <Typography sx={{ fontSize: '12px' }}>
                                <strong>Customer ID:</strong> {customer.customerID}
                            </Typography>
                        </Box>
                    )}
                    <Alert severity="warning" sx={{ mt: 2, fontSize: '12px' }}>
                        This will also delete all associated addresses for this customer.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                        onClick={handleDeleteCancel}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                        size="small"
                        disabled={deleteLoading}
                        sx={{ fontSize: '12px' }}
                    >
                        {deleteLoading ? 'Deleting...' : 'Delete Customer'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CustomerDetail; 