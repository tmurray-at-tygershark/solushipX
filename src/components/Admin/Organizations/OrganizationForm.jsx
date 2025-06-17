import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, TextField, Button, CircularProgress, FormControl,
    InputLabel, Select, MenuItem, Autocomplete, Stack, Breadcrumbs, Link as MuiLink, Alert, FormHelperText, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Chip, Avatar, Divider, Stepper, Step, StepLabel, LinearProgress
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

// Import reusable components
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
    const [saveProgress, setSaveProgress] = useState(0);

    // Steps for form wizard
    const steps = ['Basic Info', 'Owner & Status', 'Connected Companies', 'Admin Users'];
    const [activeStep, setActiveStep] = useState(0);

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        enqueueSnackbar(message, { variant: severity });
    }, [enqueueSnackbar]);

    const fetchInitialData = useCallback(async () => {
        setPageLoading(true);
        try {
            // Fetch companies
            const companiesSnap = await getDocs(collection(db, 'companies'));
            const companiesData = companiesSnap.docs.map(d => ({
                id: d.data().companyID,
                name: d.data().name,
                status: d.data().status || 'active',
                firestoreId: d.id
            }));
            setAllCompanies(companiesData);

            // Fetch users
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersData = usersSnap.docs.map(d => ({
                id: d.id,
                name: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim(),
                email: d.data().email,
                role: d.data().role,
                status: d.data().status || 'active'
            }));
            setAllUsers(usersData);

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
                        currentOrgAdminIds = adminUsersSnap.docs.map(d => d.id);
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

    const handleAutocompleteChange = (fieldName, newValue) => {
        if (fieldName === 'connectedCompanies') {
            setFormData(prev => ({ ...prev, connectedCompanies: newValue.map(item => item.id) }));
        } else if (fieldName === 'adminUserIdsToUpdate') {
            setFormData(prev => ({ ...prev, adminUserIdsToUpdate: newValue.map(item => item.id) }));
        } else if (fieldName === 'ownerID') {
            setFormData(prev => ({ ...prev, ownerID: newValue ? newValue.id : '' }));
        }
    };

    const validate = () => {
        const errors = {};
        if (!formData.name.trim()) errors.name = 'Organization name is required.';
        if (!formData.orgID.trim()) errors.orgID = 'Organization ID is required.';
        if (!formData.ownerID) errors.ownerID = 'Owner is required.';
        if (orgIdError) errors.orgID = orgIdError;

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) {
            enqueueSnackbar('Please correct the form errors.', { variant: 'warning' });
            return;
        }

        setLoading(true);
        setSaveProgress(10);

        const newAdminSelections = formData.adminUserIdsToUpdate || [];
        const humanReadableOrgID = formData.orgID.trim();
        const previouslyAssignedAdmins = originalAdminUserIds || [];

        try {
            setSaveProgress(20);

            // Double-check for duplicate orgID (race condition safety)
            if (!isEditMode) {
                const q2 = query(collection(db, 'organizations'), where('orgID', '==', humanReadableOrgID));
                const snap2 = await getDocs(q2);
                if (!snap2.empty) {
                    enqueueSnackbar('An organization with this ID was just created. Please choose a different ID.', { variant: 'error' });
                    setLoading(false);
                    setSaveProgress(0);
                    return;
                }
            }

            setSaveProgress(40);

            const orgDataToSave = {
                name: formData.name.trim(),
                orgID: humanReadableOrgID,
                status: formData.status,
                connectedCompanies: formData.connectedCompanies || [],
                ownerID: formData.ownerID,
                updatedAt: serverTimestamp(),
            };

            let orgFirestoreIdToUpdateUsersWith = routeOrgFirestoreId;

            setSaveProgress(60);

            if (isEditMode) {
                const orgDocRef = doc(db, 'organizations', routeOrgFirestoreId);
                await setDoc(orgDocRef, orgDataToSave, { merge: true });
            } else {
                orgDataToSave.createdAt = serverTimestamp();
                const newOrgDocRef = await addDoc(collection(db, 'organizations'), orgDataToSave);
                orgFirestoreIdToUpdateUsersWith = newOrgDocRef.id;
            }

            setSaveProgress(80);

            // Update user connections
            const batch = writeBatch(db);
            const usersToAddLink = newAdminSelections.filter(uid => !previouslyAssignedAdmins.includes(uid));
            const usersToRemoveLink = previouslyAssignedAdmins.filter(uid => !newAdminSelections.includes(uid));

            usersToAddLink.forEach(userId => {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, { connectedOrganizations: arrayUnion(humanReadableOrgID) });
            });

            usersToRemoveLink.forEach(userId => {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, { connectedOrganizations: arrayRemove(humanReadableOrgID) });
            });

            if (usersToAddLink.length > 0 || usersToRemoveLink.length > 0) {
                await batch.commit();
            }

            setSaveProgress(100);
            setOriginalAdminUserIds(newAdminSelections);

            enqueueSnackbar(`Organization ${isEditMode ? 'updated' : 'created'} successfully!`, { variant: 'success' });

            setTimeout(() => {
                navigate('/admin/organizations');
            }, 1000);

        } catch (error) {
            console.error("Error saving organization:", error);
            enqueueSnackbar('Error saving organization: ' + error.message, { variant: 'error' });
            setSaveProgress(0);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            await setDoc(doc(db, 'organizations', routeOrgFirestoreId), {
                status: 'deleted',
                updatedAt: serverTimestamp()
            }, { merge: true });
            enqueueSnackbar('Organization deleted successfully.', { variant: 'success' });
            navigate('/admin/organizations');
        } catch (err) {
            enqueueSnackbar('Error deleting organization: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
            setShowDeleteDialog(false);
        }
    };

    // Render step content
    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Card sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    Enter the basic information for this organization
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Organization Name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            error={!!formErrors.name}
                                            helperText={formErrors.name}
                                            required
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Organization ID (Auto-generated from name)"
                                            name="orgID"
                                            value={formData.orgID}
                                            onChange={handleInputChange}
                                            error={!!formErrors.orgID || !!orgIdError}
                                            helperText={formErrors.orgID || orgIdError || (isCheckingOrgId ? 'Checking availability...' : 'This will be used for user connections')}
                                            required
                                            disabled={isEditMode}
                                            InputProps={{ sx: { fontSize: '12px', fontFamily: 'monospace' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                        />
                                    </Grid>
                                </Grid>
                            </Card>
                        </Grid>
                    </Grid>
                );
            case 1:
                return (
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <Card sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    Select organization owner
                                </Typography>
                                <Autocomplete
                                    options={allUsers.filter(u => u.status === 'active')}
                                    getOptionLabel={(option) => `${option.name} (${option.email || 'No email'})`}
                                    value={allUsers.find(u => u.id === formData.ownerID) || null}
                                    onChange={(event, newValue) => handleAutocompleteChange('ownerID', newValue)}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    renderOption={(props, option) => (
                                        <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                            <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '10px' }}>
                                                {option.name[0] || 'U'}
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {option.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {option.email}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                    renderInput={(params) =>
                                        <TextField
                                            {...params}
                                            label="Organization Owner"
                                            required
                                            error={!!formErrors.ownerID}
                                            helperText={formErrors.ownerID}
                                            InputProps={{
                                                ...params.InputProps,
                                                sx: { fontSize: '12px' }
                                            }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                        />
                                    }
                                />
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Card sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    Set organization status
                                </Typography>
                                <FormControl fullWidth error={!!formErrors.status} required>
                                    <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                    <Select
                                        name="status"
                                        value={formData.status}
                                        label="Status"
                                        onChange={handleInputChange}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <MenuItem value="active" sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CheckCircleIcon sx={{ fontSize: '16px', color: '#10b981' }} />
                                                Active
                                            </Box>
                                        </MenuItem>
                                        <MenuItem value="inactive" sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <WarningIcon sx={{ fontSize: '16px', color: '#f59e0b' }} />
                                                Inactive
                                            </Box>
                                        </MenuItem>
                                    </Select>
                                    {formErrors.status && <FormHelperText sx={{ fontSize: '11px' }}>{formErrors.status}</FormHelperText>}
                                </FormControl>
                            </Card>
                        </Grid>
                    </Grid>
                );
            case 2:
                return (
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Card sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    Connect companies to this organization ({formData.connectedCompanies.length} selected)
                                </Typography>
                                <Autocomplete
                                    multiple
                                    options={allCompanies.filter(c => c.status === 'active')}
                                    getOptionLabel={(option) => option.name}
                                    value={allCompanies.filter(c => formData.connectedCompanies.includes(c.id))}
                                    onChange={(event, newValue) => handleAutocompleteChange('connectedCompanies', newValue)}
                                    filterSelectedOptions
                                    renderTags={(tagValue, getTagProps) =>
                                        tagValue.map((option, index) => (
                                            <Chip
                                                key={option.id}
                                                label={option.name}
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
                                                    {option.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                                    ID: {option.id}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            variant="outlined"
                                            label="Connect Companies"
                                            placeholder="Select companies"
                                            InputProps={{
                                                ...params.InputProps,
                                                sx: { fontSize: '12px' }
                                            }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    )}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                />
                            </Card>
                        </Grid>
                    </Grid>
                );
            case 3:
                return (
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Card sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    Select admin users for this organization ({formData.adminUserIdsToUpdate.length} selected)
                                </Typography>
                                <Autocomplete
                                    multiple
                                    options={allUsers.filter(u => u.status === 'active')}
                                    getOptionLabel={(option) => `${option.name} (${option.email || 'No email'})`}
                                    value={allUsers.filter(u => formData.adminUserIdsToUpdate.includes(u.id))}
                                    onChange={(event, newValue) => handleAutocompleteChange('adminUserIdsToUpdate', newValue)}
                                    filterSelectedOptions
                                    renderTags={(tagValue, getTagProps) =>
                                        tagValue.map((option, index) => (
                                            <Chip
                                                key={option.id}
                                                avatar={<Avatar sx={{ width: 20, height: 20, fontSize: '10px' }}>{option.name[0]}</Avatar>}
                                                label={option.name}
                                                size="small"
                                                sx={{ fontSize: '11px' }}
                                                {...getTagProps({ index })}
                                            />
                                        ))
                                    }
                                    renderOption={(props, option) => (
                                        <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                            <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '10px' }}>
                                                {option.name[0] || 'U'}
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {option.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {option.email}
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
                                            InputProps={{
                                                ...params.InputProps,
                                                sx: { fontSize: '12px' }
                                            }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    )}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                />
                                <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 1 }}>
                                    Selected users will have this organization added to their connected organizations list
                                </Typography>
                            </Card>
                        </Grid>
                    </Grid>
                );
            default:
                return null;
        }
    };

    // Loading state
    if (pageLoading) {
        return (
            <Box sx={{
                backgroundColor: 'transparent',
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <CircularProgress />
            </Box>
        );
    }

    // Main render
    const renderContent = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                    {isEditMode ? `Edit Organization: ${formData.name}` : 'Add Organization'}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    {isEditMode ? 'Update organization details and relationships' : 'Create a new organization to manage company relationships'}
                </Typography>

                {/* Progress Bar */}
                {loading && (
                    <Box sx={{ mt: 2 }}>
                        <LinearProgress
                            variant="determinate"
                            value={saveProgress}
                            sx={{ height: '6px', borderRadius: '3px' }}
                        />
                        <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5 }}>
                            Saving... {saveProgress}%
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Stepper */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                <Stepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label, index) => (
                        <Step key={label}>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px' } }}>
                                {label}
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Box>

            {/* Form Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
                    {renderStepContent(activeStep)}

                    {/* Navigation Buttons */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                onClick={() => navigate('/admin/organizations')}
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
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {activeStep > 0 && (
                                <Button
                                    onClick={() => setActiveStep(prev => prev - 1)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Back
                                </Button>
                            )}
                            {activeStep < steps.length - 1 ? (
                                <Button
                                    onClick={() => setActiveStep(prev => prev + 1)}
                                    variant="contained"
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<SaveIcon />}
                                    disabled={loading || pageLoading}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {loading ? <CircularProgress size={16} color="inherit" /> : (isEditMode ? 'Save Changes' : 'Create Organization')}
                                </Button>
                            )}
                        </Box>
                    </Box>
                </Paper>
            </Box>

            {/* Delete Confirmation Dialog */}
            {isEditMode && (
                <Dialog
                    open={showDeleteDialog}
                    onClose={() => setShowDeleteDialog(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Confirm Delete</DialogTitle>
                    <DialogContent>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: '12px' }}>
                                This action will mark the organization as deleted. This cannot be undone.
                            </Typography>
                        </Alert>
                        <Typography sx={{ fontSize: '12px' }}>
                            Are you sure you want to delete the organization "{formData.name}"?
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
                            {loading ? <CircularProgress size={16} color="inherit" /> : 'Delete Organization'}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );

    return (
        <Box sx={{
            backgroundColor: 'transparent',
            width: '100%',
            height: '100%'
        }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title={isEditMode ? `Edit ${formData.name}` : 'Add Organization'}
                    onClose={onClose}
                    showBackButton={true}
                    showCloseButton={showCloseButton}
                />
            )}

            {/* Main Content */}
            <Box sx={{
                width: '100%',
                height: isModal ? 'calc(100% - 64px)' : '100%',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {renderContent()}
            </Box>
        </Box>
    );
};

export default OrganizationForm; 