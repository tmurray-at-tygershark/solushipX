import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import './ShipTo.css';
import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress, Pagination, Card, CardContent, Grid, Button, Divider, List, TablePagination, Skeleton, IconButton, Alert } from '@mui/material';
import {
    LocationOn as LocationOnIcon,
    LocalPhone as LocalPhoneIcon,
    Email as EmailIcon,
    Business as BusinessIcon,
    Home as HomeIcon,
    Add as AddIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    Person as PersonIcon
} from '@mui/icons-material';

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

    const [customers, setCustomers] = useState([]);
    const [selectedCustomerState, setSelectedCustomerState] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(formData.shipTo?.selectedAddressId || null);

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [customersPerPage] = useState(5);
    const [totalPages, setTotalPages] = useState(1);

    const [loading, setLoading] = useState(true);
    const [loadingDestinations, setLoadingDestinations] = useState(false);
    const [error, setError] = useState(null);
    const [companyId, setCompanyId] = useState(null);

    useEffect(() => {
        const customerIdFromContext = formData.shipTo?.customerID;
        const selectedAddressIdFromContext = formData.shipTo?.selectedAddressId;

        console.log("ShipTo: Context sync effect triggered:", {
            customerIdFromContext,
            selectedAddressIdFromContext,
            currentSelectedCustomer: selectedCustomerState?.customerID,
            currentSelectedAddress: selectedAddressId
        });

        // Handle customer selection from context
        if (customerIdFromContext && (!selectedCustomerState || selectedCustomerState.customerID !== customerIdFromContext)) {
            const customerFromList = customers.find(c => c.customerID === customerIdFromContext || c.id === customerIdFromContext);
            if (customerFromList) {
                console.log("ShipTo: Setting customer from context:", customerFromList);
                setSelectedCustomerState(customerFromList);
            } else {
                console.log("ShipTo: Customer ID from context not found in customer list, will search when customers load");
            }
        }

        // Handle address selection from context
        if (selectedAddressIdFromContext !== selectedAddressId) {
            console.log("ShipTo: Updating selected address ID from context:", selectedAddressIdFromContext);
            setSelectedAddressId(selectedAddressIdFromContext || null);
        }
    }, [formData.shipTo?.customerID, formData.shipTo?.selectedAddressId, customers, selectedCustomerState?.customerID, selectedAddressId]);

    useEffect(() => {
        setTotalPages(Math.ceil(customers.length / customersPerPage));
    }, [customers, customersPerPage]);

    const fetchCustomers = useCallback(async (id) => {
        if (!id) return;
        setLoading(true);
        try {
            setError(null);
            const customersSnapshot = await getDocs(query(collection(db, 'customers'), where('companyID', '==', id)));
            let customersData = [];
            if (!customersSnapshot.empty) {
                customersData = customersSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, customerID: data.customerID || doc.id, ...data };
                });
            }
            setCustomers(customersData);
            if (formData.shipTo?.customerID && customersData.length > 0) {
                const preSelected = customersData.find(c => c.customerID === formData.shipTo.customerID || c.id === formData.shipTo.customerID);
                if (preSelected) setSelectedCustomerState(preSelected);
            }
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError('Failed to load customers.');
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchCompanyId = async () => {
            if (!currentUser) { setLoading(false); return; }
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
            return;
        }
        setLoadingDestinations(true); setError(null);
        try {
            let addressesToProcess = [];
            const addressesQuery = query(collection(db, 'addressBook'), where('addressClass', '==', 'customer'), where('addressType', '==', 'destination'), where('addressClassID', '==', localCustomerID));
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
                company: addr.companyName || customerForAddresses.company || '',
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
            formattedAddresses.sort((a, b) => (a.isDefault === b.isDefault) ? 0 : a.isDefault ? -1 : 1);
            setCustomerAddresses(formattedAddresses);

            let addressToSelectObject = null;

            // Enhanced address selection logic for draft data
            const currentShipToData = formData.shipTo || {};
            const hasExistingAddressData = currentShipToData.street || currentShipToData.city;

            console.log("ShipTo: Address selection logic:", {
                selectedAddressIdFromContext: formData.shipTo?.selectedAddressId,
                hasExistingAddressData,
                currentShipToData,
                formattedAddressesCount: formattedAddresses.length
            });

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
                    company: customerForAddresses.company || ''
                });
                setSelectedAddressId(null);
            }
        } catch (err) {
            console.error('Error loading/processing addresses:', err);
            setError(`Failed to load addresses: ${err.message}`);
            setCustomerAddresses([]);
        } finally {
            setLoadingDestinations(false);
        }
    }, [updateFormSection, formData.shipTo?.selectedAddressId]);

    useEffect(() => {
        if (selectedCustomerState && selectedCustomerState.customerID) {
            const currentContextCustomerId = formData.shipTo?.customerID;
            if (currentContextCustomerId !== selectedCustomerState.customerID || customerAddresses.length === 0 || (customerAddresses.length > 0 && customerAddresses[0].customerID !== selectedCustomerState.customerID)) {
                console.log(`Load Address Effect: Triggering address load for customer ${selectedCustomerState.customerID}`);
                loadAndProcessAddresses(selectedCustomerState);
            }
        } else {
            setCustomerAddresses([]);
        }
    }, [selectedCustomerState, loadAndProcessAddresses, formData.shipTo?.customerID, customerAddresses]);

    const handleCustomerSelect = useCallback((customer) => {
        if (!customer) {
            setSelectedCustomerState(null);
            setSelectedAddressId(null);
            setCustomerAddresses([]);
            updateFormSection('shipTo', { ...emptyAddress(), customerID: null, selectedAddressId: null });
            return;
        }
        const customerID = customer.customerID || customer.id;
        setSelectedCustomerState({ ...customer, customerID });
        setSelectedAddressId(null);
        updateFormSection('shipTo', {
            ...emptyAddress(),
            customerID: customerID,
            company: customer.company || '',
            selectedAddressId: null
        });
    }, [updateFormSection]);

    useEffect(() => {
        if (formData.shipTo &&
            formData.shipTo.attention &&
            !formData.shipTo.contactName) {

            // Only update if there's an actual change to avoid potential loops
            const currentContactName = formData.shipTo.contactName;
            const currentContactPhone = formData.shipTo.contactPhone;
            const currentContactEmail = formData.shipTo.contactEmail;

            const newContactName = formData.shipTo.attention;
            // Ensure fallback for phone/email considers existing formData.shipTo values first
            const newContactPhone = formData.shipTo.contactPhone || formData.shipTo.phone || '';
            const newContactEmail = formData.shipTo.contactEmail || formData.shipTo.email || '';

            if (newContactName !== currentContactName ||
                newContactPhone !== currentContactPhone ||
                newContactEmail !== currentContactEmail) {

                console.log("ShipTo: Auto-populating contact fields from attention/defaults.", {
                    attention: formData.shipTo.attention,
                    currentContactName, newContactName,
                    currentContactPhone, newContactPhone,
                    currentContactEmail, newContactEmail
                });

                updateFormSection('shipTo', {
                    ...formData.shipTo, // Preserve existing shipTo fields
                    contactName: newContactName,
                    contactPhone: newContactPhone,
                    contactEmail: newContactEmail
                });
            }
        }
    }, [formData.shipTo, updateFormSection]);

    const ensureContactFields = useCallback((data) => {
        if (!data.contactName && data.attention) {
            data.contactName = data.attention;
        }

        if (!data.contactPhone && data.phone) {
            data.contactPhone = data.phone;
        }

        if (!data.contactEmail && data.email) {
            data.contactEmail = data.email;
        }

        return data;
    }, []);

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
        } else {
            console.error(`No address found with ID: ${addressIdStr} in local list.`);
        }
    }, [customerAddresses, selectedCustomerState, updateFormSection]);

    const handleSubmit = useCallback(() => {
        setError(null);
        const currentShipToData = formData.shipTo || {};
        let validationErrorMessages = [];

        console.log("ShipTo handleSubmit: Validating currentShipToData from context:", currentShipToData);

        if (!currentShipToData.customerID) {
            validationErrorMessages.push('Please select a customer.');
            console.warn("ShipTo Validation: No selected customer ID.");
        }

        if (!currentShipToData.street) {
            validationErrorMessages.push('Please select or complete a shipping address (street is missing).');
            console.warn("ShipTo Validation: Street is missing.");
        }

        const requiredAddressFields = ['company', 'street', 'city', 'state', 'postalCode', 'country', 'contactName', 'contactPhone', 'contactEmail'];
        const missingFields = requiredAddressFields.filter(field => !currentShipToData[field] || String(currentShipToData[field]).trim() === '');

        if (missingFields.length > 0) {
            missingFields.forEach(field => {
                let fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                if (field === 'contactPhone') fieldName = 'Contact Phone';
                else if (field === 'contactEmail') fieldName = 'Contact Email';
                else if (field === 'contactName') fieldName = 'Contact Name';
                else if (field === 'postalCode') fieldName = 'Postal Code';
                validationErrorMessages.push(`Ship To ${fieldName} is required.`);
            });
            console.warn("ShipTo Validation: Missing required address fields:", missingFields);
        }

        if (validationErrorMessages.length > 0) {
            const errorMessage = validationErrorMessages.join(' \n ');
            setError(errorMessage);
            return;
        }

        console.log("ShipTo handleSubmit: Validation passed. Calling onNext with:", currentShipToData);
        onNext(currentShipToData);
    }, [formData.shipTo, onNext]);

    const handleClearCustomer = useCallback(() => {
        setSelectedCustomerState(null);
        setSelectedAddressId(null);
        setCustomerAddresses([]);
        updateFormSection('shipTo', { ...emptyAddress(), customerID: null, selectedAddressId: null });
    }, [updateFormSection]);

    const handleAddCustomerClick = () => {
        console.log("Add new customer clicked");
    };

    const handleAddAddressClick = () => {
        console.log("Add new address clicked", selectedCustomerState?.id);
    };

    const renderCustomerSearch = () => (
        <div className="customer-search mb-4">
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
                        label="Search Customers"
                        variant="outlined"
                        fullWidth
                        placeholder="Start typing to search customers..."
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'white',
                                '&:hover': {
                                    backgroundColor: 'white',
                                },
                            },
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <Box component="li" {...props}>
                        <div className="d-flex align-items-center w-100">
                            <div className="customer-avatar me-3">
                                {option.name?.charAt(0) || 'C'}
                            </div>
                            <div>
                                <Typography variant="subtitle1">{option.name}</Typography>
                                {option.contacts?.[0] && (
                                    <Typography variant="body2" color="textSecondary">
                                        <i className="bi bi-person me-1"></i> {option.contacts[0].name}
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
                disableClearable
                blurOnSelect
            />
        </div>
    );

    const getCurrentPageCustomers = () => {
        const startIndex = (currentPage - 1) * customersPerPage;
        const endIndex = startIndex + customersPerPage;
        return customers.slice(startIndex, endIndex);
    };

    const renderCustomerList = () => {
        if (loading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (customers.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No customers found. Please add a new customer.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        sx={{ mt: 2 }}
                        onClick={handleAddCustomerClick}
                    >
                        Add Customer
                    </Button>
                </Box>
            );
        }

        const filteredCustomers = searchQuery
            ? customers.filter(
                customer =>
                    (customer.name && customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (customer.company && customer.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (customer.contacts && customer.contacts.some(contact =>
                        (contact.name && contact.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    ))
            )
            : customers;

        const indexOfLastCustomer = currentPage * customersPerPage;
        const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
        const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
        const totalCustomerPages = Math.ceil(filteredCustomers.length / customersPerPage);

        if (filteredCustomers.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No customers match your search. Try a different query.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<ClearIcon />}
                        onClick={() => setSearchQuery('')}
                        sx={{ mt: 2 }}
                    >
                        Clear Search
                    </Button>
                </Box>
            );
        }

        return (
            <>
                <Grid container spacing={2}>
                    {currentCustomers.map((customer, index) => {
                        const isSelected = selectedCustomerState && (
                            (selectedCustomerState?.customerID && selectedCustomerState.customerID === customer.customerID) ||
                            (selectedCustomerState?.id && selectedCustomerState.id === customer.id)
                        );
                        const customerName = customer.name || 'Unnamed Customer';
                        const customerCompany = customer.company || '';
                        const primaryContact = customer.contacts?.[0] || {};

                        return (
                            <Grid item xs={12} key={index}>
                                <Card
                                    sx={{
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        borderRadius: '8px',
                                        width: '100%',
                                        mb: 1,
                                        ...(isSelected
                                            ? {
                                                borderColor: '#6b46c1 !important',
                                                border: '2px solid #6b46c1 !important',
                                                bgcolor: 'rgba(107, 70, 193, 0.12) !important',
                                                boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                                transform: 'scale(1.01) !important',
                                                position: 'relative',
                                                '&:hover': {
                                                    boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                                    borderColor: '#6b46c1 !important',
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
                                                borderColor: 'rgba(0, 0, 0, 0.12)',
                                                border: '1px solid rgba(0, 0, 0, 0.12)',
                                                bgcolor: 'transparent',
                                                background: 'none',
                                                boxShadow: 'none',
                                                transform: 'none',
                                                '&:hover': {
                                                    boxShadow: '0 4px 12px 0 rgba(0,0,0,0.08)',
                                                    transform: 'translateY(-4px)',
                                                }
                                            })
                                    }}
                                    onClick={() => handleCustomerSelect(customer)}
                                    data-selected={isSelected ? "true" : "false"}
                                    data-customer-id={customer.customerID || customer.id}
                                >
                                    <CardContent>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <Box sx={{ mb: 1 }}>
                                                    <Typography
                                                        variant="subtitle1"
                                                        component="div"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color: 'text.primary',
                                                            fontSize: '1.1rem'
                                                        }}
                                                    >
                                                        {customerName}
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{
                                                            fontSize: '0.75rem',
                                                            letterSpacing: '0.5px',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        ID: {customer.customerID || customer.id}
                                                    </Typography>
                                                </Box>

                                                {customerCompany && (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{
                                                            mb: 1
                                                        }}
                                                    >
                                                        {customerCompany}
                                                    </Typography>
                                                )}
                                            </Grid>

                                            <Grid item xs={12} sm={6}>
                                                {primaryContact.name && (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            mb: 1
                                                        }}
                                                    >
                                                        {primaryContact.name}
                                                    </Typography>
                                                )}

                                                {primaryContact.email && (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            mb: 1
                                                        }}
                                                    >
                                                        {primaryContact.email}
                                                    </Typography>
                                                )}

                                                {primaryContact.phone && (
                                                    <Typography
                                                        variant="body2"
                                                    >
                                                        {primaryContact.phone}
                                                    </Typography>
                                                )}
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>

                {totalCustomerPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination
                            count={totalCustomerPages}
                            page={currentPage}
                            onChange={(e, page) => setCurrentPage(page)}
                            color="primary"
                        />
                    </Box>
                )}
            </>
        );
    };

    const renderAddressSuggestions = () => {
        if (!selectedCustomerState) {
            return (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                    <Typography variant="body1" color="text.secondary">
                        Please select a customer first to see their addresses.
                    </Typography>
                </Box>
            );
        }

        if (loadingDestinations) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (customerAddresses.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No addresses found for this customer.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        sx={{ mt: 2 }}
                        onClick={handleAddAddressClick}
                    >
                        Add New Address
                    </Button>
                </Box>
            );
        }

        console.log("Address objects structure:", customerAddresses);
        if (customerAddresses.length > 0) {
            console.log("First address fields:",
                Object.keys(customerAddresses[0]).map(key => `${key}: ${typeof customerAddresses[0][key]}`));
            console.log("First address object:", customerAddresses[0]);
        }

        return (
            <Grid container spacing={2}>
                {customerAddresses.map((address, index) => {
                    const isSelected = String(selectedAddressId) === String(address.id);

                    if (isSelected) {
                        console.log(`Selected address ${index}: ${address.name} (ID: ${address.id}, default: ${address.isDefault})`);
                    }

                    return (
                        <Grid item xs={12} key={index}>
                            <Card
                                sx={{
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    borderRadius: '8px',
                                    width: '100%',
                                    mb: 1,
                                    ...(isSelected
                                        ? {
                                            borderColor: '#6b46c1 !important',
                                            border: '2px solid #6b46c1 !important',
                                            borderLeft: '8px solid #6b46c1 !important',
                                            bgcolor: 'rgba(107, 70, 193, 0.12) !important',
                                            boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                            transform: 'scale(1.01) !important',
                                            position: 'relative',
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
                                            borderColor: 'rgba(0, 0, 0, 0.12)',
                                            border: '1px solid rgba(0, 0, 0, 0.12)',
                                            borderLeft: '1px solid rgba(0, 0, 0, 0.12)',
                                            bgcolor: 'transparent',
                                            background: 'none',
                                            boxShadow: 'none',
                                            transform: 'none',
                                            '&:hover': {
                                                boxShadow: '0 4px 12px 0 rgba(0,0,0,0.08)',
                                                transform: 'translateY(-4px)',
                                                borderLeft: '4px solid rgba(107, 70, 193, 0.5)',
                                            }
                                        })
                                }}
                                onClick={() => handleAddressChange(address.id)}
                                data-selected={isSelected ? "true" : "false"}
                                data-address-id={address.id}
                                data-is-default={address.isDefault ? "true" : "false"}
                            >
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="subtitle1" component="h6" sx={{ mr: 1 }}>
                                                    {address.name || "Unnamed Address"}
                                                </Typography>
                                                {address.isDefault && (
                                                    <Chip
                                                        label="Default"
                                                        color="primary"
                                                        size="small"
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="body2">
                                                {selectedCustomerState?.name || address.company || ""}
                                            </Typography>
                                            {address.attention && (
                                                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                                                    Attn: {address.attention}
                                                </Typography>
                                            )}
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.street || "(Address Line 1 Missing)"}
                                            </Typography>
                                            {address.street2 && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    {address.street2}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.city || "(City Missing)"}, {address.state || "(State Missing)"} {address.postalCode || "(Postal Code Missing)"}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.country || "US"}
                                            </Typography>
                                            {address.specialInstructions && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, fontStyle: 'italic' }}>
                                                    Note: {address.specialInstructions}
                                                </Typography>
                                            )}
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            {(typeof address.contactName === 'string' || typeof address.contact?.name === 'string') && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Contact:</Box>
                                                    {address.contactName || address.contact?.name}
                                                </Typography>
                                            )}
                                            {(typeof address.contactPhone === 'string' || typeof address.contact?.phone === 'string') && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Phone:</Box>
                                                    {address.contactPhone || address.contact?.phone}
                                                </Typography>
                                            )}
                                            {(typeof address.contactEmail === 'string' || typeof address.contact?.email === 'string') && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Email:</Box>
                                                    {address.contactEmail || address.contact?.email}
                                                </Typography>
                                            )}
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        );
    };

    if (loading) {
        return (
            <div className="ship-to-container">
                <div className="section-title mb-4">
                    <Skeleton variant="text" width={200} height={40} />
                    <Skeleton variant="text" width={300} height={20} />
                </div>

                <Box sx={{ mb: 4 }}>
                    <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
                </Box>

                <Grid container spacing={2}>
                    {[1, 2, 3].map((index) => (
                        <Grid item xs={12} key={index}>
                            <Card sx={{ mb: 2 }}>
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Skeleton variant="text" width={200} height={30} />
                                            <Skeleton variant="text" width={150} height={20} />
                                            <Skeleton variant="text" width={180} height={20} />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Skeleton variant="text" width={200} height={20} />
                                            <Skeleton variant="text" width={180} height={20} />
                                            <Skeleton variant="text" width={160} height={20} />
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Skeleton variant="rectangular" width={120} height={40} />
                    <Skeleton variant="rectangular" width={120} height={40} />
                </Box>
            </div>
        );
    }

    const currentShipToData = formData.shipTo || {};

    return (
        <div className="ship-to-container">
            <div className="section-title mb-4">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <h2>Ship To</h2>
                        <p className="text-muted">Select or search for a customer to ship to</p>
                    </div>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={selectedCustomerState ? handleAddAddressClick : handleAddCustomerClick}
                    >
                        {selectedCustomerState ? "Add Address" : "Add Customer"}
                    </Button>
                </div>
            </div>

            {error && (
                <Alert severity="error" sx={{ mb: 2, mt: 2 }}
                    onClose={() => setError(null)}
                >
                    {error.split(' \n ').map((line, index) => <div key={index}>{line}</div>)}
                </Alert>
            )}

            {renderCustomerSearch()}

            {!selectedCustomerState && renderCustomerList()}

            {selectedCustomerState && (
                <>
                    <div className="selected-customer mb-4">
                        <div className="d-flex justify-content-between align-items-start w-100">
                            <div className="customer-info">
                                <div>
                                    <h3>{selectedCustomerState.name}</h3>
                                    {selectedCustomerState.contacts?.[0] && (
                                        <p className="text-muted mb-0">
                                            <i className="bi bi-person me-1"></i> {selectedCustomerState.contacts[0].name}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={handleClearCustomer}
                                aria-label="Clear selected customer"
                            >
                                <i className="bi bi-x-lg"></i> Change Customer
                            </button>
                        </div>
                    </div>

                    {renderAddressSuggestions()}
                </>
            )}

            <div className="navigation-buttons">
                <button
                    type="button"
                    className="btn btn-outline-primary btn-navigation"
                    onClick={onPrevious}
                >
                    <i className="bi bi-arrow-left"></i> Previous
                </button>
                <button
                    type="button"
                    className="btn btn-primary btn-navigation btn-next-green"
                    onClick={handleSubmit}
                    disabled={!selectedCustomerState || (!currentShipToData.selectedAddressId && !currentShipToData.street) || loadingDestinations}
                >
                    Next <i className="bi bi-arrow-right"></i>
                </button>
            </div>

            {selectedCustomerState && !currentShipToData.selectedAddressId && !currentShipToData.street && (
                <div className="text-center mt-3">
                    <small className="text-danger">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        Please select a destination address to continue
                    </small>
                </div>
            )}
        </div>
    );
};

export default ShipTo; 