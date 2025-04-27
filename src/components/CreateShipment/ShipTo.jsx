import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import './ShipTo.css';
import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress, Pagination, Card, CardContent, Grid, Button, Divider, List, TablePagination, Skeleton } from '@mui/material';
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
import { getFunctions, httpsCallable } from 'firebase/functions';

const ShipTo = ({ onDataChange, onNext, onPrevious }) => {
    const { currentUser } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        company: '',
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
        specialInstructions: ''
    });

    // State for customers and destinations
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);

    // Search and pagination state
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [customersPerPage] = useState(5);
    const [totalPages, setTotalPages] = useState(1);

    // State for loading and errors
    const [loading, setLoading] = useState(true);
    const [loadingDestinations, setLoadingDestinations] = useState(false);
    const [error, setError] = useState(null);
    const [companyId, setCompanyId] = useState(null);

    // Firebase functions references
    const functions = getFunctions();
    const getCompanyCustomersFunction = httpsCallable(functions, 'getCompanyCustomers');
    const getDestinationsFunction = httpsCallable(functions, 'getCompanyCustomerDestinations');

    // Calculate total pages when customers array changes
    useEffect(() => {
        setTotalPages(Math.ceil(customers.length / customersPerPage));
    }, [customers, customersPerPage]);

    // Fetch company ID for the current user
    useEffect(() => {
        const fetchCompanyId = async () => {
            try {
                setLoading(true);
                setError(null);

                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    setError('User data not found.');
                    return;
                }

                const userData = userDoc.data();
                let id = null;

                if (userData.connectedCompanies?.companies?.length > 0) {
                    id = userData.connectedCompanies.companies[0];
                } else if (userData.companies?.length > 0) {
                    id = userData.companies[0];
                }

                if (!id) {
                    setError('No company associated with this user.');
                    return;
                }

                setCompanyId(id);
                await fetchCustomers(id);

            } catch (err) {
                console.error('Error fetching company ID:', err);
                setError('Failed to load company data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) {
            fetchCompanyId();
        }
    }, [currentUser]);

    // Fetch customers for the company
    const fetchCustomers = async (id) => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);

            const customersResult = await getCompanyCustomersFunction({
                companyId: id,
                includeAllCompanies: false // Ensure we only get customers for this company
            });

            if (!customersResult.data.success) {
                throw new Error(customersResult.data.error || 'Failed to fetch customers');
            }

            const customersData = customersResult.data.data.customers || [];
            const sortedCustomers = [...customersData].sort((a, b) =>
                (a.name || '').localeCompare(b.name || '')
            );

            setCustomers(sortedCustomers);
            setCurrentPage(1);

        } catch (err) {
            console.error('Error fetching customers:', err);
            setError('Failed to load customers. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch destinations for a specific customer
    const fetchCustomerDestinations = async (customer) => {
        if (!customer || !customer.customerId) {
            console.error('Invalid customer data:', customer);
            return;
        }

        try {
            setLoadingDestinations(true);
            setError(null);

            console.log('Fetching destinations for customer:', customer.customerId);
            const destinationsResult = await getDestinationsFunction({
                companyId: customer.companyId,
                customerId: customer.customerId,
                includeAllTypes: false
            });

            console.log('Destinations API response:', destinationsResult);

            if (!destinationsResult.data.success) {
                throw new Error(destinationsResult.data.error || 'Failed to fetch destinations');
            }

            const destinations = destinationsResult.data.data.destinations || [];
            console.log('Fetched destinations:', destinations);

            if (destinations.length === 0) {
                console.log('No destinations found for customer:', customer.customerId);
            }

            processDestinations(customer, destinations);

        } catch (err) {
            console.error('Error fetching customer destinations:', err);
            setError('Failed to load destination addresses. Please try again.');
            setCustomerAddresses([]);
        } finally {
            setLoadingDestinations(false);
        }
    };

    // Process customer destinations into a usable format
    const processDestinations = (customer, destinations) => {
        console.log('Processing destinations for customer:', customer);
        console.log('Raw destinations data:', destinations);

        const formattedAddresses = destinations
            .filter(dest => {
                console.log('Checking destination:', dest);
                return dest.address?.type === 'shipping';
            })
            .map((dest, index) => {
                // Get the primary contact from customer if available
                const primaryContact = customer.contacts?.find(contact => contact.primary === true) || customer.contacts?.[0] || {};

                const formattedAddress = {
                    id: dest.id || `addr_${index}`,
                    customerId: customer.customerId,
                    attention: dest.address?.attention || '',
                    name: customer.name || '',
                    // Handle contact information from primary contact
                    contactName: primaryContact.name || '',
                    contactPhone: primaryContact.phone || '',
                    contactEmail: primaryContact.email || '',
                    default: dest.address?.default || false,
                    // Map address fields from the nested address object
                    street: dest.address?.street || '',
                    street2: dest.address?.street2 || '',
                    city: dest.address?.city || '',
                    state: dest.address?.state || '',
                    postalCode: dest.address?.zip || '',
                    country: dest.address?.country || 'US',
                    specialInstructions: dest.address?.specialInstructions || ''
                };

                console.log('Formatted address:', formattedAddress);
                return formattedAddress;
            });

        console.log('All formatted addresses:', formattedAddresses);

        // Sort addresses to put default address first
        formattedAddresses.sort((a, b) => {
            if (a.default === true && b.default !== true) return -1;
            if (a.default !== true && b.default === true) return 1;
            return 0;
        });

        console.log('Final sorted addresses:', formattedAddresses);
        setCustomerAddresses(formattedAddresses);

        // Select the default address or the first address if available
        if (formattedAddresses.length > 0) {
            const defaultAddress = formattedAddresses.find(addr => addr.default === true) || formattedAddresses[0];
            handleAddressChange(defaultAddress.id);
        }
    };

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setSelectedAddressId(null);
        setCustomerAddresses([]);

        if (customer) {
            // Process addresses directly from the customer record
            const formattedAddresses = customer.addresses
                ?.filter(addr => addr.type === 'shipping')
                .map((addr, index) => {
                    // Get the primary contact from customer if available
                    const primaryContact = customer.contacts?.find(contact => contact.isPrimary === true) || customer.contacts?.[0] || {};

                    const formattedAddress = {
                        id: addr.id || `addr_${index}`,
                        customerId: customer.customerId,
                        attention: addr.attention || '',
                        name: addr.name || customer.name || '',
                        contactName: primaryContact.name || '',
                        contactPhone: primaryContact.phone || '',
                        contactEmail: primaryContact.email || '',
                        default: addr.default || false,
                        street: addr.street || '',
                        street2: addr.street2 || '',
                        city: addr.city || '',
                        state: addr.state || '',
                        postalCode: addr.zip || '',
                        country: addr.country || 'US',
                        specialInstructions: addr.specialInstructions || ''
                    };

                    return formattedAddress;
                }) || [];

            // Sort addresses to put default address first
            formattedAddresses.sort((a, b) => {
                if (a.default === true && b.default !== true) return -1;
                if (a.default !== true && b.default === true) return 1;
                return 0;
            });

            setCustomerAddresses(formattedAddresses);

            // Select the default address or the first address if available
            if (formattedAddresses.length > 0) {
                const defaultAddress = formattedAddresses.find(addr => addr.default === true) || formattedAddresses[0];
                handleAddressChange(defaultAddress.id);
            }
        }
    };

    const handleAddressChange = useCallback((addressId) => {
        console.log("Changing address to ID:", addressId);

        // Ensure addressId is a string
        const addressIdStr = addressId ? String(addressId) : null;

        // Set selectedAddressId state first
        setSelectedAddressId(addressIdStr);

        // The address update will happen in the useEffect above

        // Avoid direct update here to prevent race conditions
        // The effect will handle finding the address and updating the form

    }, []);

    const handleSubmit = useCallback(() => {
        if (!selectedCustomer) {
            setError('Please select a customer');
            return;
        }

        // Check if we have a selected address or if we're using form data
        if (selectedAddressId === null && !formData.street) {
            setError('Please select a shipping address');
            return;
        }

        // Validate required fields in formData
        const requiredFields = ['street', 'city', 'state', 'postalCode', 'country'];
        const missingFields = requiredFields.filter(field => !formData[field]);

        if (missingFields.length > 0) {
            setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
            return;
        }

        // Ensure form data is passed to parent before proceeding
        onDataChange(formData);

        // If all validations pass, proceed to next step
        onNext();
    }, [selectedCustomer, selectedAddressId, formData, onNext, onDataChange]);

    const handleClearCustomer = () => {
        setSelectedCustomer(null);
        setSelectedAddressId(null);
        setCustomerAddresses([]);
    };

    const handleAddCustomerClick = () => {
        // Function to handle adding a new customer
        console.log("Add new customer clicked");
        // Implement the functionality to add a new customer
    };

    const handleAddAddressClick = () => {
        // Function to handle adding a new address
        console.log("Add new address clicked", selectedCustomer?.id);
        // Implement the functionality to add a new address for the selected customer
    };

    const renderCustomerSearch = () => (
        <div className="customer-search mb-4">
            <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.name || ''}
                value={selectedCustomer}
                onChange={(event, newValue) => {
                    if (newValue) {
                        handleCustomerSelect(newValue);
                    }
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

    // Get current page customers
    const getCurrentPageCustomers = () => {
        const startIndex = (currentPage - 1) * customersPerPage;
        const endIndex = startIndex + customersPerPage;
        return customers.slice(startIndex, endIndex);
    };

    // Render the customer list with pagination
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

        // Pagination
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
                        const isSelected = selectedCustomer && selectedCustomer.customerId === customer.customerId;
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
                                    data-customer-id={customer.customerId}
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
                                                        ID: {customer.customerId}
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
        if (!selectedCustomer) {
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

        // Debug address structure
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

                    // Debug log for selection status
                    if (isSelected) {
                        console.log(`Selected address ${index}: ${address.name} (ID: ${address.id}, default: ${address.default})`);
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
                                data-is-default={address.default ? "true" : "false"}
                            >
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="subtitle1" component="h6" sx={{ mr: 1 }}>
                                                    {address.name || "Unnamed Address"}
                                                </Typography>
                                                {address.default && (
                                                    <Chip
                                                        label="Default"
                                                        color="primary"
                                                        size="small"
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="body2">
                                                {selectedCustomer?.name || address.company || ""}
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
                        onClick={selectedCustomer ? handleAddAddressClick : handleAddCustomerClick}
                    >
                        {selectedCustomer ? "Add Address" : "Add Customer"}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger mb-3" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                </div>
            )}

            {renderCustomerSearch()}

            {!selectedCustomer && renderCustomerList()}

            {selectedCustomer && (
                <>
                    <div className="selected-customer mb-4">
                        <div className="d-flex justify-content-between align-items-start w-100">
                            <div className="customer-info">
                                <div>
                                    <h3>{selectedCustomer.name}</h3>
                                    {selectedCustomer.contacts?.[0] && (
                                        <p className="text-muted mb-0">
                                            <i className="bi bi-person me-1"></i> {selectedCustomer.contacts[0].name}
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
                    className="btn btn-primary btn-navigation"
                    onClick={handleSubmit}
                    disabled={!selectedCustomer || (selectedAddressId === null && !formData.street)}
                >
                    Next <i className="bi bi-arrow-right"></i>
                </button>
            </div>

            {selectedCustomer && selectedAddressId === null && !formData.street && (
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