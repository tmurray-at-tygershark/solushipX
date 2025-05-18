import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, Button, CircularProgress, Chip, Stack, Divider,
    List, ListItem, ListItemIcon, ListItemText, Avatar, Breadcrumbs, Link as MuiLink, Alert
} from '@mui/material';
import {
    Edit as EditIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Group as GroupIcon, // For org admins
    LabelImportant as LabelImportantIcon // For Org ID
} from '@mui/icons-material';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';

const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleString();
};

const OrganizationDetail = () => {
    const { id: orgId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [companyDetails, setCompanyDetails] = useState([]); // Stores {id, name} for connected companies
    const [adminUserDetails, setAdminUserDetails] = useState([]); // Stores {id, name, email} for admin users
    const [ownerDetails, setOwnerDetails] = useState(null); // Stores {id, name, email} for owner

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const orgDocRef = doc(db, 'organizations', orgId);
            const orgDoc = await getDoc(orgDocRef);

            if (!orgDoc.exists()) {
                enqueueSnackbar('Organization not found.', { variant: 'error' });
                navigate('/admin/organizations');
                return;
            }
            const orgData = orgDoc.data();
            setOrganization(orgData);

            // Fetch details for connected companies
            if (orgData.connectedCompanies && orgData.connectedCompanies.length > 0) {
                const companyPromises = orgData.connectedCompanies.map(async (companyId) => {
                    const q = query(collection(db, 'companies'), where('companyID', '==', companyId));
                    const companySnap = await getDocs(q);
                    if (!companySnap.empty) {
                        const companyDocData = companySnap.docs[0].data();
                        return { id: companySnap.docs[0].id, firestoreId: companySnap.docs[0].id, companyID: companyDocData.companyID, name: companyDocData.name };
                    }
                    return { id: companyId, name: companyId + ' (Not Found)' };
                });
                setCompanyDetails(await Promise.all(companyPromises));
            }

            // Fetch admin users by querying the 'users' collection
            // where their 'connectedOrganizations' array contains the current organization's human-readable orgID
            if (orgData.orgID) { // Ensure we have the human-readable orgID
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('connectedOrganizations', 'array-contains', orgData.orgID));
                const adminUsersSnap = await getDocs(q);
                const admins = adminUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAdminUserDetails(admins);
                console.log(`Found ${admins.length} admin users for orgID ${orgData.orgID}:`, admins);
            } else {
                setAdminUserDetails([]);
                console.warn("Organization data does not have an orgID field to fetch admin users.");
            }

            // Fetch owner details
            if (orgData.ownerID) {
                const ownerDoc = await getDoc(doc(db, 'users', orgData.ownerID));
                if (ownerDoc.exists()) {
                    setOwnerDetails({ id: ownerDoc.id, ...ownerDoc.data() });
                } else {
                    setOwnerDetails({ id: orgData.ownerID, name: 'Owner not found' });
                }
            }

        } catch (err) {
            console.error("Error fetching organization details:", err);
            setError('Failed to load organization details: ' + err.message);
            enqueueSnackbar('Failed to load details: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [orgId, navigate, enqueueSnackbar]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
    }

    if (!organization) {
        return <Box sx={{ p: 3 }}><Alert severity="warning">Organization data not available.</Alert></Box>;
    }

    const getStatusChip = (status) => (
        <Chip
            label={status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
            color={status === 'active' ? 'success' : status === 'inactive' ? 'default' : 'warning'}
            size="small"
            sx={{ ml: 1 }}
        />
    );

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
                    {organization.name}
                    {getStatusChip(organization.status)}
                </Typography>
                <Breadcrumbs aria-label="breadcrumb" sx={{ mt: 1 }}>
                    <RouterLink component={MuiLink} to="/admin" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Admin
                    </RouterLink>
                    <RouterLink component={MuiLink} to="/admin/organizations" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Organizations
                    </RouterLink>
                    <Typography color="text.primary">{organization.name}</Typography>
                </Breadcrumbs>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">Organization Details</Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => navigate(`/admin/organizations/${orgId}/edit`)}
                            >
                                Edit Organization
                            </Button>
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Organization ID</Typography>
                                <Chip icon={<LabelImportantIcon fontSize="small" />} label={organization.orgID || 'N/A'} size="small" variant="outlined" />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Owner</Typography>
                                {ownerDetails ? (
                                    <Chip
                                        avatar={<Avatar>{ownerDetails.firstName?.[0] || 'U'}</Avatar>}
                                        label={`${ownerDetails.firstName || ''} ${ownerDetails.lastName || ''} (${ownerDetails.email || 'N/A'})`}
                                        onClick={() => navigate(`/admin/users/${organization.ownerID}`)}
                                        clickable
                                        size="small"
                                    />
                                ) : <Typography variant="body2">N/A</Typography>}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Date Created</Typography>
                                <Typography variant="body1">{formatDate(organization.createdAt)}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" color="textSecondary">Last Updated</Typography>
                                <Typography variant="body1">{formatDate(organization.updatedAt)}</Typography>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Connected Companies ({companyDetails.length})</Typography>
                        {companyDetails.length > 0 ? (
                            <List dense>
                                {companyDetails.map(company => (
                                    <ListItem key={company.id || company.companyID} disablePadding>
                                        <ListItemIcon sx={{ minWidth: 36 }}><BusinessIcon fontSize="small" /></ListItemIcon>
                                        <ListItemText
                                            primary={company.name}
                                            secondary={`ID: ${company.companyID || company.id}`}
                                            onClick={() => navigate(`/admin/companies/${company.firestoreId}`)} // Assuming company.id is Firestore doc ID
                                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography color="text.secondary">No companies are currently connected to this organization.</Typography>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>Organization Admins ({adminUserDetails.length})</Typography>
                        {adminUserDetails.length > 0 ? (
                            <List dense>
                                {adminUserDetails.map(adminUser => (
                                    <ListItem key={adminUser.id} disablePadding>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.8rem' }}>
                                                {adminUser.firstName?.[0]}
                                            </Avatar>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={`${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim()}
                                            secondary={adminUser.email}
                                            onClick={() => navigate(`/admin/users/${adminUser.id}`)}
                                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography color="text.secondary">No admin users assigned to this organization.</Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default OrganizationDetail; 