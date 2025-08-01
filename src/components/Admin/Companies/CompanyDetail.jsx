import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Button,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Switch,
    Avatar,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Edit as EditIcon,
    LocalShipping as LocalShippingIcon,
    Business as BusinessIcon,
    People as PeopleIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { formatDateString } from '../../../utils/dateUtils';
import { useSnackbar } from 'notistack';
import { useCompany } from '../../../contexts/CompanyContext';
import { getLightBackgroundLogo } from '../../../utils/logoUtils';

const CompanyDetail = () => {
    const { id: companyFirestoreId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { refreshCompanyData } = useCompany();
    const [company, setCompany] = useState(null);
    const [ownerDetails, setOwnerDetails] = useState(null);
    const [adminUsers, setAdminUsers] = useState([]);
    const [mainContact, setMainContact] = useState(null);
    const [billingAddress, setBillingAddress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Carrier management dialog states
    const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
    const [allCarriers, setAllCarriers] = useState([]);
    const [carrierLoading, setCarrierLoading] = useState(false);

    // Load all available carriers
    const loadCarriers = useCallback(async () => {
        setCarrierLoading(true);
        try {
            const carriersSnapshot = await getDocs(collection(db, 'carriers'));
            const carriers = carriersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllCarriers(carriers);
        } catch (err) {
            console.error('Error loading carriers:', err);
            enqueueSnackbar('Failed to load carriers', { variant: 'error' });
        }
        setCarrierLoading(false);
    }, [enqueueSnackbar]);

    // Handle carrier toggle for this company
    const handleCarrierToggle = useCallback(async (carrier, enabled) => {
        try {
            const companyRef = doc(db, 'companies', companyFirestoreId);
            const currentConnectedCarriers = company?.connectedCarriers || [];

            let updatedConnectedCarriers;

            if (enabled) {
                // Add carrier if not already connected
                const existingIndex = currentConnectedCarriers.findIndex(cc =>
                    cc.carrierID === carrier.carrierID
                );

                if (existingIndex === -1) {
                    updatedConnectedCarriers = [...currentConnectedCarriers, {
                        carrierID: carrier.carrierID,
                        carrierName: carrier.name,
                        enabled: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }];
                } else {
                    updatedConnectedCarriers = currentConnectedCarriers.map((cc, index) =>
                        index === existingIndex ? { ...cc, enabled: true, updatedAt: new Date() } : cc
                    );
                }
            } else {
                // Disable carrier (keep in array but set enabled: false)
                updatedConnectedCarriers = currentConnectedCarriers.map(cc =>
                    cc.carrierID === carrier.carrierID
                        ? { ...cc, enabled: false, updatedAt: new Date() }
                        : cc
                );
            }

            await updateDoc(companyRef, {
                connectedCarriers: updatedConnectedCarriers,
                updatedAt: serverTimestamp()
            });

            // Update local state
            setCompany(prev => ({
                ...prev,
                connectedCarriers: updatedConnectedCarriers
            }));

            enqueueSnackbar(
                `${carrier.name} ${enabled ? 'enabled' : 'disabled'} for this company`,
                { variant: 'success' }
            );

        } catch (err) {
            console.error('Error updating carrier connection:', err);
            enqueueSnackbar('Failed to update carrier connection', { variant: 'error' });
        }
    }, [company, companyFirestoreId, enqueueSnackbar]);

    // Check if carrier is enabled for this company
    const isCarrierEnabled = useCallback((carrierID) => {
        const connectedCarrier = company?.connectedCarriers?.find(cc => cc.carrierID === carrierID);
        return connectedCarrier?.enabled === true;
    }, [company]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('[CompanyDetail] Starting data fetch for companyFirestoreId:', companyFirestoreId);

            const companyDocRef = doc(db, 'companies', companyFirestoreId);
            const companyDoc = await getDoc(companyDocRef);

            if (!companyDoc.exists()) {
                setError('Company not found');
                setLoading(false);
                return;
            }
            const companyData = { id: companyDoc.id, ...companyDoc.data() };
            setCompany(companyData);
            console.log('[CompanyDetail] Company data loaded:', companyData);

            // Fetch owner details
            if (companyData.ownerID) {
                try {
                    const ownerDoc = await getDoc(doc(db, 'users', companyData.ownerID));
                    if (ownerDoc.exists()) {
                        setOwnerDetails({ id: ownerDoc.id, ...ownerDoc.data() });
                        console.log('[CompanyDetail] Owner details loaded:', ownerDoc.data());
                    }
                } catch (ownerErr) {
                    console.error('[CompanyDetail] Error fetching owner details:', ownerErr);
                }
            }

            // Fetch admin users
            if (companyData.companyID) {
                try {
                    const usersRef = collection(db, 'users');
                    const q = query(usersRef, where('connectedCompanies.companies', 'array-contains', companyData.companyID));
                    const adminUsersSnap = await getDocs(q);
                    const admins = adminUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setAdminUsers(admins);
                    console.log('[CompanyDetail] Admin users loaded:', admins.length, 'users');
                } catch (adminErr) {
                    console.error('[CompanyDetail] Error fetching admin users:', adminErr);
                    setAdminUsers([]);
                }
            }

            // Fetch address book records (main contact and billing)
            const addressBookRef = collection(db, 'addressBook');
            if (companyData.companyID) {
                console.log('[CompanyDetail] Fetching address records for companyID:', companyData.companyID);

                try {
                    // Fetch main contact with enhanced query
                    console.log('[CompanyDetail] Querying main contact...');
                    const mainContactQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyData.companyID),
                        where('addressType', '==', 'contact')
                    );
                    const mainContactSnapshot = await getDocs(mainContactQuery);
                    console.log('[CompanyDetail] Main contact query results:', mainContactSnapshot.size, 'documents');

                    if (!mainContactSnapshot.empty) {
                        const contactData = { id: mainContactSnapshot.docs[0].id, ...mainContactSnapshot.docs[0].data() };
                        setMainContact(contactData);
                        console.log('[CompanyDetail] Main contact loaded:', contactData);
                    } else {
                        console.log('[CompanyDetail] No main contact found');
                        setMainContact(null);
                    }
                } catch (contactErr) {
                    console.error('[CompanyDetail] Error fetching main contact:', contactErr);
                    setMainContact(null);
                }

                try {
                    // Fetch billing address with enhanced query
                    console.log('[CompanyDetail] Querying billing address...');
                    const billingQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyData.companyID),
                        where('addressType', '==', 'billing')
                    );
                    const billingSnapshot = await getDocs(billingQuery);
                    console.log('[CompanyDetail] Billing address query results:', billingSnapshot.size, 'documents');

                    if (!billingSnapshot.empty) {
                        const billingData = { id: billingSnapshot.docs[0].id, ...billingSnapshot.docs[0].data() };
                        setBillingAddress(billingData);
                        console.log('[CompanyDetail] Billing address loaded:', billingData);
                    } else {
                        console.log('[CompanyDetail] No billing address found');
                        setBillingAddress(null);
                    }
                } catch (billingErr) {
                    console.error('[CompanyDetail] Error fetching billing address:', billingErr);
                    setBillingAddress(null);
                }

                // Alternative query to debug - fetch all address records for this company
                try {
                    console.log('[CompanyDetail] Running debug query for all company addresses...');
                    const debugQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyData.companyID)
                    );
                    const debugSnapshot = await getDocs(debugQuery);
                    console.log('[CompanyDetail] Total company address records found:', debugSnapshot.size);
                    debugSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        console.log('[CompanyDetail] Found address record:', {
                            id: doc.id,
                            addressType: data.addressType,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            email: data.email
                        });
                    });
                } catch (debugErr) {
                    console.error('[CompanyDetail] Debug query error:', debugErr);
                }
            }

        } catch (err) {
            console.error('[CompanyDetail] Error loading company data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [companyFirestoreId]);



    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }
    if (error) {
        return <Box sx={{ p: 3 }}><Alert severity="error">Error: {error}</Alert></Box>;
    }
    if (!company) {
        return <Box sx={{ p: 3 }}><Alert severity="warning">Company not found</Alert></Box>;
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {/* Company Logo */}
                        <Box
                            sx={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                border: '2px solid #e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: '#f8fafc',
                                overflow: 'hidden'
                            }}
                        >
                            {(() => {
                                // Use new multi-logo system for company detail display (light background)
                                const logoUrl = getLightBackgroundLogo(company);

                                return logoUrl ? (
                                    <Box
                                        component="img"
                                        src={logoUrl}
                                        alt={`${company.name} logo`}
                                        sx={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null;
                            })()}
                            <Box
                                sx={{
                                    display: (() => {
                                        const logoUrl = getLightBackgroundLogo(company);
                                        return logoUrl ? 'none' : 'flex';
                                    })(),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: '100%',
                                    color: '#6b7280'
                                }}
                            >
                                <BusinessIcon sx={{ fontSize: '28px' }} />
                            </Box>
                        </Box>

                        {/* Company Name and Description */}
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                                {company.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                Company details and configuration
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PeopleIcon />}
                            component={RouterLink}
                            to={`/admin/customers?company=${company?.companyID}`}
                            sx={{ fontSize: '12px' }}
                        >
                            Customers
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<EditIcon />}
                            component={RouterLink}
                            to={`/admin/companies/${companyFirestoreId}/edit`}
                            sx={{ fontSize: '12px' }}
                        >
                            Edit
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ p: 3 }}>
                    <Grid container spacing={3}>
                        {/* Company Overview - Consolidated Information */}
                        <Grid item xs={12}>
                            <Paper sx={{
                                p: 3,
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                bgcolor: '#ffffff'
                            }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 3 }}>
                                    Company Overview
                                </Typography>
                                <Grid container spacing={3}>
                                    {/* Basic Company Information */}
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2 }}>
                                            Company Details
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Company Name</Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827' }}>{company.name}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Company ID</Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827', fontFamily: 'monospace' }}>{company.companyID}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Status</Typography>
                                                <Chip
                                                    label={company.status === 'active' ? 'Active' : 'Inactive'}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: company.status === 'active' ? '#f1f8f5' : '#fef2f2',
                                                        color: company.status === 'active' ? '#0a875a' : '#dc2626',
                                                        fontWeight: 500,
                                                        fontSize: '11px',
                                                        '& .MuiChip-label': { px: 1.5 }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Created</Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827' }}>{formatDateString(company.createdAt)}</Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Website</Typography>
                                                {company.website ? (
                                                    <Typography
                                                        variant="body1"
                                                        component="a"
                                                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        sx={{
                                                            fontSize: '12px',
                                                            color: '#3b82f6',
                                                            textDecoration: 'none',
                                                            '&:hover': { textDecoration: 'underline' }
                                                        }}
                                                    >
                                                        {company.website}
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>No website provided</Typography>
                                                )}
                                            </Grid>
                                        </Grid>
                                    </Grid>

                                    {/* Owner & Contact Information */}
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2 }}>
                                            Owner & Contact
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Company Owner</Typography>
                                                {ownerDetails ? (
                                                    <Box>
                                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827' }}>
                                                            {`${ownerDetails.firstName} ${ownerDetails.lastName}`}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {ownerDetails.email}
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No owner assigned</Typography>
                                                )}
                                            </Grid>
                                            {mainContact && (
                                                <>
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Main Contact</Typography>
                                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                            {(mainContact.firstName || mainContact.lastName)
                                                                ? `${mainContact.firstName || ''} ${mainContact.lastName || ''}`.trim()
                                                                : 'No name provided'
                                                            }
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {mainContact.email || 'No email'}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6}>
                                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Contact Phone</Typography>
                                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                            {mainContact.phone || 'No phone provided'}
                                                        </Typography>
                                                    </Grid>
                                                </>
                                            )}
                                            {billingAddress && (
                                                <Grid item xs={12}>
                                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Billing Contact</Typography>
                                                    <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                        {(billingAddress.firstName || billingAddress.lastName)
                                                            ? `${billingAddress.firstName || ''} ${billingAddress.lastName || ''}`.trim()
                                                            : 'No billing contact'
                                                        }
                                                    </Typography>
                                                    {billingAddress.email && (
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {billingAddress.email}
                                                        </Typography>
                                                    )}
                                                </Grid>
                                            )}
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Company Admins */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{
                                p: 3,
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                bgcolor: '#ffffff',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2 }}>
                                    Company Admins
                                </Typography>
                                <Box sx={{ flex: 1 }}>
                                    {adminUsers.length > 0 ? (
                                        <List sx={{ p: 0 }}>
                                            {adminUsers.map((admin) => (
                                                <ListItem key={admin.id} sx={{ px: 0, py: 1 }}>
                                                    <ListItemText
                                                        primary={<Typography sx={{ fontSize: '12px', color: '#111827', fontWeight: 500 }}>{`${admin.firstName} ${admin.lastName}`}</Typography>}
                                                        secondary={<Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{admin.email}</Typography>}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No admins assigned</Typography>
                                    )}
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Connected Carriers */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{
                                p: 3,
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                bgcolor: '#ffffff',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
                                        Connected Carriers
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<LocalShippingIcon />}
                                        onClick={() => {
                                            setCarrierDialogOpen(true);
                                            loadCarriers();
                                        }}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Manage Carriers
                                    </Button>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    {company.connectedCarriers && company.connectedCarriers.length > 0 ? (
                                        <TableContainer>
                                            <Table>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier Name</TableCell>
                                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Connected Since</TableCell>
                                                        <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Last Updated</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {company.connectedCarriers.map((carrier) => (
                                                        <TableRow key={carrier.carrierID}>
                                                            <TableCell sx={{ fontSize: '12px' }}>{carrier.carrierName}</TableCell>
                                                            <TableCell>
                                                                <Chip
                                                                    label={carrier.enabled ? 'Enabled' : 'Disabled'}
                                                                    size="small"
                                                                    sx={{
                                                                        backgroundColor: carrier.enabled ? '#f1f8f5' : '#fef2f2',
                                                                        color: carrier.enabled ? '#0a875a' : '#dc2626',
                                                                        fontWeight: 500,
                                                                        fontSize: '11px',
                                                                        '& .MuiChip-label': { px: 1.5 }
                                                                    }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>{formatDateString(carrier.createdAt)}</TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>{formatDateString(carrier.updatedAt)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No carriers connected to this company.</Typography>
                                    )}
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            </Box>

            {/* Carrier Management Dialog */}
            <Dialog
                open={carrierDialogOpen}
                onClose={() => setCarrierDialogOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '8px',
                        minHeight: '500px'
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pb: 2,
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalShippingIcon sx={{ color: '#6366f1' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
                            Manage Carriers for {company?.companyName}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={() => setCarrierDialogOpen(false)}
                        size="small"
                        sx={{ color: '#6b7280' }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    {carrierLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                                Enable or disable carriers for this company. Enabled carriers will be available when creating shipments.
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {allCarriers.map((carrier) => (
                                    <Paper
                                        key={carrier.id}
                                        sx={{
                                            p: 2,
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            backgroundColor: isCarrierEnabled(carrier.carrierID) ? '#f0f9ff' : '#ffffff'
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Avatar
                                                    src={carrier.logo}
                                                    sx={{
                                                        width: 40,
                                                        height: 40,
                                                        backgroundColor: '#f3f4f6',
                                                        color: '#6b7280',
                                                        fontSize: '14px',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {carrier.name?.charAt(0)?.toUpperCase()}
                                                </Avatar>
                                                <Box>
                                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                                        {carrier.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        ID: {carrier.carrierID} • Type: {carrier.carrierType || 'Not specified'}
                                                    </Typography>
                                                    {carrier.connectionType && (
                                                        <Chip
                                                            label={carrier.connectionType.toUpperCase()}
                                                            size="small"
                                                            sx={{
                                                                fontSize: '10px',
                                                                height: '20px',
                                                                mt: 0.5,
                                                                backgroundColor: carrier.connectionType === 'api' ? '#dcfce7' : '#fef3c7',
                                                                color: carrier.connectionType === 'api' ? '#166534' : '#92400e'
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>

                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip
                                                    label={isCarrierEnabled(carrier.carrierID) ? 'Enabled' : 'Disabled'}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: isCarrierEnabled(carrier.carrierID) ? '#f1f8f5' : '#fef2f2',
                                                        color: isCarrierEnabled(carrier.carrierID) ? '#0a875a' : '#dc2626',
                                                        fontWeight: 500,
                                                        fontSize: '11px'
                                                    }}
                                                />
                                                <Switch
                                                    checked={isCarrierEnabled(carrier.carrierID)}
                                                    onChange={(e) => handleCarrierToggle(carrier, e.target.checked)}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                                            color: '#10b981'
                                                        },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                            backgroundColor: '#10b981'
                                                        }
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        </>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb' }}>
                    <Button
                        variant="outlined"
                        onClick={() => setCarrierDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default CompanyDetail; 