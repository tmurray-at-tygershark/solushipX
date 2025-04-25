import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import './ShipTo.css';
import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress, Pagination, Card, CardContent, Grid, Button, Divider, List, TablePagination } from '@mui/material';
import {
    LocationOn as LocationOnIcon,
    LocalPhone as LocalPhoneIcon,
    Email as EmailIcon,
    Business as BusinessIcon,
    Home as HomeIcon,
    Add as AddIcon,
    Search as SearchIcon,
    Clear as ClearIcon
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
    const [customerDestinations, setCustomerDestinations] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);

    // Search and pagination state
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [customersPerPage] = useState(5); // Fixed number of customers per page
    const itemsPerPage = 50;
    const [totalPages, setTotalPages] = useState(1);

    // State for loading and errors
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingDestinations, setLoadingDestinations] = useState(false);
    const [error, setError] = useState(null);
    const [companyId, setCompanyId] = useState(null);

    // Firebase functions references
    const functions = getFunctions();
    const getCompanyCustomersFunction = httpsCallable(functions, 'getCompanyCustomers');
    const getDestinationsFunction = httpsCallable(functions, 'getCompanyCustomerDestinations');

    // Calculate total pages when customers array changes
    useEffect(() => {
        setTotalPages(Math.ceil(customers.length / itemsPerPage));
    }, [customers, itemsPerPage]);

    // Fetch company ID for the current user
    useEffect(() => {
        const fetchCompanyId = async () => {
            try {
                setInitialLoading(true);

                // Get the current user's data
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    setError('User data not found.');
                    setInitialLoading(false);
                    return;
                }

                const userData = userDoc.data();

                // Get company ID from either connectedCompanies map or companies array
                let id = null;
                if (userData.connectedCompanies && userData.connectedCompanies.companies && userData.connectedCompanies.companies.length > 0) {
                    id = userData.connectedCompanies.companies[0];
                    console.log('Using company ID from connectedCompanies.companies:', id);
                } else if (userData.companies && userData.companies.length > 0) {
                    id = userData.companies[0];
                    console.log('Using company ID from companies array:', id);
                }

                if (!id) {
                    console.log('No company ID found in user data');
                    setError('No company associated with this user.');
                    setInitialLoading(false);
                    return;
                }

                setCompanyId(id);

                // Initial fetch of customers
                await fetchCustomers(id);

            } catch (err) {
                console.error('Error fetching company ID:', err);
                setError('Failed to load company data. Please try again.');
            } finally {
                setInitialLoading(false);
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

            console.log('Calling getCompanyCustomers with companyId:', id);
            const customersResult = await getCompanyCustomersFunction({ companyId: id });

            if (!customersResult.data.success) {
                throw new Error(customersResult.data.error || 'Failed to fetch customers');
            }

            const customersData = customersResult.data.data.customers || [];
            console.log('Retrieved customers:', customersData.length);

            // Sort customers alphabetically by name
            const sortedCustomers = [...customersData].sort((a, b) =>
                (a.name || '').localeCompare(b.name || '')
            );

            setCustomers(sortedCustomers);
            setCurrentPage(1); // Reset to first page when new customers are loaded

            // Also fetch all destinations in background for faster searching
            fetchAllDestinations(id);

        } catch (err) {
            console.error('Error fetching customers:', err);
            setError('Failed to load customers. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch all destinations for company (to have them cached for faster UI)
    const fetchAllDestinations = async (id) => {
        try {
            console.log('Fetching all destinations for company:', id);
            const destinationsResult = await getDestinationsFunction({
                companyId: id,
                includeAllTypes: true
            });

            if (!destinationsResult.data.success) {
                console.error('Error fetching all destinations:', destinationsResult.data.error);
                return;
            }

            const destinations = destinationsResult.data.data.destinations || [];
            console.log('Retrieved all destinations:', destinations.length);
            setCustomerDestinations(destinations);

        } catch (err) {
            console.error('Error fetching all destinations:', err);
        }
    };

    // Fetch destinations for a specific customer
    const fetchCustomerDestinations = async (customer) => {
        if (!customer || !customer.id) return;

        try {
            setLoadingDestinations(true);
            console.log('===== FETCHING DESTINATIONS =====');
            console.log('Customer ID:', customer.id);
            console.log('Customer Name:', customer.name);

            // First try to use already cached destinations
            if (customerDestinations.length > 0) {
                const filteredDestinations = customerDestinations.filter(
                    dest => dest.customerId === customer.id
                );

                console.log('Cached destinations for this customer:', filteredDestinations.length);

                if (filteredDestinations.length > 0) {
                    console.log('Using cached destinations');
                    processDestinations(customer, filteredDestinations);
                    setLoadingDestinations(false);
                    return;
                }
            }

            // If not cached or none found, fetch from server
            console.log('Fetching destinations from server with params:', {
                companyId,
                includeAllTypes: true
            });

            const destinationsResult = await getDestinationsFunction({
                companyId,
                includeAllTypes: true
            });

            console.log('Server response:', destinationsResult.data);

            if (!destinationsResult.data.success) {
                throw new Error(destinationsResult.data.error || 'Failed to fetch destinations');
            }

            const allDestinations = destinationsResult.data.data.destinations || [];
            console.log('All destinations from server:', allDestinations.length);

            // Filter for this customer
            const customerSpecificDestinations = allDestinations.filter(
                dest => dest.customerId === customer.id
            );

            console.log('Filtered destinations for customer:', customerSpecificDestinations.length);
            console.log('Destination details:', customerSpecificDestinations);

            // Update full destination cache
            setCustomerDestinations(allDestinations);

            // Process destinations for this customer
            processDestinations(customer, customerSpecificDestinations);

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
        console.log('===== PROCESSING DESTINATIONS =====');
        console.log('Customer:', customer.name);
        console.log('Raw destinations from API:', destinations);

        // Filter out billing addresses and format addresses for display
        const formattedAddresses = destinations
            .filter(dest => (!dest.address.type || dest.address.type !== 'billing')) // Filter out billing addresses
            .map((dest, index) => ({
                ...dest.address,
                // Generate an index-based ID if none exists
                id: index.toString(),
                customerId: customer.id,
                attention: dest.address.attention || '',
                name: dest.address.name || customer.name,
                contactName: dest.contact?.name || customer.contacts?.[0]?.name || '',
                contactPhone: dest.contact?.phone || customer.contacts?.[0]?.phone || '',
                contactEmail: dest.contact?.email || customer.contacts?.[0]?.email || '',
                // Ensure default flag is properly carried over
                default: dest.address.default === true || false
            }));

        // Log parsed addresses for debugging
        console.log('Processed addresses with index IDs:', formattedAddresses.map((addr, idx) => ({
            index: idx,
            id: addr.id,
            name: addr.name,
            default: addr.default
        })));

        // Sort addresses - put default addresses first
        formattedAddresses.sort((a, b) => {
            if (a.default === true && b.default !== true) return -1;
            if (a.default !== true && b.default === true) return 1;
            return 0;
        });

        console.log('Sorted addresses (default first):', formattedAddresses.map((addr, idx) => ({
            id: addr.id,
            name: addr.name,
            default: addr.default
        })));

        // Set customer addresses before selecting default
        setCustomerAddresses(formattedAddresses);

        // Immediately find and select the default address
        const defaultAddress = formattedAddresses.find(addr => addr.default === true);

        // Use setTimeout to ensure state is updated before selection
        setTimeout(() => {
            if (defaultAddress) {
                console.log('Found default address to pre-select:', defaultAddress.name, 'with ID:', defaultAddress.id);
                handleAddressChange(defaultAddress.id);
            } else if (formattedAddresses.length > 0) {
                // If no default but addresses exist, select the first one
                console.log('No default address found, selecting first address:', formattedAddresses[0].name, 'with ID:', formattedAddresses[0].id);
                handleAddressChange(formattedAddresses[0].id);
            } else {
                console.log('No addresses available for selection');
                setSelectedAddressId(null);
            }
        }, 10); // Slight delay to ensure state updates
    };

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setSelectedAddressId(null);

        // Reset addresses immediately to prevent stale data
        setCustomerAddresses([]);

        // Use the addresses directly from the customer object instead of fetching separately
        console.log('Customer selected:', customer.name, customer);

        if (customer.addresses && Array.isArray(customer.addresses) && customer.addresses.length > 0) {
            console.log('Customer has addresses array with', customer.addresses.length, 'items');
            processAddressesFromCustomer(customer);
        } else {
            console.log('No addresses found on customer object, falling back to fetch method');
            // Fallback to original method if no addresses found directly on customer
            fetchCustomerDestinations(customer);
        }
    };

    // New function to process addresses directly from customer object
    const processAddressesFromCustomer = (customer) => {
        console.log('===== PROCESSING CUSTOMER ADDRESSES =====');
        console.log('Customer:', customer.name);
        console.log('Raw addresses from customer:', customer.addresses);

        if (!customer.addresses || !Array.isArray(customer.addresses)) {
            console.log('No valid addresses array on customer');
            setCustomerAddresses([]);
            return;
        }

        // Format addresses for display, adding index-based IDs
        const formattedAddresses = customer.addresses
            .filter(addr => addr.type !== 'billing') // Filter out billing addresses
            .map((addr, index) => ({
                ...addr,
                id: index.toString(),
                customerId: customer.id,
                name: addr.name || `Address ${index + 1}`,
                contactName: customer.contacts?.[0]?.name || '',
                contactPhone: customer.contacts?.[0]?.phone || '',
                contactEmail: customer.contacts?.[0]?.email || '',
            }));

        // Log parsed addresses for debugging
        console.log('Processed customer addresses with index IDs:', formattedAddresses.map((addr, idx) => ({
            index: idx,
            id: addr.id,
            name: addr.name || `Address ${idx + 1}`,
            default: addr.default
        })));

        // Sort addresses - put default addresses first
        formattedAddresses.sort((a, b) => {
            if (a.default === true && b.default !== true) return -1;
            if (a.default !== true && b.default === true) return 1;
            return 0;
        });

        console.log('Sorted addresses (default first):', formattedAddresses.map(addr => ({
            id: addr.id,
            name: addr.name,
            default: addr.default
        })));

        // Set customer addresses
        setCustomerAddresses(formattedAddresses);
        setLoadingDestinations(false);

        // Wait until next render cycle to select an address using useEffect
        if (formattedAddresses.length > 0) {
            // Find default address if available
            const defaultAddress = formattedAddresses.find(addr => addr.default === true);
            const addressToSelect = defaultAddress || formattedAddresses[0];

            console.log('Address to pre-select:',
                addressToSelect.name,
                'with ID:',
                addressToSelect.id,
                'Default:',
                !!addressToSelect.default
            );

            // Use setTimeout with a longer delay to ensure state has updated
            setTimeout(() => {
                setSelectedAddressId(addressToSelect.id);

                // Update form data directly here as a backup
                updateFormWithAddress(addressToSelect);
            }, 100);
        } else {
            console.log('No addresses available for selection');
        }
    };

    // New helper function to update form with address data
    const updateFormWithAddress = (address) => {
        if (!address) {
            console.log("Cannot update form: no address provided");
            return;
        }

        console.log("Directly updating form with address:", address);

        const newData = {
            name: address.name || '',
            company: selectedCustomer?.name || address.company || '',
            attention: address.attention || '',
            street: address.street || address.address1 || '',
            street2: address.street2 || address.address2 || '',
            city: address.city || '',
            state: address.state || '',
            postalCode: address.postalCode || address.zip || '',
            country: address.country || 'US',
            contactName: address.contactName || '',
            contactPhone: address.contactPhone || address.phone || '',
            contactEmail: address.contactEmail || address.email || '',
            specialInstructions: address.specialInstructions || '',
            shipToAddressId: address.id,
            shipToAddress: address
        };

        setFormData(newData);
        onDataChange(newData);
    };

    // Add an effect to handle address selection after addresses are loaded
    useEffect(() => {
        if (selectedAddressId && customerAddresses.length > 0) {
            const selectedAddress = customerAddresses.find(addr => String(addr.id) === String(selectedAddressId));

            if (selectedAddress) {
                console.log("Effect: Found selected address:", selectedAddress.name);
                updateFormWithAddress(selectedAddress);
            } else {
                console.log("Effect: Selected address not found with ID:", selectedAddressId);
                console.log("Effect: Available addresses:", customerAddresses.map(a => a.id));

                // If the selected address is not found but we have addresses, select the first one
                if (customerAddresses.length > 0) {
                    console.log("Effect: Selecting first available address instead");
                    setSelectedAddressId(customerAddresses[0].id);
                }
            }
        }
        // Remove onDataChange from the dependency array to prevent loops
    }, [selectedAddressId, customerAddresses, selectedCustomer]);

    // Create a ref to track the previous address ID to prevent infinite loops
    const prevAddressIdRef = useRef(null);

    // Add a separate effect to update form data when address changes
    useEffect(() => {
        if (selectedAddressId && customerAddresses.length > 0 && prevAddressIdRef.current !== selectedAddressId) {
            prevAddressIdRef.current = selectedAddressId;
            const selectedAddress = customerAddresses.find(addr => String(addr.id) === String(selectedAddressId));
            if (selectedAddress) {
                console.log("Form update effect: Updating form with address:", selectedAddress.name);
                updateFormWithAddress(selectedAddress);
            }
        }
        // Intentionally exclude onDataChange from dependencies
    }, [selectedAddressId, customerAddresses]);

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
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
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
                        Add New Customer
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
                        const isSelected = selectedCustomer && selectedCustomer.id === customer.id;
                        const customerName = customer.name || 'Unnamed Customer';
                        const customerCompany = customer.company || '';

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
                                                border: '3px solid #6b46c1 !important',
                                                borderLeft: '8px solid #6b46c1 !important',
                                                bgcolor: 'rgba(107, 70, 193, 0.12) !important',
                                                boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                                transform: 'scale(1.02) !important',
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
                                    onClick={() => handleCustomerSelect(customer)}
                                    data-selected={isSelected ? "true" : "false"}
                                    data-customer-id={customer.id}
                                >
                                    <CardContent>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="subtitle1" component="div" fontWeight="bold">
                                                    {customerName}
                                                    {customerCompany && (
                                                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                                            ({customerCompany})
                                                        </Typography>
                                                    )}
                                                </Typography>

                                                {customer.address && (
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1, mt: 1 }}>
                                                        <LocationOnIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary', mt: 0.3 }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {customer.address}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {(customer.type || customer.customerType) && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                        {(customer.type === 'business' || customer.customerType === 'business') ? (
                                                            <BusinessIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                                        ) : (
                                                            <HomeIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                                        )}
                                                        <Typography variant="body2" color="text.secondary">
                                                            {(customer.type || customer.customerType) === 'business' ? 'Business' : 'Residential'}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Grid>

                                            <Grid item xs={12} sm={6}>
                                                {customer.phone && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                        <LocalPhoneIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {customer.phone}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {customer.email && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <EmailIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {customer.email}
                                                        </Typography>
                                                    </Box>
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

                <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleAddCustomerClick}
                    fullWidth
                    sx={{ mt: 2 }}
                >
                    Add New Customer
                </Button>
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
                                                {address.address1 || address.street1 || address.street || "(Address Line 1 Missing)"}
                                            </Typography>
                                            {(address.address2 || address.street2) && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    {address.address2 || address.street2}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.city || "(City Missing)"}, {address.state || "(State Missing)"} {address.postalCode || address.zip || "(Postal Code Missing)"}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.country || "US"}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            {(address.contact || address.contactName) && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Contact:</Box>
                                                    {address.contact || address.contactName}
                                                </Typography>
                                            )}
                                            {address.phone && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Phone:</Box>
                                                    {address.phone}
                                                </Typography>
                                            )}
                                            {address.email && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Email:</Box>
                                                    {address.email}
                                                </Typography>
                                            )}
                                            {address.contactPhone && address.contactPhone !== address.phone && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Contact Phone:</Box>
                                                    {address.contactPhone}
                                                </Typography>
                                            )}
                                            {address.contactEmail && address.contactEmail !== address.email && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Contact Email:</Box>
                                                    {address.contactEmail}
                                                </Typography>
                                            )}
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}

                <Grid item xs={12}>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleAddAddressClick}
                        fullWidth
                        sx={{ mt: 1 }}
                    >
                        Add New Address
                    </Button>
                </Grid>
            </Grid>
        );
    };

    if (initialLoading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="ship-to-container">
            <div className="section-title mb-4">
                <h2>Ship To</h2>
                <p className="text-muted">Select or search for a customer to ship to</p>
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

            {!selectedCustomer && (
                <div className="text-center mt-4">
                    <p className="text-muted">Select a customer to view their addresses</p>
                </div>
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