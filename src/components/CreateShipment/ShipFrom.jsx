import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../contexts/AuthContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';

const ShipFrom = ({ onDataChange, onNext, onPrevious }) => {
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
    const [companyAddresses, setCompanyAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showAddAddressModal, setShowAddAddressModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
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

    // Fetch company data and addresses
    useEffect(() => {
        const fetchCompanyData = async () => {
            try {
                console.log('Current user:', currentUser);

                // First, fetch the user's data from the users collection
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    console.log('User document not found');
                    setError('User data not found. Please contact support.');
                    setLoading(false);
                    return;
                }

                const userData = userDoc.data();
                console.log('User data:', userData);

                if (!userData.connectedCompanies?.companies || userData.connectedCompanies.companies.length === 0) {
                    console.log('No connected companies found for user');
                    setError('No company associated with this account. Please contact support.');
                    setLoading(false);
                    return;
                }

                // Get the first company ID from the companies array
                const companyId = userData.connectedCompanies.companies[0];
                console.log('Using company ID:', companyId);

                if (!companyId) {
                    console.log('No company ID found in connectedCompanies');
                    setError('No company associated with this account. Please contact support.');
                    setLoading(false);
                    return;
                }

                // First try to find the company by companyID field
                console.log('Fetching company document for ID:', companyId);
                const companiesRef = collection(db, 'companies');
                const q = query(companiesRef, where('companyID', '==', companyId));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    console.log('No company found with companyID:', companyId);
                    setError('Company data not found. Please contact support.');
                    setLoading(false);
                    return;
                }

                const companyDoc = querySnapshot.docs[0];
                console.log('Company document exists:', companyDoc.exists());
                const data = companyDoc.data();
                console.log('Company data:', data);
                setCompanyAddresses(data.shipFromAddresses || []);

                // Find and set default address
                const defaultAddress = data.shipFromAddresses?.find(addr => addr.isDefault);
                if (defaultAddress) {
                    setSelectedAddressId(defaultAddress.id);
                    setFormData(defaultAddress);
                    console.log('Default address set:', defaultAddress);
                }
            } catch (err) {
                console.error('Error fetching company data:', err);
                setError('Failed to load company data. Please try again or contact support.');
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) {
            fetchCompanyData();
        }
    }, [currentUser]);

    const handleAddressChange = useCallback((addressId) => {
        const selectedAddress = companyAddresses.find(addr => addr.id === addressId);
        if (selectedAddress) {
            setSelectedAddressId(addressId);
            setFormData(selectedAddress);
            console.log('Selected address:', selectedAddress);
            setTimeout(() => onDataChange(selectedAddress), 0);
        }
    }, [companyAddresses, onDataChange]);

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

    const checkDuplicateAddress = useCallback((address) => {
        return companyAddresses.some(addr =>
            addr.street.toLowerCase() === address.street.toLowerCase() &&
            addr.city.toLowerCase() === address.city.toLowerCase() &&
            addr.state === address.state &&
            addr.postalCode === address.postalCode
        );
    }, [companyAddresses]);

    const handleAddAddress = useCallback(async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            // Validate required fields
            const requiredFields = ['name', 'company', 'street', 'city', 'state', 'postalCode', 'contactName', 'contactPhone', 'contactEmail'];
            const missingFields = requiredFields.filter(field => !newAddress[field]);
            if (missingFields.length > 0) {
                throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
            }

            // Check for duplicate address
            if (checkDuplicateAddress(newAddress)) {
                throw new Error('This address already exists in your address book');
            }

            const addressId = uuidv4();
            const addressToAdd = {
                ...newAddress,
                id: addressId,
                createdAt: new Date().toISOString()
            };

            // If this is the first address or marked as default, update other addresses
            if (addressToAdd.isDefault || companyAddresses.length === 0) {
                const updatedAddresses = companyAddresses.map(addr => ({
                    ...addr,
                    isDefault: false
                }));
                updatedAddresses.push({ ...addressToAdd, isDefault: true });
                const companyId = currentUser?.connectedCompanies?.companies?.[0];
                if (!companyId) {
                    throw new Error('No company ID found. Please contact support.');
                }
                await updateDoc(doc(db, 'companies', companyId), {
                    shipFromAddresses: updatedAddresses
                });
                setCompanyAddresses(updatedAddresses);
                setSelectedAddressId(addressId);
                setFormData(addressToAdd);
                setTimeout(() => onDataChange(addressToAdd), 0);
            } else {
                const companyId = currentUser?.connectedCompanies?.companies?.[0];
                if (!companyId) {
                    throw new Error('No company ID found. Please contact support.');
                }
                await updateDoc(doc(db, 'companies', companyId), {
                    shipFromAddresses: arrayUnion(addressToAdd)
                });
                setCompanyAddresses(prev => [...prev, addressToAdd]);
            }

            setShowAddAddressModal(false);
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
            setSuccess('Address added successfully');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error adding address:', err);
            setError(err.message || 'Failed to add address. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [newAddress, companyAddresses, currentUser, checkDuplicateAddress, onDataChange]);

    const handleSubmit = useCallback(() => {
        if (!selectedAddressId) {
            setError('Please select or add a shipping address');
            return;
        }
        onNext();
    }, [selectedAddressId, onNext]);

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
        <form className="ship-from-form">
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
                    <h5 className="card-title mb-4">Select Shipping Origin</h5>

                    <div className="address-selection mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <label className="form-label mb-0">Saved Addresses</label>
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => setShowAddAddressModal(true)}
                            >
                                <i className="bi bi-plus-lg me-1"></i> Add New Address
                            </button>
                        </div>

                        <div className="address-list">
                            {companyAddresses.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-muted mb-3">No saved addresses found</p>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => setShowAddAddressModal(true)}
                                    >
                                        <i className="bi bi-plus-lg me-1"></i> Add Your First Address
                                    </button>
                                </div>
                            ) : (
                                <div className="row g-3">
                                    {companyAddresses.map((address) => (
                                        <div key={address.id} className="col-md-6">
                                            <div
                                                className={`card h-100 ${selectedAddressId === address.id ? 'border-primary' : ''}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleAddressChange(address.id)}
                                            >
                                                <div className="card-body">
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <h6 className="card-title mb-0">{address.name}</h6>
                                                        {address.isDefault && (
                                                            <span className="badge bg-primary">Default</span>
                                                        )}
                                                    </div>
                                                    <p className="card-text small mb-1">{address.company}</p>
                                                    <p className="card-text small mb-1">
                                                        {address.street}
                                                        {address.street2 && <>, {address.street2}</>}
                                                    </p>
                                                    <p className="card-text small mb-1">
                                                        {address.city}, {address.state} {address.postalCode}
                                                    </p>
                                                    <p className="card-text small mb-0">
                                                        {address.contactName} • {address.contactPhone}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
                </div>
            </div>

            {/* Add Address Modal */}
            {showAddAddressModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg" style={{ zIndex: 1051 }}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Add New Shipping Origin</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowAddAddressModal(false)}
                                    disabled={isSubmitting}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-danger" role="alert">
                                        {error}
                                    </div>
                                )}
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="newName">Address Name*</label>
                                            <input
                                                type="text"
                                                id="newName"
                                                name="name"
                                                className="form-control"
                                                value={newAddress.name}
                                                onChange={handleNewAddressChange}
                                                placeholder="e.g., Main Office, Warehouse"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="newCompany">Company Name*</label>
                                            <input
                                                type="text"
                                                id="newCompany"
                                                name="company"
                                                className="form-control"
                                                value={newAddress.company}
                                                onChange={handleNewAddressChange}
                                                required
                                            />
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
                                                placeholder="Contact person or department"
                                            />
                                        </div>
                                    </div>
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
                                            <label className="form-label" htmlFor="newContactName">Contact Name*</label>
                                            <input
                                                type="text"
                                                id="newContactName"
                                                name="contactName"
                                                className="form-control"
                                                value={newAddress.contactName}
                                                onChange={handleNewAddressChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="newContactPhone">Contact Phone*</label>
                                            <input
                                                type="tel"
                                                id="newContactPhone"
                                                name="contactPhone"
                                                className="form-control"
                                                value={newAddress.contactPhone}
                                                onChange={handleNewAddressChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="newContactEmail">Contact Email*</label>
                                            <input
                                                type="email"
                                                id="newContactEmail"
                                                name="contactEmail"
                                                className="form-control"
                                                value={newAddress.contactEmail}
                                                onChange={handleNewAddressChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="col-12">
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
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowAddAddressModal(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAddAddress}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Address'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop show" style={{ zIndex: 1049 }}></div>
                </div>
            )}

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
                    disabled={!selectedAddressId}
                >
                    Next <i className="bi bi-arrow-right ms-2"></i>
                </button>
            </div>
        </form>
    );
};

export default ShipFrom; 