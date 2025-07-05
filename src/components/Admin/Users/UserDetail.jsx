import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db, functions } from '../../../firebase'; // Assuming functions is exported for httpsCallable
import { httpsCallable } from 'firebase/functions';
import {
    Box, Typography, CircularProgress, Paper, Chip, Stack, Grid, Avatar, Button,
    Tabs, Tab, TextField, MenuItem, FormControl, InputLabel, Select,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    List, ListItem, ListItemText, IconButton, Divider, Alert, ListItemIcon,
    Breadcrumbs, Autocomplete
} from '@mui/material';
import {
    Person as PersonIcon,
    Business as BusinessIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    LockReset as LockResetIcon,
    AddCircleOutline as AddCircleOutlineIcon,
    DeleteOutline as DeleteOutlineIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    CalendarToday as CalendarTodayIcon,
    AdminPanelSettings as AdminPanelSettingsIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

// Helper to format Firestore Timestamps
const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleString();
};

// Get role display name
const getRoleDisplayName = (role) => {
    switch (role) {
        case 'superadmin':
            return 'Super Administrator';
        case 'admin':
            return 'Administrator';
        case 'user':
            return 'Company Administrator';
        case 'company_staff':
            return 'Company Staff';
        case 'accounting':
            return 'Accounting';
        default:
            return role || 'User';
    }
};

const UserDetail = () => {
    const { id: userId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [user, setUser] = useState(null);
    const [originalUser, setOriginalUser] = useState(null); // For reverting edits
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [companyMap, setCompanyMap] = useState({});
    const [allCompanies, setAllCompanies] = useState([]); // For company management modal

    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({});
    const [formErrors, setFormErrors] = useState({});

    const [activeTab, setActiveTab] = useState(0);
    const [manageCompaniesOpen, setManageCompaniesOpen] = useState(false);
    const [selectedCompaniesForManagement, setSelectedCompaniesForManagement] = useState([]);

    const [isSaving, setIsSaving] = useState(false);
    const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [passwordResetError, setPasswordResetError] = useState('');


    const fetchUserAndCompanyData = useCallback(async () => {
        console.log(`fetchUserAndCompanyData called for ID: ${userId}`);
        setLoading(true);
        setError(null);
        setUser(null);
        setOriginalUser(null);
        setCompanyMap({});
        setAllCompanies([]);

        try {
            // Fetch all companies for mapping and management
            const companiesSnap = await getDocs(collection(db, 'companies'));
            const newCompanyMap = {};
            const allCompaniesData = [];
            companiesSnap.forEach(doc => {
                const companyData = doc.data();
                if (companyData.companyID && companyData.name) {
                    newCompanyMap[companyData.companyID] = companyData.name;
                    allCompaniesData.push({ id: companyData.companyID, name: companyData.name });
                }
            });
            setCompanyMap(newCompanyMap);
            setAllCompanies(allCompaniesData);
            console.log('Company map and all companies populated:', newCompanyMap, allCompaniesData);

            // Fetch user document
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                console.log(`User document with ID ${userId} not found.`);
                setError('User not found');
                setLoading(false);
                return;
            }

            const userData = userDoc.data();
            console.log(`User document with ID ${userId} found:`, userData);
            setUser(userData);
            setOriginalUser(userData); // Save for potential edit cancellation
            setFormData({ // Initialize formData for editing
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                phone: userData.phone || '',
                phoneExtension: userData.phoneExtension || '',
                role: userData.role || 'user',
                status: userData.status || 'active',
            });
            // Initialize selected companies for management modal
            const connectedCompanyIds = userData.connectedCompanies?.companies || [];
            setSelectedCompaniesForManagement(allCompaniesData.filter(c => connectedCompanyIds.includes(c.id)));


        } catch (err) {
            console.error('Error in fetchUserAndCompanyData:', err);
            setError(`Error loading user details: ${err.message}`);
            enqueueSnackbar(`Error loading user: ${err.message}`, { variant: 'error' });
        } finally {
            console.log(`fetchUserAndCompanyData finished for ID: ${userId}. Setting loading to false.`);
            setLoading(false);
        }
    }, [userId, enqueueSnackbar]);

    useEffect(() => {
        if (userId) {
            fetchUserAndCompanyData();
        } else {
            setError("User ID is missing.");
            setLoading(false);
        }
    }, [userId, fetchUserAndCompanyData]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleEditToggle = () => {
        if (editMode) {
            // If canceling edit, revert formData to original user data
            setFormData({
                firstName: originalUser.firstName || '',
                lastName: originalUser.lastName || '',
                phone: originalUser.phone || '',
                phoneExtension: originalUser.phoneExtension || '',
                role: originalUser.role || 'user',
                status: originalUser.status || 'active',
            });
            setFormErrors({});
        } else {
            // Entering edit mode, formData is already set from user state
        }
        setEditMode(!editMode);
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;

        // Validate phone extension to allow only numbers
        if (name === 'phoneExtension') {
            const numericValue = value.replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, [name]: numericValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.firstName?.trim()) errors.firstName = 'First name is required.';
        if (!formData.lastName?.trim()) errors.lastName = 'Last name is required.';
        if (!formData.role) errors.role = 'Role is required.';
        if (!formData.status) errors.status = 'Status is required.';
        // Add more validation as needed (e.g., phone format)
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveChanges = async () => {
        if (!validateForm()) {
            enqueueSnackbar('Please correct the form errors.', { variant: 'warning' });
            return;
        }
        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', userId);
            const dataToUpdate = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                phoneExtension: formData.phoneExtension,
                role: formData.role,
                status: formData.status,
                updatedAt: new Date(), // Using client-side date, consider serverTimestamp if precision is critical
            };
            await updateDoc(userDocRef, dataToUpdate);
            setUser(prev => ({ ...prev, ...dataToUpdate })); // Update local user state
            setOriginalUser(prev => ({ ...prev, ...dataToUpdate })); // Update original user state
            setEditMode(false);
            enqueueSnackbar('User details updated successfully!', { variant: 'success' });
        } catch (err) {
            console.error("Error updating user details:", err);
            setError(`Failed to save changes: ${err.message}`);
            enqueueSnackbar(`Error saving: ${err.message}`, { variant: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleManageCompanies = () => {
        const connectedCompanyIds = user?.connectedCompanies?.companies || [];
        setSelectedCompaniesForManagement(allCompanies.filter(c => connectedCompanyIds.includes(c.id)));
        setManageCompaniesOpen(true);
    };

    const handleSaveConnectedCompanies = async () => {
        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', userId);
            const companyIdsToSave = selectedCompaniesForManagement.map(c => c.id);
            await updateDoc(userDocRef, {
                'connectedCompanies.companies': companyIdsToSave, // Correctly targets the nested array
                updatedAt: new Date()
            });
            setUser(prev => ({
                ...prev,
                connectedCompanies: { ...(prev.connectedCompanies || {}), companies: companyIdsToSave }
            }));
            setOriginalUser(prev => ({
                ...prev,
                connectedCompanies: { ...(prev.connectedCompanies || {}), companies: companyIdsToSave }
            }));
            enqueueSnackbar('Connected companies updated!', { variant: 'success' });
            setManageCompaniesOpen(false);
        } catch (err) {
            console.error("Error updating connected companies:", err);
            enqueueSnackbar(`Error saving companies: ${err.message}`, { variant: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordResetRequest = async () => {
        if (newPassword !== confirmNewPassword) {
            setPasswordResetError("Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            setPasswordResetError("Password must be at least 6 characters long.");
            return;
        }
        setPasswordResetError('');
        setIsSaving(true);
        try {
            const resetPasswordFunction = httpsCallable(functions, 'adminResetUserPassword'); // Ensure this function exists
            await resetPasswordFunction({ uid: userId, newPassword: newPassword });
            enqueueSnackbar('Password reset successfully.', { variant: 'success' });
            setResetPasswordDialogOpen(false);
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error) {
            console.error("Error resetting password:", error);
            setPasswordResetError(error.message || "Failed to reset password.");
            enqueueSnackbar(`Password reset failed: ${error.message}`, { variant: 'error' });
        } finally {
            setIsSaving(false);
        }
    };


    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }
    if (error) {
        return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
    }
    if (!user) {
        return <Box sx={{ p: 3 }}><Alert severity="warning">User data not available.</Alert></Box>;
    }

    const connectedCompanyIds = user.connectedCompanies?.companies || [];

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc'
        }}>
            {/* Header Section */}
            <Box sx={{
                p: 3,
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: 'white'
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h5" sx={{
                            fontWeight: 600,
                            color: '#111827',
                            fontSize: '20px',
                            mb: 0.5
                        }}>
                            {user ? `${user.firstName} ${user.lastName}` : 'User Details'}
                        </Typography>
                        <Typography sx={{
                            fontSize: '12px',
                            color: '#6b7280',
                            mb: 2
                        }}>
                            Manage user information, permissions, and settings
                        </Typography>
                        <Breadcrumbs aria-label="breadcrumb" sx={{ fontSize: '12px' }}>
                            <RouterLink to="/admin" sx={{
                                textDecoration: 'none',
                                color: '#6b7280',
                                fontSize: '12px',
                                '&:hover': { textDecoration: 'underline' }
                            }}>
                                Admin
                            </RouterLink>
                            <RouterLink to="/admin/users" sx={{
                                textDecoration: 'none',
                                color: '#6b7280',
                                fontSize: '12px',
                                '&:hover': { textDecoration: 'underline' }
                            }}>
                                Users
                            </RouterLink>
                            <Typography sx={{ color: '#374151', fontSize: '12px' }}>
                                {user ? `${user.firstName} ${user.lastName}` : 'Detail'}
                            </Typography>
                        </Breadcrumbs>
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {editMode ? (
                            <>
                                <Button
                                    variant="contained"
                                    onClick={handleSaveChanges}
                                    startIcon={<SaveIcon />}
                                    disabled={isSaving}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {isSaving ? <CircularProgress size={16} color="inherit" /> : 'Save Changes'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={handleEditToggle}
                                    startIcon={<CancelIcon />}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outlined"
                                onClick={handleEditToggle}
                                startIcon={<EditIcon />}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Edit User
                            </Button>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box sx={{
                flex: 1,
                overflow: 'auto',
                p: 3
            }}>
                <Paper sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    <Grid container>
                        {/* Left Pane: Avatar and Core Info */}
                        <Grid item xs={12} md={4} sx={{
                            borderRight: { md: '1px solid #e5e7eb' },
                            p: 3
                        }}>
                            <Box sx={{ textAlign: 'center', mb: 3 }}>
                                <Avatar sx={{
                                    width: 100,
                                    height: 100,
                                    margin: '0 auto 16px',
                                    fontSize: '2.5rem',
                                    backgroundColor: '#1f2937'
                                }}>
                                    {user.firstName?.[0]?.toUpperCase()}{user.lastName?.[0]?.toUpperCase()}
                                </Avatar>
                                <Typography sx={{
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#111827',
                                    mb: 1
                                }}>
                                    {user.firstName || ''} {user.lastName || ''}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <Chip
                                        label={user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Unknown'}
                                        color={
                                            user.status === 'active' ? 'success' :
                                                user.status === 'inactive' ? 'default' :
                                                    user.status === 'suspended' ? 'error' :
                                                        'warning'
                                        }
                                        size="small"
                                        sx={{
                                            fontSize: '11px',
                                            fontWeight: 600
                                        }}
                                    />
                                    <Chip
                                        label={getRoleDisplayName(user.role)}
                                        color="primary"
                                        variant="outlined"
                                        size="small"
                                        sx={{
                                            fontSize: '11px',
                                            fontWeight: 600
                                        }}
                                    />
                                </Box>
                            </Box>

                            <Stack spacing={2}>
                                <Box>
                                    <Typography sx={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#374151',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        mb: 0.5
                                    }}>
                                        Email
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                        {user.email || '—'}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography sx={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#374151',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        mb: 0.5
                                    }}>
                                        Phone
                                    </Typography>
                                    {editMode ? (
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <TextField
                                                size="small"
                                                name="phone"
                                                placeholder="(555) 123-4567"
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                sx={{
                                                    flex: 1,
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                }}
                                            />
                                            <TextField
                                                size="small"
                                                name="phoneExtension"
                                                placeholder="Ext"
                                                value={formData.phoneExtension}
                                                onChange={handleInputChange}
                                                sx={{
                                                    width: '80px',
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                }}
                                            />
                                        </Box>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            {user.phone ?
                                                `${user.phone}${user.phoneExtension ? ` ext. ${user.phoneExtension}` : ''}`
                                                : '—'}
                                        </Typography>
                                    )}
                                </Box>

                                <Box>
                                    <Typography sx={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#374151',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        mb: 0.5
                                    }}>
                                        Role
                                    </Typography>
                                    {editMode ? (
                                        <FormControl fullWidth size="small">
                                            <Select
                                                name="role"
                                                value={formData.role}
                                                onChange={handleInputChange}
                                                sx={{
                                                    '& .MuiSelect-select': { fontSize: '12px' },
                                                    '& .MuiMenuItem-root': { fontSize: '12px' }
                                                }}
                                            >
                                                <MenuItem value="superadmin" sx={{ fontSize: '12px' }}>Super Administrator</MenuItem>
                                                <MenuItem value="admin" sx={{ fontSize: '12px' }}>Administrator</MenuItem>
                                                <MenuItem value="user" sx={{ fontSize: '12px' }}>Company Administrator</MenuItem>
                                                <MenuItem value="company_staff" sx={{ fontSize: '12px' }}>Company Staff</MenuItem>
                                                <MenuItem value="accounting" sx={{ fontSize: '12px' }}>Accounting</MenuItem>
                                            </Select>
                                        </FormControl>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            {getRoleDisplayName(user.role)}
                                        </Typography>
                                    )}
                                </Box>

                                <Box>
                                    <Typography sx={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#374151',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        mb: 0.5
                                    }}>
                                        Status
                                    </Typography>
                                    {editMode ? (
                                        <FormControl fullWidth size="small">
                                            <Select
                                                name="status"
                                                value={formData.status}
                                                onChange={handleInputChange}
                                                sx={{
                                                    '& .MuiSelect-select': { fontSize: '12px' },
                                                    '& .MuiMenuItem-root': { fontSize: '12px' }
                                                }}
                                            >
                                                <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                                <MenuItem value="inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                                                <MenuItem value="suspended" sx={{ fontSize: '12px' }}>Suspended</MenuItem>
                                            </Select>
                                        </FormControl>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            {user.status || '—'}
                                        </Typography>
                                    )}
                                </Box>
                            </Stack>
                        </Grid>

                        {/* Right Pane: Tabs for Details */}
                        <Grid item xs={12} md={8}>
                            <Paper variant="outlined" sx={{ height: '100%' }}>
                                <Tabs
                                    value={activeTab}
                                    onChange={handleTabChange}
                                    aria-label="user details tabs"
                                    sx={{
                                        borderBottom: 1,
                                        borderColor: 'divider',
                                        '& .MuiTab-root': {
                                            fontSize: '12px',
                                            textTransform: 'none',
                                            minHeight: '48px'
                                        }
                                    }}
                                >
                                    <Tab label="Details" icon={<PersonIcon />} iconPosition="start" />
                                    <Tab label="Companies" icon={<BusinessIcon />} iconPosition="start" />
                                    <Tab label="Security" icon={<AdminPanelSettingsIcon />} iconPosition="start" />
                                </Tabs>

                                {/* Tab Panel 1: Details */}
                                {activeTab === 0 && (
                                    <Box sx={{ p: 3 }}>
                                        <Typography sx={{
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            color: '#374151',
                                            mb: 3
                                        }}>
                                            User Information
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    label="First Name"
                                                    fullWidth
                                                    name="firstName"
                                                    value={editMode ? formData.firstName : user.firstName}
                                                    onChange={handleInputChange}
                                                    disabled={!editMode}
                                                    error={!!formErrors.firstName}
                                                    helperText={formErrors.firstName}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                                        '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    label="Last Name"
                                                    fullWidth
                                                    name="lastName"
                                                    value={editMode ? formData.lastName : user.lastName}
                                                    onChange={handleInputChange}
                                                    disabled={!editMode}
                                                    error={!!formErrors.lastName}
                                                    helperText={formErrors.lastName}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                                        '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    label="Email"
                                                    fullWidth
                                                    value={user.email || '—'}
                                                    disabled
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField
                                                    label="Phone"
                                                    fullWidth
                                                    name="phone"
                                                    value={editMode ? formData.phone : (user.phone || '—')}
                                                    onChange={handleInputChange}
                                                    disabled={!editMode}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 0.5 }}>
                                                    Joined:
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                    {formatDate(user.createdAt)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 0.5 }}>
                                                    Last Updated:
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                    {formatDate(user.updatedAt)}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                )}

                                {/* Tab Panel 2: Connected Companies */}
                                {activeTab === 1 && (
                                    <Box sx={{ p: 3 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                                            <Typography sx={{
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                color: '#374151'
                                            }}>
                                                Connected Companies
                                            </Typography>
                                            <Button
                                                startIcon={<EditIcon />}
                                                onClick={handleManageCompanies}
                                                size="small"
                                                sx={{ fontSize: '12px' }}
                                            >
                                                Manage
                                            </Button>
                                        </Stack>
                                        {connectedCompanyIds.length > 0 ? (
                                            <List dense>
                                                {connectedCompanyIds.map(companyId => (
                                                    <ListItem key={companyId} disableGutters>
                                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                                            <BusinessIcon fontSize="small" />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={
                                                                <Typography sx={{ fontSize: '12px', color: '#111827', fontWeight: 500 }}>
                                                                    {companyMap[companyId] || companyId}
                                                                </Typography>
                                                            }
                                                            secondary={
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                    Company ID: {companyId}
                                                                </Typography>
                                                            }
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        ) : (
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                No companies connected.
                                            </Typography>
                                        )}
                                    </Box>
                                )}

                                {/* Tab Panel 3: Account Security */}
                                {activeTab === 2 && (
                                    <Box sx={{ p: 3 }}>
                                        <Typography sx={{
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            color: '#374151',
                                            mb: 3
                                        }}>
                                            Account Security
                                        </Typography>
                                        <Stack spacing={3}>
                                            <Box>
                                                <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 0.5 }}>
                                                    Last Login:
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                    {formatDate(user.lastLogin) || 'Never'}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                    Password Management:
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<LockResetIcon />}
                                                    onClick={() => setResetPasswordDialogOpen(true)}
                                                    size="small"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    Reset User Password
                                                </Button>
                                            </Box>
                                        </Stack>
                                    </Box>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Manage Connected Companies Dialog */}
                <Dialog open={manageCompaniesOpen} onClose={() => setManageCompaniesOpen(false)} fullWidth maxWidth="md">
                    <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Manage Connected Companies
                    </DialogTitle>
                    <DialogContent dividers>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Currently Connected:
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{
                            mb: 2,
                            p: 1,
                            border: '1px solid #e5e7eb',
                            borderRadius: 1,
                            minHeight: '40px',
                            backgroundColor: '#f8fafc'
                        }}>
                            {selectedCompaniesForManagement.length > 0 ? (
                                selectedCompaniesForManagement.map((company) => (
                                    <Chip
                                        key={company.id}
                                        label={`${company.name} (${company.id})`}
                                        onDelete={() => {
                                            setSelectedCompaniesForManagement(prev => prev.filter(c => c.id !== company.id));
                                        }}
                                        color="primary"
                                        size="small"
                                        sx={{ fontSize: '11px' }}
                                    />
                                ))
                            ) : (
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', p: 1 }}>
                                    No companies currently connected.
                                </Typography>
                            )}
                        </Stack>

                        <Autocomplete
                            multiple
                            id="add-companies-autocomplete"
                            options={allCompanies.filter(opt =>
                                !selectedCompaniesForManagement.find(sel => sel.id === opt.id)
                            )}
                            getOptionLabel={(option) => `${option.name} (${option.id})`}
                            value={[]}
                            onChange={(event, newValue) => {
                                setSelectedCompaniesForManagement(prev => {
                                    const newSelections = newValue.filter(nv => !prev.find(p => p.id === nv.id));
                                    return [...prev, ...newSelections];
                                });
                            }}
                            renderOption={(props, option) => (
                                <Box component="li" {...props} sx={{ flexDirection: 'column', alignItems: 'flex-start !important' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>
                                        {option.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Company ID: {option.id}
                                    </Typography>
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    variant="outlined"
                                    label="Add Companies"
                                    placeholder="Search and select companies to add"
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            sx={{ mt: 2 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setManageCompaniesOpen(false)}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveConnectedCompanies}
                            variant="contained"
                            disabled={isSaving}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            {isSaving ? <CircularProgress size={16} color="inherit" /> : 'Save Changes'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Reset Password Dialog */}
                <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)} fullWidth maxWidth="xs">
                    <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Reset User Password
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText sx={{ mb: 2, fontSize: '12px', color: '#6b7280' }}>
                            Enter a new password for {user.email}.
                        </DialogContentText>
                        {passwordResetError && (
                            <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                                {passwordResetError}
                            </Alert>
                        )}
                        <TextField
                            autoFocus
                            margin="dense"
                            label="New Password"
                            type="password"
                            fullWidth
                            variant="outlined"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            size="small"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                        <TextField
                            margin="dense"
                            label="Confirm New Password"
                            type="password"
                            fullWidth
                            variant="outlined"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            size="small"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                setResetPasswordDialogOpen(false);
                                setPasswordResetError('');
                            }}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePasswordResetRequest}
                            variant="contained"
                            disabled={isSaving}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            {isSaving ? <CircularProgress size={16} color="inherit" /> : 'Reset Password'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default UserDetail; 