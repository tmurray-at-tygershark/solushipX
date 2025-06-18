import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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
    Container,
    Link as MuiLink,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Save as SaveIcon,
    ArrowBack as ArrowBackIcon,
    ContentCopy as ContentCopyIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { collection, query, where, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSnackbar } from 'notistack';
import { useCompany } from '../../contexts/CompanyContext';
import { isValidCustomerID, isValidEmail } from '../../utils/validationUtils';
import ModalHeader from '../common/ModalHeader';
import DestinationAddressDialog from './DestinationAddressDialog';
import './EditCustomer.css';

const initialCustomerFormData = {
    customerID: '',
    name: '',
    status: 'active',
    companyID: '',
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

// Customer ID generation helper functions
const generateCustomerIDFromName = (name) => {
    if (!name || typeof name !== 'string') return '';

    // Clean the name - remove special characters and extra spaces
    const cleanName = name.trim().replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ');

    if (!cleanName) return '';

    const words = cleanName.split(' ').filter(word => word.length > 0);

    if (words.length === 0) return '';

    let generatedID = '';

    if (words.length === 1) {
        // Single word - take first 3 characters
        generatedID = words[0].substring(0, 3).toUpperCase();
    } else if (words.length === 2) {
        // Two words - take first letter of each word
        generatedID = (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    } else {
        // Three or more words - take first letter of first 3 words
        generatedID = (words[0].charAt(0) + words[1].charAt(0) + words[2].charAt(0)).toUpperCase();
    }

    return generatedID;
};

const checkCustomerIDExists = async (customerID, companyID, excludeId = null) => {
    try {
        const q = query(
            collection(db, 'customers'),
            where('companyID', '==', companyID),
            where('customerID', '==', customerID.trim())
        );
        const querySnapshot = await getDocs(q);

        if (excludeId) {
            // Filter out the document we're excluding (for edits)
            return querySnapshot.docs.some(doc => doc.id !== excludeId);
        }

        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking customer ID existence:', error);
        return false;
    }
};

const generateUniqueCustomerID = async (companyName, companyID, excludeId = null) => {
    const baseID = generateCustomerIDFromName(companyName);
    if (!baseID) return '';

    let candidateID = baseID;
    let counter = 1;

    // Check if base ID is available
    while (await checkCustomerIDExists(candidateID, companyID, excludeId)) {
        candidateID = `${baseID}${counter}`;
        counter++;

        // Prevent infinite loop
        if (counter > 999) {
            throw new Error('Unable to generate unique Customer ID');
        }
    }

    return candidateID;
};

const AddCustomer = ({ isModal = false, hideModalHeader = false, onBackToTable = null, onCustomerCreated = null }) => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { companyIdForAddress } = useCompany();

    const [customerData, setCustomerData] = useState(() => ({
        ...initialCustomerFormData,
        companyID: companyIdForAddress || ''
    }));
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [isGeneratingCustomerID, setIsGeneratingCustomerID] = useState(false);

    // Destination addresses state
    const [destinationAddresses, setDestinationAddresses] = useState([]);
    const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
    const [addressToDelete, setAddressToDelete] = useState(null);

    useEffect(() => {
        // Pre-fill companyID if available from context when component mounts
        if (companyIdForAddress) {
            setCustomerData(prev => ({ ...prev, companyID: companyIdForAddress }));
        }
    }, [companyIdForAddress]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;

        // Use functional update to avoid race conditions
        setCustomerData(prev => {
            const updated = { ...prev, [name]: value };

            // Auto-generate customer ID when name changes
            if (name === 'name' && value.trim()) {
                handleGenerateCustomerID(value.trim());
            }

            // Auto-populate company name in main contact if not manually set
            if (name === 'name' && value.trim() && !prev.mainContact_companyName) {
                updated.mainContact_companyName = value.trim();
            }

            // Auto-populate attention field from first and last name
            if (name === 'mainContact_firstName' || name === 'mainContact_lastName') {
                const firstName = name === 'mainContact_firstName' ? value : prev.mainContact_firstName;
                const lastName = name === 'mainContact_lastName' ? value : prev.mainContact_lastName;
                const fullName = `${firstName || ''} ${lastName || ''}`.trim();
                if (fullName) {
                    updated.mainContact_attention = fullName;
                }
            }

            return updated;
        });

        // Clear errors for the changed field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    // Handle customer ID generation
    const handleGenerateCustomerID = async (companyName) => {
        if (!companyName || !companyIdForAddress) return;

        setIsGeneratingCustomerID(true);
        try {
            const generatedID = await generateUniqueCustomerID(companyName, companyIdForAddress);
            if (generatedID) {
                setCustomerData(prev => ({ ...prev, customerID: generatedID }));
                // Clear any existing customerID error
                if (errors.customerID) {
                    setErrors(prev => ({ ...prev, customerID: null }));
                }
            }
        } catch (error) {
            console.error('Error generating customer ID:', error);
            enqueueSnackbar('Failed to generate unique Customer ID', { variant: 'warning' });
        } finally {
            setIsGeneratingCustomerID(false);
        }
    };

    const validateForm = async () => {
        const newErrors = {};

        // Customer ID validation
        if (!customerData.customerID?.trim()) {
            newErrors.customerID = 'Customer ID is required.';
        } else if (!isValidCustomerID(customerData.customerID.trim())) {
            newErrors.customerID = 'Customer ID must be 2-12 alphanumeric characters (no spaces or special characters).';
        } else {
            // Check uniqueness
            const idExists = await checkCustomerIDExists(customerData.customerID.trim(), customerData.companyID);
            if (idExists) {
                newErrors.customerID = 'This Customer ID is already in use. Please choose a different one.';
            }
        }

        // Company name validation
        if (!customerData.name?.trim()) {
            newErrors.name = 'Customer / Company Name is required.';
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

        // Address validation (required for main contact)
        if (!customerData.mainContact_street?.trim()) {
            newErrors.mainContact_street = 'Main Contact Street is required.';
        }
        if (!customerData.mainContact_city?.trim()) {
            newErrors.mainContact_city = 'Main Contact City is required.';
        }
        if (!customerData.mainContact_state?.trim()) {
            newErrors.mainContact_state = 'Main Contact State is required.';
        }
        if (!customerData.mainContact_postalCode?.trim()) {
            newErrors.mainContact_postalCode = 'Main Contact Postal Code is required.';
        }
        if (!customerData.mainContact_country?.trim()) {
            newErrors.mainContact_country = 'Main Contact Country is required.';
        }

        // Company ID validation
        if (!customerData.companyID) {
            newErrors.companyID = 'System Error: Company association is missing. Please re-login or contact support.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Address handling functions
    const handleOpenAddressDialog = (address = null) => {
        setEditingAddress(address);
        setIsAddressDialogOpen(true);
    };

    const handleCloseAddressDialog = () => {
        setIsAddressDialogOpen(false);
        setEditingAddress(null);
    };

    const handleSaveAddress = async (addressData) => {
        try {
            if (editingAddress) {
                // Update existing address
                setDestinationAddresses(prev =>
                    prev.map(addr => addr.tempId === editingAddress.tempId ?
                        { ...addressData, tempId: editingAddress.tempId } : addr
                    )
                );
            } else {
                // Add new address with temporary ID
                const newAddress = {
                    ...addressData,
                    tempId: Date.now() + Math.random() // Temporary ID for local state
                };
                setDestinationAddresses(prev => [...prev, newAddress]);
            }
            handleCloseAddressDialog();
        } catch (error) {
            console.error('Error saving address:', error);
            enqueueSnackbar('Failed to save address', { variant: 'error' });
        }
    };

    const handleDeleteAddress = async (tempId) => {
        try {
            setDestinationAddresses(prev => prev.filter(addr => addr.tempId !== tempId));
            setIsConfirmDeleteDialogOpen(false);
            setAddressToDelete(null);
            enqueueSnackbar('Address deleted successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error deleting address:', error);
            enqueueSnackbar('Failed to delete address', { variant: 'error' });
        }
    };

    const openConfirmDeleteDialog = (tempId) => {
        setAddressToDelete(tempId);
        setIsConfirmDeleteDialogOpen(true);
    };

    const handleSave = async () => {
        if (!await validateForm()) return;
        setSaving(true);

        const userDefinedCustomerID = customerData.customerID.trim();

        console.log('AddCustomer: Current customerData state:', JSON.parse(JSON.stringify(customerData)));

        const customerCoreData = {
            customerID: userDefinedCustomerID,
            name: customerData.name?.trim(),
            status: customerData.status,
            companyID: customerData.companyID,
            // Main contact information stored directly in customer record
            contactName: `${customerData.mainContact_firstName || ''} ${customerData.mainContact_lastName || ''}`.trim(),
            email: customerData.mainContact_email?.trim(),
            phone: customerData.mainContact_phone?.trim(),
            type: 'business', // Default type for new customers
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const mainContactAddressDataForBook = {
            addressClass: 'customer',
            addressClassID: userDefinedCustomerID,
            addressType: 'contact',
            status: 'active',
            nickname: customerData.mainContact_nickname?.trim() || 'Main Contact',
            firstName: customerData.mainContact_firstName?.trim(),
            lastName: customerData.mainContact_lastName?.trim(),
            email: customerData.mainContact_email?.trim(),
            phone: customerData.mainContact_phone?.trim(),
            companyName: customerData.mainContact_companyName?.trim() || customerData.name?.trim(),
            attention: customerData.mainContact_attention?.trim() || `${customerData.mainContact_firstName || ''} ${customerData.mainContact_lastName || ''}`.trim(),
            // Use field names that match CustomerDetail expectations
            address1: customerData.mainContact_street?.trim(),
            address2: customerData.mainContact_street2?.trim(),
            street: customerData.mainContact_street?.trim(), // Keep both for compatibility
            street2: customerData.mainContact_street2?.trim(),
            city: customerData.mainContact_city?.trim(),
            stateProv: customerData.mainContact_state?.trim(),
            state: customerData.mainContact_state?.trim(), // Keep both for compatibility
            zipPostal: customerData.mainContact_postalCode?.trim(),
            postalCode: customerData.mainContact_postalCode?.trim(), // Keep both for compatibility
            country: customerData.mainContact_country?.trim(),
            specialInstructions: customerData.mainContact_specialInstructions?.trim(),
            isDefault: false,
            companyID: customerData.companyID,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // Create default destination address (same as main contact)
        const defaultDestinationAddressData = {
            ...mainContactAddressDataForBook,
            addressType: 'destination',
            nickname: 'Primary Destination',
            isDefault: true,
        };

        console.log('AddCustomer: Customer core data to save:', JSON.parse(JSON.stringify(customerCoreData)));
        console.log('AddCustomer: Main contact address data to save:', JSON.parse(JSON.stringify(mainContactAddressDataForBook)));
        console.log('AddCustomer: Default destination address data to save:', JSON.parse(JSON.stringify(defaultDestinationAddressData)));

        try {
            const newCustomerDocRef = await addDoc(collection(db, 'customers'), customerCoreData);
            const newCustomerFirestoreId = newCustomerDocRef.id;
            console.log('AddCustomer: Customer created with ID:', newCustomerFirestoreId);

            // Create main contact address book entry
            const contactAddressRef = await addDoc(collection(db, 'addressBook'), mainContactAddressDataForBook);
            console.log('AddCustomer: Main contact address created with ID:', contactAddressRef.id);

            // Create default destination address (main contact as shipping location) only if no custom addresses were added
            if (destinationAddresses.length === 0) {
                const destinationAddressRef = await addDoc(collection(db, 'addressBook'), defaultDestinationAddressData);
                console.log('AddCustomer: Default destination address created with ID:', destinationAddressRef.id);
            }

            // Create custom destination addresses if any were added
            if (destinationAddresses.length > 0) {
                console.log('AddCustomer: Creating custom destination addresses:', destinationAddresses.length);
                for (const address of destinationAddresses) {
                    const customDestinationData = {
                        addressClass: 'customer',
                        addressClassID: userDefinedCustomerID,
                        addressType: 'destination',
                        status: 'active',
                        nickname: address.nickname || 'Delivery Location',
                        firstName: address.firstName || '',
                        lastName: address.lastName || '',
                        email: address.email || '',
                        phone: address.phone || '',
                        companyName: address.companyName || '',
                        attention: address.attention || '',
                        // Use field names that match CustomerDetail expectations
                        address1: address.street || '',
                        address2: address.street2 || '',
                        street: address.street || '', // Keep both for compatibility
                        street2: address.street2 || '',
                        city: address.city || '',
                        stateProv: address.state || '',
                        state: address.state || '', // Keep both for compatibility
                        zipPostal: address.postalCode || '',
                        postalCode: address.postalCode || '', // Keep both for compatibility
                        country: address.country || 'US',
                        specialInstructions: address.specialInstructions || '',
                        isDefault: address.isDefault || false,
                        companyID: customerData.companyID,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };

                    const customAddressRef = await addDoc(collection(db, 'addressBook'), customDestinationData);
                    console.log('AddCustomer: Custom destination address created with ID:', customAddressRef.id);
                }
            }

            const addressMessage = destinationAddresses.length > 0
                ? `Customer created successfully with ${destinationAddresses.length} destination address${destinationAddresses.length > 1 ? 'es' : ''}!`
                : 'Customer created successfully with default shipping location!';
            enqueueSnackbar(addressMessage, { variant: 'success' });

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

    const handleCancel = () => {
        if (isModal && onBackToTable) {
            onBackToTable();
        } else {
            navigate('/customers');
        }
    };

    return (
        <Box sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white'
        }}>
            {/* Modal Header - show when used as standalone modal (but not when hideModalHeader is true) */}
            {isModal && !hideModalHeader && (
                <ModalHeader
                    title="Create New Customer"
                    onBack={onBackToTable || (() => navigate('/customers'))}
                    onClose={onBackToTable}
                    showBackButton={true}
                    showCloseButton={!!onBackToTable}
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
                        <Typography color="text.primary">Create New Customer</Typography>
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
                {/* Customer Header - show in modal modes */}
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
                                Create New Customer
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                                Add a new customer with contact information and address details
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleCancel}
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
                                disabled={saving || isGeneratingCustomerID}
                                sx={{ fontSize: '12px', textTransform: 'none' }}
                            >
                                {saving ? 'Creating...' : 'Create Customer'}
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
                                Create New Customer
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                                <Button
                                    variant="outlined"
                                    onClick={handleCancel}
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
                                    disabled={saving || isGeneratingCustomerID}
                                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                    size="small"
                                    sx={{ fontSize: '12px', textTransform: 'none' }}
                                >
                                    {saving ? 'Creating...' : 'Create Customer'}
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
                                disabled={saving}
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
                                label="Customer ID (2-12 chars, alphanumeric)"
                                name="customerID"
                                value={customerData.customerID}
                                onChange={handleInputChange}
                                error={!!errors.customerID}
                                helperText={errors.customerID || 'Auto-generated from company name, but can be edited'}
                                fullWidth
                                required
                                disabled={saving || isGeneratingCustomerID}
                                size="small"
                                inputProps={{
                                    maxLength: 12,
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
                                        disabled={saving}
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
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b', mb: 3 }}>
                        This contact information will also be used as the default shipping destination for this customer.
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
                                disabled={saving}
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
                                disabled={saving}
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
                                disabled={saving}
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
                                disabled={saving}
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
                                disabled={saving}
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
                                required
                                disabled={saving}
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
                                disabled={saving}
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
                                required
                                disabled={saving}
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
                                required
                                disabled={saving}
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
                                required
                                disabled={saving}
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
                            <FormControl fullWidth error={!!errors.mainContact_country} disabled={saving} size="small">
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
                        <Grid item xs={12}>
                            <TextField
                                label="Special Instructions"
                                name="mainContact_specialInstructions"
                                value={customerData.mainContact_specialInstructions}
                                onChange={handleInputChange}
                                helperText="Optional delivery instructions or notes"
                                fullWidth
                                multiline
                                rows={2}
                                disabled={saving}
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
                            disabled={saving}
                            size="small"
                            sx={{ fontSize: '12px', textTransform: 'none' }}
                        >
                            Add Address
                        </Button>
                    </Box>

                    <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                        {destinationAddresses.length === 0
                            ? "No additional addresses added. The main contact address will be used as the default shipping location."
                            : `${destinationAddresses.length} destination address${destinationAddresses.length > 1 ? 'es' : ''} added.`
                        }
                    </Alert>

                    {destinationAddresses.length > 0 && (
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
                                        <TableRow key={addr.tempId || index} hover>
                                            <TableCell>{addr.nickname || 'N/A'}</TableCell>
                                            <TableCell>{addr.companyName || 'N/A'}</TableCell>
                                            <TableCell sx={{ fontSize: '12px', lineHeight: '1.4' }}>
                                                {addr.street || ''}
                                                {addr.street2 ? <><br />{addr.street2}</> : ''}
                                                <br />
                                                {`${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}`}
                                                <br />
                                                {addr.country || ''}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', lineHeight: '1.4' }}>
                                                {`${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A'}
                                                {addr.email ? <><br />{addr.email}</> : <><br />N/A</>}
                                                {addr.phone ? <><br />{addr.phone}</> : <><br />N/A</>}
                                            </TableCell>
                                            <TableCell>
                                                {addr.isDefault ?
                                                    <Chip label="Yes" color="primary" size="small" sx={{ fontSize: '10px' }} /> :
                                                    <Chip label="No" variant="outlined" size="small" sx={{ fontSize: '10px' }} />
                                                }
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenAddressDialog(addr)}
                                                    disabled={saving}
                                                    title="Edit Address"
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => openConfirmDeleteDialog(addr.tempId)}
                                                    disabled={saving}
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
                    key={editingAddress ? editingAddress.tempId || `addr-${Date.now()}` : 'new-address-dialog'}
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

export default AddCustomer; 