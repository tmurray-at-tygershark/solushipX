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
        setFormData(prev => ({ ...prev, [name]: value }));
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
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Title and Breadcrumbs */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    User Profile: {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
                </Typography>
                <Breadcrumbs aria-label="breadcrumb">
                    <RouterLink to="/admin" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Admin
                    </RouterLink>
                    <RouterLink to="/admin/users" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Users
                    </RouterLink>
                    <Typography color="text.primary">
                        {user ? `${user.firstName} ${user.lastName}` : 'Detail'}
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 } }}>
                <Grid container spacing={3}>
                    {/* Left Pane: Avatar and Core Info */}
                    <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                            <Avatar sx={{ width: 120, height: 120, margin: '0 auto 16px', fontSize: '3rem' }}>
                                {user.firstName?.[0]?.toUpperCase()}{user.lastName?.[0]?.toUpperCase()}
                            </Avatar>
                            <Typography variant="h5" gutterBottom>
                                {user.firstName || ''} {user.lastName || ''}
                            </Typography>
                            <Chip
                                label={user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Unknown'}
                                color={user.status === 'active' ? 'success' : user.status === 'inactive' ? 'default' : 'warning'}
                                size="small"
                            />
                        </Box>
                        <Stack spacing={1.5} divider={<Divider flexItem />}>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                                <Typography variant="body1">{user.email || '—'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Phone</Typography>
                                <Typography variant="body1">{editMode ?
                                    <TextField size="small" name="phone" value={formData.phone} onChange={handleInputChange} fullWidth />
                                    : (user.phone || '—')}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Role</Typography>
                                {editMode ? (
                                    <FormControl fullWidth size="small">
                                        <Select name="role" value={formData.role} onChange={handleInputChange}>
                                            <MenuItem value="super_admin">Super Admin</MenuItem>
                                            <MenuItem value="admin">Admin</MenuItem>
                                            <MenuItem value="business_admin">Business Admin</MenuItem>
                                            <MenuItem value="user">User</MenuItem>
                                        </Select>
                                    </FormControl>
                                ) : (
                                    <Typography variant="body1">{user.role || '—'}</Typography>
                                )}
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                                {editMode ? (
                                    <FormControl fullWidth size="small">
                                        <Select name="status" value={formData.status} onChange={handleInputChange}>
                                            <MenuItem value="active">Active</MenuItem>
                                            <MenuItem value="inactive">Inactive</MenuItem>
                                            <MenuItem value="suspended">Suspended</MenuItem>
                                        </Select>
                                    </FormControl>
                                ) : (
                                    <Typography variant="body1">{user.status || '—'}</Typography>
                                )}
                            </Box>
                        </Stack>
                        <Box sx={{ mt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                            {editMode ? (
                                <>
                                    <Button variant="contained" onClick={handleSaveChanges} startIcon={<SaveIcon />} disabled={isSaving}>
                                        {isSaving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
                                    </Button>
                                    <Button variant="outlined" onClick={handleEditToggle} startIcon={<CancelIcon />}>Cancel</Button>
                                </>
                            ) : (
                                <Button variant="outlined" onClick={handleEditToggle} startIcon={<EditIcon />}>Edit User</Button>
                            )}
                        </Box>
                    </Grid>

                    {/* Right Pane: Tabs for Details */}
                    <Grid item xs={12} md={8}>
                        <Paper variant="outlined" sx={{ height: '100%' }}>
                            <Tabs value={activeTab} onChange={handleTabChange} aria-label="user details tabs" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tab label="Details" icon={<PersonIcon />} iconPosition="start" />
                                <Tab label="Companies" icon={<BusinessIcon />} iconPosition="start" />
                                <Tab label="Security" icon={<AdminPanelSettingsIcon />} iconPosition="start" />
                            </Tabs>

                            {/* Tab Panel 1: Details (becomes edit form) */}
                            {activeTab === 0 && (
                                <Box sx={{ p: 3 }}>
                                    <Typography variant="h6" gutterBottom>User Information</Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <TextField label="First Name" fullWidth name="firstName" value={editMode ? formData.firstName : user.firstName} onChange={handleInputChange} disabled={!editMode} error={!!formErrors.firstName} helperText={formErrors.firstName} />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField label="Last Name" fullWidth name="lastName" value={editMode ? formData.lastName : user.lastName} onChange={handleInputChange} disabled={!editMode} error={!!formErrors.lastName} helperText={formErrors.lastName} />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField label="Email" fullWidth value={user.email || '—'} disabled />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField label="Phone" fullWidth name="phone" value={editMode ? formData.phone : (user.phone || '—')} onChange={handleInputChange} disabled={!editMode} />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="body2" color="textSecondary">Joined:</Typography>
                                            <Typography variant="body1">{formatDate(user.createdAt)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="body2" color="textSecondary">Last Updated:</Typography>
                                            <Typography variant="body1">{formatDate(user.updatedAt)}</Typography>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {/* Tab Panel 2: Connected Companies */}
                            {activeTab === 1 && (
                                <Box sx={{ p: 3 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                        <Typography variant="h6">Connected Companies</Typography>
                                        <Button startIcon={<EditIcon />} onClick={handleManageCompanies} size="small">Manage</Button>
                                    </Stack>
                                    {connectedCompanyIds.length > 0 ? (
                                        <List dense>
                                            {connectedCompanyIds.map(companyId => (
                                                <ListItem key={companyId} disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 32 }}><BusinessIcon fontSize="small" /></ListItemIcon>
                                                    <ListItemText primary={companyMap[companyId] || companyId} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography color="text.secondary">No companies connected.</Typography>
                                    )}
                                </Box>
                            )}
                            {/* Tab Panel 3: Account Security */}
                            {activeTab === 2 && (
                                <Box sx={{ p: 3 }}>
                                    <Typography variant="h6" gutterBottom>Account Security</Typography>
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography variant="body2" color="textSecondary">Last Login:</Typography>
                                            <Typography variant="body1">{formatDate(user.lastLogin) || 'Never'}</Typography>
                                        </Box>
                                        <Button
                                            variant="outlined"
                                            startIcon={<LockResetIcon />}
                                            onClick={() => setResetPasswordDialogOpen(true)}
                                            sx={{ alignSelf: 'flex-start' }}
                                        >
                                            Reset User Password
                                        </Button>
                                    </Stack>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            </Paper>

            {/* Manage Connected Companies Dialog */}
            <Dialog open={manageCompaniesOpen} onClose={() => setManageCompaniesOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Manage Connected Companies</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="subtitle1" gutterBottom>Currently Connected:</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2, p: 1, border: '1px solid #eee', borderRadius: 1, minHeight: '40px' }}>
                        {selectedCompaniesForManagement.length > 0 ? (
                            selectedCompaniesForManagement.map((company) => (
                                <Chip
                                    key={company.id}
                                    label={company.name}
                                    onDelete={() => {
                                        setSelectedCompaniesForManagement(prev => prev.filter(c => c.id !== company.id));
                                    }}
                                    color="primary"
                                />
                            ))
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No companies currently connected.</Typography>
                        )}
                    </Stack>

                    <Autocomplete
                        multiple
                        id="add-companies-autocomplete"
                        options={allCompanies.filter(opt =>
                            !selectedCompaniesForManagement.find(sel => sel.id === opt.id)
                        )} // Only show companies not already selected
                        getOptionLabel={(option) => option.name}
                        value={[]} // Controlled by the chips above, this is for selecting new ones
                        onChange={(event, newValue) => {
                            // newValue will be an array of the selected company objects to add
                            // We need to ensure no duplicates if user manages to select one already in chips (though filter should prevent)
                            setSelectedCompaniesForManagement(prev => {
                                const newSelections = newValue.filter(nv => !prev.find(p => p.id === nv.id));
                                return [...prev, ...newSelections];
                            });
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                variant="outlined"
                                label="Add Companies"
                                placeholder="Search and select companies to add"
                            />
                        )}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setManageCompaniesOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveConnectedCompanies} variant="contained" disabled={isSaving}>
                        {isSaving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Reset User Password</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Enter a new password for {user.email}.
                    </DialogContentText>
                    {passwordResetError && <Alert severity="error" sx={{ mb: 2 }}>{passwordResetError}</Alert>}
                    <TextField
                        autoFocus
                        margin="dense"
                        label="New Password"
                        type="password"
                        fullWidth
                        variant="outlined"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Confirm New Password"
                        type="password"
                        fullWidth
                        variant="outlined"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setResetPasswordDialogOpen(false); setPasswordResetError(''); }}>Cancel</Button>
                    <Button onClick={handlePasswordResetRequest} variant="contained" disabled={isSaving}>
                        {isSaving ? <CircularProgress size={20} color="inherit" /> : 'Reset Password'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserDetail; 