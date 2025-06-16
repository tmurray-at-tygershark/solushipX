import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Card,
    CardContent,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    Autocomplete,
    CircularProgress,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Stack,
    Divider,
    List,
    ListItem,
    ListItemText
} from '@mui/material';
import {
    Business as BusinessIcon,
    LocationOn as LocationIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Home as HomeIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { doc, updateDoc, collection, addDoc, onSnapshot, serverTimestamp, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import ModalHeader from '../common/ModalHeader';
import { formatDateString } from '../../utils/dateUtils';

// Countries list for autocomplete
const countries = [
    'United States', 'Canada', 'Mexico', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain',
    'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland',
    'Australia', 'New Zealand', 'Japan', 'South Korea', 'Singapore', 'Hong Kong', 'China', 'India',
    'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'South Africa', 'Israel', 'Turkey'
];

// US States and Canadian Provinces
const statesProvinces = [
    // US States
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
    'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
    'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
    // Canadian Provinces
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon'
];

const emptyOrigin = (companyName = '') => ({
    nickname: '',
    companyName: companyName,
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address1: '',
    address2: '',
    city: '',
    stateProv: '',
    zipPostal: '',
    country: 'Canada'
});

const Company = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const { companyData, refreshCompanyData } = useCompany();
    const { user } = useAuth();

    // Basic state
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Company data state
    const [company, setCompany] = useState(null);
    const [ownerDetails, setOwnerDetails] = useState(null);
    const [adminUsers, setAdminUsers] = useState([]);
    const [mainContact, setMainContact] = useState(null);
    const [billingAddress, setBillingAddress] = useState(null);
    const [origins, setOrigins] = useState([]);

    // Origins dialog state
    const [isOriginDialogOpen, setIsOriginDialogOpen] = useState(false);
    const [editingOrigin, setEditingOrigin] = useState(null);
    const [originForm, setOriginForm] = useState(emptyOrigin());

    // Delete confirmation dialog state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [originToDelete, setOriginToDelete] = useState(null);

    // Main data fetching function (following admin pattern)
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (!companyData?.id) return;

            // Get company document
            const companyDocRef = doc(db, 'companies', companyData.id);
            const companyDoc = await getDoc(companyDocRef);

            if (!companyDoc.exists()) {
                console.error('Company document not found');
                return;
            }

            const companyDataFull = { id: companyDoc.id, ...companyDoc.data() };
            setCompany(companyDataFull);

            // Fetch owner details using ownerID
            if (companyDataFull.ownerID) {
                try {
                    const ownerDoc = await getDoc(doc(db, 'users', companyDataFull.ownerID));
                    if (ownerDoc.exists()) {
                        setOwnerDetails({ id: ownerDoc.id, ...ownerDoc.data() });
                    }
                } catch (error) {
                    console.error('Error fetching owner details:', error);
                }
            }

            // Fetch company admins using connectedCompanies pattern
            if (companyDataFull.companyID) {
                try {
                    const usersRef = collection(db, 'users');
                    const q = query(usersRef, where('connectedCompanies.companies', 'array-contains', companyDataFull.companyID));
                    const adminUsersSnap = await getDocs(q);
                    const admins = adminUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setAdminUsers(admins);
                } catch (error) {
                    console.error('Error fetching admin users:', error);
                    setAdminUsers([]);
                }

                // Fetch address book data with status filtering
                const addressBookRef = collection(db, 'addressBook');

                // Main Contact
                try {
                    const mainContactQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyDataFull.companyID),
                        where('addressType', '==', 'contact'),
                        where('status', '!=', 'deleted')
                    );
                    const mainContactSnapshot = await getDocs(mainContactQuery);
                    if (!mainContactSnapshot.empty) {
                        setMainContact({ id: mainContactSnapshot.docs[0].id, ...mainContactSnapshot.docs[0].data() });
                    } else {
                        setMainContact(null);
                    }
                } catch (error) {
                    console.error('Error fetching main contact:', error);
                    setMainContact(null);
                }

                // Billing Address
                try {
                    const billingQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyDataFull.companyID),
                        where('addressType', '==', 'billing'),
                        where('status', '!=', 'deleted')
                    );
                    const billingSnapshot = await getDocs(billingQuery);
                    if (!billingSnapshot.empty) {
                        setBillingAddress({ id: billingSnapshot.docs[0].id, ...billingSnapshot.docs[0].data() });
                    } else {
                        setBillingAddress(null);
                    }
                } catch (error) {
                    console.error('Error fetching billing address:', error);
                    setBillingAddress(null);
                }

                // Origin Addresses - Filter out deleted addresses
                try {
                    const originsQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyDataFull.companyID),
                        where('addressType', '==', 'origin'),
                        where('status', '!=', 'deleted')
                    );
                    const originsSnapshot = await getDocs(originsQuery);
                    const activeOrigins = originsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setOrigins(activeOrigins);
                } catch (error) {
                    console.error('Error fetching origins:', error);
                    setOrigins([]);
                }
            }

        } catch (err) {
            console.error('Error loading company data:', err);
        } finally {
            setLoading(false);
        }
    }, [companyData?.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle origin form changes
    const handleOriginFormChange = (field, value) => {
        setOriginForm(prev => ({ ...prev, [field]: value }));
    };

    // Open origin dialog
    const handleOpenOriginDialog = (origin = null) => {
        if (origin) {
            setEditingOrigin(origin);
            setOriginForm({
                nickname: origin.nickname || '',
                companyName: origin.companyName || company?.name || '',
                firstName: origin.firstName || '',
                lastName: origin.lastName || '',
                phone: origin.phone || '',
                email: origin.email || '',
                address1: origin.address1 || '',
                address2: origin.address2 || '',
                city: origin.city || '',
                stateProv: origin.stateProv || '',
                zipPostal: origin.zipPostal || '',
                country: origin.country || 'Canada'
            });
        } else {
            setEditingOrigin(null);
            setOriginForm(emptyOrigin(company?.name || ''));
        }
        setIsOriginDialogOpen(true);
    };

    // Close origin dialog
    const handleCloseOriginDialog = () => {
        setIsOriginDialogOpen(false);
        setEditingOrigin(null);
        setOriginForm(emptyOrigin(''));
    };

    // Save origin to addressBook
    const handleSaveOrigin = async () => {
        if (!company?.companyID) return;

        try {
            const originData = {
                ...originForm,
                addressClass: 'company',
                addressClassID: company.companyID,
                addressType: 'origin',
                status: 'active', // Add active status
                updatedAt: serverTimestamp()
            };

            if (editingOrigin) {
                // Update existing origin in addressBook
                const originRef = doc(db, 'addressBook', editingOrigin.id);
                await updateDoc(originRef, originData);
                setSnackbar({
                    open: true,
                    message: 'Origin address updated successfully',
                    severity: 'success'
                });
            } else {
                // Create new origin in addressBook
                const addressBookRef = collection(db, 'addressBook');
                await addDoc(addressBookRef, {
                    ...originData,
                    createdAt: serverTimestamp()
                });
                setSnackbar({
                    open: true,
                    message: 'Origin address added successfully',
                    severity: 'success'
                });
            }

            handleCloseOriginDialog();
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error saving origin:', error);
            setSnackbar({
                open: true,
                message: 'Failed to save origin address',
                severity: 'error'
            });
        }
    };

    // Open delete confirmation dialog
    const handleOpenDeleteConfirm = (origin) => {
        setOriginToDelete(origin);
        setDeleteConfirmOpen(true);
    };

    // Close delete confirmation dialog
    const handleCloseDeleteConfirm = () => {
        setOriginToDelete(null);
        setDeleteConfirmOpen(false);
    };

    // Soft delete origin (mark as deleted instead of hard delete)
    const handleConfirmDelete = async () => {
        if (!originToDelete) return;

        try {
            const originRef = doc(db, 'addressBook', originToDelete.id);
            await updateDoc(originRef, {
                status: 'deleted',
                deletedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setSnackbar({
                open: true,
                message: 'Origin address deleted successfully',
                severity: 'success'
            });

            handleCloseDeleteConfirm();
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error deleting origin:', error);
            setSnackbar({
                open: true,
                message: 'Failed to delete origin address',
                severity: 'error'
            });
        }
    };

    // Close snackbar
    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

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

    return (
        <Box sx={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden', position: 'relative' }}>
                    {isModal && (
                        <ModalHeader
                            title={company?.name || 'Company Information'}
                            onClose={onClose}
                            showCloseButton={showCloseButton}
                        />
                    )}

                    <Box sx={{ p: 3, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
                        <Stack spacing={3}>
                            {/* Company Information Section */}
                            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Company Information
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                        <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                            Company Name
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {company?.name || 'N/A'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                            Company ID
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {company?.companyID || 'N/A'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                            Company Owner
                                        </Typography>
                                        {ownerDetails ? (
                                            <Box>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {`${ownerDetails.firstName || ''} ${ownerDetails.lastName || ''}`.trim()}
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#64748b' }}>
                                                    {ownerDetails.email || ''}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Typography sx={{ fontSize: '12px' }}>N/A</Typography>
                                        )}
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                            Status
                                        </Typography>
                                        <Chip
                                            label={company?.status === 'active' ? 'Active' : 'Inactive'}
                                            color={company?.status === 'active' ? 'success' : 'default'}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                            Created
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {company?.createdAt ? formatDateString(company.createdAt) : 'N/A'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                            Website
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {company?.website || 'N/A'}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Company Admins Section */}
                            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Company Admins
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                {adminUsers.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                        {adminUsers.map((admin) => (
                                            <Box key={admin.id} sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                p: 1.5,
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 1,
                                                backgroundColor: '#f8fafc',
                                                minWidth: '200px'
                                            }}>
                                                <PersonIcon sx={{ fontSize: '16px', color: '#64748b' }} />
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {`${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Unknown User'}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                                        {admin.email || 'No email'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                                        No administrators found
                                    </Typography>
                                )}
                            </Paper>

                            {/* Main Contact Section */}
                            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Main Contact
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <TableContainer>
                                    <Table sx={{
                                        '& .MuiTableCell-root': {
                                            fontSize: '12px',
                                            padding: '8px 12px'
                                        },
                                        '& .MuiTableHead-root .MuiTableCell-root': {
                                            fontWeight: 600,
                                            backgroundColor: '#f8fafc',
                                            color: '#374151'
                                        }
                                    }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Nickname</TableCell>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Email</TableCell>
                                                <TableCell>Phone</TableCell>
                                                <TableCell>Address</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell sx={{ verticalAlign: 'top' }}>
                                                    {mainContact?.nickname || 'Head Office'}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top' }}>
                                                    {mainContact ? `${mainContact.firstName || ''} ${mainContact.lastName || ''}`.trim() : 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top' }}>
                                                    {mainContact?.email || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top' }}>
                                                    {mainContact?.phone || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', fontSize: '12px', lineHeight: '1.4' }}>
                                                    {mainContact?.address1 ? (
                                                        <Box>
                                                            <div>{mainContact.address1}</div>
                                                            {mainContact.address2 && <div>{mainContact.address2}</div>}
                                                            <div>
                                                                {[mainContact.city, mainContact.stateProv, mainContact.zipPostal].filter(Boolean).join(', ')}
                                                            </div>
                                                            <div>{mainContact.country}</div>
                                                        </Box>
                                                    ) : (
                                                        'N/A'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>

                            {/* Billing Address Section */}
                            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Billing Address
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <TableContainer>
                                    <Table sx={{
                                        '& .MuiTableCell-root': {
                                            fontSize: '12px',
                                            padding: '8px 12px'
                                        },
                                        '& .MuiTableHead-root .MuiTableCell-root': {
                                            fontWeight: 600,
                                            backgroundColor: '#f8fafc',
                                            color: '#374151'
                                        }
                                    }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Nickname</TableCell>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Email</TableCell>
                                                <TableCell>Phone</TableCell>
                                                <TableCell>Address</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {billingAddress ? (
                                                <TableRow>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>
                                                        {billingAddress.nickname || 'Head Office'}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>
                                                        {`${billingAddress.firstName || ''} ${billingAddress.lastName || ''}`.trim() || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>
                                                        {billingAddress.email || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>
                                                        {billingAddress.phone || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', fontSize: '12px', lineHeight: '1.4' }}>
                                                        <Box>
                                                            <div>{billingAddress.address1}</div>
                                                            {billingAddress.address2 && <div>{billingAddress.address2}</div>}
                                                            <div>
                                                                {[billingAddress.city, billingAddress.stateProv, billingAddress.zipPostal].filter(Boolean).join(', ')}
                                                            </div>
                                                            <div>{billingAddress.country}</div>
                                                        </Box>
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

                            {/* Origin Addresses Section */}
                            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                        Origin Addresses
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => handleOpenOriginDialog()}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Add Origin
                                    </Button>
                                </Box>
                                <Divider sx={{ mb: 2 }} />
                                <TableContainer>
                                    <Table sx={{
                                        '& .MuiTableCell-root': {
                                            fontSize: '12px',
                                            padding: '8px 12px'
                                        },
                                        '& .MuiTableHead-root .MuiTableCell-root': {
                                            fontWeight: 600,
                                            backgroundColor: '#f8fafc',
                                            color: '#374151'
                                        }
                                    }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Nickname</TableCell>
                                                <TableCell>Contact Name</TableCell>
                                                <TableCell>Email</TableCell>
                                                <TableCell>Phone</TableCell>
                                                <TableCell>Address</TableCell>
                                                <TableCell>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {origins.length > 0 ? (
                                                origins.map((origin) => (
                                                    <TableRow key={origin.id} hover>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            {origin.nickname || 'Unnamed Origin'}
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            {`${origin.firstName || ''} ${origin.lastName || ''}`.trim() || 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            {origin.email || 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            {origin.phone || 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top', fontSize: '12px', lineHeight: '1.4' }}>
                                                            <Box>
                                                                <div>{origin.address1}</div>
                                                                {origin.address2 && <div>{origin.address2}</div>}
                                                                <div>
                                                                    {[origin.city, origin.stateProv, origin.zipPostal].filter(Boolean).join(', ')}
                                                                </div>
                                                                <div>{origin.country}</div>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleOpenOriginDialog(origin)}
                                                                    title="Edit"
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleOpenDeleteConfirm(origin)}
                                                                    color="error"
                                                                    title="Delete"
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center" sx={{ fontStyle: 'italic', color: 'text.secondary', py: 3 }}>
                                                        No origin addresses configured
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Stack>
                    </Box>
                </Box>
            </Box>

            {/* Origin Dialog */}
            <Dialog
                open={isOriginDialogOpen}
                onClose={handleCloseOriginDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        maxHeight: '90vh'
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    pb: 2
                }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocationIcon color="primary" />
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                {editingOrigin ? 'Edit Origin Address' : 'Add New Origin Address'}
                            </Typography>
                        </Box>
                        {company?.name && (
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b', ml: 3 }}>
                                for {company.name}
                            </Typography>
                        )}
                    </Box>
                    <IconButton
                        onClick={handleCloseOriginDialog}
                        size="small"
                        sx={{
                            color: '#64748b',
                            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                        }}
                    >
                        <CancelIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ pt: 4 }}>
                    <Grid container spacing={2}>
                        {/* Address Identification */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 2, color: '#374151' }}>
                                Address Information
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Address Nickname"
                                name="nickname"
                                value={originForm.nickname}
                                onChange={(e) => handleOriginFormChange('nickname', e.target.value)}
                                helperText="e.g., Main Warehouse, East Office (optional)"
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Company Name (at origin)"
                                name="companyName"
                                value={originForm.companyName}
                                onChange={(e) => handleOriginFormChange('companyName', e.target.value)}
                                helperText="Company name at this origin location"
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        {/* Contact Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, color: '#374151' }}>
                                Contact Information
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact First Name"
                                name="firstName"
                                value={originForm.firstName}
                                onChange={(e) => handleOriginFormChange('firstName', e.target.value)}
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Last Name"
                                name="lastName"
                                value={originForm.lastName}
                                onChange={(e) => handleOriginFormChange('lastName', e.target.value)}
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Email"
                                name="email"
                                type="email"
                                value={originForm.email}
                                onChange={(e) => handleOriginFormChange('email', e.target.value)}
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Phone"
                                name="phone"
                                value={originForm.phone}
                                onChange={(e) => handleOriginFormChange('phone', e.target.value)}
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        {/* Physical Address */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 1, color: '#374151' }}>
                                Physical Address
                            </Typography>
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Address Line 1"
                                name="address1"
                                value={originForm.address1}
                                onChange={(e) => handleOriginFormChange('address1', e.target.value)}
                                fullWidth
                                required
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Address Line 2"
                                name="address2"
                                value={originForm.address2}
                                onChange={(e) => handleOriginFormChange('address2', e.target.value)}
                                helperText="Suite, apartment, floor, etc. (optional)"
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="City"
                                name="city"
                                value={originForm.city}
                                onChange={(e) => handleOriginFormChange('city', e.target.value)}
                                fullWidth
                                required
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Autocomplete
                                options={statesProvinces}
                                value={originForm.stateProv}
                                onChange={(event, newValue) => handleOriginFormChange('stateProv', newValue || '')}
                                size="small"
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="State/Province"
                                        required
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                )}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Postal Code"
                                name="zipPostal"
                                value={originForm.zipPostal}
                                onChange={(e) => handleOriginFormChange('zipPostal', e.target.value)}
                                fullWidth
                                required
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Autocomplete
                                options={countries}
                                value={originForm.country}
                                onChange={(event, newValue) => handleOriginFormChange('country', newValue || 'Canada')}
                                size="small"
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Country"
                                        required
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>

                <DialogActions sx={{
                    borderTop: '1px solid #e2e8f0',
                    px: 3,
                    py: 2,
                    gap: 1
                }}>
                    <Button
                        onClick={handleCloseOriginDialog}
                        size="small"
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            color: '#64748b'
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveOrigin}
                        variant="contained"
                        startIcon={<SaveIcon />}
                        size="small"
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            minWidth: '100px'
                        }}
                    >
                        {editingOrigin ? 'Update Origin' : 'Save Origin'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={handleCloseDeleteConfirm}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    pb: 2,
                    borderBottom: '1px solid #e2e8f0'
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626'
                    }}>
                        <WarningIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Delete Origin Address
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b', mt: 0.5 }}>
                            This action cannot be undone
                        </Typography>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ pt: 3, pb: 2 }}>
                    <Box>
                        <Typography sx={{ fontSize: '14px', color: '#374151', mb: 2 }}>
                            Are you sure you want to delete this origin address?
                        </Typography>

                        {originToDelete && (
                            <Box sx={{
                                p: 2,
                                backgroundColor: '#f8fafc',
                                borderRadius: 1,
                                border: '1px solid #e2e8f0'
                            }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                    {originToDelete.nickname || 'Unnamed Origin'}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                    {originToDelete.address1}
                                    {originToDelete.address2 && `, ${originToDelete.address2}`}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                    {[originToDelete.city, originToDelete.stateProv, originToDelete.zipPostal].filter(Boolean).join(', ')}
                                </Typography>
                            </Box>
                        )}

                        <Alert severity="warning" sx={{ mt: 2, fontSize: '12px' }}>
                            This address will be marked as deleted and will no longer be available for new shipments.
                        </Alert>
                    </Box>
                </DialogContent>

                <DialogActions sx={{
                    borderTop: '1px solid #e2e8f0',
                    px: 3,
                    py: 2,
                    gap: 1
                }}>
                    <Button
                        onClick={handleCloseDeleteConfirm}
                        size="small"
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            color: '#64748b'
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            minWidth: '100px'
                        }}
                    >
                        Delete Address
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Company; 