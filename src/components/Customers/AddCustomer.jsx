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
    Stack,
    Avatar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Checkbox,
    Autocomplete
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
    Tag as TagIcon,
    ArrowBack as ArrowBackIcon
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
    serverTimestamp,
    limit
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getApp } from 'firebase/app';
import { db } from '../../firebase/firebase';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

import ModalHeader from '../common/ModalHeader';

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

const AddCustomer = ({ onBackToTable = null, onCustomerCreated = null, onClose = null, isModal = false, hideModalHeader = false }) => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth();
    const { companyIdForAddress, companyData } = useCompany();

    const [pageLoading, setPageLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        customerID: '',
        status: 'active',
        companyID: companyIdForAddress || '',
        contactEmail: '',
        dispatchEmail: '',
        billingEmail: '',
        website: '',
        logoUrl: '',
        // Main Contact Information
        mainContactName: '',
        mainContactCompany: '',
        mainContactAddress1: '',
        mainContactAddress2: '',
        mainContactCity: '',
        mainContactState: '',
        mainContactPostalCode: '',
        mainContactCountry: 'CA',
        mainContactPhone: '',
        mainContactEmail: '',
        // Billing Address Information
        billingContactName: '',
        billingCompanyName: '',
        billingAddress1: '',
        billingAddress2: '',
        billingCity: '',
        billingState: '',
        billingPostalCode: '',
        billingCountry: 'CA',
        billingPhone: ''
    });

    const [customerIdError, setCustomerIdError] = useState('');
    const [isCheckingCustomerId, setIsCheckingCustomerId] = useState(false);
    const [isGeneratingCustomerId, setIsGeneratingCustomerId] = useState(false);
    const [sameAsMainContact, setSameAsMainContact] = useState(true);

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



    // Set company context on mount
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            companyID: companyIdForAddress || ''
        }));
    }, [companyIdForAddress]);

    // Auto-generate customer ID when name changes
    useEffect(() => {
        if (formData.name && formData.companyID) {
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
    }, [formData.name, formData.companyID]);

    // Validate form whenever key fields change
    useEffect(() => {
        const validateForm = () => {
            // Required fields check
            const hasCustomerName = !!formData.name.trim();
            const hasNoCustomerIdError = !customerIdError;
            const hasCustomerId = !!formData.customerID.trim();

            // Form is valid if all required fields are filled and no errors
            const isValid = hasCustomerName && hasNoCustomerIdError && hasCustomerId;
            setIsFormValid(isValid);
        };

        validateForm();
    }, [formData.name, formData.customerID, customerIdError]);

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

    // Handle "Same as Main Contact" checkbox
    const handleSameAsMainContactChange = (checked) => {
        setSameAsMainContact(checked);

        if (checked) {
            // Auto-populate billing fields from main contact
            setFormData(prev => ({
                ...prev,
                billingContactName: prev.mainContactName,
                billingCompanyName: prev.mainContactCompany || prev.name,
                billingAddress1: prev.mainContactAddress1,
                billingAddress2: prev.mainContactAddress2,
                billingCity: prev.mainContactCity,
                billingState: prev.mainContactState,
                billingPostalCode: prev.mainContactPostalCode,
                billingCountry: prev.mainContactCountry,
                billingPhone: prev.mainContactPhone
            }));
        }
    };

    // Logo upload functions
    const handleLogoSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setLogoError('Please select a valid image file.');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            setLogoError('Image must be smaller than 5MB.');
            return;
        }

        setSelectedLogo(file);
        setLogoError('');

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => setLogoPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    const handleLogoDelete = () => {
        setSelectedLogo(null);
        setLogoPreview('');
        setLogoError('');
        handleFormChange('logoUrl', '');
    };

    const uploadLogo = async () => {
        if (!selectedLogo) return null;

        try {
            const firebaseApp = getApp();
            const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
            const logoRef = ref(customStorage, `customer-logos/${Date.now()}_${selectedLogo.name}`);

            await uploadBytes(logoRef, selectedLogo);
            const downloadURL = await getDownloadURL(logoRef);

            return downloadURL;
        } catch (error) {
            console.error('Error uploading logo:', error);
            throw new Error('Failed to upload logo');
        }
    };

    // Handle save
    const handleSave = async () => {
        if (!isFormValid) {
            enqueueSnackbar('Please fill in all required fields', { variant: 'error' });
            return;
        }

        try {
            setSaveLoading(true);

            // Upload logo if selected
            let logoUrl = formData.logoUrl;
            if (selectedLogo) {
                logoUrl = await uploadLogo();
            }

            const customerData = {
                name: formData.name.trim(),
                customerID: formData.customerID.trim(),
                status: formData.status,
                companyID: formData.companyID,
                contactEmail: formData.contactEmail.trim(),
                dispatchEmail: formData.dispatchEmail.trim(),
                billingEmail: formData.billingEmail.trim(),
                website: formData.website.trim(),
                logoUrl: logoUrl,
                // Main Contact Information
                mainContactName: formData.mainContactName.trim(),
                mainContactCompany: formData.mainContactCompany.trim(),
                mainContactAddress1: formData.mainContactAddress1.trim(),
                mainContactAddress2: formData.mainContactAddress2.trim(),
                mainContactCity: formData.mainContactCity.trim(),
                mainContactState: formData.mainContactState.trim(),
                mainContactPostalCode: formData.mainContactPostalCode.trim(),
                mainContactCountry: formData.mainContactCountry,
                mainContactPhone: formData.mainContactPhone.trim(),
                mainContactEmail: formData.mainContactEmail.trim(),
                // Billing Address Information
                billingContactName: formData.billingContactName.trim(),
                billingCompanyName: formData.billingCompanyName.trim(),
                billingAddress1: formData.billingAddress1.trim(),
                billingAddress2: formData.billingAddress2.trim(),
                billingCity: formData.billingCity.trim(),
                billingState: formData.billingState.trim(),
                billingPostalCode: formData.billingPostalCode.trim(),
                billingCountry: formData.billingCountry,
                billingPhone: formData.billingPhone.trim()
            };

            // Create new customer
            customerData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, 'customers'), customerData);

            setCreatedCustomer({ id: docRef.id, ...customerData });
            setShowSuccessDialog(true);
            enqueueSnackbar('Customer created successfully!', { variant: 'success' });

            // Callback to parent if provided
            if (onCustomerCreated) {
                onCustomerCreated({ id: docRef.id, ...customerData });
            }

            setIsFormDirty(false);

        } catch (error) {
            console.error('Error saving customer:', error);
            enqueueSnackbar('Failed to save customer: ' + error.message, { variant: 'error' });
        } finally {
            setSaveLoading(false);
        }
    };

    // Handle cancel
    const handleCancel = () => {
        if (onClose) {
            onClose();
        } else if (onBackToTable) {
            onBackToTable();
        } else if (!isModal) {
            navigate('/customers');
        }
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
            {/* Modal Header */}
            {isModal && !hideModalHeader && (
                <ModalHeader
                    title="Create New Customer"
                    onClose={handleCancel}
                />
            )}

            {/* Header Section */}
            {!isModal && (
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
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
                                onClick={handleCancel}
                                size="medium"
                                sx={{
                                    fontSize: '12px',
                                    minWidth: '80px',
                                    minHeight: '36px'
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={!isFormValid || saveLoading}
                                size="medium"
                                sx={{
                                    fontSize: '12px',
                                    minWidth: '120px',
                                    minHeight: '36px',
                                    backgroundColor: '#6366f1',
                                    '&:hover': {
                                        backgroundColor: '#4f46e5'
                                    }
                                }}
                            >
                                {saveLoading ? 'Creating...' : 'Create Customer'}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Customer Header - show in modal modes */}
            {isModal && !hideModalHeader && (
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 3,
                    pt: 2,
                    px: 3,
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white',
                    zIndex: 100,
                    borderBottom: '1px solid #e5e7eb'
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
                            onClick={handleCancel}
                            size="medium"
                            sx={{
                                fontSize: '12px',
                                minWidth: '80px',
                                minHeight: '36px'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={!isFormValid || saveLoading}
                            size="medium"
                            sx={{
                                fontSize: '12px',
                                minWidth: '120px',
                                minHeight: '36px',
                                backgroundColor: '#6366f1',
                                '&:hover': {
                                    backgroundColor: '#4f46e5'
                                }
                            }}
                        >
                            {saveLoading ? 'Creating...' : 'Create Customer'}
                        </Button>
                    </Box>
                </Box>
            )}



            {/* Content Section */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Grid container spacing={3}>

                    {/* Customer Information Section */}
                    <Grid item xs={12}>
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
                                                    placeholder="Enter customer name"
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

                                            {/* Customer ID */}
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    label="Customer ID"
                                                    placeholder="Auto-generated"
                                                    value={formData.customerID}
                                                    onChange={(e) => handleFormChange('customerID', e.target.value)}
                                                    required
                                                    size="small"
                                                    error={!!customerIdError}
                                                    helperText={customerIdError || (isGeneratingCustomerId ? 'Generating ID...' : '')}
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                                        '& .MuiFormHelperText-root': { fontSize: '11px' },
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

                                            {/* Contact Email */}
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    label="Contact Email"
                                                    placeholder="contact@company.com"
                                                    type="email"
                                                    value={formData.contactEmail}
                                                    onChange={(e) => handleFormChange('contactEmail', e.target.value)}
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
                                                    label="Dispatch Email"
                                                    placeholder="dispatch@company.com"
                                                    type="email"
                                                    value={formData.dispatchEmail}
                                                    onChange={(e) => handleFormChange('dispatchEmail', e.target.value)}
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
                                                    label="Website"
                                                    placeholder="https://company.com"
                                                    value={formData.website}
                                                    onChange={(e) => handleFormChange('website', e.target.value)}
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
                    </Grid>

                    {/* Main Contact Information Section */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 3 }}>
                                Main Contact Information
                            </Typography>

                            <Grid container spacing={3}>
                                {/* Contact Name */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Contact Name"
                                        placeholder="Full name"
                                        value={formData.mainContactName}
                                        onChange={(e) => handleFormChange('mainContactName', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>

                                {/* Company Name */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Company Name"
                                        placeholder="Company name"
                                        value={formData.mainContactCompany}
                                        onChange={(e) => handleFormChange('mainContactCompany', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>

                                {/* Address 1 */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Address Line 1"
                                        placeholder="Street address"
                                        value={formData.mainContactAddress1}
                                        onChange={(e) => handleFormChange('mainContactAddress1', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>

                                {/* Address 2 */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Address Line 2"
                                        placeholder="Apt, suite, etc. (optional)"
                                        value={formData.mainContactAddress2}
                                        onChange={(e) => handleFormChange('mainContactAddress2', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>

                                {/* City */}
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="City"
                                        placeholder="City"
                                        value={formData.mainContactCity}
                                        onChange={(e) => handleFormChange('mainContactCity', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>

                                {/* State/Province */}
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="State/Province"
                                        placeholder="State/Province"
                                        value={formData.mainContactState}
                                        onChange={(e) => handleFormChange('mainContactState', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>

                                {/* Postal Code */}
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Postal Code"
                                        value={formData.mainContactPostalCode || ''}
                                        onChange={(e) => handleFormChange('mainContactPostalCode', e.target.value)}
                                        placeholder="M5V 3A8"
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

                                {/* Country */}
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        value={formData.mainContactCountry}
                                        onChange={(event, newValue) => handleFormChange('mainContactCountry', newValue)}
                                        options={['CA', 'US', 'MX']}
                                        getOptionLabel={(option) => {
                                            switch (option) {
                                                case 'CA': return 'Canada';
                                                case 'US': return 'United States';
                                                case 'MX': return 'Mexico';
                                                default: return option;
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Country"
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
                                        sx={{
                                            '& .MuiAutocomplete-listbox': {
                                                fontSize: '12px'
                                            }
                                        }}
                                    />
                                </Grid>

                                {/* Main Contact Phone */}
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Phone"
                                        value={formData.mainContactPhone || ''}
                                        onChange={(e) => handleFormChange('mainContactPhone', e.target.value)}
                                        placeholder="(416) 555-0123"
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

                                {/* Main Contact Email */}
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        type="email"
                                        value={formData.mainContactEmail || ''}
                                        onChange={(e) => handleFormChange('mainContactEmail', e.target.value)}
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
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Billing Address Information Section */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 4, border: '1px solid #e5e7eb', mt: 3 }}>
                            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <LocationOnIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                                <Typography variant="h6" sx={{ color: '#111827', fontWeight: 600, fontSize: '16px' }}>
                                    Billing Address Information
                                </Typography>
                            </Box>

                            {/* Same as Main Contact Checkbox */}
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={sameAsMainContact}
                                        onChange={(e) => handleSameAsMainContactChange(e.target.checked)}
                                        sx={{
                                            color: '#6366f1',
                                            '&.Mui-checked': {
                                                color: '#6366f1',
                                            },
                                        }}
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                        Same as Main Contact
                                    </Typography>
                                }
                                sx={{ mb: 3 }}
                            />

                            {!sameAsMainContact && (
                                <>
                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mb: 3 }}>
                                        Invoice delivery address and billing contact information for this customer.
                                    </Typography>

                                    <Grid container spacing={3}>
                                        {/* Billing Contact Name */}
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Billing Contact Name"
                                                value={formData.billingContactName || ''}
                                                onChange={(e) => handleFormChange('billingContactName', e.target.value)}
                                                placeholder="John Smith"
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

                                        {/* Billing Company Name */}
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Billing Company Name"
                                                value={formData.billingCompanyName || formData.name}
                                                onChange={(e) => handleFormChange('billingCompanyName', e.target.value)}
                                                placeholder="Company name for invoices"
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

                                        {/* Billing Address Line 1 */}
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Billing Address Line 1"
                                                value={formData.billingAddress1 || ''}
                                                onChange={(e) => handleFormChange('billingAddress1', e.target.value)}
                                                placeholder="123 Main Street"
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

                                        {/* Billing Address Line 2 */}
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Billing Address Line 2 (Optional)"
                                                value={formData.billingAddress2 || ''}
                                                onChange={(e) => handleFormChange('billingAddress2', e.target.value)}
                                                placeholder="Suite, Apt, Floor, etc."
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

                                        {/* City, State, Postal - 3 column layout */}
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                fullWidth
                                                label="City"
                                                value={formData.billingCity || ''}
                                                onChange={(e) => handleFormChange('billingCity', e.target.value)}
                                                placeholder="Toronto"
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

                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                fullWidth
                                                label="State/Province"
                                                value={formData.billingState || ''}
                                                onChange={(e) => handleFormChange('billingState', e.target.value)}
                                                placeholder="ON"
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

                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                fullWidth
                                                label="Postal Code"
                                                value={formData.billingPostalCode || ''}
                                                onChange={(e) => handleFormChange('billingPostalCode', e.target.value)}
                                                placeholder="M5V 3A8"
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

                                        {/* Country */}
                                        <Grid item xs={12} md={6}>
                                            <Autocomplete
                                                value={formData.billingCountry}
                                                onChange={(event, newValue) => handleFormChange('billingCountry', newValue)}
                                                options={['CA', 'US', 'MX']}
                                                getOptionLabel={(option) => {
                                                    switch (option) {
                                                        case 'CA': return 'Canada';
                                                        case 'US': return 'United States';
                                                        case 'MX': return 'Mexico';
                                                        default: return option;
                                                    }
                                                }}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Country"
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
                                                sx={{
                                                    '& .MuiAutocomplete-listbox': {
                                                        fontSize: '12px'
                                                    }
                                                }}
                                            />
                                        </Grid>

                                        {/* Billing Phone */}
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Billing Phone"
                                                value={formData.billingPhone || ''}
                                                onChange={(e) => handleFormChange('billingPhone', e.target.value)}
                                                placeholder="(416) 555-0123"
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
                                </>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                {/* Bottom Save Section */}
                <Grid item xs={12}>
                    <Paper sx={{
                        p: 3,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        mt: 3
                    }}>
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <Typography sx={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#374151'
                            }}>
                                Ready to create customer?
                            </Typography>
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
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleSave}
                                    disabled={!isFormValid || saveLoading}
                                    size="medium"
                                    sx={{
                                        fontSize: '12px',
                                        minWidth: '120px',
                                        minHeight: '36px',
                                        backgroundColor: '#6366f1',
                                        '&:hover': {
                                            backgroundColor: '#4f46e5'
                                        }
                                    }}
                                >
                                    {saveLoading ? 'Creating...' : 'Create Customer'}
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Box>

            {/* Success Dialog */}
            <Dialog open={showSuccessDialog} onClose={() => setShowSuccessDialog(false)}>
                <DialogTitle sx={{ textAlign: 'center', fontSize: '16px', fontWeight: 600 }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: '#10b981', mb: 2 }} />
                    Customer Created Successfully!
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                        {createdCustomer?.name} has been added to your customer database.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                    <Button
                        onClick={() => setShowSuccessDialog(false)}
                        variant="contained"
                        sx={{
                            fontSize: '12px',
                            backgroundColor: '#6366f1',
                            '&:hover': { backgroundColor: '#4f46e5' }
                        }}
                    >
                        Continue
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AddCustomer; 