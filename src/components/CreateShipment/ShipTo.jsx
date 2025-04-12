import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import './ShipTo.css';

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
    const [searchFocused, setSearchFocused] = useState(false);
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

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        const shippingAddresses = customer.addresses?.filter(addr => addr.type === 'shipping') || [];
        setCustomerAddresses(shippingAddresses);

        // Find the default/primary address
        const defaultAddressIndex = shippingAddresses.findIndex(addr => addr.default === true);

        // If there's a default address, select it; otherwise, select the first address if available
        if (defaultAddressIndex !== -1) {
            setSelectedAddressId(defaultAddressIndex);
            handleAddressChange(defaultAddressIndex);
        } else if (shippingAddresses.length > 0) {
            setSelectedAddressId(0);
            handleAddressChange(0);
        } else {
            setSelectedAddressId(null);
        }

        setFormData({
            name: '',
            company: customer.name || '',
            attention: '',
            street: '',
            street2: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US',
            contactName: customer.contacts?.[0]?.name || '',
            contactPhone: customer.contacts?.[0]?.phone || '',
            contactEmail: customer.contacts?.[0]?.email || '',
            specialInstructions: ''
        });
        setSearchFocused(false);
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
                postalCode: selectedAddress.zip || '',
                country: selectedAddress.country || 'US',
                contactName: selectedAddress.contactName || '',
                contactPhone: selectedAddress.contactPhone || '',
                contactEmail: selectedAddress.contactEmail || '',
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
        if (!selectedAddressId) {
            setError('Please select or add a shipping address');
            return;
        }
        onNext();
    }, [selectedCustomer, selectedAddressId, onNext]);

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
                    <h5 className="card-title mb-4">Select Customer</h5>

                    <div className="customer-selection mb-4">
                        <div className="search-container position-relative">
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0">
                                    <i className="bi bi-search text-muted"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0"
                                    placeholder="Search by customer name, company, contact, or location..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                />
                                {searchQuery && (
                                    <button
                                        className="btn btn-outline-secondary border-start-0"
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        <i className="bi bi-x"></i>
                                    </button>
                                )}
                            </div>

                            {searchFocused && searchQuery && (
                                <div className="search-results-dropdown">
                                    {filteredCustomers.length === 0 ? (
                                        <div className="p-3 text-center text-muted">
                                            <i className="bi bi-search me-2"></i> No customers found
                                        </div>
                                    ) : (
                                        <div className="customer-search-results">
                                            {filteredCustomers.map((customer) => (
                                                <div
                                                    key={customer.id}
                                                    className="customer-search-item"
                                                    onClick={() => handleCustomerSelect(customer)}
                                                >
                                                    <div className="d-flex align-items-center">
                                                        <div className="customer-avatar me-3">
                                                            {customer.name?.charAt(0) || 'C'}
                                                        </div>
                                                        <div>
                                                            <div className="fw-medium">{customer.name}</div>
                                                            <div className="small text-muted">
                                                                {customer.contacts?.[0]?.email || 'No email'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedCustomer ? (
                            <div className="selected-customer mt-4">
                                <div className="card border-primary">
                                    <div className="card-body">
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <h6 className="mb-1">{selectedCustomer.name}</h6>
                                                <p className="text-muted small mb-0">
                                                    {selectedCustomer.contacts?.[0]?.name && (
                                                        <span className="me-2">
                                                            <i className="bi bi-person me-1"></i> {selectedCustomer.contacts[0].name}
                                                        </span>
                                                    )}
                                                    {selectedCustomer.contacts?.[0]?.email && (
                                                        <span className="me-2">
                                                            <i className="bi bi-envelope me-1"></i> {selectedCustomer.contacts[0].email}
                                                        </span>
                                                    )}
                                                    {selectedCustomer.contacts?.[0]?.phone && (
                                                        <span>
                                                            <i className="bi bi-telephone me-1"></i> {selectedCustomer.contacts[0].phone}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => {
                                                    setSelectedCustomer(null);
                                                    setCustomerAddresses([]);
                                                    setSelectedAddressId(null);
                                                }}
                                            >
                                                Change
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="customer-list mt-4">
                                <div className="row g-3">
                                    {customers.map((customer) => (
                                        <div key={customer.id} className="col-md-6">
                                            <div
                                                className="card h-100 customer-card"
                                                onClick={() => handleCustomerSelect(customer)}
                                            >
                                                <div className="card-body">
                                                    <div className="d-flex align-items-center mb-3">
                                                        <div className="customer-avatar me-3">
                                                            {customer.name?.charAt(0) || 'C'}
                                                        </div>
                                                        <div>
                                                            <h6 className="card-title mb-1 text-dark">{customer.name}</h6>
                                                            <p className="card-text small text-muted mb-0">
                                                                {customer.addresses?.length || 0} address{customer.addresses?.length !== 1 ? 'es' : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="customer-details">
                                                        {customer.contacts?.[0] && (
                                                            <div className="small mb-1">
                                                                <i className="bi bi-person me-1"></i> {customer.contacts[0].name}
                                                            </div>
                                                        )}
                                                        {customer.contacts?.[0]?.email && (
                                                            <div className="small mb-1">
                                                                <i className="bi bi-envelope me-1"></i> {customer.contacts[0].email}
                                                            </div>
                                                        )}
                                                        {customer.contacts?.[0]?.phone && (
                                                            <div className="small">
                                                                <i className="bi bi-telephone me-1"></i> {customer.contacts[0].phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedCustomer && (
                        <>
                            <h5 className="card-title mb-4">Select Shipping Destination</h5>

                            <div className="address-selection mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <label className="form-label mb-0">Saved Addresses</label>
                                    {!showAddAddressForm && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() => setShowAddAddressForm(true)}
                                        >
                                            <i className="bi bi-plus-lg me-1"></i> Add New Address
                                        </button>
                                    )}
                                </div>

                                {showAddAddressForm ? (
                                    <div className="add-address-form mb-4">
                                        <div className="card border-primary">
                                            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                                                <h6 className="mb-0">Add New Shipping Destination</h6>
                                                <button
                                                    type="button"
                                                    className="btn-close"
                                                    onClick={handleCloseForm}
                                                    disabled={isSubmitting}
                                                ></button>
                                            </div>
                                            <div className="card-body p-4">
                                                {error && (
                                                    <div className="alert alert-danger" role="alert">
                                                        {error}
                                                    </div>
                                                )}

                                                <div className="row g-3">
                                                    <div className="col-md-12">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newStreet">Street Address*</label>
                                                            <input
                                                                type="text"
                                                                id="newStreet"
                                                                name="street"
                                                                className="form-control"
                                                                value={newAddress.street}
                                                                onChange={handleNewAddressChange}
                                                                placeholder="e.g., 3850 Oak St"
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-md-12">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newStreet2">Suite/Unit (Optional)</label>
                                                            <input
                                                                type="text"
                                                                id="newStreet2"
                                                                name="street2"
                                                                className="form-control"
                                                                value={newAddress.street2}
                                                                onChange={handleNewAddressChange}
                                                                placeholder="e.g., Suite 100"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newCity">City*</label>
                                                            <input
                                                                type="text"
                                                                id="newCity"
                                                                name="city"
                                                                className="form-control"
                                                                value={newAddress.city}
                                                                onChange={handleNewAddressChange}
                                                                placeholder="e.g., New York"
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newState">{getStateLabel(newAddress.country)}*</label>
                                                            <select
                                                                id="newState"
                                                                name="state"
                                                                className="form-control"
                                                                value={newAddress.state}
                                                                onChange={handleNewAddressChange}
                                                                required
                                                            >
                                                                <option value="">Select {getStateLabel(newAddress.country)}</option>
                                                                {getStateOptions(newAddress.country).map(({ value, label }) => (
                                                                    <option key={value} value={value}>{label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newPostalCode">Postal Code*</label>
                                                            <input
                                                                type="text"
                                                                id="newPostalCode"
                                                                name="postalCode"
                                                                className="form-control"
                                                                value={newAddress.postalCode}
                                                                onChange={handleNewAddressChange}
                                                                placeholder="e.g., 11340"
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newCountry">Country*</label>
                                                            <select
                                                                id="newCountry"
                                                                name="country"
                                                                className="form-control"
                                                                value={newAddress.country}
                                                                onChange={handleNewAddressChange}
                                                                required
                                                            >
                                                                <option value="US">United States</option>
                                                                <option value="CA">Canada</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-12">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newAttention">Attention</label>
                                                            <input
                                                                type="text"
                                                                id="newAttention"
                                                                name="attention"
                                                                className="form-control"
                                                                value={newAddress.attention}
                                                                onChange={handleNewAddressChange}
                                                                placeholder="e.g., Shipping Dept"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-md-12">
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor="newSpecialInstructions">Special Instructions</label>
                                                            <textarea
                                                                id="newSpecialInstructions"
                                                                name="specialInstructions"
                                                                className="form-control"
                                                                value={newAddress.specialInstructions}
                                                                onChange={handleNewAddressChange}
                                                                placeholder="e.g., Delivery entrance on side"
                                                                rows="2"
                                                            ></textarea>
                                                        </div>
                                                    </div>
                                                    <div className="col-12 mt-3">
                                                        <div className="form-check">
                                                            <input
                                                                type="checkbox"
                                                                id="newIsDefault"
                                                                name="isDefault"
                                                                className="form-check-input"
                                                                checked={newAddress.isDefault}
                                                                onChange={handleNewAddressChange}
                                                            />
                                                            <label className="form-check-label" htmlFor="newIsDefault">
                                                                Set as default address
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="card-footer bg-light">
                                                <div className="d-flex justify-content-between">
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={handleCloseForm}
                                                        disabled={isSubmitting}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-success"
                                                        onClick={handleAddAddress}
                                                        disabled={isSubmitting}
                                                    >
                                                        {isSubmitting ? (
                                                            <>
                                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                                Adding...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="bi bi-check-lg me-1"></i> Add Address
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="address-list">
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
                                            <div className="row g-3">
                                                {customerAddresses.map((address, index) => (
                                                    <div key={index} className="col-md-6">
                                                        <div
                                                            className={`card h-100 address-card ${selectedAddressId === index ? 'selected' : ''}`}
                                                            onClick={() => handleAddressChange(index)}
                                                        >
                                                            <div className="card-body">
                                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                                    <h6 className="card-title mb-0">{address.street}</h6>
                                                                    {address.default && (
                                                                        <span className="badge bg-primary">Default</span>
                                                                    )}
                                                                </div>
                                                                <p className="card-text small mb-1">
                                                                    {address.city}, {address.state} {address.zip}
                                                                </p>
                                                                <p className="card-text small mb-1">
                                                                    {address.country}
                                                                </p>
                                                                <div className="mt-2 pt-2 border-top">
                                                                    {address.attention && (
                                                                        <p className="card-text small mb-2">
                                                                            <span className="text-muted">Attention:</span> {address.attention}
                                                                        </p>
                                                                    )}
                                                                    {address.specialInstructions && (
                                                                        <>
                                                                            <p className="card-text small mb-0">
                                                                                <span className="text-muted">Special Instructions:</span>
                                                                            </p>
                                                                            <p className="card-text small mb-0 fst-italic">
                                                                                {address.specialInstructions}
                                                                            </p>
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
                                )}
                            </div>

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