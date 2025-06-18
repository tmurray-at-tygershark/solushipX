import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import {
    Skeleton,
    Card,
    CardContent,
    Grid,
    Box,
    Typography,
    Chip,
    Button,
    Alert,
    TextField,
    InputAdornment,
    Paper,
    Autocomplete,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import {
    Add as AddIcon,
    Clear as ClearIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import { getCountryFlag } from '../Shipments/utils/shipmentHelpers';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';

const emptyAddress = () => ({
    company: '',
    name: '',
    attention: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    specialInstructions: '',
    customerID: null,
    selectedAddressId: null
});

const QuickShipTo = forwardRef(({ onNext, onOpenAddCustomer = null }, ref) => {
    const { currentUser } = useAuth();
    const { formData, updateFormSection } = useShipmentForm();

    const [customers, setCustomers] = useState([]);
    const [selectedCustomerState, setSelectedCustomerState] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [filteredAddresses, setFilteredAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(formData.shipTo?.selectedAddressId || null);

    const [loading, setLoading] = useState(true);
    const [loadingDestinations, setLoadingDestinations] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Track when to refresh customer list (will be set by parent component)
    const [shouldRefreshCustomers, setShouldRefreshCustomers] = useState(false);

    // Add New Address Dialog states
    const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
    const [newAddress, setNewAddress] = useState({
        nickname: '',
        companyName: '',
        firstName: '',
        lastName: '',
        address1: '',
        address2: '',
        city: '',
        stateProv: '',
        zipPostal: '',
        country: 'US',
        phone: '',
        email: '',
        specialInstructions: ''
    });

    // Show all customer addresses - no search needed
    useEffect(() => {
        setFilteredAddresses(customerAddresses);
    }, [customerAddresses]);

    const fetchCustomers = useCallback(async (companyId) => {
        if (!companyId) return;
        setLoading(true);
        try {
            setError(null);

            const queries = [
                query(collection(db, 'customers'), where('companyID', '==', companyId)),
                query(collection(db, 'customers'), where('companyId', '==', companyId))
            ];

            let customersData = [];

            for (let i = 0; i < queries.length; i++) {
                try {
                    const customersSnapshot = await getDocs(queries[i]);
                    if (!customersSnapshot.empty) {
                        customersData = customersSnapshot.docs.map(doc => {
                            const data = doc.data();
                            return { id: doc.id, customerID: data.customerID || doc.id, ...data };
                        });
                        break;
                    }
                } catch (queryError) {
                    console.error(`QuickShipTo: Query ${i + 1} failed:`, queryError);
                }
            }

            setCustomers(customersData);

            // Handle existing customer selection from context
            if (formData.shipTo?.customerID && customersData.length > 0) {
                const preSelected = customersData.find(c => c.customerID === formData.shipTo.customerID || c.id === formData.shipTo.customerID);
                if (preSelected) {
                    setSelectedCustomerState(preSelected);
                }
            }
        } catch (err) {
            console.error('QuickShipTo: Error fetching customers:', err);
            setError('Failed to load customers.');
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [formData.shipTo?.customerID]);

    useEffect(() => {
        const fetchCompanyId = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    throw new Error('User data not found.');
                }

                const userData = userDoc.data();
                const id = userData.companyID || userData.companyId || userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];

                if (!id) {
                    throw new Error('No company associated with this user.');
                }

                await fetchCustomers(id);
            } catch (err) {
                console.error('QuickShipTo: Error fetching company data:', err);
                setError(err.message || 'Failed to load company data.');
            } finally {
                setLoading(false);
            }
        };
        fetchCompanyId();
    }, [currentUser, fetchCustomers]);

    const loadAndProcessAddresses = useCallback(async (customerForAddresses) => {
        const localCustomerID = customerForAddresses?.customerID || customerForAddresses?.id;
        if (!localCustomerID) {
            setCustomerAddresses([]);
            setFilteredAddresses([]);
            return;
        }

        setLoadingDestinations(true);
        setError(null);

        try {
            let addressesToProcess = [];
            const addressesQuery = query(
                collection(db, 'addressBook'),
                where('addressClass', '==', 'customer'),
                where('addressType', '==', 'destination'),
                where('addressClassID', '==', localCustomerID),
                where('status', '!=', 'deleted')
            );
            const addressesSnapshot = await getDocs(addressesQuery);

            if (!addressesSnapshot.empty) {
                addressesToProcess = addressesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            } else if (customerForAddresses.addresses && customerForAddresses.addresses.length > 0 && customerForAddresses.addresses[0]?.street) {
                addressesToProcess = customerForAddresses.addresses.map((addr, idx) => ({ ...addr, id: addr.id || `legacy_${idx}` }));
            }

            const primaryContact = customerForAddresses.contacts?.find(c => c.isPrimary) || customerForAddresses.contacts?.[0] || {};

            const formattedAddresses = addressesToProcess.map(addr => ({
                id: addr.id,
                customerID: localCustomerID,
                name: addr.nickname || addr.name || customerForAddresses.name || '',
                company: addr.companyName || customerForAddresses.company || customerForAddresses.name || '',
                attention: addr.attention || `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || primaryContact.name || '',
                street: addr.address1 || addr.street || '',
                street2: addr.address2 || addr.street2 || '',
                city: addr.city || '',
                state: addr.stateProv || addr.state || '',
                postalCode: addr.zipPostal || addr.postalCode || addr.zip || '',
                country: addr.country || 'US',
                contactName: addr.contactName || `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || primaryContact.name || '',
                contactPhone: addr.contactPhone || addr.phone || primaryContact.phone || '',
                contactEmail: addr.contactEmail || addr.email || primaryContact.email || '',
                specialInstructions: addr.specialInstructions || '',
                isDefault: addr.isDefault || false
            }));

            // Sort with default addresses first
            formattedAddresses.sort((a, b) => (a.isDefault === b.isDefault) ? 0 : a.isDefault ? -1 : 1);

            setCustomerAddresses(formattedAddresses);
            // Show all addresses - no search functionality
            setFilteredAddresses(formattedAddresses);

            // Enhanced address selection logic for draft data
            const currentShipToData = formData.shipTo || {};
            const hasExistingAddressData = currentShipToData.street || currentShipToData.city;

            let addressToSelectObject = null;

            if (formData.shipTo?.selectedAddressId && formattedAddresses.length > 0) {
                addressToSelectObject = formattedAddresses.find(addr => String(addr.id) === String(formData.shipTo.selectedAddressId));
            }

            if (!addressToSelectObject && hasExistingAddressData && formattedAddresses.length > 0) {
                addressToSelectObject = formattedAddresses.find(addr =>
                    addr.street?.toLowerCase() === currentShipToData.street?.toLowerCase() &&
                    addr.city?.toLowerCase() === currentShipToData.city?.toLowerCase()
                );
            }

            if (!addressToSelectObject && formattedAddresses.length > 0) {
                addressToSelectObject = formattedAddresses.find(addr => addr.isDefault) || formattedAddresses[0];
            }

            if (addressToSelectObject) {
                setSelectedAddressId(String(addressToSelectObject.id));
                const shipToUpdate = {
                    ...addressToSelectObject,
                    customerID: localCustomerID,
                    selectedAddressId: String(addressToSelectObject.id)
                };
                updateFormSection('shipTo', shipToUpdate);
            } else if (hasExistingAddressData) {
                updateFormSection('shipTo', {
                    ...currentShipToData,
                    customerID: localCustomerID,
                    selectedAddressId: null
                });
                setSelectedAddressId(null);
            } else if (formattedAddresses.length === 0) {
                updateFormSection('shipTo', {
                    ...emptyAddress(),
                    customerID: localCustomerID,
                    company: customerForAddresses.company || customerForAddresses.name || ''
                });
                setSelectedAddressId(null);
            }
        } catch (err) {
            console.error('QuickShipTo: Error loading addresses:', err);
            setError(`Failed to load addresses: ${err.message}`);
            setCustomerAddresses([]);
            setFilteredAddresses([]);
        } finally {
            setLoadingDestinations(false);
        }
    }, [updateFormSection, formData.shipTo?.selectedAddressId]);

    useEffect(() => {
        if (selectedCustomerState && selectedCustomerState.customerID) {
            const currentContextCustomerId = formData.shipTo?.customerID;
            if (currentContextCustomerId !== selectedCustomerState.customerID || customerAddresses.length === 0 || (customerAddresses.length > 0 && customerAddresses[0].customerID !== selectedCustomerState.customerID)) {
                loadAndProcessAddresses(selectedCustomerState);
            }
        } else {
            setCustomerAddresses([]);
            setFilteredAddresses([]);
        }
    }, [selectedCustomerState, loadAndProcessAddresses, formData.shipTo?.customerID, customerAddresses]);

    const handleCustomerSelect = useCallback((customer) => {
        if (!customer) {
            setSelectedCustomerState(null);
            setSelectedAddressId(null);
            setCustomerAddresses([]);
            setFilteredAddresses([]);
            updateFormSection('shipTo', { ...emptyAddress(), customerID: null, selectedAddressId: null });
            return;
        }
        const customerID = customer.customerID || customer.id;
        setSelectedCustomerState({ ...customer, customerID });
        setSelectedAddressId(null);
        updateFormSection('shipTo', {
            ...emptyAddress(),
            customerID: customerID,
            company: customer.company || customer.name || '',
            selectedAddressId: null
        });
    }, [updateFormSection]);

    // Expose methods to parent component via ref (placed after all dependencies are defined)
    useImperativeHandle(ref, () => ({
        refreshCustomers: async (newCustomerId) => {
            try {
                // Fetch company ID first
                if (!currentUser) return;

                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) return;

                const userData = userDoc.data();
                const companyId = userData.companyID || userData.companyId || userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];

                if (!companyId) return;

                // Refresh the customer list
                await fetchCustomers(companyId);

                // If a specific customer ID was provided, try to select it
                if (newCustomerId) {
                    // Small delay to ensure the customer list has been updated
                    setTimeout(() => {
                        const newCustomer = customers.find(c => c.id === newCustomerId);
                        if (newCustomer) {
                            handleCustomerSelect(newCustomer);
                        }
                    }, 500);
                }
            } catch (error) {
                console.error('Error refreshing customers:', error);
            }
        }
    }), [currentUser, fetchCustomers, customers, handleCustomerSelect]);

    const handleAddressChange = useCallback((addressId) => {
        const addressIdStr = addressId ? String(addressId) : null;
        if (!addressIdStr || !selectedCustomerState) return;

        setSelectedAddressId(addressIdStr);
        const selectedAddressData = customerAddresses.find(addr => String(addr.id) === addressIdStr);

        if (selectedAddressData) {
            const shipToUpdate = {
                ...selectedAddressData,
                customerID: selectedCustomerState.customerID || selectedCustomerState.id,
                selectedAddressId: addressIdStr
            };
            updateFormSection('shipTo', shipToUpdate);

            // Auto-submit when address is selected
            if (onNext) {
                setTimeout(() => onNext(shipToUpdate), 100);
            }
        }
    }, [customerAddresses, selectedCustomerState, updateFormSection, onNext]);

    const handleOpenAddressDialog = useCallback(() => {
        if (!selectedCustomerState) {
            setError('Please select a customer first.');
            return;
        }
        setIsAddressDialogOpen(true);
    }, [selectedCustomerState]);

    const handleCloseAddressDialog = useCallback(() => {
        setIsAddressDialogOpen(false);
        setNewAddress({
            nickname: '', companyName: '', firstName: '', lastName: '', address1: '', address2: '',
            city: '', stateProv: '', zipPostal: '', country: 'US', phone: '', email: '', specialInstructions: ''
        });
    }, []);

    const handleNewAddressChange = useCallback((e) => {
        const { name, value } = e.target;
        setNewAddress(prev => ({ ...prev, [name]: value }));
    }, []);

    // Fallback handler for when onOpenAddCustomer is not provided
    const handleOpenCustomerDialog = useCallback(() => {
        if (onOpenAddCustomer) {
            onOpenAddCustomer();
        } else {
            setError('Customer creation is not available in this context.');
        }
    }, [onOpenAddCustomer]);

    const handleSaveAddress = useCallback(async () => {
        if (!selectedCustomerState) {
            setError('No customer selected.');
            return;
        }

        try {
            const customerID = selectedCustomerState.customerID || selectedCustomerState.id;

            const addressBookData = {
                addressClass: 'customer',
                addressClassID: customerID,
                addressType: 'destination',
                status: 'active',
                nickname: newAddress.nickname || '',
                companyName: newAddress.companyName || selectedCustomerState.company || selectedCustomerState.name || '',
                firstName: newAddress.firstName || '',
                lastName: newAddress.lastName || '',
                attention: `${newAddress.firstName || ''} ${newAddress.lastName || ''}`.trim(),
                address1: newAddress.address1 || '',
                address2: newAddress.address2 || '',
                city: newAddress.city || '',
                stateProv: newAddress.stateProv || '',
                zipPostal: newAddress.zipPostal || '',
                country: newAddress.country || 'US',
                phone: newAddress.phone || '',
                email: newAddress.email || '',
                specialInstructions: newAddress.specialInstructions || '',
                isDefault: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const docRef = await addDoc(collection(db, 'addressBook'), addressBookData);

            // Refresh the addresses list
            await loadAndProcessAddresses(selectedCustomerState);

            // Auto-select the newly created address
            const newAddressFormatted = {
                id: docRef.id,
                customerID: customerID,
                name: newAddress.nickname || 'New Address',
                company: newAddress.companyName || selectedCustomerState.company || selectedCustomerState.name || '',
                attention: `${newAddress.firstName || ''} ${newAddress.lastName || ''}`.trim(),
                street: newAddress.address1 || '',
                street2: newAddress.address2 || '',
                city: newAddress.city || '',
                state: newAddress.stateProv || '',
                postalCode: newAddress.zipPostal || '',
                country: newAddress.country || 'US',
                contactName: `${newAddress.firstName || ''} ${newAddress.lastName || ''}`.trim(),
                contactPhone: newAddress.phone || '',
                contactEmail: newAddress.email || '',
                specialInstructions: newAddress.specialInstructions || '',
                selectedAddressId: docRef.id
            };

            setSelectedAddressId(docRef.id);
            updateFormSection('shipTo', newAddressFormatted);

            setIsAddressDialogOpen(false);
            setSuccess('New destination address added and selected!');
            setTimeout(() => setSuccess(null), 3000);

            // Auto-submit when new address is added
            if (onNext) {
                setTimeout(() => onNext(newAddressFormatted), 100);
            }
        } catch (err) {
            console.error('QuickShipTo: Error saving address:', err);
            setError('Failed to save address.');
        }
    }, [selectedCustomerState, newAddress, loadAndProcessAddresses, updateFormSection, onNext]);

    return (
        <Box sx={{ p: 3 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    <Typography sx={{ fontSize: '12px' }}>{error}</Typography>
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                    <Typography sx={{ fontSize: '12px' }}>{success}</Typography>
                </Alert>
            )}

            <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600, mb: 2, color: '#374151' }}>
                Destination
            </Typography>

            {/* Customer Selection */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                        Select Customer
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onOpenAddCustomer || handleOpenCustomerDialog}
                        sx={{ fontSize: '12px', minWidth: '120px' }}
                    >
                        New Customer
                    </Button>
                </Box>
                {loading ? (
                    <Skeleton variant="rectangular" height={40} />
                ) : (
                    <Autocomplete
                        size="small"
                        options={customers}
                        getOptionLabel={(option) => option?.name || option?.company || ''}
                        value={selectedCustomerState}
                        onChange={(event, newValue) => handleCustomerSelect(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Search and select a customer..."
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <PersonIcon sx={{ color: '#666', fontSize: '16px' }} />
                                        </InputAdornment>
                                    ),
                                    sx: { fontSize: '12px' }
                                }}
                            />
                        )}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                <Box>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        {option.name || option.company}
                                    </Typography>
                                    {option.company && option.name && (
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            {option.company}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        )}
                        noOptionsText={
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                No customers found
                            </Typography>
                        }
                        loadingText={
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Loading customers...
                            </Typography>
                        }
                    />
                )}
            </Box>

            {/* Address Selection */}
            {selectedCustomerState && (
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                            Destination Addresses
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleOpenAddressDialog}
                            sx={{ fontSize: '12px', minWidth: '100px' }}
                        >
                            Add New
                        </Button>
                    </Box>



                    {loadingDestinations ? (
                        <Box sx={{ py: 2 }}>
                            <Skeleton variant="rectangular" height={80} sx={{ mb: 1 }} />
                            <Skeleton variant="rectangular" height={80} />
                        </Box>
                    ) : (
                        <Box>
                            {filteredAddresses.length > 0 ? (
                                filteredAddresses.map((address) => {
                                    const addressId = address.id;
                                    const isSelected = String(addressId) === String(selectedAddressId) && selectedAddressId !== null;

                                    return (
                                        <Card
                                            key={addressId}
                                            sx={{
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                borderRadius: '8px',
                                                width: '100%',
                                                mb: 1.5,
                                                ...(isSelected
                                                    ? {
                                                        borderColor: '#6b46c1 !important',
                                                        border: '2px solid #6b46c1 !important',
                                                        borderLeft: '6px solid #6b46c1 !important',
                                                        bgcolor: 'rgba(107, 70, 193, 0.08) !important',
                                                        boxShadow: '0 4px 12px 0 rgba(0,0,0,0.1) !important',
                                                        position: 'relative',
                                                        '&::after': {
                                                            content: '""',
                                                            position: 'absolute',
                                                            top: '12px',
                                                            right: '12px',
                                                            width: '16px',
                                                            height: '16px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#6b46c1',
                                                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'white\'%3E%3Cpath d=\'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z\'/%3E%3C/svg%3E")',
                                                            backgroundSize: '10px 10px',
                                                            backgroundPosition: 'center',
                                                            backgroundRepeat: 'no-repeat',
                                                        }
                                                    }
                                                    : {
                                                        border: '1px solid rgba(0, 0, 0, 0.12) !important',
                                                        '&:hover': {
                                                            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)',
                                                            borderColor: '#6b46c1 !important',
                                                        }
                                                    })
                                            }}
                                            onClick={() => handleAddressChange(addressId)}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <Box sx={{ flex: 1 }}>
                                                        {/* Header with nickname and flags */}
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                            <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
                                                                {address.name || 'Destination Address'}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                {address.isDefault && (
                                                                    <Chip
                                                                        label="Default"
                                                                        size="small"
                                                                        sx={{
                                                                            fontSize: '10px',
                                                                            height: '20px',
                                                                            bgcolor: '#dcfdf7',
                                                                            color: '#065f46'
                                                                        }}
                                                                    />
                                                                )}
                                                                <Typography sx={{ fontSize: '16px' }}>
                                                                    {getCountryFlag(address.country)}
                                                                </Typography>
                                                            </Box>
                                                        </Box>

                                                        {/* 3-column compact layout */}
                                                        <Grid container spacing={1}>
                                                            <Grid item xs={12} md={4}>
                                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                                    Company:
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                                    {address.company}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} md={4}>
                                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                                    Address:
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                                    {address.street}
                                                                    {address.street2 && `, ${address.street2}`}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} md={4}>
                                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                                    Location:
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                                    {address.city}, {address.state} {address.postalCode}
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>

                                                        {address.contactName && (
                                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af', mt: 1 }}>
                                                                Contact: {address.contactName}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            ) : (
                                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f9fafb', border: '1px dashed #d1d5db' }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        No destination addresses found.
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={handleOpenAddressDialog}
                                            sx={{ fontSize: '12px', p: 0, minWidth: 'auto', ml: 0.5 }}
                                        >
                                            Add a new address
                                        </Button>
                                    </Typography>
                                </Paper>
                            )}
                        </Box>
                    )}
                </Box>
            )}

            {/* Add New Address Dialog */}
            <Dialog
                open={isAddressDialogOpen}
                onClose={handleCloseAddressDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '14px', fontWeight: 600 }}>
                    Add New Destination Address
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Address Nickname"
                                name="nickname"
                                value={newAddress.nickname}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Company Name"
                                name="companyName"
                                value={newAddress.companyName}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="First Name"
                                name="firstName"
                                value={newAddress.firstName}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Last Name"
                                name="lastName"
                                value={newAddress.lastName}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Street Address"
                                name="address1"
                                value={newAddress.address1}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Address Line 2 (Optional)"
                                name="address2"
                                value={newAddress.address2}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                size="small"
                                label="City"
                                name="city"
                                value={newAddress.city}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>State/Province</InputLabel>
                                <Select
                                    name="stateProv"
                                    value={newAddress.stateProv}
                                    onChange={handleNewAddressChange}
                                    label="State/Province"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {getStateOptions(newAddress.country).map(({ value, label }) => (
                                        <MenuItem key={value} value={value} sx={{ fontSize: '12px' }}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Postal Code"
                                name="zipPostal"
                                value={newAddress.zipPostal}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                <Select
                                    name="country"
                                    value={newAddress.country}
                                    onChange={handleNewAddressChange}
                                    label="Country"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Phone"
                                name="phone"
                                value={newAddress.phone}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Email"
                                name="email"
                                value={newAddress.email}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleCloseAddressDialog}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveAddress}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        Add Address
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
});

QuickShipTo.displayName = 'QuickShipTo';

export default QuickShipTo; 