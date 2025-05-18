import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, TextField, Button, CircularProgress, FormControl,
    InputLabel, Select, MenuItem, Autocomplete, Stack, Breadcrumbs, Link as MuiLink, Alert, FormHelperText
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp, writeBatch, addDoc, updateDoc, arrayUnion, arrayRemove, FieldValue, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';

const OrganizationForm = () => {
    const { id: routeOrgFirestoreId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const isEditMode = Boolean(routeOrgFirestoreId);

    const [formData, setFormData] = useState({
        name: '',
        orgID: '',
        status: 'active',
        connectedCompanies: [],
        adminUserIdsToUpdate: [],
        ownerID: ''
    });
    const [originalAdminUserIds, setOriginalAdminUserIds] = useState([]);

    const [allCompanies, setAllCompanies] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(isEditMode);
    const [formErrors, setFormErrors] = useState({});

    const fetchInitialData = useCallback(async () => {
        setPageLoading(true);
        try {
            const companiesSnap = await getDocs(collection(db, 'companies'));
            setAllCompanies(companiesSnap.docs.map(d => ({ id: d.data().companyID, name: d.data().name })));

            const usersSnap = await getDocs(collection(db, 'users'));
            setAllUsers(usersSnap.docs.map(d => ({ id: d.id, name: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim(), email: d.data().email })));

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
                        adminUserIdsToUpdate: currentOrgAdminIds, // Pre-fill with actual admins
                        ownerID: orgData.ownerID || ''
                    });
                    setOriginalAdminUserIds(currentOrgAdminIds); // Store these as the original for diffing
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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let newOrgID = formData.orgID;
        if (name === 'name' && !isEditMode) {
            newOrgID = value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            setFormData(prev => ({ ...prev, [name]: value, orgID: newOrgID }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
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
        if (!formData.orgID.trim()) errors.orgID = 'Organization ID (human-readable) is required.';
        if (!formData.ownerID) errors.ownerID = 'Owner is required.';
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

        const newAdminSelections = formData.adminUserIdsToUpdate || [];
        const humanReadableOrgID = formData.orgID.trim();
        const previouslyAssignedAdmins = originalAdminUserIds || [];

        console.log("handleSubmit: Starting organization save/update.");
        console.log("handleSubmit: Form Data:", formData);
        console.log("handleSubmit: Human Readable OrgID for user linking:", humanReadableOrgID);
        console.log("handleSubmit: Previously Assigned Admins (before this save):", previouslyAssignedAdmins);
        console.log("handleSubmit: New Admin Selections from form (target state):", newAdminSelections);

        try {
            const orgDataToSave = {
                name: formData.name.trim(),
                orgID: humanReadableOrgID,
                status: formData.status,
                connectedCompanies: formData.connectedCompanies || [],
                ownerID: formData.ownerID,
                updatedAt: serverTimestamp(),
            };

            let orgFirestoreIdToUpdateUsersWith = routeOrgFirestoreId;

            if (isEditMode) {
                const orgDocRef = doc(db, 'organizations', routeOrgFirestoreId);
                await setDoc(orgDocRef, orgDataToSave, { merge: true });
                console.log(`handleSubmit: Updated existing organization, Firestore ID: ${routeOrgFirestoreId}`);
            } else {
                orgDataToSave.createdAt = serverTimestamp();
                const newOrgDocRef = await addDoc(collection(db, 'organizations'), orgDataToSave);
                orgFirestoreIdToUpdateUsersWith = newOrgDocRef.id; // Use the new auto-ID for logging for new orgs
                console.log(`handleSubmit: Created new organization, Firestore ID: ${orgFirestoreIdToUpdateUsersWith}`);
            }

            const batch = writeBatch(db);
            const usersToAddLink = newAdminSelections.filter(uid => !previouslyAssignedAdmins.includes(uid));
            const usersToRemoveLink = previouslyAssignedAdmins.filter(uid => !newAdminSelections.includes(uid));

            console.log(`handleSubmit: Org's humanReadableOrgID: ${humanReadableOrgID}`);
            console.log("handleSubmit: Users to ADD org link for:", usersToAddLink);
            console.log("handleSubmit: Users to REMOVE org link for:", usersToRemoveLink);

            usersToAddLink.forEach(userId => {
                const userRef = doc(db, 'users', userId);
                console.log(`BATCHING: Add org [${humanReadableOrgID}] to user ${userId}`);
                batch.update(userRef, { connectedOrganizations: arrayUnion(humanReadableOrgID) });
            });

            usersToRemoveLink.forEach(userId => {
                const userRef = doc(db, 'users', userId);
                console.log(`BATCHING: Remove org [${humanReadableOrgID}] from user ${userId}`);
                batch.update(userRef, { connectedOrganizations: arrayRemove(humanReadableOrgID) });
            });

            if (usersToAddLink.length > 0 || usersToRemoveLink.length > 0) {
                console.log("handleSubmit: Attempting to commit batch for user updates...");
                await batch.commit();
                console.log('handleSubmit: Batch committed successfully for user connectedOrganizations updates.');
            } else {
                console.log("handleSubmit: No user organization links to update.");
            }

            setOriginalAdminUserIds(newAdminSelections);

            enqueueSnackbar(`Organization ${isEditMode ? 'updated' : 'created'} successfully!`, { variant: 'success' });
            navigate('/admin/organizations');

        } catch (error) {
            console.error("Error saving organization or updating users:", error);
            enqueueSnackbar('Error saving organization: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    {isEditMode ? `Edit Organization: ${formData.name}` : 'Add Organization'}
                </Typography>
                <Breadcrumbs aria-label="breadcrumb">
                    <RouterLink component={MuiLink} to="/admin" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Admin
                    </RouterLink>
                    <RouterLink component={MuiLink} to="/admin/organizations" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Organizations
                    </RouterLink>
                    <Typography color="text.primary">
                        {isEditMode ? formData.name : 'Create New'}
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Paper component="form" onSubmit={handleSubmit} elevation={2} sx={{ p: { xs: 2, sm: 3 } }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Organization Name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            error={!!formErrors.name}
                            helperText={formErrors.name}
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Organization ID (Human-readable, e.g., ORG_NAME)"
                            name="orgID"
                            value={formData.orgID}
                            onChange={handleInputChange}
                            error={!!formErrors.orgID}
                            helperText={formErrors.orgID}
                            required
                            disabled={isEditMode}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth error={!!formErrors.status} required>
                            <InputLabel>Status</InputLabel>
                            <Select name="status" value={formData.status} label="Status" onChange={handleInputChange}>
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="inactive">Inactive</MenuItem>
                            </Select>
                            {formErrors.status && <FormHelperText>{formErrors.status}</FormHelperText>}
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={allUsers}
                            getOptionLabel={(option) => `${option.name} (${option.email || 'No email'})`}
                            value={allUsers.find(u => u.id === formData.ownerID) || null}
                            onChange={(event, newValue) => handleAutocompleteChange('ownerID', newValue)}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            renderInput={(params) =>
                                <TextField {...params} label="Organization Owner" required error={!!formErrors.ownerID} helperText={formErrors.ownerID} />
                            }
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Autocomplete
                            multiple
                            id="connected-companies-org-form"
                            options={allCompanies}
                            getOptionLabel={(option) => option.name}
                            value={allCompanies.filter(c => formData.connectedCompanies.includes(c.id))}
                            onChange={(event, newValue) => handleAutocompleteChange('connectedCompanies', newValue)}
                            filterSelectedOptions
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    variant="outlined"
                                    label="Connect Companies to this Organization"
                                    placeholder="Select companies"
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Organization Admins</Typography>
                        <Autocomplete
                            multiple
                            id="admin-user-ids-org-form"
                            options={allUsers}
                            getOptionLabel={(option) => `${option.name} (${option.email || 'No email'})`}
                            value={allUsers.filter(u => formData.adminUserIdsToUpdate.includes(u.id))}
                            onChange={(event, newValue) => handleAutocompleteChange('adminUserIdsToUpdate', newValue)}
                            filterSelectedOptions
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    variant="outlined"
                                    label="Select Users to be Organization Admins"
                                    placeholder="Select users"
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                        />
                        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                            Selected users will have this organization (by its Org ID: {formData.orgID || '...'}) added to their 'connectedOrganizations' field.
                        </Typography>
                    </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button onClick={() => navigate('/admin/organizations')} variant="outlined" color="inherit" startIcon={<CancelIcon />} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" color="primary" startIcon={<SaveIcon />} disabled={loading || pageLoading}>
                        {loading || pageLoading ? <CircularProgress size={20} color="inherit" /> : (isEditMode ? 'Save Changes' : 'Add Organization')}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default OrganizationForm; 