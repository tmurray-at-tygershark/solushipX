import React, { useState, useEffect, useCallback } from 'react';
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
    Container,
    Autocomplete,
    CircularProgress,
    Dialog
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    ArrowForward as ArrowForwardIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import DestinationAddressDialog from '../Customers/DestinationAddressDialog';
import AddCustomer from '../Customers/AddCustomer';
import { useSnackbar } from 'notistack';
import { getCountryFlag } from '../Shipments/utils/shipmentHelpers';
import './ShipTo.css';

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

const ShipTo = ({ onNext, onPrevious }) => {
    const { currentUser } = useAuth();
    const { formData, updateFormSection } = useShipmentForm();
    const { enqueueSnackbar } = useSnackbar();

    const [customers, setCustomers] = useState([]);
    const [selectedCustomerState, setSelectedCustomerState] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [filteredAddresses, setFilteredAddresses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAddressId, setSelectedAddressId] = useState(formData.shipTo?.selectedAddressId || null);

    const [loading, setLoading] = useState(true);
    const [loadingDestinations, setLoadingDestinations] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Add New Address Dialog states
    const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);

    // Add Customer Modal states
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

    // Search functionality for addresses
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredAddresses(customerAddresses);
        } else {
            const filtered = customerAddresses.filter(address =>
                address.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.street?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredAddresses(filtered);
        }
    }, [searchTerm, customerAddresses]);

    const handleSearchChange = useCallback((e) => {
        setSearchTerm(e.target.value);
    }, []);

    const fetchCustomers = useCallback(async (companyId) => {
        if (!companyId) return;
        setLoading(true);
        try {
            setError(null);
            const customersSnapshot = await getDocs(query(collection(db, 'customers'), where('companyID', '==', companyId)));
            let customersData = [];
            if (!customersSnapshot.empty) {
                customersData = customersSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, customerID: data.customerID || doc.id, ...data };
                });
            }
            setCustomers(customersData);

            // Handle existing customer selection from context
            if (formData.shipTo?.customerID && customersData.length > 0) {
                const preSelected = customersData.find(c => c.customerID === formData.shipTo.customerID || c.id === formData.shipTo.customerID);
                if (preSelected) {
                    console.log("ShipTo: Setting customer from context:", preSelected);
                    setSelectedCustomerState(preSelected);
                }
            }
        } catch (err) {
            console.error('Error fetching customers:', err);
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
                if (!userDoc.exists()) throw new Error('User data not found.');
                const userData = userDoc.data();
                const id = userData.companyID || userData.companyId || userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];
                if (!id) throw new Error('No company associated with this user.');
                await fetchCustomers(id);
            } catch (err) {
                console.error('Error fetching company ID for ShipTo:', err);
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

            console.log("ShipTo: Formatted addresses:", formattedAddresses);
            setCustomerAddresses(formattedAddresses);
            setFilteredAddresses(formattedAddresses);

            // Enhanced address selection logic for draft data
            const currentShipToData = formData.shipTo || {};
            const hasExistingAddressData = currentShipToData.street || currentShipToData.city;

            console.log("ShipTo: Address selection logic:", {
                selectedAddressIdFromContext: formData.shipTo?.selectedAddressId,
                hasExistingAddressData,
                currentShipToData,
                formattedAddressesCount: formattedAddresses.length
            });

            let addressToSelectObject = null;

            if (formData.shipTo?.selectedAddressId && formattedAddresses.length > 0) {
                // Try to find the address by ID first
                addressToSelectObject = formattedAddresses.find(addr => String(addr.id) === String(formData.shipTo.selectedAddressId));
                console.log("ShipTo: Found address by ID:", addressToSelectObject);
            }

            if (!addressToSelectObject && hasExistingAddressData && formattedAddresses.length > 0) {
                // Try to find matching address by street/city if no ID match
                addressToSelectObject = formattedAddresses.find(addr =>
                    addr.street?.toLowerCase() === currentShipToData.street?.toLowerCase() &&
                    addr.city?.toLowerCase() === currentShipToData.city?.toLowerCase()
                );
                console.log("ShipTo: Found address by street/city match:", addressToSelectObject);
            }

            if (!addressToSelectObject && formattedAddresses.length > 0) {
                // Fall back to default or first address
                addressToSelectObject = formattedAddresses.find(addr => addr.isDefault) || formattedAddresses[0];
                console.log("ShipTo: Using default/first address:", addressToSelectObject);
            }

            if (addressToSelectObject) {
                setSelectedAddressId(String(addressToSelectObject.id));
                const shipToUpdate = {
                    ...addressToSelectObject,
                    customerID: localCustomerID,
                    selectedAddressId: String(addressToSelectObject.id)
                };
                console.log("ShipTo: Updating context with selected address:", shipToUpdate);
                updateFormSection('shipTo', shipToUpdate);
            } else if (hasExistingAddressData) {
                // Keep existing address data but ensure customer ID is set
                console.log("ShipTo: Keeping existing address data with customer ID");
                updateFormSection('shipTo', {
                    ...currentShipToData,
                    customerID: localCustomerID,
                    selectedAddressId: null
                });
                setSelectedAddressId(null);
            } else if (formattedAddresses.length === 0) {
                // No addresses available - create empty address with customer info
                console.log("ShipTo: No addresses available, creating empty address");
                updateFormSection('shipTo', {
                    ...emptyAddress(),
                    customerID: localCustomerID,
                    company: customerForAddresses.company || customerForAddresses.name || ''
                });
                setSelectedAddressId(null);
            }
        } catch (err) {
            console.error('Error loading/processing addresses:', err);
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
                console.log(`ShipTo: Triggering address load for customer ${selectedCustomerState.customerID}`);
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
        console.log("🏠 ShipTo: Customer selected:", customer);
        setSelectedCustomerState({ ...customer, customerID });
        setSelectedAddressId(null);
        updateFormSection('shipTo', {
            ...emptyAddress(),
            customerID: customerID,
            company: customer.company || customer.name || '',
            selectedAddressId: null
        });
    }, [updateFormSection]);

    const handleAddressChange = useCallback((addressId) => {
        const addressIdStr = addressId ? String(addressId) : null;
        if (!addressIdStr || !selectedCustomerState) return;

        console.log('🏠 ShipTo: Address card clicked, ID:', addressIdStr);
        setSelectedAddressId(addressIdStr);
        const selectedAddressData = customerAddresses.find(addr => String(addr.id) === addressIdStr);

        if (selectedAddressData) {
            console.log('🏠 ShipTo: Found address data:', selectedAddressData);
            const shipToUpdate = {
                ...selectedAddressData,
                customerID: selectedCustomerState.customerID || selectedCustomerState.id,
                selectedAddressId: addressIdStr
            };
            console.log('🏠 ShipTo: Updating context with:', shipToUpdate);
            updateFormSection('shipTo', shipToUpdate);

            // Verify the update worked
            setTimeout(() => {
                console.log("🏠 ShipTo: Verification - formData.shipTo after update:", formData.shipTo);
            }, 100);
        } else {
            console.error(`❌ ShipTo: No address found with ID: ${addressIdStr} in local list.`);
        }
    }, [customerAddresses, selectedCustomerState, updateFormSection, formData.shipTo]);

    // Add New Address Dialog handlers
    const handleOpenAddressDialog = useCallback(() => {
        if (!selectedCustomerState) {
            enqueueSnackbar('Please select a customer first.', { variant: 'warning' });
            return;
        }
        setIsAddressDialogOpen(true);
    }, [selectedCustomerState, enqueueSnackbar]);

    const handleCloseAddressDialog = useCallback(() => {
        setIsAddressDialogOpen(false);
    }, []);

    const handleSaveAddress = useCallback(async (addressData) => {
        if (!selectedCustomerState) {
            enqueueSnackbar('No customer selected.', { variant: 'error' });
            return;
        }

        try {
            const customerID = selectedCustomerState.customerID || selectedCustomerState.id;

            // Prepare address data for addressBook collection
            const addressBookData = {
                addressClass: 'customer',
                addressClassID: customerID,
                addressType: 'destination',
                status: 'active',
                nickname: addressData.nickname || '',
                companyName: addressData.companyName || selectedCustomerState.company || selectedCustomerState.name || '',
                firstName: addressData.firstName || '',
                lastName: addressData.lastName || '',
                attention: addressData.attention || `${addressData.firstName || ''} ${addressData.lastName || ''}`.trim(),
                address1: addressData.address1 || addressData.street || '',
                address2: addressData.address2 || addressData.street2 || '',
                city: addressData.city || '',
                stateProv: addressData.stateProv || addressData.state || '',
                zipPostal: addressData.zipPostal || addressData.postalCode || '',
                country: addressData.country || 'US',
                phone: addressData.phone || '',
                email: addressData.email || '',
                specialInstructions: addressData.specialInstructions || '',
                isDefault: addressData.isDefault || false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log('🏠 ShipTo: Saving new address to addressBook:', addressBookData);

            // Add to addressBook collection
            const docRef = await addDoc(collection(db, 'addressBook'), addressBookData);
            console.log('🏠 ShipTo: Address saved with ID:', docRef.id);

            // Refresh the addresses list
            await loadAndProcessAddresses(selectedCustomerState);

            // Auto-select the newly created address
            const newAddressFormatted = {
                id: docRef.id,
                customerID: customerID,
                name: addressData.nickname || 'New Address',
                company: addressData.companyName || selectedCustomerState.company || selectedCustomerState.name || '',
                attention: addressData.attention || `${addressData.firstName || ''} ${addressData.lastName || ''}`.trim(),
                street: addressData.address1 || '',
                street2: addressData.address2 || '',
                city: addressData.city || '',
                state: addressData.stateProv || '',
                postalCode: addressData.zipPostal || '',
                country: addressData.country || 'US',
                contactName: `${addressData.firstName || ''} ${addressData.lastName || ''}`.trim(),
                contactPhone: addressData.phone || '',
                contactEmail: addressData.email || '',
                specialInstructions: addressData.specialInstructions || '',
                isDefault: addressData.isDefault || false
            };

            // Update form context with new address
            setSelectedAddressId(docRef.id);
            updateFormSection('shipTo', {
                ...newAddressFormatted,
                customerID: customerID,
                selectedAddressId: docRef.id
            });

            enqueueSnackbar('Delivery address added successfully!', { variant: 'success' });
            setIsAddressDialogOpen(false);

        } catch (error) {
            console.error('Error saving address:', error);
            enqueueSnackbar(`Failed to save address: ${error.message}`, { variant: 'error' });
        }
    }, [selectedCustomerState, loadAndProcessAddresses, updateFormSection, enqueueSnackbar]);

    // Add Customer Modal handlers
    const handleOpenAddCustomerModal = useCallback(() => {
        setIsAddCustomerModalOpen(true);
    }, []);

    const handleCloseAddCustomerModal = useCallback(() => {
        setIsAddCustomerModalOpen(false);
    }, []);

    const handleCustomerCreated = useCallback(async (newCustomerFirestoreId) => {
        try {
            console.log('🏠 ShipTo: Customer created with ID:', newCustomerFirestoreId);

            // Close the add customer modal
            setIsAddCustomerModalOpen(false);

            // Refresh the customers list
            if (currentUser) {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const companyId = userData.companyID || userData.companyId || userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];
                    if (companyId) {
                        await fetchCustomers(companyId);

                        // Find and auto-select the newly created customer
                        const customersSnapshot = await getDocs(query(collection(db, 'customers'), where('companyID', '==', companyId)));
                        const newCustomer = customersSnapshot.docs.find(doc => doc.id === newCustomerFirestoreId);

                        if (newCustomer) {
                            const customerData = { id: newCustomer.id, customerID: newCustomer.data().customerID || newCustomer.id, ...newCustomer.data() };
                            console.log('🏠 ShipTo: Auto-selecting newly created customer:', customerData);
                            handleCustomerSelect(customerData);
                            enqueueSnackbar('Customer created and selected successfully!', { variant: 'success' });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error handling customer creation:', error);
            enqueueSnackbar('Customer created but failed to auto-select. Please select manually.', { variant: 'warning' });
        }
    }, [currentUser, fetchCustomers, handleCustomerSelect, enqueueSnackbar]);

    const handleSubmit = useCallback(() => {
        setError(null);
        const currentShipToData = formData.shipTo || {};
        let validationErrorMessages = [];

        console.log("🔍 ShipTo handleSubmit: Starting validation");
        console.log("🔍 selectedCustomerState:", selectedCustomerState);
        console.log("🔍 selectedAddressId:", selectedAddressId);
        console.log("🔍 currentShipToData from context:", currentShipToData);

        if (!currentShipToData.customerID) {
            validationErrorMessages.push('Please select a customer.');
            console.log("❌ No customer selected");
        }

        if (!selectedAddressId && !currentShipToData.street) {
            validationErrorMessages.push('Please select or add a shipping destination address.');
            console.log("❌ No address selected and no street in currentShipToData");
        } else {
            const requiredFields = ['company', 'street', 'city', 'state', 'postalCode', 'country', 'contactName', 'contactPhone', 'contactEmail'];
            const missingFields = requiredFields.filter(field => {
                const fieldValue = currentShipToData[field];
                const isEmpty = !fieldValue || String(fieldValue).trim() === '';
                if (isEmpty) {
                    console.log(`❌ Missing field: ${field} = "${fieldValue}"`);
                }
                return isEmpty;
            });

            console.log("🔍 Required fields check:", {
                requiredFields,
                missingFields,
                currentShipToDataKeys: Object.keys(currentShipToData)
            });

            if (missingFields.length > 0) {
                missingFields.forEach(field => {
                    let fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                    if (field === 'contactPhone') fieldName = 'Contact Phone';
                    if (field === 'contactEmail') fieldName = 'Contact Email';
                    if (field === 'contactName') fieldName = 'Contact Name';
                    if (field === 'postalCode') fieldName = 'Postal Code';
                    validationErrorMessages.push(`Destination ${fieldName} is required.`);
                });
            }
        }

        if (validationErrorMessages.length > 0) {
            const errorMessage = validationErrorMessages.join(' \n ');
            setError(errorMessage);
            console.warn("❌ ShipTo handleSubmit: Validation failed:", validationErrorMessages);
            return;
        }

        console.log("✅ ShipTo handleSubmit: Validation passed. Calling onNext with data:", currentShipToData);
        console.log("🚀 About to call onNext...");
        onNext(currentShipToData);
        console.log("✅ onNext called successfully");
    }, [selectedCustomerState, selectedAddressId, formData.shipTo, onNext]);

    const getAttentionLine = useCallback((address) => {
        if (!address) return '';
        return address.attention || address.contactName || '';
    }, []);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error.split(' \n ').map((line, index) => <div key={index} style={{ fontSize: '12px' }}>{line}</div>)}
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
                    <Typography sx={{ fontSize: '12px' }}>{success}</Typography>
                </Alert>
            )}

            <Paper sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Delivery Location
                    </Typography>
                </Box>

                {/* Customer Selection */}
                <Box sx={{ mb: 3 }}>
                    {!selectedCustomerState ? (
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                                    Select Customer
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={handleOpenAddCustomerModal}
                                    sx={{
                                        fontSize: '12px',
                                        minWidth: '140px',
                                        borderColor: '#6b46c1',
                                        color: '#6b46c1',
                                        '&:hover': {
                                            borderColor: '#553c9a',
                                            backgroundColor: 'rgba(107, 70, 193, 0.04)'
                                        }
                                    }}
                                >
                                    Add Customer
                                </Button>
                            </Box>
                            <Autocomplete
                                options={customers}
                                getOptionLabel={(option) => option.name || ''}
                                value={selectedCustomerState}
                                onChange={(event, newValue) => {
                                    handleCustomerSelect(newValue);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        size="medium"
                                        placeholder="Search customers..."
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ color: '#666', fontSize: '24px' }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <>
                                                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                            sx: {
                                                fontSize: '16px',
                                                height: '56px',
                                                '& .MuiInputBase-input': {
                                                    fontSize: '16px',
                                                    fontWeight: 500,
                                                    padding: '16px 14px'
                                                }
                                            }
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    border: 'none'
                                                },
                                                '&:hover': {
                                                    borderColor: '#6b46c1',
                                                    boxShadow: '0 4px 12px rgba(107, 70, 193, 0.15)',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        border: 'none'
                                                    }
                                                },
                                                '&.Mui-focused': {
                                                    borderColor: '#6b46c1',
                                                    boxShadow: '0 4px 20px rgba(107, 70, 193, 0.25)',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        border: 'none'
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props}>
                                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                            <div style={{ marginRight: '12px', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#6b46c1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                                {option.name?.charAt(0) || 'C'}
                                            </div>
                                            <div>
                                                <Typography variant="subtitle1" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {option.name}
                                                </Typography>
                                                {option.contacts?.[0] && (
                                                    <Typography variant="body2" color="textSecondary" sx={{ fontSize: '11px' }}>
                                                        {option.contacts[0].name}
                                                    </Typography>
                                                )}
                                            </div>
                                        </div>
                                    </Box>
                                )}
                                filterOptions={(options, { inputValue }) => {
                                    const searchValue = inputValue.toLowerCase();
                                    return options.filter(option =>
                                        option.name?.toLowerCase().includes(searchValue) ||
                                        option.contacts?.some(contact =>
                                            contact.name?.toLowerCase().includes(searchValue) ||
                                            contact.email?.toLowerCase().includes(searchValue)
                                        )
                                    );
                                }}
                                ListboxProps={{
                                    sx: {
                                        maxHeight: '300px',
                                        '& .MuiAutocomplete-option': {
                                            padding: '8px 16px',
                                            '&:hover': {
                                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                            },
                                        },
                                    },
                                }}
                                disablePortal
                                loading={loading}
                            />
                        </>
                    ) : (
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 2,
                            border: '1px solid #e2e8f0',
                            borderRadius: 1,
                            backgroundColor: '#f8fafc'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box sx={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    backgroundColor: '#6b46c1',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    mr: 2
                                }}>
                                    {selectedCustomerState.name?.charAt(0) || 'C'}
                                </Box>
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        {selectedCustomerState.name}
                                    </Typography>
                                    {selectedCustomerState.contacts?.[0] && (
                                        <Typography variant="body2" color="textSecondary" sx={{ fontSize: '12px' }}>
                                            {selectedCustomerState.contacts[0].name}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleCustomerSelect(null)}
                                sx={{
                                    fontSize: '12px',
                                    minWidth: '120px',
                                    borderColor: '#6b46c1',
                                    color: '#6b46c1',
                                    '&:hover': {
                                        borderColor: '#553c9a',
                                        backgroundColor: 'rgba(107, 70, 193, 0.04)'
                                    }
                                }}
                            >
                                Change Customer
                            </Button>
                        </Box>
                    )}
                </Box>

                {/* Address Selection */}
                {selectedCustomerState && (
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                                Select Delivery Address
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={handleOpenAddressDialog}
                                sx={{ fontSize: '12px', minWidth: '100px' }}
                            >
                                Add
                            </Button>
                        </Box>

                        {loadingDestinations ? (
                            <Box sx={{ py: 4 }}>
                                <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
                                <Skeleton variant="rectangular" height={100} />
                            </Box>
                        ) : (
                            <Box>
                                {filteredAddresses.length > 0 ? (
                                    filteredAddresses.map((address) => {
                                        const addressId = address.id;
                                        const isSelected = addressId === selectedAddressId && selectedAddressId !== null;
                                        const attentionLine = getAttentionLine(address);

                                        return (
                                            <Card
                                                key={addressId}
                                                sx={{
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s ease',
                                                    borderRadius: '8px',
                                                    width: '100%',
                                                    mb: 2,
                                                    position: 'relative',
                                                    ...(isSelected
                                                        ? {
                                                            borderColor: '#6b46c1 !important',
                                                            border: '3px solid #6b46c1 !important',
                                                            borderLeft: '8px solid #6b46c1 !important',
                                                            bgcolor: 'rgba(107, 70, 193, 0.12) !important',
                                                            boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                                            transform: 'scale(1.02) !important',
                                                            '&:hover': {
                                                                boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                                                borderColor: '#6b46c1 !important',
                                                                borderLeft: '8px solid #6b46c1 !important',
                                                            },
                                                            '&::after': {
                                                                content: '""',
                                                                position: 'absolute',
                                                                top: '15px',
                                                                right: '15px',
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                backgroundColor: '#6b46c1',
                                                                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'white\'%3E%3Cpath d=\'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z\'/%3E%3C/svg%3E")',
                                                                backgroundSize: '14px 14px',
                                                                backgroundPosition: 'center',
                                                                backgroundRepeat: 'no-repeat',
                                                            }
                                                        }
                                                        : {
                                                            borderColor: 'rgba(0, 0, 0, 0.12) !important',
                                                            border: '1px solid rgba(0, 0, 0, 0.12) !important',
                                                            borderLeft: '1px solid rgba(0, 0, 0, 0.12) !important',
                                                            bgcolor: 'transparent !important',
                                                            background: 'none !important',
                                                            boxShadow: 'none !important',
                                                            transform: 'none !important',
                                                            '&:hover': {
                                                                boxShadow: '0 4px 12px 0 rgba(0,0,0,0.08)',
                                                                transform: 'translateY(-4px)',
                                                                borderLeft: '4px solid rgba(107, 70, 193, 0.5)',
                                                            }
                                                        })
                                                }}
                                                onClick={() => handleAddressChange(addressId)}
                                            >
                                                {/* Country Flag */}
                                                {getCountryFlag(address) && (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            bottom: '12px',
                                                            right: '12px',
                                                            fontSize: '20px',
                                                            zIndex: 1,
                                                            opacity: 0.8,
                                                            transition: 'opacity 0.2s ease',
                                                            '&:hover': {
                                                                opacity: 1
                                                            }
                                                        }}
                                                        title={`Country: ${address.country || 'Unknown'}`}
                                                    >
                                                        {getCountryFlag(address)}
                                                    </Box>
                                                )}

                                                <CardContent sx={{ p: 2 }}>
                                                    <Grid container alignItems="center" spacing={2}>
                                                        <Grid item xs={12} sm={4}>
                                                            <Box display="flex" alignItems="center">
                                                                <Typography variant="subtitle1" fontWeight="500" sx={{ mr: 1, fontSize: '14px' }}>
                                                                    {address.name || "Unnamed Address"}
                                                                </Typography>
                                                                {address.isDefault && (
                                                                    <Chip
                                                                        size="small"
                                                                        label="Default"
                                                                        color="primary"
                                                                        sx={{ height: 22, fontSize: '10px' }}
                                                                    />
                                                                )}
                                                            </Box>
                                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                                {address.company}
                                                            </Typography>
                                                            {attentionLine && (
                                                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                                    <Box component="span" fontWeight="500">Attn:</Box> {attentionLine}
                                                                </Typography>
                                                            )}
                                                        </Grid>
                                                        <Grid item xs={12} sm={4}>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                {address.street}
                                                                {address.street2 && <>, {address.street2}</>}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                {address.city}, {address.state} {address.postalCode}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={4}>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                <Box component="span" fontWeight="500">Phone:</Box> {address.contactPhone}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                <Box component="span" fontWeight="500">Email:</Box> {address.contactEmail}
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                ) : (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontSize: '12px' }}>
                                            {searchTerm ? 'No delivery locations found matching your search.' : 'No saved delivery locations found.'}
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<AddIcon />}
                                            onClick={handleOpenAddressDialog}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Add Delivery Location
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                )}

                <Box sx={{ mt: 4 }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1 }}>
                        Special Instructions
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        name="specialInstructions"
                        value={formData.shipTo?.specialInstructions || ''}
                        onChange={(e) => {
                            updateFormSection('shipTo', {
                                ...formData.shipTo,
                                specialInstructions: e.target.value
                            });
                        }}
                        placeholder="Enter any special delivery instructions or notes for the carrier"
                        InputProps={{
                            sx: { fontSize: '12px' }
                        }}
                        sx={{ mb: 2 }}
                    />
                </Box>
            </Paper>

            {/* Add New Address Dialog */}
            <DestinationAddressDialog
                open={isAddressDialogOpen}
                onClose={handleCloseAddressDialog}
                onSave={handleSaveAddress}
                customerID={selectedCustomerState?.customerID || selectedCustomerState?.id}
                customerCompanyName={selectedCustomerState?.company || selectedCustomerState?.name || ''}
                addressData={null} // Always null for new addresses
            />

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                    variant="outlined"
                    onClick={onPrevious}
                    sx={{ px: 4, fontSize: '12px' }}
                >
                    Previous
                </Button>
                <Button
                    type="button"
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!selectedCustomerState || (!selectedAddressId && !formData.shipTo?.street) || loadingDestinations}
                    sx={{
                        px: 6,
                        py: 1.5,
                        fontSize: '12px',
                        backgroundColor: '#10B981',
                        minWidth: '160px',
                        '&:hover': {
                            backgroundColor: '#059669'
                        },
                        '&:disabled': {
                            backgroundColor: '#cccccc'
                        }
                    }}
                    endIcon={<ArrowForwardIcon />}
                >
                    Next
                </Button>
            </Box>

            {/* Add Customer Modal */}
            <Dialog
                open={isAddCustomerModalOpen}
                onClose={handleCloseAddCustomerModal}
                maxWidth="lg"
                fullWidth
                fullScreen
                PaperProps={{
                    sx: {
                        borderRadius: 0,
                        backgroundColor: '#ffffff'
                    }
                }}
                TransitionProps={{
                    timeout: 400
                }}
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end'
                    },
                    '& .MuiBackdrop-root': {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)'
                    }
                }}
            >
                <AddCustomer
                    isModal={true}
                    onBackToTable={handleCloseAddCustomerModal}
                    onCustomerCreated={handleCustomerCreated}
                />
            </Dialog>

            {/* Add New Address Dialog */}
            <DestinationAddressDialog
                open={isAddressDialogOpen}
                onClose={handleCloseAddressDialog}
                onSave={handleSaveAddress}
                customerID={selectedCustomerState?.customerID || selectedCustomerState?.id}
                customerCompanyName={selectedCustomerState?.company || selectedCustomerState?.name || ''}
                addressData={null} // Always null for new addresses
            />
        </Container>
    );
};

export default ShipTo; 