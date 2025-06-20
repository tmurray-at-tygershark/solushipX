import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    CircularProgress,
    Breadcrumbs,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    Switch,
    FormControlLabel,
    Stack,
    IconButton,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Container,
    Link as MuiLink,
    Alert
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Save as SaveIcon,
    ArrowBack as ArrowBackIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import ModalHeader from '../common/ModalHeader';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, limit, writeBatch, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSnackbar } from 'notistack';
import './EditCustomer.css';
import DestinationAddressDialog from './DestinationAddressDialog';
import { isValidEmail } from '../../utils/validationUtils';

const emptyAddress = () => ({
    name: '',
    companyName: '',
    attention: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialInstructions: '',
    isDefault: false,
});

const initialEditFormState = {
    customerID: '',
    name: '',
    status: 'active',
    companyID: '',
    id: null,
    mainContact_firstName: '',
    mainContact_lastName: '',
    mainContact_email: '',
    mainContact_phone: '',
    mainContact_companyName: '',
    mainContact_attention: '',
    mainContact_nickname: 'Main Contact',
    mainContact_street: '',
    mainContact_street2: '',
    mainContact_city: '',
    mainContact_state: '',
    mainContact_postalCode: '',
    mainContact_country: 'US',
    mainContact_specialInstructions: '',
};



const EditCustomer = ({ customerId = null, onBackToDetail = null, onCustomerUpdated = null, isModal = false }) => {
    const { id: customerDocIdFromUrl } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    // Use prop customerId if provided, otherwise fall back to URL parameter
    const id = customerId || customerDocIdFromUrl;

    const [customerData, setCustomerData] = useState(initialEditFormState);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [destinationAddresses, setDestinationAddresses] = useState([]);
    const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
    const [addressToDelete, setAddressToDelete] = useState(null);
    const [initialUserDefinedCustomerID, setInitialUserDefinedCustomerID] = useState('');
    const [mainContactAddressBookId, setMainContactAddressBookId] = useState(null);


    useEffect(() => {
        if (!id) {
            enqueueSnackbar('No customer ID provided for editing.', { variant: 'error' });
            if (!isModal) {
                navigate('/customers');
            }
            return;
        }
        setLoading(true);
        const customerDocRef = doc(db, 'customers', id);
        getDoc(customerDocRef)
            .then(async (docSnap) => {
                if (docSnap.exists()) {
                    const customerFromDb = docSnap.data();
                    const userDefinedCustID = customerFromDb.customerID;
                    setInitialUserDefinedCustomerID(userDefinedCustID);

                    let populatedMainContactFields = {
                        mainContact_firstName: '',
                        mainContact_lastName: '',
                        mainContact_email: '',
                        mainContact_phone: '',
                        mainContact_companyName: customerFromDb.name || '',
                        mainContact_attention: '',
                        mainContact_nickname: 'Main Contact',
                        mainContact_street: '',
                        mainContact_street2: '',
                        mainContact_city: '',
                        mainContact_state: '',
                        mainContact_postalCode: '',
                        mainContact_country: 'US',
                        mainContact_specialInstructions: '',
                    };

                    if (userDefinedCustID) {
                        const mainContactQuery = query(
                            collection(db, 'addressBook'),
                            where('addressClass', '==', 'customer'),
                            where('addressClassID', '==', userDefinedCustID),
                            where('addressType', '==', 'contact'),
                            limit(1)
                        );
                        const mainContactSnapshot = await getDocs(mainContactQuery);
                        if (!mainContactSnapshot.empty) {
                            const mcData = mainContactSnapshot.docs[0].data();
                            console.log("EditCustomer: Found main contact addressBook entry (mcData):", JSON.parse(JSON.stringify(mcData)));
                            setMainContactAddressBookId(mainContactSnapshot.docs[0].id);
                            populatedMainContactFields = {
                                mainContact_firstName: mcData.firstName || '',
                                mainContact_lastName: mcData.lastName || '',
                                mainContact_email: mcData.email || '',
                                mainContact_phone: mcData.phone || '',
                                mainContact_companyName: mcData.companyName || customerFromDb.name || '',
                                mainContact_attention: mcData.attention || '',
                                mainContact_nickname: mcData.nickname || 'Main Contact',
                                mainContact_street: mcData.street || mcData.address1 || '',
                                mainContact_street2: mcData.street2 || mcData.address2 || '',
                                mainContact_city: mcData.city || '',
                                mainContact_state: mcData.state || mcData.stateProv || '',
                                mainContact_postalCode: mcData.postalCode || mcData.zipPostal || '',
                                mainContact_country: mcData.country || mcData.countryCode || 'US',
                                mainContact_specialInstructions: mcData.specialInstructions || '',
                            };
                        }
                    }

                    const dataToSet = {
                        ...initialEditFormState,
                        ...customerFromDb,
                        id: docSnap.id,
                        ...populatedMainContactFields,
                    };
                    delete dataToSet.companyName;
                    delete dataToSet.notes;

                    console.log("EditCustomer: Final data object being set to customerData state:", JSON.parse(JSON.stringify(dataToSet)));

                    setCustomerData(dataToSet);

                    if (userDefinedCustID) {
                        fetchDestinationAddresses(userDefinedCustID);
                    }
                } else {
                    enqueueSnackbar('Customer not found.', { variant: 'error' });
                    if (!isModal) {
                        navigate('/customers');
                    }
                }
            })
            .catch((error) => {
                console.error('Error fetching customer data:', error);
                enqueueSnackbar('Error fetching customer data: ' + error.message, { variant: 'error' });
            })
            .finally(() => setLoading(false));
    }, [id, navigate, enqueueSnackbar, isModal]);

    const fetchDestinationAddresses = async (userDefinedCustID) => {
        if (!userDefinedCustID) {
            console.log('EditCustomer/fetchDestinationAddresses: No userDefinedCustID provided, skipping fetch.');
            setDestinationAddresses([]); // Clear any existing addresses if ID is missing
            return;
        }
        console.log(`EditCustomer/fetchDestinationAddresses: Fetching for userDefinedCustID: ${userDefinedCustID}`);
        try {
            const q = query(
                collection(db, 'addressBook'),
                where('addressClass', '==', 'customer'),
                where('addressClassID', '==', userDefinedCustID),
                where('addressType', '==', 'destination')
            );
            const querySnapshot = await getDocs(q);
            const addresses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`EditCustomer/fetchDestinationAddresses: Found ${addresses.length} destination addresses:`, addresses);
            setDestinationAddresses(addresses);
        } catch (error) {
            console.error('Error fetching destination addresses:', error);
            enqueueSnackbar('Failed to load destination addresses: ' + error.message, { variant: 'error' });
            setDestinationAddresses([]); // Clear on error too
        }
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setCustomerData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };



    const validateForm = async () => {
        const newErrors = {};

        // Customer name validation
        if (!customerData.name?.trim()) {
            newErrors.name = 'Customer / Company Name is required.';
        }

        // Customer ID validation - just check if it exists (should always exist for edit)
        if (!customerData.customerID?.trim()) {
            newErrors.customerID = 'Customer ID is required.';
        }

        // Contact validation
        if (!customerData.mainContact_firstName?.trim()) {
            newErrors.mainContact_firstName = 'First Name is required.';
        }
        if (!customerData.mainContact_lastName?.trim()) {
            newErrors.mainContact_lastName = 'Last Name is required.';
        }
        if (!customerData.mainContact_email?.trim()) {
            newErrors.mainContact_email = 'Main Contact Email is required.';
        } else if (!isValidEmail(customerData.mainContact_email)) {
            newErrors.mainContact_email = 'Main Contact Email is invalid.';
        }
        if (!customerData.mainContact_phone?.trim()) {
            newErrors.mainContact_phone = 'Main Contact Phone is required.';
        }
        if (!customerData.mainContact_street?.trim()) newErrors.mainContact_street = 'Main Contact Street is required.';
        if (!customerData.mainContact_city?.trim()) newErrors.mainContact_city = 'Main Contact City is required.';
        if (!customerData.mainContact_state?.trim()) newErrors.mainContact_state = 'Main Contact State is required.';
        if (!customerData.mainContact_postalCode?.trim()) newErrors.mainContact_postalCode = 'Main Contact Postal Code is required.';
        if (!customerData.mainContact_country?.trim()) newErrors.mainContact_country = 'Main Contact Country is required.';

        if (!customerData.companyID) {
            newErrors.companyID = 'System Error: Company association is missing.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!await validateForm()) return;
        if (!id) {
            enqueueSnackbar('Error: No customer document ID found for update.', { variant: 'error' });
            return;
        }
        setSaving(true);
        const userDefinedCustID = customerData.customerID;

        const customerCoreDataToSave = {
            customerID: userDefinedCustID,
            name: customerData.name?.trim(),
            status: customerData.status,
            companyID: customerData.companyID,
            updatedAt: serverTimestamp(),
        };

        const mainContactAddressDataToSave = {
            addressClass: 'customer',
            addressClassID: userDefinedCustID,
            addressType: 'contact',
            nickname: customerData.mainContact_nickname?.trim() || 'Main Contact',
            firstName: customerData.mainContact_firstName?.trim(),
            lastName: customerData.mainContact_lastName?.trim(),
            email: customerData.mainContact_email?.trim(),
            phone: customerData.mainContact_phone?.trim(),
            companyName: customerData.mainContact_companyName?.trim() || customerData.name?.trim(),
            attention: customerData.mainContact_attention?.trim() || `${customerData.mainContact_firstName || ''} ${customerData.mainContact_lastName || ''}`.trim(),
            street: customerData.mainContact_street?.trim(),
            street2: customerData.mainContact_street2?.trim(),
            city: customerData.mainContact_city?.trim(),
            state: customerData.mainContact_state?.trim(),
            postalCode: customerData.mainContact_postalCode?.trim(),
            country: customerData.mainContact_country?.trim(),
            isDefault: false,
            companyID: customerData.companyID,
            updatedAt: serverTimestamp(),
        };
        if (!mainContactAddressBookId) {
            mainContactAddressDataToSave.createdAt = serverTimestamp();
        }

        try {
            const customerDocRef = doc(db, 'customers', id);
            await updateDoc(customerDocRef, customerCoreDataToSave);

            if (mainContactAddressBookId) {
                const contactDocRef = doc(db, 'addressBook', mainContactAddressBookId);
                await updateDoc(contactDocRef, mainContactAddressDataToSave);
            } else {
                const newContactRef = await addDoc(collection(db, 'addressBook'), mainContactAddressDataToSave);
                setMainContactAddressBookId(newContactRef.id);
            }
            enqueueSnackbar('Customer updated successfully!', { variant: 'success' });

            // Call onCustomerUpdated callback if provided (for modal mode)
            if (onCustomerUpdated) {
                onCustomerUpdated(id);
            }

            // Navigate based on modal mode
            if (onBackToDetail) {
                onBackToDetail();
            } else {
                navigate(`/customers/${id}`);
            }
        } catch (error) {
            console.error('Error updating customer:', error);
            enqueueSnackbar('Error updating customer: ' + error.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleOpenAddressDialog = (address = null) => {
        console.log("EditCustomer.jsx: handleOpenAddressDialog called with address:", address ? JSON.parse(JSON.stringify(address)) : address);

        if (address === null) {
            // enqueueSnackbar('Please save the customer details first to add/edit addresses.', { variant: 'info' });
            // return; 
            // This specific check might be redundant in the refactored EditCustomer as it always loads an existing customer.
        }
        setEditingAddress(address ? { ...address } : emptyAddress());
        setIsAddressDialogOpen(true);
    };

    const handleCloseAddressDialog = () => {
        setIsAddressDialogOpen(false);
        setEditingAddress(null);
    };

    const handleSaveAddress = async (addressData) => {
        if (!customerData.customerID) {
            enqueueSnackbar('Customer User-Defined ID is missing, cannot save address.', { variant: 'error' });
            return;
        }
        setSaving(true);
        try {
            const dataToSaveInAddressBook = {
                ...addressData,
                addressClass: 'customer',
                addressClassID: customerData.customerID,
                addressType: 'destination',
                companyID: customerData.companyID,
                updatedAt: serverTimestamp(),
            };
            delete dataToSaveInAddressBook.id;

            if (dataToSaveInAddressBook.isDefault) {
                const batch = writeBatch(db);
                const otherDefaultsQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'customer'),
                    where('addressClassID', '==', customerData.customerID),
                    where('addressType', '==', 'destination'),
                    where('isDefault', '==', true)
                );
                const otherDefaultsSnapshot = await getDocs(otherDefaultsQuery);
                otherDefaultsSnapshot.forEach(docToUpdate => {
                    if (docToUpdate.id !== addressData.id) {
                        batch.update(doc(db, 'addressBook', docToUpdate.id), { isDefault: false });
                    }
                });
                await batch.commit();
            }

            if (addressData.id) {
                const addressDocRef = doc(db, 'addressBook', addressData.id);
                await updateDoc(addressDocRef, dataToSaveInAddressBook);
                enqueueSnackbar('Destination address updated!', { variant: 'success' });
            } else {
                dataToSaveInAddressBook.createdAt = serverTimestamp();
                await addDoc(collection(db, 'addressBook'), dataToSaveInAddressBook);
                enqueueSnackbar('New destination address added!', { variant: 'success' });
            }
            fetchDestinationAddresses(customerData.customerID);
            handleCloseAddressDialog();
        } catch (error) {
            console.error('Error saving destination address:', error);
            enqueueSnackbar('Error saving destination address: ' + error.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAddress = async (addressIdToDelete) => {
        if (!addressIdToDelete) return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, 'addressBook', addressIdToDelete));
            enqueueSnackbar('Address deleted successfully!', { variant: 'success' });
            fetchDestinationAddresses(customerData.customerID);
        } catch (error) {
            console.error('Error deleting address:', error);
            enqueueSnackbar('Error deleting address: ' + error.message, { variant: 'error' });
        }
        setIsConfirmDeleteDialogOpen(false);
        setAddressToDelete(null);
        setSaving(false);
    };

    const openConfirmDeleteDialog = (addressId) => {
        setAddressToDelete(addressId);
        setIsConfirmDeleteDialogOpen(true);
    };

    const handleUseMainContactAsAddress = () => {
        const prefillData = {
            ...emptyAddress(),
            name: customerData.mainContact_nickname || 'Main Contact Address',
            companyName: customerData.mainContact_companyName || customerData.name || '',
            attention: customerData.mainContact_attention || `${customerData.mainContact_firstName || ''} ${customerData.mainContact_lastName || ''}`.trim(),
            street: customerData.mainContact_street || '',
            street2: customerData.mainContact_street2 || '',
            city: customerData.mainContact_city || '',
            state: customerData.mainContact_state || '',
            postalCode: customerData.mainContact_postalCode || '',
            country: customerData.mainContact_country || 'US',
            firstName: customerData.mainContact_firstName || '',
            lastName: customerData.mainContact_lastName || '',
            email: customerData.mainContact_email || '',
            phone: customerData.mainContact_phone || '',
            specialInstructions: customerData.mainContact_specialInstructions || '',
            isDefault: !destinationAddresses.some(addr => addr.isDefault),
        };
        setEditingAddress(prefillData);
        setIsAddressDialogOpen(true);
    };

    if (loading) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
    }

    return (
        <Box sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white'
        }}>
            {/* Modal Header - only show when used as standalone modal, not in sliding system */}
            {isModal && !onBackToDetail && (
                <ModalHeader
                    title="Edit Customer"
                    onBack={() => navigate('/customers')}
                    showBackButton={true}
                    showCloseButton={false}
                />
            )}

            {/* Breadcrumb - only show when not in modal mode */}
            {!isModal && (
                <Box sx={{ px: 2, pt: 2 }}>
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
                        <Typography color="text.primary">
                            {customerData.name || 'Edit Customer'}
                        </Typography>
                    </Breadcrumbs>
                </Box>
            )}

            {/* Scrollable Content Area */}
            <Box sx={{
                flex: 1,
                overflow: 'auto',
                minHeight: 0,
                px: 3,
                pb: 4
            }}>
                {/* Customer Header - show in all modal modes */}
                {isModal && (
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 3,
                        pt: 2
                    }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontSize: '20px', fontWeight: 600, mb: 1 }}>
                                Editing: {customerData.name || 'Customer'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                                    Customer ID: {customerData.customerID}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        navigator.clipboard.writeText(customerData.customerID);
                                    }}
                                    sx={{
                                        padding: '2px',
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                        }
                                    }}
                                    title="Copy Customer ID to clipboard"
                                >
                                    <ContentCopyIcon sx={{ fontSize: '12px' }} />
                                </IconButton>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                    if (onBackToDetail) {
                                        onBackToDetail();
                                    } else {
                                        navigate(`/customers/${id}`);
                                    }
                                }}
                                disabled={saving}
                                sx={{ fontSize: '12px', textTransform: 'none' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                onClick={handleSave}
                                disabled={saving || loading}
                                sx={{ fontSize: '12px', textTransform: 'none' }}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* Header Section - only show when not in modal mode */}
                {!isModal && (
                    <Paper sx={{
                        p: 3,
                        mb: 2,
                        border: '1px solid #e2e8f0'
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="h5" component="h1" sx={{ fontSize: '18px', fontWeight: 600, mb: { xs: 2, sm: 0 } }}>
                                {`Edit: ${customerData.name || customerData.customerID}`}
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        if (onBackToDetail) {
                                            onBackToDetail();
                                        } else {
                                            navigate(`/customers/${id}`);
                                        }
                                    }}
                                    disabled={saving}
                                    startIcon={<ArrowBackIcon />}
                                    size="small"
                                    sx={{ fontSize: '12px', textTransform: 'none' }}
                                >
                                    Back
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleSave}
                                    disabled={saving || loading}
                                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                    size="small"
                                    sx={{ fontSize: '12px', textTransform: 'none' }}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </Stack>
                        </Box>
                    </Paper>
                )}

                {/* Customer Details Section */}
                <Paper sx={{
                    p: 3,
                    mb: 2,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2
                }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Customer Details
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Customer / Company Name"
                                name="name"
                                value={customerData.name}
                                onChange={handleInputChange}
                                error={!!errors.name}
                                helperText={errors.name}
                                fullWidth
                                required
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Customer ID"
                                name="customerID"
                                value={customerData.customerID}
                                error={!!errors.customerID}
                                helperText={errors.customerID || 'Customer ID cannot be changed after creation'}
                                fullWidth
                                required
                                disabled={true}
                                size="small"
                                inputProps={{
                                    style: { textTransform: 'uppercase' }
                                }}
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={customerData.status === 'active'}
                                        onChange={(e) => {
                                            setCustomerData(prev => ({
                                                ...prev,
                                                status: e.target.checked ? 'active' : 'inactive'
                                            }));
                                            if (errors.status) {
                                                setErrors(prev => ({ ...prev, status: null }));
                                            }
                                        }}
                                        disabled={saving || loading}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                        Customer Status: {customerData.status === 'active' ? 'Active' : 'Inactive'}
                                    </Typography>
                                }
                                sx={{ mt: 1 }}
                            />
                            {errors.status && (
                                <FormHelperText error sx={{ ml: 0, mt: 0.5 }}>
                                    {errors.status}
                                </FormHelperText>
                            )}
                        </Grid>
                    </Grid>
                </Paper>

                {/* Main Contact Section */}
                <Paper sx={{
                    p: 3,
                    mb: 2,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2
                }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Main Contact Person & Address
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="First Name"
                                name="mainContact_firstName"
                                value={customerData.mainContact_firstName}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_firstName}
                                helperText={errors.mainContact_firstName}
                                fullWidth
                                required
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Last Name"
                                name="mainContact_lastName"
                                value={customerData.mainContact_lastName}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_lastName}
                                helperText={errors.mainContact_lastName}
                                fullWidth
                                required
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Email"
                                name="mainContact_email"
                                type="email"
                                value={customerData.mainContact_email}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_email}
                                helperText={errors.mainContact_email}
                                fullWidth
                                required
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Phone"
                                name="mainContact_phone"
                                type="tel"
                                value={customerData.mainContact_phone}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_phone}
                                helperText={errors.mainContact_phone}
                                fullWidth
                                required
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Company Name"
                                name="mainContact_companyName"
                                value={customerData.mainContact_companyName}
                                onChange={handleInputChange}
                                helperText="Defaults to Customer Name if blank"
                                fullWidth
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Street Address"
                                name="mainContact_street"
                                value={customerData.mainContact_street}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_street}
                                helperText={errors.mainContact_street}
                                fullWidth
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Street Address 2"
                                name="mainContact_street2"
                                value={customerData.mainContact_street2}
                                onChange={handleInputChange}
                                fullWidth
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="City"
                                name="mainContact_city"
                                value={customerData.mainContact_city}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_city}
                                helperText={errors.mainContact_city}
                                fullWidth
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="State/Province"
                                name="mainContact_state"
                                value={customerData.mainContact_state}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_state}
                                helperText={errors.mainContact_state}
                                fullWidth
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                label="Postal Code"
                                name="mainContact_postalCode"
                                value={customerData.mainContact_postalCode}
                                onChange={handleInputChange}
                                error={!!errors.mainContact_postalCode}
                                helperText={errors.mainContact_postalCode}
                                fullWidth
                                disabled={saving || loading}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiInputLabel-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth error={!!errors.mainContact_country} disabled={saving || loading} size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                <Select
                                    name="mainContact_country"
                                    value={customerData.mainContact_country || 'US'}
                                    onChange={handleInputChange}
                                    label="Country"
                                    sx={{
                                        fontSize: '12px'
                                    }}
                                >
                                    <MenuItem value="US">United States</MenuItem>
                                    <MenuItem value="CA">Canada</MenuItem>
                                </Select>
                                {errors.mainContact_country && <FormHelperText>{errors.mainContact_country}</FormHelperText>}
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Delivery Addresses Section */}
                <Paper sx={{
                    p: 3,
                    mb: 4,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2
                }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: { xs: 1, sm: 0 } }}>
                            Delivery Addresses
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => handleOpenAddressDialog()}
                            startIcon={<AddIcon />}
                            disabled={saving || loading}
                            size="small"
                            sx={{ fontSize: '12px', textTransform: 'none' }}
                        >
                            Add Address
                        </Button>
                    </Box>
                    {destinationAddresses.length === 0 ? (
                        <Alert severity="info" sx={{ fontSize: '12px' }}>
                            No delivery addresses. Click "Add Address" to create one.
                        </Alert>
                    ) : (
                        <TableContainer>
                            <Table size="small" sx={{
                                '& .MuiTableCell-root': {
                                    fontSize: '12px',
                                    padding: '8px 12px'
                                },
                                '& .MuiTableHead-root .MuiTableCell-root': {
                                    fontWeight: 600,
                                    backgroundColor: '#f8fafc',
                                    color: '#374151'
                                }
                            }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Company</TableCell>
                                        <TableCell>Address</TableCell>
                                        <TableCell>Contact</TableCell>
                                        <TableCell>Default</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {destinationAddresses.map((addr, index) => (
                                        <TableRow key={addr.id || index} hover>
                                            <TableCell>{addr.nickname || addr.name || 'N/A'}</TableCell>
                                            <TableCell>{addr.companyName || addr.company || 'N/A'}</TableCell>
                                            <TableCell sx={{ fontSize: '12px', lineHeight: '1.4' }}>
                                                {addr.street || addr.address1 || ''}
                                                {addr.street2 || addr.address2 ? <><br />{addr.street2 || addr.address2}</> : ''}
                                                <br />
                                                {`${addr.city || ''}, ${addr.state || addr.stateProv || ''} ${addr.postalCode || addr.zipPostal || ''}`}
                                                <br />
                                                {addr.country || addr.countryCode || ''}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', lineHeight: '1.4' }}>
                                                {addr.contactName || `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A'}
                                                {addr.contactEmail || addr.email ? <><br />{addr.contactEmail || addr.email}</> : <><br />N/A</>}
                                                {addr.contactPhone || addr.phone ? <><br />{addr.contactPhone || addr.phone}</> : <><br />N/A</>}
                                            </TableCell>
                                            <TableCell>
                                                {addr.isDefault || addr.isDefaultShipping ?
                                                    <Chip label="Yes" color="primary" size="small" sx={{ fontSize: '10px' }} /> :
                                                    <Chip label="No" variant="outlined" size="small" sx={{ fontSize: '10px' }} />
                                                }
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenAddressDialog(addr)}
                                                    disabled={saving || loading}
                                                    title="Edit Address"
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => openConfirmDeleteDialog(addr.id)}
                                                    disabled={saving || loading}
                                                    title="Delete Address"
                                                >
                                                    <DeleteIcon fontSize="small" color="error" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>

                {/* Bottom spacing with subtle visual element */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    py: 4,
                    mt: 2
                }}>
                    <Box sx={{
                        width: '100px',
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)',
                        borderRadius: '1px'
                    }} />
                </Box>

                {/* Dialogs */}
                <DestinationAddressDialog
                    key={editingAddress ? editingAddress.id || `addr-${Date.now()}` : 'new-address-dialog'}
                    open={isAddressDialogOpen}
                    onClose={handleCloseAddressDialog}
                    onSave={handleSaveAddress}
                    addressData={editingAddress}
                    customerCompanyName={customerData.name}
                    customerID={customerData.customerID}
                />

                <Dialog open={isConfirmDeleteDialogOpen} onClose={() => setIsConfirmDeleteDialogOpen(false)}>
                    <DialogTitle sx={{ fontSize: '16px' }}>Confirm Delete Address</DialogTitle>
                    <DialogContent>
                        <Typography sx={{ fontSize: '12px' }}>Are you sure you want to delete this destination address?</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setIsConfirmDeleteDialogOpen(false)}
                            disabled={saving}
                            size="small"
                            sx={{ fontSize: '12px', textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleDeleteAddress(addressToDelete)}
                            color="error"
                            variant="contained"
                            disabled={saving}
                            size="small"
                            sx={{ fontSize: '12px', textTransform: 'none' }}
                        >
                            {saving ? <CircularProgress size={16} color="inherit" /> : 'Delete Address'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default EditCustomer; 