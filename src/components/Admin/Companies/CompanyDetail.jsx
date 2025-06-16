import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Button,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    CircularProgress,
    Alert,
    Breadcrumbs,
    Link as MuiLink,
    Avatar,
    Stack,
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
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Business as BusinessIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    LocationOn as LocationIcon,
    Edit as EditIcon,
    Person as PersonIcon,
    Group as GroupIcon,
    Badge as BadgeIcon,
    LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { formatDateString } from '../../../utils/dateUtils';
import './CompanyDetail.css';
import { useSnackbar } from 'notistack';
import { useCompany } from '../../../contexts/CompanyContext';

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
    const [origins, setOrigins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [manageCarriersOpen, setManageCarriersOpen] = useState(false);
    const [availableCarriers, setAvailableCarriers] = useState([]);
    const [connectedCarriers, setConnectedCarriers] = useState([]);
    const [loadingCarriers, setLoadingCarriers] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const companyDocRef = doc(db, 'companies', companyFirestoreId);
            const companyDoc = await getDoc(companyDocRef);

            if (!companyDoc.exists()) {
                setError('Company not found');
                setLoading(false);
                return;
            }
            const companyData = { id: companyDoc.id, ...companyDoc.data() };
            setCompany(companyData);

            if (companyData.ownerID) {
                const ownerDoc = await getDoc(doc(db, 'users', companyData.ownerID));
                if (ownerDoc.exists()) {
                    setOwnerDetails({ id: ownerDoc.id, ...ownerDoc.data() });
                }
            }

            if (companyData.companyID) {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('connectedCompanies.companies', 'array-contains', companyData.companyID));
                const adminUsersSnap = await getDocs(q);
                const admins = adminUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAdminUsers(admins);
            }

            const addressBookRef = collection(db, 'addressBook');
            if (companyData.companyID) {
                const mainContactQuery = query(addressBookRef, where('addressClass', '==', 'company'), where('addressClassID', '==', companyData.companyID), where('addressType', '==', 'contact'), where('status', '!=', 'deleted'));
                const mainContactSnapshot = await getDocs(mainContactQuery);
                if (!mainContactSnapshot.empty) {
                    setMainContact({ id: mainContactSnapshot.docs[0].id, ...mainContactSnapshot.docs[0].data() });
                }
                const billingQuery = query(addressBookRef, where('addressClass', '==', 'company'), where('addressClassID', '==', companyData.companyID), where('addressType', '==', 'billing'), where('status', '!=', 'deleted'));
                const billingSnapshot = await getDocs(billingQuery);
                if (!billingSnapshot.empty) {
                    setBillingAddress({ id: billingSnapshot.docs[0].id, ...billingSnapshot.docs[0].data() });
                } else {
                    setBillingAddress(null);
                }
                const originsQuery = query(addressBookRef, where('addressClass', '==', 'company'), where('addressClassID', '==', companyData.companyID), where('addressType', '==', 'origin'), where('status', '!=', 'deleted'));
                const originsSnapshot = await getDocs(originsQuery);
                setOrigins(originsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            }

        } catch (err) {
            console.error('Error loading company data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [companyFirestoreId]);

    const fetchCarriers = async () => {
        setLoadingCarriers(true);
        try {
            // Fetch all carriers
            const carriersRef = collection(db, 'carriers');
            const carriersSnapshot = await getDocs(carriersRef);
            const carriersData = carriersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAvailableCarriers(carriersData);

            // Fetch connected carriers for this company
            if (company?.connectedCarriers) {
                setConnectedCarriers(company.connectedCarriers);
            } else {
                setConnectedCarriers([]);
            }
        } catch (err) {
            console.error('Error fetching carriers:', err);
            setError('Error loading carriers');
        } finally {
            setLoadingCarriers(false);
        }
    };

    const handleManageCarriers = () => {
        fetchCarriers();
        setManageCarriersOpen(true);
    };

    const handleCloseManageCarriers = () => {
        setManageCarriersOpen(false);
    };

    const handleToggleCarrier = async (carrierId, carrierName) => {
        try {
            const isConnected = connectedCarriers.some(c => c.carrierID === carrierId);
            let updatedConnectedCarriers;

            if (isConnected) {
                // Remove carrier
                updatedConnectedCarriers = connectedCarriers.filter(c => c.carrierID !== carrierId);
            } else {
                // Add carrier
                updatedConnectedCarriers = [
                    ...connectedCarriers,
                    {
                        carrierID: carrierId,
                        carrierName: carrierName,
                        enabled: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];
            }

            // Update company document
            await updateDoc(doc(db, 'companies', companyFirestoreId), {
                connectedCarriers: updatedConnectedCarriers,
                updatedAt: serverTimestamp()
            });

            setConnectedCarriers(updatedConnectedCarriers);
            enqueueSnackbar(`Carrier ${isConnected ? 'removed' : 'added'} successfully`, { variant: 'success' });
            refreshCompanyData();
        } catch (err) {
            console.error('Error updating carriers:', err);
            enqueueSnackbar('Error updating carriers', { variant: 'error' });
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Helper to render a structured address block
    const renderAddressBlock = (addressObject, title, isOrigin = false) => {
        if (!addressObject || (!addressObject.address1 && !isOrigin)) {
            const noInfoMessage = title ? `No ${title.toLowerCase()} information available.` : 'No contact information available.';
            if (!isOrigin) {
                return (
                    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>{title}</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Typography color="text.secondary">{noInfoMessage}</Typography>
                    </Paper>
                );
            }
            return null;
        }

        if (isOrigin) {
            return (
                <TableRow>
                    <TableCell sx={{ verticalAlign: 'top' }}>{addressObject.nickname || 'Unnamed Origin'}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                        {addressObject.firstName} {addressObject.lastName}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{addressObject.email}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{addressObject.phone}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                        {addressObject.address1}
                        {addressObject.address2 && <br />}{addressObject.address2}
                        <br />
                        {addressObject.city}, {addressObject.stateProv} {addressObject.zipPostal}
                        <br />
                        {addressObject.country}
                    </TableCell>
                </TableRow>
            );
        }

        return (
            <TableRow>
                <TableCell sx={{ verticalAlign: 'top' }}>{addressObject.firstName} {addressObject.lastName}</TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>{addressObject.email}</TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>{addressObject.phone}</TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>
                    {addressObject.address1}
                    {addressObject.address2 && <br />}{addressObject.address2}
                    <br />
                    {addressObject.city}, {addressObject.stateProv} {addressObject.zipPostal}
                    <br />
                    {addressObject.country}
                </TableCell>
            </TableRow>
        );
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }
    if (error) {
        return <Box sx={{ p: 3 }}><Alert severity="error">Error: {error}</Alert></Box>;
    }
    if (!company) {
        return <Box sx={{ p: 3 }}><Alert severity="warning">Company not found</Alert></Box>;
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
                <Breadcrumbs aria-label="breadcrumb">
                    <RouterLink component={MuiLink} to="/admin" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Admin
                    </RouterLink>
                    <RouterLink component={MuiLink} to="/admin/companies" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Companies
                    </RouterLink>
                    <Typography color="text.primary">{company.name}</Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
                    {company.name}
                </Typography>
                <Box>
                    <Button
                        variant="outlined"
                        startIcon={<LocalShippingIcon />}
                        onClick={handleManageCarriers}
                        sx={{ mr: 2 }}
                    >
                        Manage Carriers
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<EditIcon />}
                        component={RouterLink}
                        to={`/admin/companies/${companyFirestoreId}/edit`}
                    >
                        Edit Company
                    </Button>
                </Box>
            </Box>

            <Stack spacing={3}>
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Company Information</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="subtitle2" color="text.secondary">Company Name</Typography>
                            <Typography variant="body1" gutterBottom>{company.name}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="subtitle2" color="text.secondary">Company ID</Typography>
                            <Typography variant="body1" gutterBottom>{company.companyID}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="subtitle2" color="text.secondary">Company Owner</Typography>
                            {ownerDetails ? (
                                <Box>
                                    <Typography variant="body1">
                                        {`${ownerDetails.firstName} ${ownerDetails.lastName}`}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {ownerDetails.email}
                                    </Typography>
                                </Box>
                            ) : (
                                <Typography color="text.secondary">No owner assigned</Typography>
                            )}
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                            <Chip
                                label={company.status === 'active' ? 'Active' : 'Inactive'}
                                color={company.status === 'active' ? 'success' : 'default'}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="subtitle2" color="text.secondary">Created</Typography>
                            <Typography variant="body1">{formatDateString(company.createdAt)}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="subtitle2" color="text.secondary">Website</Typography>
                            {company.website ? (
                                <Typography
                                    variant="body1"
                                    component="a"
                                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{
                                        color: 'primary.main',
                                        textDecoration: 'none',
                                        '&:hover': { textDecoration: 'underline' }
                                    }}
                                >
                                    {company.website}
                                </Typography>
                            ) : (
                                <Typography variant="body1" color="text.secondary">No website provided</Typography>
                            )}
                        </Grid>
                    </Grid>
                </Paper>

                <Paper elevation={2} sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Connected Carriers</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<LocalShippingIcon />}
                            onClick={handleManageCarriers}
                            size="small"
                        >
                            Manage Carriers
                        </Button>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {company.connectedCarriers && company.connectedCarriers.length > 0 ? (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Carrier Name</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Connected Since</TableCell>
                                        <TableCell>Last Updated</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {company.connectedCarriers.map((carrier) => (
                                        <TableRow key={carrier.carrierID}>
                                            <TableCell>{carrier.carrierName}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={carrier.enabled ? 'Enabled' : 'Disabled'}
                                                    color={carrier.enabled ? 'success' : 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{formatDateString(carrier.createdAt)}</TableCell>
                                            <TableCell>{formatDateString(carrier.updatedAt)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography color="text.secondary">No carriers connected to this company.</Typography>
                    )}
                </Paper>

                <Paper elevation={2} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Company Admins</Typography>
                    <Divider sx={{ mb: 2 }} />
                    {adminUsers.length > 0 ? (
                        <List>
                            {adminUsers.map((admin) => (
                                <ListItem key={admin.id} sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={`${admin.firstName} ${admin.lastName}`}
                                        secondary={admin.email}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography color="text.secondary">No admins assigned</Typography>
                    )}
                </Paper>

                <Paper elevation={2} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Main Contact</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Nickname</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow>
                                    <TableCell sx={{ verticalAlign: 'top' }}>{mainContact?.nickname || ''}</TableCell>
                                    <TableCell sx={{ verticalAlign: 'top' }}>{mainContact?.firstName} {mainContact?.lastName}</TableCell>
                                    <TableCell sx={{ verticalAlign: 'top' }}>{mainContact?.email}</TableCell>
                                    <TableCell sx={{ verticalAlign: 'top' }}>{mainContact?.phone}</TableCell>
                                    <TableCell sx={{ verticalAlign: 'top' }}>
                                        {mainContact?.address1}
                                        {mainContact?.address2 && <br />}{mainContact?.address2}
                                        <br />
                                        {mainContact?.city}, {mainContact?.stateProv} {mainContact?.zipPostal}
                                        <br />
                                        {mainContact?.country}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                <Paper elevation={2} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Billing Address</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Nickname</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {billingAddress ? (
                                    <TableRow>
                                        <TableCell sx={{ verticalAlign: 'top' }}>{billingAddress.nickname || ''}</TableCell>
                                        <TableCell sx={{ verticalAlign: 'top' }}>{billingAddress.firstName} {billingAddress.lastName}</TableCell>
                                        <TableCell sx={{ verticalAlign: 'top' }}>{billingAddress.email}</TableCell>
                                        <TableCell sx={{ verticalAlign: 'top' }}>{billingAddress.phone}</TableCell>
                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                            {billingAddress.address1}
                                            {billingAddress.address2 && <br />}{billingAddress.address2}
                                            <br />
                                            {billingAddress.city}, {billingAddress.stateProv} {billingAddress.zipPostal}
                                            <br />
                                            {billingAddress.country}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ fontStyle: 'italic', color: 'text.secondary', py: 3 }}>
                                            No billing address defined.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                <Paper elevation={2} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Origin Addresses</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Nickname</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Contact Name</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {origins.map((origin, index) => (
                                    <React.Fragment key={index}>
                                        {renderAddressBlock(origin, null, true)}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Stack>

            {/* Manage Carriers Dialog */}
            <Dialog
                open={manageCarriersOpen}
                onClose={handleCloseManageCarriers}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Manage Connected Carriers</DialogTitle>
                <DialogContent>
                    {loadingCarriers ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Logo</TableCell>
                                        <TableCell>Carrier Name</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {availableCarriers.map((carrier) => {
                                        const isConnected = connectedCarriers.some(c => c.carrierID === carrier.carrierID);
                                        return (
                                            <TableRow key={carrier.id}>
                                                <TableCell>
                                                    <Box
                                                        component="img"
                                                        src={carrier.logoURL || '/images/carriers/default.png'}
                                                        alt={`${carrier.name} logo`}
                                                        sx={{
                                                            width: 80,
                                                            height: 80,
                                                            objectFit: 'contain',
                                                            bgcolor: 'grey.100',
                                                            borderRadius: 1,
                                                            p: 0.5
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>{carrier.name}</TableCell>
                                                <TableCell>{carrier.type}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={carrier.enabled ? 'Enabled' : 'Disabled'}
                                                        color={carrier.enabled ? 'success' : 'default'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Switch
                                                        checked={isConnected}
                                                        onChange={() => handleToggleCarrier(carrier.carrierID, carrier.name)}
                                                        color="primary"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseManageCarriers}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CompanyDetail; 