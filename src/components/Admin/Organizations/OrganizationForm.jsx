import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, TextField, Button, CircularProgress, FormControl,
    InputLabel, Select, MenuItem, Autocomplete, Stack, Breadcrumbs, Link as MuiLink,
    Alert, FormHelperText, Dialog, DialogTitle, DialogContent, DialogActions, Card,
    CardContent, Chip, Avatar
} from '@mui/material';
import {
    Save as SaveIcon,
    Cancel as CancelIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Group as GroupIcon,
    DeleteForever as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    doc, getDoc, setDoc, collection, getDocs, serverTimestamp, writeBatch,
    addDoc, updateDoc, arrayUnion, arrayRemove, query, where
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import ModalHeader from '../../common/ModalHeader';

const OrganizationForm = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const { id: routeOrgFirestoreId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const isEditMode = Boolean(routeOrgFirestoreId);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        orgID: '',
        status: 'active',
        connectedCompanies: [],
        adminUserIdsToUpdate: [],
        ownerID: ''
    });
    const [originalAdminUserIds, setOriginalAdminUserIds] = useState([]);

    // Data states
    const [allCompanies, setAllCompanies] = useState([]);
    const [allUsers, setAllUsers] = useState([]);

    // UI states
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(isEditMode);
    const [formErrors, setFormErrors] = useState({});
    const [orgIdError, setOrgIdError] = useState('');
    const [isCheckingOrgId, setIsCheckingOrgId] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // ✅ NEW: Fetch initial data
    const fetchInitialData = useCallback(async () => {
        setPageLoading(true);
        try {
            // Load companies and users in parallel
            const [companiesSnap, usersSnap] = await Promise.all([
                getDocs(collection(db, 'companies')),
                getDocs(collection(db, 'users'))
            ]);

            const companies = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const users = usersSnap.docs.map(doc => {
                const userData = doc.data();
                return {
                    id: doc.id,
                    ...userData,
                    name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'Unknown User'
                };
            });

            setAllCompanies(companies);
            setAllUsers(users);

            // If edit mode, fetch organization data
            if (isEditMode && routeOrgFirestoreId) {
                const orgDocRef = doc(db, 'organizations', routeOrgFirestoreId);
                const orgDoc = await getDoc(orgDocRef);

                if (orgDoc.exists()) {
                    const orgData = orgDoc.data();

                    // Fetch users currently associated with this organization's orgID
                    let currentOrgAdminIds = [];
                    if (orgData.orgID) {
                        const usersAdminingOrgQuery = query(
                            collection(db, 'users'),
                            where('connectedOrganizations', 'array-contains', orgData.orgID)
                        );
                        const adminUsersSnap = await getDocs(usersAdminingOrgQuery);
                        currentOrgAdminIds = adminUsersSnap.docs.map(doc => doc.id);
                    }

                    setFormData({
                        name: orgData.name || '',
                        orgID: orgData.orgID || '',
                        status: orgData.status || 'active',
                        connectedCompanies: orgData.connectedCompanies || [],
                        adminUserIdsToUpdate: currentOrgAdminIds,
                        ownerID: orgData.ownerID || ''
                    });
                    setOriginalAdminUserIds(currentOrgAdminIds);
                } else {
                    enqueueSnackbar('Organization not found.', { variant: 'error' });
                    navigate('/admin/organizations');
                }
            }
        } catch (error) {
            console.error("Error fetching initial data:", error);
            enqueueSnackbar('Failed to load data: ' + error.message, { variant: 'error' });
        } finally {
            setPageLoading(false);
        }
    }, [routeOrgFirestoreId, isEditMode, enqueueSnackbar, navigate]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // Check orgID availability
    useEffect(() => {
        const checkOrgId = async () => {
            if (!formData.orgID.trim() || isEditMode) return;
            setIsCheckingOrgId(true);
            try {
                const q = query(collection(db, 'organizations'), where('orgID', '==', formData.orgID.trim()));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setOrgIdError('This Organization ID is already taken');
                } else {
                    setOrgIdError('');
                }
            } catch (err) {
                console.error('Error checking org ID:', err);
            } finally {
                setIsCheckingOrgId(false);
            }
        };
        const timeoutId = setTimeout(checkOrgId, 1000);
        return () => clearTimeout(timeoutId);
    }, [formData.orgID, isEditMode]);

    // ✅ NEW: Handle input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let newOrgID = formData.orgID;

        if (name === 'name' && !isEditMode) {
            newOrgID = value.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
            setFormData(prev => ({ ...prev, [name]: value, orgID: newOrgID }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        // Clear errors when user starts typing
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    // ✅ NEW: Handle autocomplete changes
    const handleAutocompleteChange = (fieldName, newValue) => {
        if (fieldName === 'connectedCompanies') {
            // Store companyID (business identifier) not Firestore document ID
            setFormData(prev => ({ ...prev, connectedCompanies: newValue.map(item => item.companyID || item.id) }));
        } else if (fieldName === 'adminUserIdsToUpdate') {
            setFormData(prev => ({ ...prev, adminUserIdsToUpdate: newValue.map(item => item.id) }));
        } else if (fieldName === 'ownerID') {
            setFormData(prev => ({ ...prev, ownerID: newValue ? newValue.id : '' }));
        }
    };

    // ✅ NEW: Validation
    const validate = () => {
        const errors = {};
        if (!formData.name.trim()) errors.name = 'Organization name is required.';
        if (!formData.orgID.trim()) errors.orgID = 'Organization ID is required.';
        if (!formData.ownerID) errors.ownerID = 'Owner is required.';
        if (orgIdError) errors.orgID = orgIdError;

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ✅ NEW: Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            enqueueSnackbar('Please correct the form errors.', { variant: 'warning' });
            return;
        }

        setLoading(true);

        try {
            const newAdminSelections = formData.adminUserIdsToUpdate || [];
            const humanReadableOrgID = formData.orgID.trim();
            const previouslyAssignedAdmins = originalAdminUserIds || [];

            const batch = writeBatch(db);

            // Organization document data
            const orgData = {
                name: formData.name.trim(),
                orgID: humanReadableOrgID,
                status: formData.status,
                connectedCompanies: formData.connectedCompanies,
                ownerID: formData.ownerID,
                updatedAt: serverTimestamp()
            };

            if (!isEditMode) {
                orgData.createdAt = serverTimestamp();
            }

            // Save organization
            const orgRef = isEditMode
                ? doc(db, 'organizations', routeOrgFirestoreId)
                : doc(collection(db, 'organizations'));

            batch.set(orgRef, orgData, { merge: true });

            // Handle admin user updates
            const usersToAdd = newAdminSelections.filter(id => !previouslyAssignedAdmins.includes(id));
            const usersToRemove = previouslyAssignedAdmins.filter(id => !newAdminSelections.includes(id));

            // Add organization to new admin users
            for (const userId of usersToAdd) {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, {
                    connectedOrganizations: arrayUnion(humanReadableOrgID)
                });
            }

            // Remove organization from removed admin users
            for (const userId of usersToRemove) {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, {
                    connectedOrganizations: arrayRemove(humanReadableOrgID)
                });
            }

            await batch.commit();

            enqueueSnackbar(
                `Organization ${isEditMode ? 'updated' : 'created'} successfully!`,
                { variant: 'success' }
            );

            if (isModal && onClose) {
                onClose();
            } else {
                navigate('/admin/organizations');
            }

        } catch (error) {
            console.error("Error saving organization:", error);
            enqueueSnackbar('Failed to save organization: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // ✅ NEW: Handle delete
    const handleDelete = async () => {
        setLoading(true);
        try {
            const batch = writeBatch(db);

            // Remove organization from all admin users
            for (const userId of originalAdminUserIds) {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, {
                    connectedOrganizations: arrayRemove(formData.orgID)
                });
            }

            // Delete organization document
            const orgRef = doc(db, 'organizations', routeOrgFirestoreId);
            batch.delete(orgRef);

            await batch.commit();

            enqueueSnackbar('Organization deleted successfully!', { variant: 'success' });

            if (isModal && onClose) {
                onClose();
            } else {
                navigate('/admin/organizations');
            }
        } catch (error) {
            console.error("Error deleting organization:", error);
            enqueueSnackbar('Failed to delete organization: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
            setShowDeleteDialog(false);
        }
    };

    if (pageLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontSize: '20px', fontWeight: 600, color: '#111827', mb: 0.5 }}>
                            {isEditMode ? 'Edit Organization' : 'Create Organization'}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            {isEditMode ? 'Update organization details and settings' : 'Create a new organization with connected companies and admin users'}
                        </Typography>
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            type="button"
                            onClick={() => isModal && onClose ? onClose() : navigate('/admin/organizations')}
                            variant="outlined"
                            color="inherit"
                            startIcon={<CancelIcon />}
                            disabled={loading}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        {isEditMode && (
                            <Button
                                type="button"
                                variant="contained"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setShowDeleteDialog(true)}
                                disabled={loading}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Delete
                            </Button>
                        )}
                        <Button
                            type="submit"
                            form="organization-form"
                            variant="contained"
                            color="primary"
                            startIcon={<SaveIcon />}
                            disabled={loading}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            {loading ? <CircularProgress size={16} color="inherit" /> : (isEditMode ? 'Save Changes' : 'Create Organization')}
                        </Button>
                    </Box>
                </Box>

                {/* Breadcrumbs */}
                <Box sx={{ mt: 2 }}>
                    <Breadcrumbs sx={{ fontSize: '12px' }}>
                        <MuiLink component={RouterLink} to="/admin" sx={{ color: '#6b7280', textDecoration: 'none' }}>
                            Admin
                        </MuiLink>
                        <MuiLink component={RouterLink} to="/admin/organizations" sx={{ color: '#6b7280', textDecoration: 'none' }}>
                            Organizations
                        </MuiLink>
                        <Typography sx={{ fontSize: '12px', color: '#374151' }}>
                            {isEditMode ? 'Edit' : 'New'}
                        </Typography>
                    </Breadcrumbs>
                </Box>
            </Box>

            {/* Form Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Paper
                    component="form"
                    id="organization-form"
                    onSubmit={handleSubmit}
                    sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}
                >
                    <Grid container spacing={4}>
                        {/* Basic Information Section */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                Basic Information
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="name"
                                        label="Organization Name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        fullWidth
                                        required
                                        size="small"
                                        error={!!formErrors.name}
                                        helperText={formErrors.name}
                                        InputProps={{ sx: { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="orgID"
                                        label="Organization ID"
                                        value={formData.orgID}
                                        onChange={handleInputChange}
                                        fullWidth
                                        required
                                        disabled={isEditMode}
                                        size="small"
                                        error={!!formErrors.orgID || !!orgIdError}
                                        helperText={formErrors.orgID || orgIdError || 'Auto-generated from organization name'}
                                        InputProps={{
                                            sx: { fontSize: '12px' },
                                            endAdornment: isCheckingOrgId && <CircularProgress size={16} />
                                        }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                </Grid>
                            </Grid>
                        </Grid>

                        {/* Owner & Status Section */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                Owner & Status
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        options={allUsers.filter(u => u.status === 'active')}
                                        getOptionLabel={(option) => `${option.name || option.email || 'Unknown User'} (${option.email || 'No email'})`}
                                        value={allUsers.find(u => u.id === formData.ownerID) || null}
                                        onChange={(event, newValue) => handleAutocompleteChange('ownerID', newValue)}
                                        renderOption={(props, option) => (
                                            <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                                <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '10px' }}>
                                                    {(option.name && option.name[0]) || (option.email && option.email[0]) || 'U'}
                                                </Avatar>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {option.name || option.email || 'Unknown User'}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {option.email || 'No email'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Organization Owner"
                                                required
                                                error={!!formErrors.ownerID}
                                                helperText={formErrors.ownerID}
                                                size="small"
                                                InputProps={{
                                                    ...params.InputProps,
                                                    sx: { fontSize: '12px' }
                                                }}
                                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            />
                                        )}
                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
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
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </Grid>

                        {/* Connected Companies Section */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                Connected Companies ({formData.connectedCompanies.length} selected)
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                Select companies that belong to this organization
                            </Typography>
                            <Autocomplete
                                multiple
                                options={allCompanies.filter(c => c.status === 'active')}
                                getOptionLabel={(option) => `${option.name} - ${option.companyID || option.id}`}
                                value={allCompanies.filter(c => formData.connectedCompanies.includes(c.companyID || c.id))}
                                onChange={(event, newValue) => handleAutocompleteChange('connectedCompanies', newValue)}
                                filterSelectedOptions
                                renderTags={(tagValue, getTagProps) =>
                                    tagValue.map((option, index) => (
                                        <Chip
                                            key={option.id}
                                            avatar={<Avatar sx={{ width: 20, height: 20, bgcolor: '#3b82f6' }}><BusinessIcon sx={{ fontSize: '12px', color: 'white' }} /></Avatar>}
                                            label={`${option.name} - ${option.companyID || option.id}`}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                            {...getTagProps({ index })}
                                        />
                                    ))
                                }
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                        <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: '#3b82f6' }}>
                                            <BusinessIcon sx={{ fontSize: '12px', color: 'white' }} />
                                        </Avatar>
                                        <Box>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {option.name} - {option.companyID || option.id}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                                Company ID: {option.companyID || option.id}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="outlined"
                                        label="Connected Companies"
                                        placeholder="Select companies"
                                        size="small"
                                        InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '12px' }
                                        }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => (option.companyID || option.id) === (value.companyID || value.id)}
                            />
                        </Grid>

                        {/* Admin Users Section */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                Admin Users ({formData.adminUserIdsToUpdate.length} selected)
                            </Typography>

                            {formData.adminUserIdsToUpdate.length === 0 && (
                                <Alert severity="warning" sx={{ mb: 2, fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                        No Admin Users Selected
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        Without admin users, this organization will have no administrative access.
                                        Consider selecting at least one admin user to manage this organization's settings and relationships.
                                    </Typography>
                                </Alert>
                            )}

                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                Select admin users for this organization. Selected users will have this organization added to their connected organizations list.
                            </Typography>

                            <Autocomplete
                                multiple
                                options={allUsers.filter(u => u.status === 'active')}
                                getOptionLabel={(option) => `${option.name || option.email || 'Unknown User'} (${option.email || 'No email'})`}
                                value={allUsers.filter(u => formData.adminUserIdsToUpdate.includes(u.id))}
                                onChange={(event, newValue) => handleAutocompleteChange('adminUserIdsToUpdate', newValue)}
                                filterSelectedOptions
                                renderTags={(tagValue, getTagProps) =>
                                    tagValue.map((option, index) => (
                                        <Chip
                                            key={option.id}
                                            avatar={<Avatar sx={{ width: 20, height: 20, fontSize: '10px' }}>{(option.name && option.name[0]) || (option.email && option.email[0]) || 'U'}</Avatar>}
                                            label={option.name || option.email || 'Unknown User'}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                            {...getTagProps({ index })}
                                        />
                                    ))
                                }
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                        <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '10px' }}>
                                            {(option.name && option.name[0]) || (option.email && option.email[0]) || 'U'}
                                        </Avatar>
                                        <Box>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {option.name || option.email || 'Unknown User'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {option.email || 'No email'}
                                            </Typography>
                                            {option.role && (
                                                <Chip label={option.role} size="small" sx={{ fontSize: '10px', height: '16px', mt: 0.5 }} />
                                            )}
                                        </Box>
                                    </Box>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="outlined"
                                        label="Organization Admins"
                                        placeholder="Select admin users"
                                        size="small"
                                        InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '12px' }
                                        }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                            />
                        </Grid>
                    </Grid>
                </Paper>
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Delete Organization
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px', mb: 2 }}>
                        Are you sure you want to delete this organization? This action cannot be undone.
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#ef4444' }}>
                        This will remove the organization from all connected admin users and companies.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setShowDeleteDialog(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDelete}
                        color="error"
                        variant="contained"
                        disabled={loading}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default OrganizationForm; 