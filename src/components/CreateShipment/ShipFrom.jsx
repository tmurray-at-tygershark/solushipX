import React, { useState, useEffect } from 'react';
import { getStateOptions, getStateLabel } from '../../constants/address';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';

const ShipFrom = ({ data, onDataChange, onNext, onPrevious }) => {
    const [formData, setFormData] = useState({
        company: '',
        attentionName: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        contactFax: '',
        specialInstructions: ''
    });

    const [showSpecialInstructions, setShowSpecialInstructions] = useState(false);
    const [companyAddresses, setCompanyAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState('');
    const [loading, setLoading] = useState(true);
    const [showAddAddressModal, setShowAddAddressModal] = useState(false);
    const [newAddress, setNewAddress] = useState({
        name: '',
        company: '',
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
    const { currentUser } = useAuth();

    // Fetch company data and addresses
    useEffect(() => {
        const fetchCompanyData = async () => {
            try {
                setLoading(true);
                // Query the companies collection for the company with companyID OSJ4266
                const companiesRef = collection(db, 'companies');
                const q = query(companiesRef, where('companyID', '==', 'OSJ4266'));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const companyData = querySnapshot.docs[0].data();

                    // Set company addresses
                    if (companyData.shipFromAddresses && companyData.shipFromAddresses.length > 0) {
                        setCompanyAddresses(companyData.shipFromAddresses);

                        // Find the default address
                        const defaultAddress = companyData.shipFromAddresses.find(addr => addr.isDefault);
                        if (defaultAddress) {
                            setSelectedAddressId(defaultAddress.id);
                            const newFormData = {
                                company: defaultAddress.company,
                                attentionName: defaultAddress.attention || '',
                                street: defaultAddress.street,
                                street2: defaultAddress.street2 || '',
                                city: defaultAddress.city,
                                state: defaultAddress.state,
                                postalCode: defaultAddress.postalCode,
                                country: defaultAddress.country,
                                contactName: defaultAddress.contactName,
                                contactPhone: defaultAddress.contactPhone,
                                contactEmail: defaultAddress.contactEmail,
                                contactFax: '',
                                specialInstructions: ''
                            };
                            setFormData(newFormData);
                            onDataChange(newFormData);
                            console.log('Default address selected:', newFormData);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching company data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCompanyData();
    }, []);

    // Handle address selection
    const handleAddressChange = (e) => {
        const selectedId = e.target.value;
        setSelectedAddressId(selectedId);

        const selectedAddress = companyAddresses.find(addr => addr.id === selectedId);
        if (selectedAddress) {
            const newFormData = {
                company: selectedAddress.company,
                attentionName: selectedAddress.attention || '',
                street: selectedAddress.street,
                street2: selectedAddress.street2 || '',
                city: selectedAddress.city,
                state: selectedAddress.state,
                postalCode: selectedAddress.postalCode,
                country: selectedAddress.country,
                contactName: selectedAddress.contactName,
                contactPhone: selectedAddress.contactPhone,
                contactEmail: selectedAddress.contactEmail,
                contactFax: '',
                specialInstructions: ''
            };
            setFormData(newFormData);
            onDataChange(newFormData);
            console.log('Selected address:', newFormData);
        }
    };

    const handleInputChange = (fieldOrEvent, directValue) => {
        let field, value;

        if (typeof fieldOrEvent === 'string') {
            field = fieldOrEvent;
            value = directValue;
        } else {
            field = fieldOrEvent.target.id;
            value = fieldOrEvent.target.value;
        }

        const newFormData = {
            ...formData,
            [field]: value
        };
        setFormData(newFormData);
        onDataChange(newFormData);
    };

    const handleCountryChange = (e) => {
        const newCountry = e.target.value;
        const newFormData = {
            ...formData,
            country: newCountry,
            state: '' // Reset state/province when country changes
        };
        setFormData(newFormData);
        onDataChange(newFormData);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Check if all required fields are filled
        const requiredFields = ['company', 'street', 'city', 'state', 'postalCode', 'country'];
        const isValid = requiredFields.every(field => formData[field] && formData[field].trim() !== '');

        if (isValid) {
            onNext();
        } else {
            // Show validation errors
            const form = document.querySelector('.form-section');
            if (form) {
                form.classList.add('was-validated');
            }
        }
    };

    const handleAddAddress = async () => {
        try {
            setLoading(true);
            const companiesRef = collection(db, 'companies');
            const q = query(companiesRef, where('companyID', '==', 'OSJ4266'));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const companyDoc = querySnapshot.docs[0];
                const newAddressWithId = {
                    ...newAddress,
                    id: Date.now().toString(), // Simple unique ID
                };

                await updateDoc(doc(db, 'companies', companyDoc.id), {
                    shipFromAddresses: arrayUnion(newAddressWithId)
                });

                // Update local state
                setCompanyAddresses(prev => [...prev, newAddressWithId]);
                setShowAddAddressModal(false);
                setNewAddress({
                    name: '',
                    company: '',
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
            }
        } catch (error) {
            console.error('Error adding new address:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div>Loading company data...</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="form-section">
            <h2 className="mb-4">Shipping Origin</h2>
            <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h4 className="card-title mb-0">Select Shipping Origin</h4>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setShowAddAddressModal(true)}
                    >
                        <i className="bi bi-plus-circle me-2"></i>Add New Origin
                    </button>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="addressSelect">Shipping Address</label>
                        <select
                            id="addressSelect"
                            className="form-control"
                            value={selectedAddressId}
                            onChange={handleAddressChange}
                            required
                        >
                            <option value="">Select an address</option>
                            {companyAddresses.map((address) => (
                                <option key={address.id} value={address.id}>
                                    {address.company} - {address.attention ? `Attn: ${address.attention}, ` : ''}{address.street}, {address.city}, {address.state}
                                </option>
                            ))}
                        </select>
                        <div className="invalid-feedback">Please select a shipping address</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Additional Information</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="specialInstructions">Special Instructions</label>
                        <textarea
                            id="specialInstructions"
                            className="form-control"
                            value={formData.specialInstructions}
                            onChange={handleInputChange}
                            placeholder="Enter any special instructions"
                            rows="3"
                        />
                    </div>
                </div>
            </div>

            {/* Add Address Modal */}
            {showAddAddressModal && (
                <div className="modal show d-block" tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title"> New Shipping Origin</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowAddAddressModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newAddressName">Address Name</label>
                                        <input
                                            type="text"
                                            id="newAddressName"
                                            className="form-control"
                                            value={newAddress.name}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g., Main Office, Warehouse, etc."
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newCompany">Company Name</label>
                                        <input
                                            type="text"
                                            id="newCompany"
                                            className="form-control"
                                            value={newAddress.company}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, company: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newStreet">Street Address</label>
                                        <input
                                            type="text"
                                            id="newStreet"
                                            className="form-control"
                                            value={newAddress.street}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, street: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newStreet2">Suite/Unit (Optional)</label>
                                        <input
                                            type="text"
                                            id="newStreet2"
                                            className="form-control"
                                            value={newAddress.street2}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, street2: e.target.value }))}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newCity">City</label>
                                        <input
                                            type="text"
                                            id="newCity"
                                            className="form-control"
                                            value={newAddress.city}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newState">{getStateLabel(newAddress.country)}</label>
                                        <select
                                            id="newState"
                                            className="form-control"
                                            value={newAddress.state}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                                            required
                                        >
                                            <option value="">Select {getStateLabel(newAddress.country)}</option>
                                            {getStateOptions(newAddress.country).map(({ value, label }) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newPostalCode">Postal Code</label>
                                        <input
                                            type="text"
                                            id="newPostalCode"
                                            className="form-control"
                                            value={newAddress.postalCode}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newCountry">Country</label>
                                        <select
                                            id="newCountry"
                                            className="form-control"
                                            value={newAddress.country}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, country: e.target.value, state: '' }))}
                                            required
                                        >
                                            <option value="US">United States</option>
                                            <option value="CA">Canada</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newContactName">Contact Name</label>
                                        <input
                                            type="text"
                                            id="newContactName"
                                            className="form-control"
                                            value={newAddress.contactName}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, contactName: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newContactPhone">Contact Phone</label>
                                        <input
                                            type="tel"
                                            id="newContactPhone"
                                            className="form-control"
                                            value={newAddress.contactPhone}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, contactPhone: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="newContactEmail">Contact Email</label>
                                        <input
                                            type="email"
                                            id="newContactEmail"
                                            className="form-control"
                                            value={newAddress.contactEmail}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, contactEmail: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <div className="form-check">
                                            <input
                                                type="checkbox"
                                                id="newIsDefault"
                                                className="form-check-input"
                                                checked={newAddress.isDefault}
                                                onChange={(e) => setNewAddress(prev => ({ ...prev, isDefault: e.target.checked }))}
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
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAddAddress}
                                >
                                    Add Address
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop show"></div>
                </div>
            )}

            <div className="navigation-buttons">
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={onPrevious}
                >
                    <i className="bi bi-arrow-left"></i> Previous
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                >
                    Next <i className="bi bi-arrow-right"></i>
                </button>
            </div>
        </form>
    );
};

export default ShipFrom; 