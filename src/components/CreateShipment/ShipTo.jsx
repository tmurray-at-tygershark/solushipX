import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import './ShipTo.css';
import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress, Pagination, Card, CardContent, Grid, Button } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
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

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
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
            .filter(dest => dest.address.type !== 'billing') // Filter out billing addresses
            .map(dest => ({
                ...dest.address,
                id: dest.id,
                attention: dest.address.attention || '',
                name: dest.address.name || customer.name,
                contactName: dest.contact?.name || customer.contacts?.[0]?.name || '',
                contactPhone: dest.contact?.phone || customer.contacts?.[0]?.phone || '',
                contactEmail: dest.contact?.email || customer.contacts?.[0]?.email || '',
            }));

        // Sort addresses - put default addresses first
        formattedAddresses.sort((a, b) => {
            if (a.default === true && !b.default) return -1;
            if (!a.default && b.default === true) return 1;
            return 0;
        });

        console.log('Formatted addresses (billing filtered, default first):', formattedAddresses);
        setCustomerAddresses(formattedAddresses);

        // Set default address if available
        const defaultAddress = formattedAddresses.find(addr => addr.default === true);
        if (defaultAddress) {
            console.log('Found default address:', defaultAddress);
            const defaultIndex = formattedAddresses.indexOf(defaultAddress);
            handleAddressChange(defaultIndex);
        } else if (formattedAddresses.length > 0) {
            // If no default but addresses exist, select the first one
            console.log('No default address, selecting first:', formattedAddresses[0]);
            handleAddressChange(0);
        } else {
            console.log('No addresses available for selection');
            setSelectedAddressId(null);
        }
    };

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setSelectedAddressId(null);
        fetchCustomerDestinations(customer);
    };

    const handleAddressChange = useCallback((addressIndex) => {
        // Find the address by index
        const selectedAddress = customerAddresses[addressIndex];
        if (selectedAddress) {
            setSelectedAddressId(addressIndex);
            const updatedFormData = {
                name: selectedAddress.name || '',
                company: selectedCustomer?.name || '',
                attention: selectedAddress.attention || '',
                street: selectedAddress.street || '',
                street2: selectedAddress.street2 || '',
                city: selectedAddress.city || '',
                state: selectedAddress.state || '',
                postalCode: selectedAddress.zip || selectedAddress.postalCode || '',
                country: selectedAddress.country || 'US',
                contactName: selectedAddress.contactName || selectedCustomer?.contacts?.[0]?.name || '',
                contactPhone: selectedAddress.contactPhone || selectedCustomer?.contacts?.[0]?.phone || '',
                contactEmail: selectedAddress.contactEmail || selectedCustomer?.contacts?.[0]?.email || '',
                specialInstructions: selectedAddress.specialInstructions || ''
            };
            setFormData(updatedFormData);
            onDataChange(updatedFormData);
        }
    }, [customerAddresses, selectedCustomer, onDataChange]);

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
        const currentCustomers = getCurrentPageCustomers();

        return (
            <div className="customer-list-container mb-4">
                <div className="card">
                    <div className="card-header bg-light d-flex align-items-center">
                        <div className="d-flex align-items-center">
                            <i className="bi bi-building me-2"></i>
                            <h6 className="mb-0">Customer List</h6>
                        </div>
                    </div>
                    <div className="card-body p-0">
                        {loading ? (
                            <div className="text-center py-4">
                                <CircularProgress size={30} />
                                <p className="text-muted mt-2">Loading customers...</p>
                            </div>
                        ) : customers.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-muted">No customers found</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Customer Name</th>
                                            <th>Contact Person</th>
                                            <th>Contact Email</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentCustomers.map((customer) => (
                                            <tr key={customer.id} className={selectedCustomer?.id === customer.id ? 'table-primary' : ''}>
                                                <td>
                                                    <div className="d-flex align-items-center">
                                                        <div className="customer-avatar-sm me-2">
                                                            {customer.name?.charAt(0) || 'C'}
                                                        </div>
                                                        <span>{customer.name}</span>
                                                    </div>
                                                </td>
                                                <td>{customer.contacts?.[0]?.name || 'N/A'}</td>
                                                <td>{customer.contacts?.[0]?.email || 'N/A'}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => handleCustomerSelect(customer)}
                                                        disabled={selectedCustomer?.id === customer.id}
                                                    >
                                                        {selectedCustomer?.id === customer.id ? 'Selected' : 'Select'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {customers.length > 0 && (
                        <div className="card-footer d-flex justify-content-center py-3">
                            <Pagination
                                count={totalPages}
                                page={currentPage}
                                onChange={(event, value) => setCurrentPage(value)}
                                color="primary"
                                size="medium"
                                showFirstButton
                                showLastButton
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderAddressSuggestions = () => (
        <div className="address-suggestions mb-4">
            <div className="card border-primary">
                <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                        <LocationOnIcon className="me-2" />
                        <h6 className="mb-0">Select Shipping Destination</h6>
                    </div>
                    {loadingDestinations && (
                        <CircularProgress size={20} />
                    )}
                </div>
                <div className="card-body p-0">
                    <div className="address-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {loadingDestinations ? (
                            <div className="text-center py-4">
                                <p className="text-muted">Loading destination addresses...</p>
                            </div>
                        ) : customerAddresses.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-muted mb-3">No saved addresses found</p>
                            </div>
                        ) : (
                            <div className="row g-3 p-3">
                                {customerAddresses.map((address, index) => (
                                    <div key={index} className="col-md-6">
                                        <div
                                            className={`card h-100 address-card ${selectedAddressId === index ? 'selected border-primary' : ''}`}
                                            onClick={() => handleAddressChange(index)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="card-body">
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <h6 className="card-title mb-0">{address.street}</h6>
                                                    <div className="d-flex">
                                                        {address.default && (
                                                            <Chip
                                                                label="Default"
                                                                color="primary"
                                                                size="small"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                {address.street2 && (
                                                    <Typography variant="body2" className="mb-1">
                                                        {address.street2}
                                                    </Typography>
                                                )}
                                                <Typography variant="body2" className="mb-2">
                                                    {address.city}, {address.state} {address.zip || address.postalCode}
                                                </Typography>
                                                <div className="mt-2 pt-2 border-top">
                                                    {address.attention && (
                                                        <Typography variant="body2" className="mb-1">
                                                            <span className="text-muted">Attention:</span> {address.attention}
                                                        </Typography>
                                                    )}
                                                    {address.specialInstructions && (
                                                        <>
                                                            <Typography variant="body2" className="mb-1">
                                                                <span className="text-muted">Special Instructions:</span>
                                                            </Typography>
                                                            <Typography variant="body2" className="fst-italic">
                                                                {address.specialInstructions}
                                                            </Typography>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

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