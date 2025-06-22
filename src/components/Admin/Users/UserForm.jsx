import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    FormHelperText,
    Autocomplete,
    CircularProgress,
    Alert,
    Divider
} from '@mui/material';
import {
    Save as SaveIcon,
    PersonAdd as PersonAddIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { collection, updateDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import { useSnackbar } from 'notistack';
import ModalHeader from '../../common/ModalHeader';

const UserForm = ({ isModal = false, onClose = null }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const isEditMode = Boolean(id);

    // State management
    const [pageLoading, setPageLoading] = useState(isEditMode);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        role: 'user',
        status: 'active',
        phone: '',
        companies: [],
    });

    const [allCompanies, setAllCompanies] = useState([]);
    const [errors, setErrors] = useState({});
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // Fetch data function
    const fetchData = useCallback(async () => {
        setPageLoading(true);
        setError(null);

        try {
            // Fetch companies
            const companiesRef = collection(db, 'companies');
            const companiesQuery = query(companiesRef, where('status', '==', 'active'));
            const companiesSnapshot = await getDocs(companiesQuery);
            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.data().companyID,
                name: doc.data().name,
                firestoreId: doc.id
            }));
            setAllCompanies(companiesData);

            // Fetch user data if editing
            if (isEditMode && id) {
                const userDocRef = doc(db, 'users', id);
                const userDoc = await getDoc(userDocRef);

                if (!userDoc.exists()) {
                    enqueueSnackbar('User not found', { variant: 'error' });
                    if (isModal && onClose) {
                        onClose();
                    } else {
                        navigate('/admin/users');
                    }
                    return;
                }

                const userData = userDoc.data();
                setFormData({
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    email: userData.email || '',
                    role: userData.role || 'user',
                    status: userData.status || 'active',
                    phone: userData.phone || '',
                    companies: userData.connectedCompanies?.companies || [],
                });
            }
        } catch (err) {
            console.error('Error loading data:', err);
            setError(err.message);
            enqueueSnackbar('Error loading data: ' + err.message, { variant: 'error' });
        } finally {
            setPageLoading(false);
            setInitialLoadComplete(true);
        }
    }, [id, isEditMode, navigate, enqueueSnackbar, isModal, onClose]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Form handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear field error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Clear general error
        if (error) setError(null);
    };

    const handleCompaniesChange = (event, newValues) => {
        setFormData(prev => ({
            ...prev,
            companies: newValues.map(company => company.id)
        }));

        if (errors.companies) {
            setErrors(prev => ({ ...prev, companies: '' }));
        }
    };

    // Form validation
    const validateForm = () => {
        const newErrors = {};

        // Required fields
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // No password validation needed - using email invites

        // Role and status validation
        if (!formData.role) {
            newErrors.role = 'Role is required';
        }
        if (!formData.status) {
            newErrors.status = 'Status is required';
        }

        // Phone validation (optional but format check if provided)
        if (formData.phone && !/^[\d\s\-\+\(\)\.]+$/.test(formData.phone)) {
            newErrors.phone = 'Please enter a valid phone number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            enqueueSnackbar('Please correct the validation errors', { variant: 'warning' });
            return;
        }

        setSaveLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            // Check authentication
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('Authentication required. Please sign in again.');
            }

            // Get fresh auth token
            await currentUser.getIdToken(true);

            const { email, firstName, lastName, role, status, phone, companies } = formData;

            if (isEditMode) {
                // Update existing user
                const userDocRef = doc(db, 'users', id);
                const dataToUpdate = {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    role,
                    status,
                    phone: phone.trim(),
                    connectedCompanies: { companies },
                    updatedAt: new Date(),
                };

                await updateDoc(userDocRef, dataToUpdate);
                enqueueSnackbar('User updated successfully!', { variant: 'success' });

                // Navigate after short delay
                setTimeout(() => {
                    if (isModal && onClose) {
                        onClose();
                    } else {
                        navigate('/admin/users');
                    }
                }, 1500);

            } else {
                // Send user invitation via cloud function
                const adminInviteUserFn = httpsCallable(functions, 'adminInviteUser');

                const result = await adminInviteUserFn({
                    email: email.trim(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    role,
                    status,
                    phone: phone.trim(),
                    companies
                });

                if (result.data.status === "success") {
                    enqueueSnackbar('User invitation sent successfully! They will receive an email to set up their password.', { variant: 'success' });

                    // Reset form for new entry
                    setFormData({
                        firstName: '',
                        lastName: '',
                        email: '',
                        role: 'user',
                        status: 'active',
                        phone: '',
                        companies: [],
                    });

                    // Navigate after short delay
                    setTimeout(() => {
                        if (isModal && onClose) {
                            onClose();
                        } else {
                            navigate('/admin/users');
                        }
                    }, 1500);
                } else {
                    throw new Error(result.data.message || 'Failed to send user invitation');
                }
            }

        } catch (err) {
            console.error('Error saving user:', err);

            // Handle specific error types
            if (err.code === 'functions/already-exists') {
                setErrors(prev => ({ ...prev, email: 'This email address is already registered' }));
                setError('A user with this email already exists');
            } else if (err.code === 'functions/invalid-argument') {
                setError(err.message);
            } else {
                setError(err.message || 'Failed to save user. Please try again.');
            }

            enqueueSnackbar(err.message || 'Error saving user', { variant: 'error' });
        } finally {
            setSaveLoading(false);
        }
    };

    const handleCancel = () => {
        if (isModal && onClose) {
            onClose();
        } else {
            navigate('/admin/users');
        }
    };

    // Loading state
    if (pageLoading) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: isModal ? '400px' : '60vh',
                flexDirection: 'column',
                gap: 2
            }}>
                <CircularProgress size={40} />
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Loading user data...
                </Typography>
            </Box>
        );
    }

    // Get selected company objects for Autocomplete
    const selectedCompanyObjects = formData.companies
        .map(companyId => allCompanies.find(c => c.id === companyId))
        .filter(company => company !== undefined);

    // Modal header navigation
    const navigation = {
        title: isEditMode ? `Edit User: ${formData.firstName} ${formData.lastName}` : 'Create New User',
        canGoBack: true,
        backText: 'Users',
        onBack: handleCancel
    };

    return (
        <Box sx={{
            backgroundColor: 'transparent',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    navigation={navigation}
                    onClose={onClose}
                    showCloseButton={true}
                />
            )}

            {/* Main Content */}
            <Box sx={{
                flex: 1,
                overflow: 'auto',
                p: 3
            }}>
                {/* Page Header */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 3,
                    pb: 3,
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <Box>
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 600,
                                color: '#111827',
                                fontSize: '20px',
                                mb: 0.5
                            }}
                        >
                            {isEditMode ? `Edit User: ${formData.firstName} ${formData.lastName}` : 'Create New User'}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '12px',
                                color: '#6b7280'
                            }}
                        >
                            {isEditMode
                                ? 'Update user information and permissions'
                                : 'Send an invitation email to create a new user account'
                            }
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ArrowBackIcon />}
                            onClick={handleCancel}
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={isEditMode ? <SaveIcon /> : <PersonAddIcon />}
                            onClick={handleSubmit}
                            disabled={saveLoading}
                            sx={{ fontSize: '12px' }}
                        >
                            {saveLoading ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                isEditMode ? 'Save Changes' : 'Send Invitation'
                            )}
                        </Button>
                    </Box>
                </Box>

                {/* Error and Success Messages */}
                {error && (
                    <Alert severity="error" sx={{ mb: 3, fontSize: '12px' }}>
                        {error}
                    </Alert>
                )}
                {successMessage && (
                    <Alert severity="success" sx={{ mb: 3, fontSize: '12px' }}>
                        {successMessage}
                    </Alert>
                )}

                {/* Form Content */}
                <Paper sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    <Box component="form" onSubmit={handleSubmit} noValidate>
                        {/* Personal Information Section */}
                        <Box sx={{ p: 3 }}>
                            <Typography
                                sx={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: '#374151',
                                    mb: 2
                                }}
                            >
                                Personal Information
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="First Name"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        error={!!errors.firstName}
                                        helperText={errors.firstName}
                                        required
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Last Name"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        error={!!errors.lastName}
                                        helperText={errors.lastName}
                                        required
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Email Address"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        error={!!errors.email}
                                        helperText={errors.email}
                                        required
                                        disabled={isEditMode}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Phone Number"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        error={!!errors.phone}
                                        helperText={errors.phone}
                                        placeholder="(555) 123-4567"
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                {!isEditMode && (
                                    <Grid item xs={12}>
                                        <Alert severity="info" sx={{ fontSize: '12px' }}>
                                            🎯 <strong>Email Invitation:</strong> The user will receive an email invitation to set up their password and activate their account.
                                        </Alert>
                                    </Grid>
                                )}
                            </Grid>
                        </Box>

                        <Divider />

                        {/* Account Settings Section */}
                        <Box sx={{ p: 3 }}>
                            <Typography
                                sx={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: '#374151',
                                    mb: 2
                                }}
                            >
                                Account Settings
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <FormControl
                                        fullWidth
                                        size="small"
                                        error={!!errors.role}
                                    >
                                        <InputLabel sx={{ fontSize: '12px' }}>Role</InputLabel>
                                        <Select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleInputChange}
                                            label="Role"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="user" sx={{ fontSize: '12px' }}>User</MenuItem>
                                            <MenuItem value="business_admin" sx={{ fontSize: '12px' }}>Business Admin</MenuItem>
                                            <MenuItem value="admin" sx={{ fontSize: '12px' }}>Admin</MenuItem>
                                            <MenuItem value="super_admin" sx={{ fontSize: '12px' }}>Super Admin</MenuItem>
                                        </Select>
                                        {errors.role && (
                                            <FormHelperText sx={{ fontSize: '11px' }}>
                                                {errors.role}
                                            </FormHelperText>
                                        )}
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl
                                        fullWidth
                                        size="small"
                                        error={!!errors.status}
                                    >
                                        <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                        <Select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            label="Status"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                            <MenuItem value="inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                                            <MenuItem value="suspended" sx={{ fontSize: '12px' }}>Suspended</MenuItem>
                                        </Select>
                                        {errors.status && (
                                            <FormHelperText sx={{ fontSize: '11px' }}>
                                                {errors.status}
                                            </FormHelperText>
                                        )}
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <Autocomplete
                                        multiple
                                        size="small"
                                        options={allCompanies}
                                        getOptionLabel={(option) => option.name}
                                        value={selectedCompanyObjects}
                                        onChange={handleCompaniesChange}
                                        filterSelectedOptions
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Connected Companies"
                                                placeholder="Select companies this user can access"
                                                error={!!errors.companies}
                                                helperText={errors.companies || "Users can access shipments and data for selected companies"}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                            />
                                        )}
                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                        sx={{
                                            '& .MuiChip-label': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
};

export default UserForm; 