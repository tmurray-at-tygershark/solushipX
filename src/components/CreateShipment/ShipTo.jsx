import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import './ShipTo.css';
import { Autocomplete, TextField, Box, Typography, Chip } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';

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
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showAddAddressForm, setShowAddAddressForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);
    const [newAddress, setNewAddress] = useState({
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
        isDefault: false
    });

    // Fetch customers for the company
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get the current user's data
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    setError('User data not found.');
                    setLoading(false);
                    return;
                }

                const userData = userDoc.data();
                console.log('User data:', userData);
                console.log('Connected companies:', userData.connectedCompanies);
                console.log('Companies array:', userData.companies);

                // Get company ID from either connectedCompanies map or companies array
                let companyId = null;
                if (userData.connectedCompanies && userData.connectedCompanies.companies && userData.connectedCompanies.companies.length > 0) {
                    // Get the first company ID from the connectedCompanies.companies array
                    companyId = userData.connectedCompanies.companies[0];
                    console.log('Using company ID from connectedCompanies.companies:', companyId);
                } else if (userData.companies && userData.companies.length > 0) {
                    // Get the first company ID from the companies array
                    companyId = userData.companies[0];
                    console.log('Using company ID from companies array:', companyId);
                }

                if (!companyId) {
                    console.log('No company ID found in user data');
                    setError('No company associated with this user.');
                    setLoading(false);
                    return;
                }

                // Fetch customers for the company
                const customersRef = collection(db, 'customers');
                const q = query(customersRef, where('companyId', '==', companyId));
                console.log('Querying customers with companyId:', companyId);
                const querySnapshot = await getDocs(q);
                console.log('Query result:', querySnapshot.empty ? 'No customers found' : `${querySnapshot.size} customers found`);

                if (querySnapshot.empty) {
                    setError('No customers found for this company.');
                    setLoading(false);
                    return;
                }

                const customersData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setCustomers(customersData);
            } catch (err) {
                console.error('Error fetching customers:', err);
                setError('Failed to load customers. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) {
            fetchCustomers();
        }
    }, [currentUser]);

    // Filter customers based on search query
    const filteredCustomers = customers.filter(customer => {
        const searchLower = searchQuery.toLowerCase();
        return (
            customer.name?.toLowerCase().includes(searchLower) ||
            customer.company?.toLowerCase().includes(searchLower) ||
            customer.contacts?.some(contact =>
                contact.name?.toLowerCase().includes(searchLower) ||
                contact.email?.toLowerCase().includes(searchLower)
            ) ||
            customer.addresses?.some(address =>
                address.city?.toLowerCase().includes(searchLower) ||
                address.state?.toLowerCase().includes(searchLower)
            )
        );
    });

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    const toggleViewMode = () => {
        setViewMode(viewMode === 'grid' ? 'list' : 'grid');
    };

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setCustomerAddresses(customer.addresses || []);
        setShowAddressSuggestions(true);
        // Set default address if available
        const defaultAddress = customer.addresses?.find(addr => addr.default);
        if (defaultAddress) {
            setSelectedAddressId(customer.addresses.indexOf(defaultAddress));
        } else {
            setSelectedAddressId(null);
        }
    };

    const handleAddressChange = useCallback((addressIndex) => {
        // Find the address by index instead of ID
        const selectedAddress = customerAddresses[addressIndex];
        if (selectedAddress) {
            setSelectedAddressId(addressIndex);
            const updatedFormData = {
                name: selectedAddress.name || '',
                company: selectedCustomer.name || '',
                attention: selectedAddress.attention || '',
                street: selectedAddress.street || '',
                street2: selectedAddress.street2 || '',
                city: selectedAddress.city || '',
                state: selectedAddress.state || '',
                postalCode: selectedAddress.zip || selectedAddress.postalCode || '',
                country: selectedAddress.country || 'US',
                contactName: selectedCustomer.contacts?.[0]?.name || '',
                contactPhone: selectedCustomer.contacts?.[0]?.phone || '',
                contactEmail: selectedCustomer.contacts?.[0]?.email || '',
                specialInstructions: selectedAddress.specialInstructions || ''
            };
            setFormData(updatedFormData);
            onDataChange(updatedFormData);
        }
    }, [customerAddresses, selectedCustomer, onDataChange]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            setTimeout(() => onDataChange(newData), 0);
            return newData;
        });
    }, [onDataChange]);

    const handleNewAddressChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setNewAddress(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }, []);

    const handleCloseForm = () => {
        setShowAddAddressForm(false);
        setNewAddress({
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
            isDefault: false
        });
    };

    const handleAddAddress = async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            // Validate required fields
            const requiredFields = ['name', 'company', 'street', 'city', 'state', 'postalCode', 'contactName', 'contactPhone', 'contactEmail'];
            const missingFields = requiredFields.filter(field => !newAddress[field]);

            if (missingFields.length > 0) {
                setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
                return;
            }

            // Create new address object
            const addressData = {
                ...newAddress,
                id: Date.now().toString(), // Temporary ID generation
                type: 'shipping',
                default: newAddress.isDefault
            };

            // Add to customer addresses
            const updatedAddresses = [...customerAddresses, addressData];
            setCustomerAddresses(updatedAddresses);

            // If this is the first address or marked as default, select it
            if (updatedAddresses.length === 1 || newAddress.isDefault) {
                handleAddressChange(0);
            }

            // Close form and reset
            handleCloseForm();
            setSuccess('Address added successfully');

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error adding address:', err);
            setError('Failed to add address. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = useCallback(() => {
        if (!selectedCustomer) {
            setError('Please select a customer');
            return;
        }

        // Check if we have a selected address or if we're using form data
        if (!selectedAddressId && !formData.street) {
            setError('Please select or add a shipping address');
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

    const renderCustomerSearch = () => (
        <div className="customer-search mb-4">
            <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.name}
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
                    return options.filter(option =>
                        option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                        option.contacts?.some(contact =>
                            contact.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
                            contact.email?.toLowerCase().includes(inputValue.toLowerCase())
                        )
                    );
                }}
            />
        </div>
    );

    const renderAddressSuggestions = () => (
        <div className="address-suggestions mb-4">
            <div className="card border-primary">
                <div className="card-header bg-light d-flex align-items-center">
                    <LocationOnIcon className="me-2" />
                    <h6 className="mb-0">Select Shipping Destination</h6>
                </div>
                <div className="card-body p-0">
                    <div className="address-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {customerAddresses.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-muted mb-3">No saved addresses found</p>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => setShowAddAddressForm(true)}
                                >
                                    <i className="bi bi-plus-lg me-1"></i> Add Your First Address
                                </button>
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
                                                    {address.default && (
                                                        <Chip
                                                            label="Default"
                                                            color="primary"
                                                            size="small"
                                                        />
                                                    )}
                                                </div>
                                                {address.street2 && (
                                                    <Typography variant="body2" className="mb-1">
                                                        {address.street2}
                                                    </Typography>
                                                )}
                                                <Typography variant="body2" className="mb-2">
                                                    {address.city}, {address.state} {address.zip}
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

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <form className="ship-to-form">
            {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}
            {success && (
                <div className="alert alert-success alert-dismissible fade show" role="alert">
                    {success}
                    <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
                </div>
            )}

            <div className="card shadow-sm mb-4">
                <div className="card-body">
                    <h5 className="card-title mb-4">Ship To</h5>

                    {renderCustomerSearch()}

                    {selectedCustomer && showAddressSuggestions && (
                        <>
                            {renderAddressSuggestions()}

                            <div className="special-instructions mt-4">
                                <label className="form-label">Special Instructions (Optional)</label>
                                <textarea
                                    name="specialInstructions"
                                    className="form-control"
                                    value={formData.specialInstructions}
                                    onChange={handleInputChange}
                                    rows="3"
                                    placeholder="Enter any special handling instructions or notes for the carrier"
                                ></textarea>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="navigation-buttons d-flex justify-content-between mt-4">
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={onPrevious}
                >
                    <i className="bi bi-arrow-left me-2"></i> Previous
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={!selectedCustomer || selectedAddressId === null}
                >
                    Next <i className="bi bi-arrow-right ms-2"></i>
                </button>
            </div>
        </form>
    );
};

export default ShipTo; 