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
import { db } from '../../firebase/firebase';
import { formatDateString } from '../../utils/dateUtils';
import { useSnackbar } from 'notistack';

import ModalHeader from '../common/ModalHeader';
import AddressFormDialog from '../AddressBook/AddressFormDialog';

const CustomerDetail = ({ customerId = null, onClose = null, isModal = false }) => {
    const { id: customerFirestoreId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();

    // Use customerId prop if provided, otherwise use URL param
    const actualCustomerId = customerId || customerFirestoreId;

    const [customer, setCustomer] = useState(null);
    const [company, setCompany] = useState(null);
    const [mainContact, setMainContact] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddAddressDialog, setShowAddAddressDialog] = useState(false);
    const [showViewAddressesDialog, setShowViewAddressesDialog] = useState(false);

    const fetchData = useCallback(async () => {
        if (!actualCustomerId) {
            setError('No customer ID provided');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            console.log('[CustomerDetail] Starting data fetch for customerId:', actualCustomerId);

            // First try to fetch customer by document ID (for backward compatibility)
            let customerData = null;
            try {
                const customerDocRef = doc(db, 'customers', actualCustomerId);
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
                    where('customerID', '==', actualCustomerId)
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

            // Fetch addresses for this customer
            const addressesQuery = query(
                collection(db, 'addressBook'),
                where('addressClass', '==', 'customer'),
                where('addressClassID', '==', customerData.customerID)
            );
            const addressesSnapshot = await getDocs(addressesQuery);
            const addressesData = addressesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAddresses(addressesData);

            // Extract main contact from customer data
            const contact = {
                nickname: customerData.mainContactName || customerData.name,
                companyName: customerData.name,
                firstName: customerData.mainContactFirstName,
                lastName: customerData.mainContactLastName,
                email: customerData.mainContactEmail,
                phone: customerData.mainContactPhone,
                street: customerData.mainContactStreet,
                city: customerData.mainContactCity,
                state: customerData.mainContactState,
                postalCode: customerData.mainContactPostalCode,
                country: customerData.mainContactCountry
            };
            setMainContact(contact);

        } catch (error) {
            console.error('[CustomerDetail] Error fetching customer data:', error);
            setError('Error loading customer data');
        } finally {
            setLoading(false);
        }
    }, [actualCustomerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            enqueueSnackbar(`${label} copied to clipboard`, { variant: 'success' });
        } catch (error) {
            enqueueSnackbar(`Failed to copy ${label}`, { variant: 'error' });
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active':
                return 'success';
            case 'inactive':
                return 'error';
            default:
                return 'default';
        }
    };

    const formatAddress = (address) => {
        if (!address) return 'No address';

        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        if (address.postalCode) parts.push(address.postalCode);
        if (address.country && address.country !== 'US') parts.push(address.country);

        return parts.length > 0 ? parts.join(', ') : 'No address';
    };

    const handleAddAddress = () => {
        setShowAddAddressDialog(true);
    };

    const handleAddressFormSuccess = (addressId) => {
        setShowAddAddressDialog(false);
        fetchData(); // Refresh data
        enqueueSnackbar('Address added successfully', { variant: 'success' });
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

    const handleCancel = () => {
        if (onClose) {
            onClose();
        } else if (!isModal) {
            navigate('/customers');
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
                    {error}
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
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title={`Customer: ${customer.name}`}
                    onClose={handleCancel}
                />
            )}

            {/* Header Section */}
            {!isModal && (
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontSize: '20px', fontWeight: 600, mb: 1 }}>
                                Customer Details
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                                View and manage customer information
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Button
                                variant="outlined"
                                onClick={handleCancel}
                                size="medium"
                                sx={{
                                    fontSize: '12px',
                                    minWidth: '80px',
                                    minHeight: '36px'
                                }}
                            >
                                Back
                            </Button>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Grid container spacing={3}>
                    {/* Customer Information */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ border: '1px solid #e5e7eb', height: '100%' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                    <Avatar
                                        src={customer.logoUrl}
                                        sx={{ width: 48, height: 48 }}
                                    >
                                        {customer.name?.charAt(0)?.toUpperCase()}
                                    </Avatar>
                                    <Box>
                                        <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#111827', mb: 1 }}>
                                            {customer.name}
                                        </Typography>
                                        <Chip
                                            label={customer.status || 'Active'}
                                            color={getStatusColor(customer.status)}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </Box>
                                </Box>

                                <Box sx={{ mb: 3 }}>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                        Customer Information
                                    </Typography>

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Customer ID:
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>
                                                {customer.customerID}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleCopyToClipboard(customer.customerID, 'Customer ID')}
                                            >
                                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Created:
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            {formatDateString(customer.createdAt)}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Addresses:
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            {addresses.length}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={handleAddAddress}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Add Address
                                    </Button>
                                    {addresses.length > 0 && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<LocationOnIcon />}
                                            onClick={handleViewAddresses}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            View All ({addresses.length})
                                        </Button>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Main Contact */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ border: '1px solid #e5e7eb', height: '100%' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                    Main Contact
                                </Typography>

                                {mainContact ? (
                                    <Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                            <Avatar sx={{ width: 40, height: 40 }}>
                                                <PersonIcon />
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                                                    {mainContact.nickname || mainContact.companyName || 'Main Contact'}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {`${mainContact.firstName || ''} ${mainContact.lastName || ''}`.trim() || 'N/A'}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <EmailIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    Email:
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                    {mainContact.email || 'No email'}
                                                </Typography>
                                                {mainContact.email && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyToClipboard(mainContact.email, 'Email')}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <PhoneIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    Phone:
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                    {mainContact.phone || 'No phone'}
                                                </Typography>
                                                {mainContact.phone && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyToClipboard(mainContact.phone, 'Phone')}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </Box>

                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <LocationOnIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    Address:
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                {formatAddress(mainContact)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <PersonIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                        <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                                            No contact information
                                        </Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>

            {/* Addresses Dialog */}
            <Dialog
                open={showViewAddressesDialog}
                onClose={handleCloseViewAddresses}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Customer Addresses ({addresses.length})
                </DialogTitle>
                <DialogContent sx={{ p: 3 }}>
                    {addresses.length > 0 ? (
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
        </Box>
    );
};

export default CustomerDetail;
