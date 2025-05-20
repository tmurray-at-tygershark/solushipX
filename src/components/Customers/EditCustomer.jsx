import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    CircularProgress,
    Breadcrumbs,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    Stack,
    IconButton,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Save as SaveIcon,
    ArrowBack as ArrowBackIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, serverTimestamp, limit, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSnackbar } from 'notistack';
import './EditCustomer.css';
import DestinationAddressDialog from './DestinationAddressDialog';

const EditCustomer = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [formData, setFormData] = useState({
        customerID: '',
        name: '',
        status: 'active',
        type: 'business',
        contact_firstName: '',
        contact_lastName: '',
        contact_email: '',
        contact_phone: '',
        contact_address1: '',
        contact_address2: '',
        contact_city: '',
        contact_stateProv: '',
        contact_zipPostal: '',
        contact_country: 'US',
        contact_companyName: '',
        contact_nickname: 'Main Contact',
    });
    const [mainContactDocId, setMainContactDocId] = useState(null);
    const [destinationAddresses, setDestinationAddresses] = useState([]);
    const [isDestinationDialogOpen, setIsDestinationDialogOpen] = useState(false);
    const [editingDestination, setEditingDestination] = useState(null);
    const [destinationToDelete, setDestinationToDelete] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const fetchCustomerAndContactData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const customerDocRef = doc(db, 'customers', id);
            const customerDocSnap = await getDoc(customerDocRef);

            if (!customerDocSnap.exists()) {
                enqueueSnackbar('Customer not found', { variant: 'error' });
                navigate('/customers');
                return;
            }
            const customerData = customerDocSnap.data();

            let fetchedMainContactData = {};
            let fetchedMainContactDocId = null;
            let fetchedDestinations = [];

            if (customerData.customerID) {
                const addressBookQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'customer'),
                    where('addressClassID', '==', customerData.customerID)
                );
                const addressBookSnapshot = await getDocs(addressBookQuery);
                const addresses = addressBookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const mainContact = addresses.find(addr => addr.addressType === 'contact');
                fetchedDestinations = addresses.filter(addr => addr.addressType === 'destination');

                if (mainContact) {
                    fetchedMainContactData = mainContact;
                    fetchedMainContactDocId = mainContact.id;
                    setMainContactDocId(fetchedMainContactDocId);
                    console.log('Fetched main contact:', fetchedMainContactData);
                } else {
                    console.log('No main contact found for customerID:', customerData.customerID);
                }
                setDestinationAddresses(fetchedDestinations);
                console.log('Fetched destination addresses:', fetchedDestinations);
            }

            setFormData({
                customerID: customerData.customerID || '',
                name: customerData.name || '',
                status: customerData.status || 'active',
                type: customerData.type || 'business',
                contact_firstName: fetchedMainContactData.firstName || '',
                contact_lastName: fetchedMainContactData.lastName || '',
                contact_email: fetchedMainContactData.email || '',
                contact_phone: fetchedMainContactData.phone || '',
                contact_address1: fetchedMainContactData.address1 || '',
                contact_address2: fetchedMainContactData.address2 || '',
                contact_city: fetchedMainContactData.city || '',
                contact_stateProv: fetchedMainContactData.stateProv || '',
                contact_zipPostal: fetchedMainContactData.zipPostal || '',
                contact_country: fetchedMainContactData.country || 'US',
                contact_companyName: fetchedMainContactData.companyName || customerData.name || '',
                contact_nickname: fetchedMainContactData.nickname || 'Main Contact',
            });

        } catch (err) {
            console.error("Error fetching data for edit:", err);
            setError('Failed to load customer data. ' + err.message);
            enqueueSnackbar('Error loading data: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id, navigate, enqueueSnackbar]);

    useEffect(() => {
        fetchCustomerAndContactData();
    }, [fetchCustomerAndContactData]);

    const handleInputChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const customerUpdateData = {
                customerID: formData.customerID,
                name: formData.name,
                status: formData.status,
                type: formData.type,
                updatedAt: serverTimestamp(),
            };
            const mainContactSaveData = {
                addressClass: 'customer',
                addressClassID: formData.customerID,
                addressType: 'contact',
                firstName: formData.contact_firstName,
                lastName: formData.contact_lastName,
                email: formData.contact_email,
                phone: formData.contact_phone,
                address1: formData.contact_address1,
                address2: formData.contact_address2,
                city: formData.contact_city,
                stateProv: formData.contact_stateProv,
                zipPostal: formData.contact_zipPostal,
                country: formData.contact_country,
                companyName: formData.contact_companyName || formData.name,
                nickname: formData.contact_nickname || 'Main Contact',
                updatedAt: serverTimestamp(),
            };
            const customerDocRef = doc(db, 'customers', id);
            await updateDoc(customerDocRef, customerUpdateData);
            console.log('Customer document updated');

            let contactDocRef;
            if (mainContactDocId) {
                contactDocRef = doc(db, 'addressBook', mainContactDocId);
                await updateDoc(contactDocRef, mainContactSaveData);
                console.log('Main contact document updated');
            } else if (formData.customerID && (formData.contact_email || formData.contact_phone || formData.contact_address1)) {
                mainContactSaveData.createdAt = serverTimestamp();
                contactDocRef = doc(collection(db, 'addressBook'));
                await setDoc(contactDocRef, mainContactSaveData);
                setMainContactDocId(contactDocRef.id);
                console.log('Main contact document created');
            }
            enqueueSnackbar('Customer updated successfully!', { variant: 'success' });
            navigate(`/customers/${id}`);
        } catch (err) {
            console.error("Error saving customer:", err);
            setError('Failed to save customer data. ' + err.message);
            enqueueSnackbar('Error saving data: ' + err.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleAddDestinationOpen = () => {
        setEditingDestination(null);
        setIsDestinationDialogOpen(true);
    };

    const handleEditDestinationOpen = (address) => {
        setEditingDestination(address);
        setIsDestinationDialogOpen(true);
    };

    const handleDestinationDialogClose = () => {
        setIsDestinationDialogOpen(false);
        setEditingDestination(null);
    };

    const handleSaveDestination = async (destinationDataToSave) => {
        if (!formData.customerID) {
            enqueueSnackbar('Customer ID is missing. Cannot save address.', { variant: 'error' });
            return;
        }

        setSaving(true);
        try {
            let docRef;
            const dataToSave = { ...destinationDataToSave };
            delete dataToSave.id;

            if (dataToSave.isDefault) {
                const batch = writeBatch(db);
                const otherDestinationsQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'customer'),
                    where('addressClassID', '==', formData.customerID),
                    where('addressType', '==', 'destination')
                );
                const otherDestinationsSnap = await getDocs(otherDestinationsQuery);
                otherDestinationsSnap.forEach(docSnap => {
                    if (destinationDataToSave.id !== docSnap.id) {
                        batch.update(doc(db, 'addressBook', docSnap.id), { isDefault: false });
                    }
                });
                await batch.commit();
                console.log('Cleared other default destination addresses.');
            }

            if (destinationDataToSave.id) {
                docRef = doc(db, 'addressBook', destinationDataToSave.id);
                dataToSave.updatedAt = serverTimestamp();
                await updateDoc(docRef, dataToSave);
                enqueueSnackbar('Destination address updated successfully!', { variant: 'success' });
            } else {
                docRef = doc(collection(db, 'addressBook'));
                dataToSave.createdAt = serverTimestamp();
                dataToSave.updatedAt = serverTimestamp();
                await setDoc(docRef, dataToSave);
                enqueueSnackbar('Destination address added successfully!', { variant: 'success' });
            }
            handleDestinationDialogClose();
            fetchCustomerAndContactData();
        } catch (err) {
            console.error("Error saving destination address:", err);
            enqueueSnackbar('Error saving destination: ' + err.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDestinationConfirm = (address) => {
        setDestinationToDelete(address);
    };

    const executeDeleteDestination = async () => {
        if (!destinationToDelete || !destinationToDelete.id) return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, 'addressBook', destinationToDelete.id));
            enqueueSnackbar('Destination address deleted successfully', { variant: 'success' });
            setDestinationToDelete(null);
            fetchCustomerAndContactData();
        } catch (err) {
            console.error("Error deleting destination address:", err);
            enqueueSnackbar('Error deleting destination: ' + err.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
    }

    return (
        <Box className="edit-customer-container" sx={{ p: 3 }}>
            <div className="breadcrumb-container">
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link component="button" onClick={() => navigate('/')} sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Home
                    </Link>
                    <Link component="button" onClick={() => navigate('/customers')} sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                        Customers
                    </Link>
                    <Link component="button" onClick={() => navigate(`/customers/${id}`)} sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                        {formData.name || 'Customer Detail'}
                    </Link>
                    <Typography color="text.primary">Edit</Typography>
                </Breadcrumbs>
            </div>

            <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
                <Typography variant="h5" component="h1" gutterBottom>
                    Edit Customer: {formData.name}
                </Typography>
                {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* Customer Details Section */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>Customer Information</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Customer ID (Immutable)"
                                name="customerID"
                                value={formData.customerID}
                                onChange={handleInputChange}
                                fullWidth
                                required
                                InputProps={{ readOnly: true }}
                                helperText="This ID cannot be changed."
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Customer/Company Name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                fullWidth
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth required>
                                <InputLabel id="status-label">Status</InputLabel>
                                <Select
                                    labelId="status-label"
                                    name="status"
                                    value={formData.status}
                                    label="Status"
                                    onChange={handleInputChange}
                                >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="suspended">Suspended</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel id="type-label">Type</InputLabel>
                                <Select
                                    labelId="type-label"
                                    name="type"
                                    value={formData.type}
                                    label="Type"
                                    onChange={handleInputChange}
                                >
                                    <MenuItem value="business">Business</MenuItem>
                                    <MenuItem value="individual">Individual</MenuItem>
                                    <MenuItem value="reseller">Reseller</MenuItem>
                                    <MenuItem value="other">Other</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Main Contact Details Section */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Typography variant="h6" gutterBottom>Main Contact Information</Typography>
                            <FormHelperText sx={{ mb: 1 }}>This information is stored in the Address Book linked to the Customer ID.</FormHelperText>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact First Name"
                                name="contact_firstName"
                                value={formData.contact_firstName}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Last Name"
                                name="contact_lastName"
                                value={formData.contact_lastName}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Email"
                                name="contact_email"
                                type="email"
                                value={formData.contact_email}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Phone"
                                name="contact_phone"
                                value={formData.contact_phone}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Company Name (for Address)"
                                name="contact_companyName"
                                value={formData.contact_companyName}
                                onChange={handleInputChange}
                                helperText="Defaults to customer name if blank."
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Address Nickname"
                                name="contact_nickname"
                                value={formData.contact_nickname}
                                onChange={handleInputChange}
                                helperText="e.g., Main Office, Head Quarters"
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Contact Address Line 1"
                                name="contact_address1"
                                value={formData.contact_address1}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Contact Address Line 2"
                                name="contact_address2"
                                value={formData.contact_address2}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                label="Contact City"
                                name="contact_city"
                                value={formData.contact_city}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                label="Contact State/Province"
                                name="contact_stateProv"
                                value={formData.contact_stateProv}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <TextField
                                label="Contact Zip/Postal Code"
                                name="contact_zipPostal"
                                value={formData.contact_zipPostal}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel id="country-label">Country</InputLabel>
                                <Select
                                    labelId="country-label"
                                    name="contact_country"
                                    value={formData.contact_country}
                                    label="Country"
                                    onChange={handleInputChange}
                                >
                                    <MenuItem value="US">United States</MenuItem>
                                    <MenuItem value="CA">Canada</MenuItem>
                                    {/* Add more countries as needed */}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Submit Buttons for Main Form */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Stack direction="row" spacing={2} justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    onClick={() => navigate(`/customers/${id}`)}
                                    startIcon={<ArrowBackIcon />}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    disabled={saving || loading}
                                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </form>

                {/* Divider */}
                <Box sx={{ my: 4 }}><hr /></Box>

                {/* Shipment Destinations Section */}
                <Grid container spacing={3} sx={{ mt: 0 }}>
                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>Shipment Destinations</Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleAddDestinationOpen}
                            size="small"
                        >
                            Add Destination
                        </Button>
                    </Grid>
                    <Grid item xs={12}>
                        {destinationAddresses.length > 0 ? (
                            <TableContainer component={Paper} elevation={1} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Nickname</TableCell>
                                            <TableCell>Company</TableCell>
                                            <TableCell>Contact</TableCell>
                                            <TableCell>Address</TableCell>
                                            <TableCell>Default</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {destinationAddresses.map((addr) => (
                                            <TableRow key={addr.id} hover>
                                                <TableCell>{addr.nickname || 'N/A'}</TableCell>
                                                <TableCell>{addr.companyName || 'N/A'}</TableCell>
                                                <TableCell>{`${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A'}</TableCell>
                                                <TableCell>
                                                    {addr.address1}
                                                    {addr.address2 && <br />}{addr.address2}
                                                    <br />
                                                    {`${addr.city}, ${addr.stateProv} ${addr.zipPostal}`}
                                                    <br />
                                                    {addr.country}
                                                </TableCell>
                                                <TableCell>
                                                    {addr.isDefault ? <Chip label="Yes" color="primary" size="small" /> : <Chip label="No" size="small" />}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <IconButton size="small" onClick={() => handleEditDestinationOpen(addr)} color="primary">
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => handleDeleteDestinationConfirm(addr)} color="error">
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary">No shipment destinations found for this customer. Click "Add Destination" to create one.</Typography>
                        )}
                    </Grid>
                </Grid>

                {/* Destination Address Dialog */}
                <DestinationAddressDialog
                    open={isDestinationDialogOpen}
                    onClose={handleDestinationDialogClose}
                    addressData={editingDestination}
                    onSave={handleSaveDestination}
                    customerID={formData.customerID}
                />

                {/* Delete Confirmation Dialog (Simple Example - consider a more robust MUI Dialog) */}
                {destinationToDelete && (
                    <Dialog open={!!destinationToDelete} onClose={() => setDestinationToDelete(null)}>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogContent>
                            <Typography>
                                Are you sure you want to delete the destination "{destinationToDelete.nickname || destinationToDelete.address1}"?
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setDestinationToDelete(null)} color="primary">
                                Cancel
                            </Button>
                            <Button onClick={executeDeleteDestination} color="error" variant="contained" disabled={saving}>
                                {saving ? <CircularProgress size={20} /> : 'Delete'}
                            </Button>
                        </DialogActions>
                    </Dialog>
                )}
            </Paper>
        </Box>
    );
};

export default EditCustomer; 