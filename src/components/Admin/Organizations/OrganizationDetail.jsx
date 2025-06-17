import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, Button, CircularProgress, Chip, Stack, Divider,
    List, ListItem, ListItemIcon, ListItemText, Avatar, Alert, Tooltip, IconButton
} from '@mui/material';
import {
    Edit as EditIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Group as GroupIcon,
    LabelImportant as LabelImportantIcon,
    ContentCopy as ContentCopyIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    LocationOn as LocationIcon,
    CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';

// Import reusable components
import ModalHeader from '../../common/ModalHeader';

const OrganizationDetail = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const { id: orgId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Enhanced data states
    const [companyDetails, setCompanyDetails] = useState([]);
    const [adminUserDetails, setAdminUserDetails] = useState([]);
    const [ownerDetails, setOwnerDetails] = useState(null);
    const [stats, setStats] = useState({
        totalCompanies: 0,
        totalAdmins: 0,
        lastActivity: null
    });

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        enqueueSnackbar(message, { variant: severity });
    }, [enqueueSnackbar]);

    // Copy to clipboard handler
    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`${label} copied to clipboard`, 'success');
        } catch (error) {
            showSnackbar(`Failed to copy ${label}`, 'error');
        }
    };

    // Format date helper
    const formatDate = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        try {
            return format(timestamp.toDate(), 'MMM d, yyyy HH:mm');
        } catch (e) {
            return 'Invalid Date';
        }
    };

    // Get status chip color
    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'inactive':
                return { color: '#dc2626', bgcolor: '#fef2f2' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

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

            // Fetch enhanced company details
            if (orgData.connectedCompanies && orgData.connectedCompanies.length > 0) {
                const companyPromises = orgData.connectedCompanies.map(async (companyId) => {
                    const q = query(collection(db, 'companies'), where('companyID', '==', companyId));
                    const companySnap = await getDocs(q);
                    if (!companySnap.empty) {
                        const companyDoc = companySnap.docs[0];
                        const companyData = companyDoc.data();
                        return {
                            id: companyDoc.id,
                            firestoreId: companyDoc.id,
                            companyID: companyData.companyID,
                            name: companyData.name,
                            status: companyData.status || 'active',
                            createdAt: companyData.createdAt,
                            ownerID: companyData.ownerID
                        };
                    }
                    return { id: companyId, name: companyId + ' (Not Found)', status: 'unknown' };
                });
                setCompanyDetails(await Promise.all(companyPromises));
            }

            // Fetch admin users with enhanced details
            if (orgData.orgID) {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('connectedOrganizations', 'array-contains', orgData.orgID));
                const adminUsersSnap = await getDocs(q);
                const admins = adminUsersSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    fullName: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim()
                }));
                setAdminUserDetails(admins);
            } else {
                setAdminUserDetails([]);
            }

            // Fetch owner details with enhanced info
            if (orgData.ownerID) {
                const ownerDoc = await getDoc(doc(db, 'users', orgData.ownerID));
                if (ownerDoc.exists()) {
                    const ownerData = ownerDoc.data();
                    setOwnerDetails({
                        id: ownerDoc.id,
                        ...ownerData,
                        fullName: `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim()
                    });
                } else {
                    setOwnerDetails({ id: orgData.ownerID, fullName: 'Owner not found' });
                }
            }

            // Calculate stats
            setStats({
                totalCompanies: orgData.connectedCompanies ? orgData.connectedCompanies.length : 0,
                totalAdmins: adminUserDetails.length,
                lastActivity: orgData.updatedAt
            });

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

    // Loading state
    if (loading) {
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

    // Error state
    if (error) {
        return (
            <Box sx={{
                backgroundColor: 'transparent',
                width: '100%',
                height: '100%',
                p: 3
            }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    // No data state
    if (!organization) {
        return (
            <Box sx={{
                backgroundColor: 'transparent',
                width: '100%',
                height: '100%',
                p: 3
            }}>
                <Alert severity="warning">Organization data not available.</Alert>
            </Box>
        );
    }

    // Main content render
    const renderContent = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Avatar sx={{ width: 48, height: 48, bgcolor: '#3b82f6' }}>
                                <BusinessIcon sx={{ fontSize: '24px', color: 'white' }} />
                            </Avatar>
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                                    {organization.name}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip
                                        label={organization.status || 'unknown'}
                                        size="small"
                                        sx={{
                                            backgroundColor: getStatusColor(organization.status).bgcolor,
                                            color: getStatusColor(organization.status).color,
                                            fontWeight: 500,
                                            fontSize: '11px'
                                        }}
                                    />
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        ID: {organization.orgID || 'N/A'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/admin/organizations/${orgId}/edit`)}
                            sx={{ fontSize: '12px' }}
                        >
                            Edit Organization
                        </Button>
                    </Box>
                </Box>

                {/* Quick Stats Cards */}
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Typography sx={{ fontSize: '24px', fontWeight: 600, color: '#3b82f6' }}>
                                {stats.totalCompanies}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Connected Companies
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Typography sx={{ fontSize: '24px', fontWeight: 600, color: '#10b981' }}>
                                {adminUserDetails.length}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Admin Users
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                {formatDate(organization.updatedAt)}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Last Updated
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            {/* Main Content Section */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Grid container spacing={3}>
                    {/* Organization Details Panel */}
                    <Grid item xs={12} lg={6}>
                        <Paper sx={{ p: 3, height: 'fit-content' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#111827' }}>
                                Organization Details
                            </Typography>

                            <Grid container spacing={3}>
                                <Grid item xs={12} sm={6}>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                            Organization ID
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', p: '4px 8px', bgcolor: '#f3f4f6', borderRadius: '4px' }}>
                                                {organization.orgID || 'N/A'}
                                            </Typography>
                                            {organization.orgID && (
                                                <Tooltip title="Copy Org ID">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyToClipboard(organization.orgID, 'Org ID')}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                            Organization Owner
                                        </Typography>
                                        {ownerDetails ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ width: 24, height: 24, fontSize: '10px' }}>
                                                    {ownerDetails.firstName?.[0] || 'U'}
                                                </Avatar>
                                                <Box>
                                                    <Typography
                                                        component="button"
                                                        onClick={() => navigate(`/admin/users/${organization.ownerID}`)}
                                                        sx={{
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            color: '#3b82f6',
                                                            cursor: 'pointer',
                                                            border: 'none',
                                                            background: 'none',
                                                            textDecoration: 'underline',
                                                            '&:hover': { color: '#1d4ed8' }
                                                        }}
                                                    >
                                                        {ownerDetails.fullName}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {ownerDetails.email || 'No email'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No owner assigned</Typography>
                                        )}
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                            Date Created
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CalendarIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {formatDate(organization.createdAt)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                            Last Updated
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CalendarIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {formatDate(organization.updatedAt)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Admin Users Panel */}
                    <Grid item xs={12} lg={6}>
                        <Paper sx={{ p: 3, height: 'fit-content' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#111827' }}>
                                Organization Admins ({adminUserDetails.length})
                            </Typography>

                            {adminUserDetails.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {adminUserDetails.map(admin => (
                                        <Paper
                                            key={admin.id}
                                            sx={{
                                                p: 2,
                                                border: '1px solid #e5e7eb',
                                                bgcolor: '#f9fafb',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 2,
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: '#f3f4f6' }
                                            }}
                                            onClick={() => navigate(`/admin/users/${admin.id}`)}
                                        >
                                            <Avatar sx={{ width: 32, height: 32, fontSize: '12px' }}>
                                                {admin.firstName?.[0] || 'U'}
                                            </Avatar>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>
                                                    {admin.fullName || 'No name'}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {admin.email || 'No email'}
                                                </Typography>
                                                {admin.role && (
                                                    <Chip
                                                        label={admin.role}
                                                        size="small"
                                                        sx={{ fontSize: '10px', height: '20px', mt: 0.5 }}
                                                    />
                                                )}
                                            </Box>
                                        </Paper>
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <GroupIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                    <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                        No admin users assigned
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                        Add users to manage this organization
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* Connected Companies Panel */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#111827' }}>
                                Connected Companies ({companyDetails.length})
                            </Typography>

                            {companyDetails.length > 0 ? (
                                <Grid container spacing={2}>
                                    {companyDetails.map(company => (
                                        <Grid item xs={12} sm={6} md={4} key={company.id || company.companyID}>
                                            <Paper
                                                sx={{
                                                    p: 2,
                                                    border: '1px solid #e5e7eb',
                                                    bgcolor: '#f9fafb',
                                                    cursor: 'pointer',
                                                    '&:hover': { bgcolor: '#f3f4f6', borderColor: '#3b82f6' }
                                                }}
                                                onClick={() => navigate(`/admin/companies/${company.firestoreId}`)}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#3b82f6' }}>
                                                        <BusinessIcon sx={{ fontSize: '16px', color: 'white' }} />
                                                    </Avatar>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#111827', mb: 0.5 }}>
                                                            {company.name}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                                            ID: {company.companyID || company.id}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                                            <Chip
                                                                label={company.status || 'unknown'}
                                                                size="small"
                                                                sx={{
                                                                    backgroundColor: getStatusColor(company.status).bgcolor,
                                                                    color: getStatusColor(company.status).color,
                                                                    fontSize: '10px',
                                                                    height: '20px'
                                                                }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    ))}
                                </Grid>
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <BusinessIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                    <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                        No companies connected
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                        Connect companies to this organization to manage relationships
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
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
                    title={organization.name}
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

export default OrganizationDetail; 