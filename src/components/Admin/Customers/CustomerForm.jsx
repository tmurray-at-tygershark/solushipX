import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Alert,
    CircularProgress,
    Autocomplete,
    Stack,
    Avatar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Save as SaveIcon,
    Cancel as CancelIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
    CloudUpload as CloudUploadIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    LocationOn as LocationOnIcon,
    Add as AddIcon,
    Check as CheckIcon,
    Tag as TagIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import {
    doc,
    getDoc,
    addDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getApp } from 'firebase/app';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../../contexts/AuthContext';

import AdminBreadcrumb from '../AdminBreadcrumb';

const generateCustomerIDFromName = (name) => {
    if (!name) return '';

    // Remove common business words and clean the name
    const cleanName = name
        .replace(/\b(inc|llc|ltd|corp|corporation|company|co|group|enterprises|solutions|services|systems|technologies|tech)\b/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();

    // Take first 3-4 characters from each significant word
    const words = cleanName.split(/\s+/).filter(word => word.length > 0);
    let customerID = '';

    if (words.length === 1) {
        customerID = words[0].substring(0, 6).toUpperCase();
    } else if (words.length === 2) {
        customerID = words[0].substring(0, 3).toUpperCase() + words[1].substring(0, 3).toUpperCase();
    } else {
        customerID = words.slice(0, 3).map(word => word.substring(0, 2)).join('').toUpperCase();
    }

    return customerID;
};

const checkCustomerIDExists = async (customerID, companyID, excludeId = null) => {
    if (!customerID || !companyID) return false;

    try {
        const customersRef = collection(db, 'customers');
        let q = query(
            customersRef,
            where('customerID', '==', customerID),
            where('companyID', '==', companyID)
        );

        const querySnapshot = await getDocs(q);

        // If we're editing, exclude the current customer from the check
        if (excludeId) {
            return querySnapshot.docs.some(doc => doc.id !== excludeId);
        }

        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking customer ID:', error);
        return false;
    }
};

const generateUniqueCustomerID = async (customerName, companyID, excludeId = null) => {
    const baseID = generateCustomerIDFromName(customerName);
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

const CustomerForm = () => {
    const { id: customerFirestoreId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { user, userRole } = useAuth();
    const isEditMode = Boolean(customerFirestoreId);

    const [pageLoading, setPageLoading] = useState(isEditMode);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        customerID: '',
        status: 'active',
        companyID: '',
        selectedCompany: null,
        contactEmail: '',
        dispatchEmail: '',
        billingEmail: '',
        website: '',
        logoUrl: ''
    });

    const [companies, setCompanies] = useState([]);
    const [customerIdError, setCustomerIdError] = useState('');
    const [isCheckingCustomerId, setIsCheckingCustomerId] = useState(false);
    const [isGeneratingCustomerId, setIsGeneratingCustomerId] = useState(false);

    // Logo upload states
    const [selectedLogo, setSelectedLogo] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [logoError, setLogoError] = useState('');



    // Success dialog states
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [createdCustomer, setCreatedCustomer] = useState(null);

    // Form dirty state for sticky bottom bar
    const [isFormDirty, setIsFormDirty] = useState(false);

    // Form validation state
    const [isFormValid, setIsFormValid] = useState(false);

    // Load companies for selection
    const loadCompanies = useCallback(async () => {
        try {
            let companiesQuery;
            let connectedCompanyIds = [];

            if (userRole === 'superadmin') {
                // Super admins can see all companies
                companiesQuery = query(
                    collection(db, 'companies'),
                    orderBy('name', 'asc')
                );
            } else if (userRole === 'admin') {
                // Admins can see companies they're connected to
                const userDoc = await getDocs(
                    query(collection(db, 'users'), where('uid', '==', user.uid))
                );

                if (!userDoc.empty) {
                    const userData = userDoc.docs[0].data();
                    connectedCompanyIds = userData.connectedCompanies?.companies || [];

                    if (connectedCompanyIds.length > 0) {
                        companiesQuery = query(
                            collection(db, 'companies'),
                            where('companyID', 'in', connectedCompanyIds),
                            orderBy('name', 'asc')
                        );
                    } else {
                        setCompanies([]);
                        return;
                    }
                } else {
                    setCompanies([]);
                    return;
                }
            } else {
                // Regular users shouldn't access this page
                setCompanies([]);
                return;
            }

            const companiesSnapshot = await getDocs(companiesQuery);
            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setCompanies(companiesData);
        } catch (error) {
            console.error('Error loading companies:', error);
            enqueueSnackbar('Failed to load companies', { variant: 'error' });
        }
    }, [user, userRole]);

    // Load customer data for editing
    const loadCustomerData = useCallback(async () => {
        if (!isEditMode) return;

        try {
            setPageLoading(true);

            // Fetch customer data
            const customerDoc = await getDoc(doc(db, 'customers', customerFirestoreId));
            if (!customerDoc.exists()) {
                setError('Customer not found');
                return;
            }

            const customerData = customerDoc.data();

            // Find the selected company
            const selectedCompany = companies.find(c => c.companyID === customerData.companyID);

            setFormData({
                name: customerData.name || '',
                customerID: customerData.customerID || '',
                status: customerData.status || 'active',
                companyID: customerData.companyID || '',
                selectedCompany: selectedCompany || null,
                contactEmail: customerData.contactEmail || '',
                dispatchEmail: customerData.dispatchEmail || '',
                billingEmail: customerData.billingEmail || '',
                website: customerData.website || '',
                logoUrl: customerData.logoUrl || ''
            });

            // Set logo preview if exists
            if (customerData.logoUrl) {
                setLogoPreview(customerData.logoUrl);
            }

        } catch (error) {
            console.error('Error loading customer data:', error);
            setError(error.message);
        } finally {
            setPageLoading(false);
        }
    }, [isEditMode, customerFirestoreId, companies]);

    // Load data on component mount
    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    useEffect(() => {
        if (companies.length > 0) {
            loadCustomerData();
        }
    }, [companies, loadCustomerData]);

    // Auto-generate customer ID when name changes
    useEffect(() => {
        if (formData.name && formData.companyID && !isEditMode) {
            const timeoutId = setTimeout(async () => {
                setIsGeneratingCustomerId(true);
                try {
                    const uniqueId = await generateUniqueCustomerID(
                        formData.name,
                        formData.companyID
                    );
                    handleFormChange('customerID', uniqueId);
                } catch (error) {
                    console.error('Error auto-generating customer ID:', error);
                } finally {
                    setIsGeneratingCustomerId(false);
                }
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [formData.name, formData.companyID, isEditMode]);

    // Validate form whenever key fields change
    useEffect(() => {
        const validateForm = () => {
            // Required fields check
            const hasCompany = !!formData.selectedCompany;
            const hasCustomerName = !!formData.name.trim();
            const hasNoCustomerIdError = !customerIdError;
            const hasCustomerId = !!formData.customerID.trim();

            // Form is valid if all required fields are filled and no errors
            const isValid = hasCompany && hasCustomerName && hasNoCustomerIdError && hasCustomerId;
            setIsFormValid(isValid);
        };

        validateForm();
    }, [formData.selectedCompany, formData.name, formData.customerID, customerIdError]);

    // Handle form field changes
    const handleFormChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Mark form as dirty
        setIsFormDirty(true);

        // Clear customer ID error when relevant fields change
        if (field === 'customerID' || field === 'companyID') {
            setCustomerIdError('');
        }
    };

    // Handle company selection
    const handleCompanyChange = (event, newValue) => {
        setFormData(prev => ({
            ...prev,
            selectedCompany: newValue,
            companyID: newValue ? newValue.companyID : ''
        }));
        setIsFormDirty(true);
        setCustomerIdError('');
    };

    // Logo upload handlers
    const handleLogoSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setLogoError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setLogoError('Logo file size must be less than 5MB');
            return;
        }

        setLogoError('');
        setSelectedLogo(file);
        setIsFormDirty(true);

        // Create preview URL
        const reader = new FileReader();
        reader.onload = (e) => {
            setLogoPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    };



    const handleLogoDelete = async () => {
        try {
            if (formData.logoUrl) {
                // Delete from Firebase Storage if it's a Firebase URL
                if (formData.logoUrl.includes('firebasestorage.googleapis.com')) {
                    const firebaseApp = getApp();
                    const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
                    const logoRef = ref(customStorage, formData.logoUrl);
                    await deleteObject(logoRef);
                }
            }

            setFormData(prev => ({ ...prev, logoUrl: '' }));
            setLogoPreview('');
            setSelectedLogo(null);
            setIsFormDirty(true);
            enqueueSnackbar('Logo removed successfully!', { variant: 'success' });
        } catch (error) {
            console.error('Error deleting logo:', error);
            enqueueSnackbar('Error removing logo: ' + error.message, { variant: 'error' });
        }
    };



    // Validate customer ID
    const validateCustomerId = async (customerID) => {
        if (!customerID || !formData.companyID) return;

        setIsCheckingCustomerId(true);
        try {
            const exists = await checkCustomerIDExists(
                customerID,
                formData.companyID,
                isEditMode ? customerFirestoreId : null
            );
            if (exists) {
                setCustomerIdError('Customer ID already exists for this company');
            } else {
                setCustomerIdError('');
            }
        } catch (error) {
            console.error('Error validating customer ID:', error);
        } finally {
            setIsCheckingCustomerId(false);
        }
    };

    // Handle customer ID change
    useEffect(() => {
        if (formData.customerID && formData.companyID) {
            const timeoutId = setTimeout(() => {
                validateCustomerId(formData.customerID);
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [formData.customerID, formData.companyID]);



    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation - only required fields
        if (!formData.name.trim()) {
            enqueueSnackbar('Customer name is required', { variant: 'error' });
            return;
        }
        if (!formData.companyID) {
            enqueueSnackbar('Please select a company', { variant: 'error' });
            return;
        }

        // Auto-generate Customer ID if not present (for new customers)
        let customerID = formData.customerID;
        if (!customerID && !isEditMode) {
            setIsGeneratingCustomerId(true);
            try {
                customerID = await generateUniqueCustomerID(
                    formData.name,
                    formData.companyID
                );
                handleFormChange('customerID', customerID);
            } catch (error) {
                console.error('Error generating customer ID:', error);
                enqueueSnackbar('Failed to generate customer ID', { variant: 'error' });
                setIsGeneratingCustomerId(false);
                return;
            }
            setIsGeneratingCustomerId(false);
        }

        if (customerIdError) {
            enqueueSnackbar('Please fix customer ID error', { variant: 'error' });
            return;
        }

        setSaveLoading(true);
        try {
            let logoUrl = formData.logoUrl;

            // Upload logo if a new file is selected
            if (selectedLogo && customerID) {
                try {
                    const firebaseApp = getApp();
                    const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
                    const fileExtension = selectedLogo.name.split('.').pop();
                    const fileName = `${customerID}-${Date.now()}.${fileExtension}`;
                    const logoRef = ref(customStorage, `customer-logos/${fileName}`);

                    // Upload file
                    const snapshot = await uploadBytes(logoRef, selectedLogo);
                    logoUrl = await getDownloadURL(snapshot.ref);
                } catch (logoError) {
                    console.error('Error uploading logo:', logoError);
                    enqueueSnackbar('Warning: Logo upload failed, but customer will be saved without logo', { variant: 'warning' });
                }
            }

            const customerData = {
                name: formData.name.trim(),
                customerID: customerID.trim(),
                status: formData.status,
                companyID: formData.companyID,
                contactEmail: formData.contactEmail.trim(),
                dispatchEmail: formData.dispatchEmail.trim(),
                billingEmail: formData.billingEmail.trim(),
                website: formData.website.trim(),
                logoUrl: logoUrl,
                updatedAt: serverTimestamp()
            };

            if (isEditMode) {
                // Update existing customer
                await updateDoc(doc(db, 'customers', customerFirestoreId), customerData);
                setIsFormDirty(false);
                enqueueSnackbar('Customer updated successfully!', { variant: 'success' });
                navigate(`/admin/customers/${customerFirestoreId}`);
            } else {
                // Create new customer
                customerData.createdAt = serverTimestamp();
                const customerDocRef = await addDoc(collection(db, 'customers'), customerData);

                // Store created customer data for success dialog
                setCreatedCustomer({
                    id: customerDocRef.id,
                    name: customerData.name,
                    customerID: customerID,
                    companyName: formData.selectedCompany?.name || 'Unknown Company'
                });

                // Reset form dirty state and show success dialog
                setIsFormDirty(false);
                setShowSuccessDialog(true);
            }
        } catch (error) {
            console.error('Error saving customer:', error);
            enqueueSnackbar('Error saving customer: ' + error.message, { variant: 'error' });
        } finally {
            setSaveLoading(false);
        }
    };

    // Handle success dialog actions
    const handleCreateAnother = () => {
        setShowSuccessDialog(false);
        setCreatedCustomer(null);
        // Reset form for new customer
        setFormData({
            name: '',
            customerID: '',
            status: 'active',
            companyID: '',
            selectedCompany: null,
            contactEmail: '',
            dispatchEmail: '',
            billingEmail: '',
            website: '',
            logoUrl: ''
        });
        setLogoPreview('');
        setSelectedLogo(null);
        setCustomerIdError('');
        setIsFormDirty(false);
        enqueueSnackbar('Ready to create another customer', { variant: 'info' });
    };

    const handleAddAddress = () => {
        setShowSuccessDialog(false);
        // Navigate to customer detail and trigger address creation
        navigate(`/admin/customers/${createdCustomer.id}`, {
            state: { showAddAddressDialog: true }
        });
    };

    const handleGoToCustomer = () => {
        setShowSuccessDialog(false);
        navigate(`/admin/customers/${createdCustomer.id}`);
    };

    if (pageLoading) {
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
                            {isEditMode ? 'Edit Customer' : 'Add New Customer'}
                        </Typography>
                        <AdminBreadcrumb />
                    </Box>

                </Box>
            </Box>

            {/* Content Section */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3, pb: 12 }}>
                <form onSubmit={handleSubmit}>
                    {/* Company Selection Section */}
                    <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fefefe' }}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" sx={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 1
                            }}>
                                <BusinessIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                                Company Assignment
                            </Typography>
                        </Box>

                        <Autocomplete
                            options={companies}
                            getOptionLabel={(option) => option.name}
                            value={formData.selectedCompany}
                            onChange={handleCompanyChange}
                            renderOption={(props, option) => (
                                <Box component="li" {...props} sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    p: 1.5,
                                    '&:hover': {
                                        backgroundColor: '#f3f4f6'
                                    }
                                }}>
                                    <Avatar
                                        src={option.logoUrl}
                                        sx={{
                                            width: 28,
                                            height: 28,
                                            border: '1px solid #d1d5db'
                                        }}
                                    >
                                        <BusinessIcon sx={{ fontSize: 16 }} />
                                    </Avatar>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>{option.name}</Typography>
                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                            {option.companyID || 'No ID'}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Select Company"
                                    placeholder="Search and select a company..."
                                    required
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                        '& .MuiOutlinedInput-root': {
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#6366f1'
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#6366f1'
                                            }
                                        }
                                    }}
                                />
                            )}
                            size="small"
                        />
                    </Paper>



                    {/* Customer Information Section */}
                    <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fefefe' }}>

                        {/* Two Column Layout: Logo + Form Fields */}
                        <Grid container spacing={4}>
                            {/* Left Column - Enhanced Logo Section */}
                            <Grid item xs={12} md={6}>
                                <Box sx={{
                                    border: logoPreview ? '2px solid #6366f1' : '2px dashed #d1d5db',
                                    borderRadius: '12px',
                                    p: 3,
                                    backgroundColor: logoPreview ? '#f8fafc' : '#f9fafb',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        borderColor: '#6366f1',
                                        backgroundColor: '#f8fafc'
                                    }
                                }}>
                                    {/* Clickable Logo Upload Area */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoSelect}
                                        style={{ display: 'none' }}
                                        id="logo-file-input"
                                    />
                                    <label htmlFor="logo-file-input" style={{ cursor: 'pointer' }}>
                                        <Box sx={{
                                            width: 140,
                                            height: 140,
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#ffffff',
                                            mb: 3,
                                            overflow: 'hidden',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                borderColor: '#6366f1',
                                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                                                transform: 'translateY(-2px)'
                                            }
                                        }}>
                                            {logoPreview ? (
                                                <>
                                                    <img
                                                        src={logoPreview}
                                                        alt="Customer Logo"
                                                        style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '100%',
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        top: 8,
                                                        right: 8,
                                                        backgroundColor: '#10b981',
                                                        borderRadius: '50%',
                                                        width: 24,
                                                        height: 24,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <CheckIcon sx={{ fontSize: 16, color: 'white' }} />
                                                    </Box>
                                                    {/* Hover overlay for changing logo */}
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        opacity: 0,
                                                        transition: 'opacity 0.3s ease',
                                                        '&:hover': {
                                                            opacity: 1
                                                        }
                                                    }}>
                                                        <Box sx={{ textAlign: 'center', color: 'white' }}>
                                                            <CloudUploadIcon sx={{ fontSize: 32, mb: 1 }} />
                                                            <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                                                Click to change
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </>
                                            ) : (
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <CloudUploadIcon sx={{ fontSize: 48, color: '#6366f1', mb: 1 }} />
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6366f1', fontWeight: 500 }}>
                                                        Click to upload logo
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </label>

                                    {/* Remove Logo Button (only when logo exists) */}
                                    {logoPreview && (
                                        <Stack direction="row" spacing={1} sx={{ mb: 3, justifyContent: 'center' }}>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                onClick={handleLogoDelete}
                                                startIcon={<DeleteIcon />}
                                                sx={{
                                                    fontSize: '12px',
                                                    '&:hover': {
                                                        backgroundColor: '#fef2f2'
                                                    }
                                                }}
                                            >
                                                Remove Logo
                                            </Button>
                                        </Stack>
                                    )}

                                    {/* Logo Status Messages */}
                                    <Box sx={{ textAlign: 'center' }}>
                                        {logoError && (
                                            <Alert severity="error" sx={{ mt: 2, fontSize: '11px' }}>
                                                {logoError}
                                            </Alert>
                                        )}

                                        {selectedLogo && (
                                            <Alert severity="success" sx={{ mt: 2, fontSize: '11px' }}>
                                                ✅ Logo ready! Will upload when you save.
                                            </Alert>
                                        )}
                                    </Box>
                                </Box>
                            </Grid>

                            {/* Right Column - Enhanced Form Fields */}
                            <Grid item xs={12} md={6}>
                                <Box sx={{ height: '100%' }}>
                                    <Grid container spacing={3}>
                                        {/* Customer Name */}
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Customer Name"
                                                placeholder="Enter customer or business name..."
                                                value={formData.name}
                                                onChange={(e) => handleFormChange('name', e.target.value)}
                                                required
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiOutlinedInput-root': {
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        },
                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        }
                                                    }
                                                }}
                                            />
                                        </Grid>

                                        {/* Auto-Generated Customer ID Display */}
                                        {formData.customerID && (
                                            <Grid item xs={12}>
                                                <Box sx={{
                                                    backgroundColor: '#f0f9ff',
                                                    border: '2px solid #bfdbfe',
                                                    borderRadius: '8px',
                                                    p: 2.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2
                                                }}>
                                                    <Box sx={{
                                                        backgroundColor: '#3b82f6',
                                                        borderRadius: '50%',
                                                        width: 32,
                                                        height: 32,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <TagIcon sx={{ fontSize: 16, color: 'white' }} />
                                                    </Box>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#1e40af', fontWeight: 500 }}>
                                                            Auto-Generated Customer ID
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ fontSize: '14px', fontWeight: 600, color: '#1e3a8a' }}>
                                                            {formData.customerID}
                                                        </Typography>
                                                    </Box>
                                                    {(isCheckingCustomerId || isGeneratingCustomerId) && (
                                                        <CircularProgress size={20} sx={{ color: '#3b82f6' }} />
                                                    )}
                                                </Box>
                                            </Grid>
                                        )}



                                        {/* Contact Email */}
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Contact Email (Optional)"
                                                type="email"
                                                value={formData.contactEmail || ''}
                                                onChange={(e) => handleFormChange('contactEmail', e.target.value)}
                                                placeholder="contact@company.com"
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiOutlinedInput-root': {
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        },
                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        }
                                                    }
                                                }}
                                            />
                                        </Grid>

                                        {/* Dispatch Email */}
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Dispatch Email (Optional)"
                                                type="email"
                                                value={formData.dispatchEmail || ''}
                                                onChange={(e) => handleFormChange('dispatchEmail', e.target.value)}
                                                placeholder="dispatch@company.com"
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiOutlinedInput-root': {
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        },
                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        }
                                                    }
                                                }}
                                            />
                                        </Grid>

                                        {/* Billing Email */}
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Billing Email (Optional)"
                                                type="email"
                                                value={formData.billingEmail || ''}
                                                onChange={(e) => handleFormChange('billingEmail', e.target.value)}
                                                placeholder="billing@company.com"
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiOutlinedInput-root': {
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        },
                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        }
                                                    }
                                                }}
                                            />
                                        </Grid>

                                        {/* Website */}
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Website URL (Optional)"
                                                type="url"
                                                value={formData.website}
                                                onChange={(e) => handleFormChange('website', e.target.value)}
                                                placeholder="https://www.example.com"
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiOutlinedInput-root': {
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        },
                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#6366f1'
                                                        }
                                                    }
                                                }}
                                            />
                                        </Grid>


                                    </Grid>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                </form>
            </Box>

            {/* Sticky Bottom Action Bar - Hidden when success dialog is open */}
            {!showSuccessDialog && (
                <Box sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    borderTop: '1px solid #e5e7eb',
                    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
                    p: 3,
                    zIndex: 9999,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {!isFormValid ? (
                            <>
                                <Box sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: '#ef4444'
                                }} />
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                    {!formData.selectedCompany ? 'Please select a company' :
                                        !formData.name.trim() ? 'Please enter customer name' :
                                            !formData.customerID.trim() ? 'Generating customer ID...' :
                                                customerIdError ? 'Customer ID must be unique' : 'Form incomplete'}
                                </Typography>
                            </>
                        ) : isFormDirty ? (
                            <>
                                <Box sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: '#f59e0b',
                                    animation: 'pulse 2s infinite'
                                }} />
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                    You have unsaved changes
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Box sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: '#10b981'
                                }} />
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                    Ready to save your customer
                                </Typography>
                            </>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CancelIcon />}
                            onClick={() => navigate('/admin/customers')}
                            sx={{
                                fontSize: '12px',
                                minWidth: 100,
                                '&:hover': {
                                    backgroundColor: '#f3f4f6'
                                }
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SaveIcon />}
                            onClick={handleSubmit}
                            disabled={saveLoading || !isFormValid}
                            sx={{
                                fontSize: '12px',
                                minWidth: 100,
                                backgroundColor: isFormValid ? '#3b82f6' : '#9ca3af',
                                '&:hover': {
                                    backgroundColor: isFormValid ? '#2563eb' : '#9ca3af'
                                },
                                '&:disabled': {
                                    backgroundColor: '#9ca3af',
                                    color: '#ffffff'
                                }
                            }}
                        >
                            {saveLoading ? 'Saving...' : 'Save'}
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Success Dialog */}
            <Dialog
                open={showSuccessDialog}
                onClose={handleGoToCustomer}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: '#f0f9ff',
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <CheckCircleIcon sx={{ color: '#10b981', fontSize: 32 }} />
                    <Box>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                            Customer Created Successfully!
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            {createdCustomer?.name} has been added to the system
                        </Typography>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', mb: 2 }}>
                            <strong>Customer Details:</strong>
                        </Typography>
                        <Box sx={{
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            p: 2
                        }}>
                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 1 }}>
                                <strong>Name:</strong> {createdCustomer?.name}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 1 }}>
                                <strong>Customer ID:</strong> {createdCustomer?.customerID}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                <strong>Company:</strong> {createdCustomer?.companyName}
                            </Typography>
                        </Box>
                    </Box>

                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                        What would you like to do next?
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<LocationOnIcon />}
                            onClick={handleAddAddress}
                            sx={{
                                fontSize: '12px',
                                justifyContent: 'flex-start',
                                backgroundColor: '#3b82f6',
                                '&:hover': { backgroundColor: '#2563eb' }
                            }}
                        >
                            Add Address to this Customer
                        </Button>

                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleCreateAnother}
                            sx={{
                                fontSize: '12px',
                                justifyContent: 'flex-start',
                                borderColor: '#d1d5db',
                                color: '#374151',
                                '&:hover': { borderColor: '#9ca3af', backgroundColor: '#f9fafb' }
                            }}
                        >
                            Create Another Customer
                        </Button>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ p: 3, pt: 0 }}>
                    <Button
                        onClick={handleGoToCustomer}
                        variant="text"
                        size="small"
                        sx={{ fontSize: '12px', color: '#6b7280' }}
                    >
                        View Customer Details
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
};

export default CustomerForm; 