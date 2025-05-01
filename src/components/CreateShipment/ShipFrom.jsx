import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import { Skeleton, Card, CardContent, Grid, Box, Typography, Chip, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import './ShipFrom.css';

const ShipFrom = ({ onNext, onPrevious }) => {
    const { currentUser } = useAuth();
    const { formData, updateFormSection } = useShipmentForm();
    const [shipFromAddresses, setShipFromAddresses] = useState(formData.shipFrom?.shipFromAddresses || []);
    const [selectedAddressId, setSelectedAddressId] = useState(formData.shipFrom?.id || null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showAddAddressForm, setShowAddAddressForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(1);
    const [companyId, setCompanyId] = useState(null);
    const [companyIdForAddress, setCompanyIdForAddress] = useState(null); // The companyID for use in addressBook
    const [newAddress, setNewAddress] = useState({
        nickname: '',
        companyName: '',
        address1: '',
        address2: '',
        city: '',
        stateProv: '',
        zipPostal: '',
        country: 'US',
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        isDefault: false
    });

    // Fetch the company ID for the current user
    useEffect(() => {
        const fetchCompanyId = async () => {
            try {
                if (!currentUser) return;

                console.log("ShipFrom: Fetching company ID for user", currentUser.uid);

                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    throw new Error('User data not found.');
                }

                const userData = userDoc.data();
                const companyIdValue = userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];

                if (!companyIdValue) {
                    throw new Error('No company ID found.');
                }

                console.log("ShipFrom: Found companyID value:", companyIdValue);

                // Query for the company document where companyID field equals the value
                console.log('ShipFrom: Querying companies collection for document where companyID =', companyIdValue);

                // Query to find the company document where companyID field equals the value we have
                const companiesQuery = query(
                    collection(db, 'companies'),
                    where('companyID', '==', companyIdValue),
                    limit(1)
                );

                const companiesSnapshot = await getDocs(companiesQuery);

                if (companiesSnapshot.empty) {
                    throw new Error(`No company found with companyID: ${companyIdValue}`);
                }

                // Get the first matching document
                const companyDoc = companiesSnapshot.docs[0];
                const companyData = companyDoc.data();
                const companyDocId = companyDoc.id;

                console.log('ShipFrom: Found company document:', { id: companyDocId, ...companyData });

                // Save the Firebase document ID
                setCompanyId(companyDocId);

                // Get the companyID field needed for addressBook
                const addressCompanyId = companyData.companyID;
                if (!addressCompanyId) {
                    console.warn('Company document does not contain companyID field:', companyData);
                }
                console.log("ShipFrom: Using companyID for address lookup:", addressCompanyId);
                setCompanyIdForAddress(addressCompanyId);

                return { firebaseId: companyDocId, addressId: addressCompanyId };
            } catch (err) {
                console.error('Error fetching company ID:', err);
                setError(err.message || 'Failed to fetch company data.');
                return null;
            }
        };

        fetchCompanyId();
    }, [currentUser]);

    // Fetch addresses from addressBook collection
    useEffect(() => {
        const fetchAddresses = async () => {
            try {
                if (!companyIdForAddress) {
                    console.log("ShipFrom: No company ID for address lookup yet");
                    return;
                }

                setLoading(true);
                console.log(`ShipFrom: Fetching addresses from addressBook for company ID: ${companyIdForAddress}`);

                // Query the addressBook collection for origin addresses associated with this company
                const addressesQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'company'),
                    where('addressType', '==', 'origin'),
                    where('addressClassID', '==', companyIdForAddress)
                );

                const addressesSnapshot = await getDocs(addressesQuery);

                if (addressesSnapshot.empty) {
                    console.log("ShipFrom: No addresses found in addressBook");
                    setShipFromAddresses([]);

                    // Only update form context if needed
                    if (formData.shipFrom?.shipFromAddresses?.length > 0) {
                        // Also update the form context with empty addresses
                        updateFormSection('shipFrom', {
                            ...formData.shipFrom,
                            shipFromAddresses: []
                        });
                    }

                    setLoading(false);
                    return;
                }

                const addresses = addressesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log(`ShipFrom: Found ${addresses.length} addresses in addressBook:`, addresses);

                // Check if addresses are different from what we already have
                const currentAddressIds = shipFromAddresses.map(a => a.id).sort().join(',');
                const newAddressIds = addresses.map(a => a.id).sort().join(',');

                if (currentAddressIds === newAddressIds) {
                    console.log("ShipFrom: Addresses unchanged, skipping update");
                    setLoading(false);
                    return;
                }

                setShipFromAddresses(addresses);

                // Map the addressBook format to the format expected by the rest of the application
                const formattedAddresses = addresses.map(addr => ({
                    id: addr.id,
                    name: addr.nickname,
                    company: addr.companyName,
                    attention: `${addr.firstName} ${addr.lastName}`.trim(),
                    street: addr.address1,
                    street2: addr.address2 || '',
                    city: addr.city,
                    state: addr.stateProv,
                    postalCode: addr.zipPostal,
                    country: addr.country,
                    contactName: `${addr.firstName} ${addr.lastName}`.trim(),
                    contactPhone: addr.phone,
                    contactEmail: addr.email,
                    isDefault: addr.isDefault,
                    nickname: addr.nickname,
                    companyName: addr.companyName,
                    address1: addr.address1,
                    address2: addr.address2 || '',
                    stateProv: addr.stateProv,
                    zipPostal: addr.zipPostal,
                    firstName: addr.firstName,
                    lastName: addr.lastName,
                    phone: addr.phone,
                    email: addr.email
                }));

                // If we have a default address and no address is currently selected, select the default
                const defaultAddress = addresses.find(addr => addr.isDefault);
                if (defaultAddress && !selectedAddressId) {
                    console.log("ShipFrom: Selecting default address:", defaultAddress.id);
                    setSelectedAddressId(defaultAddress.id);

                    // Find the formatted version of this address
                    const formattedDefaultAddress = formattedAddresses.find(addr => addr.id === defaultAddress.id);

                    updateFormSection('shipFrom', {
                        ...formattedDefaultAddress,
                        id: defaultAddress.id,
                        shipFromAddresses: formattedAddresses
                    });
                } else {
                    // Only update form context if addresses have changed
                    const formAddressIds = formData.shipFrom?.shipFromAddresses?.map(a => a.id).sort().join(',') || '';

                    if (formAddressIds !== newAddressIds) {
                        console.log("ShipFrom: Updating form context with addresses");
                        updateFormSection('shipFrom', {
                            ...formData.shipFrom,
                            shipFromAddresses: formattedAddresses
                        });
                    } else {
                        console.log("ShipFrom: Form already has current addresses, skipping update");
                    }
                }

            } catch (err) {
                console.error('Error fetching addresses:', err);
                setError(err.message || 'Failed to fetch shipping addresses.');
            } finally {
                setLoading(false);
            }
        };

        fetchAddresses();
    }, [companyIdForAddress, updateFormSection, selectedAddressId, shipFromAddresses]);

    const handleAddressChange = useCallback((addressId) => {
        const addressIdStr = addressId ? String(addressId) : null;
        console.log(`ShipFrom: handleAddressChange called with ID: "${addressIdStr}"`);
        if (!addressIdStr) return;

        setSelectedAddressId(addressIdStr);

        // Find the address in our state
        const selectedAddress = shipFromAddresses.find(addr => String(addr.id) === addressIdStr);

        if (selectedAddress) {
            console.log('Selected address found:', selectedAddress);

            // Create a formatted version that has both the new and old field names
            const formattedAddress = {
                id: selectedAddress.id,
                name: selectedAddress.nickname,
                company: selectedAddress.companyName,
                attention: `${selectedAddress.firstName} ${selectedAddress.lastName}`.trim(),
                street: selectedAddress.address1,
                street2: selectedAddress.address2 || '',
                city: selectedAddress.city,
                state: selectedAddress.stateProv,
                postalCode: selectedAddress.zipPostal,
                country: selectedAddress.country,
                contactName: `${selectedAddress.firstName} ${selectedAddress.lastName}`.trim(),
                contactPhone: selectedAddress.phone,
                contactEmail: selectedAddress.email,
                isDefault: selectedAddress.isDefault,
                nickname: selectedAddress.nickname,
                companyName: selectedAddress.companyName,
                address1: selectedAddress.address1,
                address2: selectedAddress.address2 || '',
                stateProv: selectedAddress.stateProv,
                zipPostal: selectedAddress.zipPostal,
                firstName: selectedAddress.firstName,
                lastName: selectedAddress.lastName,
                phone: selectedAddress.phone,
                email: selectedAddress.email,
                // Map the addresses in the list to the formatted version as well
                shipFromAddresses: shipFromAddresses.map(addr => ({
                    id: addr.id,
                    name: addr.nickname,
                    company: addr.companyName,
                    attention: `${addr.firstName} ${addr.lastName}`.trim(),
                    street: addr.address1,
                    street2: addr.address2 || '',
                    city: addr.city,
                    state: addr.stateProv,
                    postalCode: addr.zipPostal,
                    country: addr.country,
                    contactName: `${addr.firstName} ${addr.lastName}`.trim(),
                    contactPhone: addr.phone,
                    contactEmail: addr.email,
                    isDefault: addr.isDefault,
                    nickname: addr.nickname,
                    companyName: addr.companyName,
                    address1: addr.address1,
                    address2: addr.address2 || '',
                    stateProv: addr.stateProv,
                    zipPostal: addr.zipPostal,
                    firstName: addr.firstName,
                    lastName: addr.lastName,
                    phone: addr.phone,
                    email: addr.email
                }))
            };

            console.log('Updating form with formatted address:', formattedAddress);
            updateFormSection('shipFrom', formattedAddress);
        } else {
            console.error('Selected address ID not found in shipFromAddresses from context:', addressIdStr);
        }
    }, [shipFromAddresses, updateFormSection]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        updateFormSection('shipFrom', { [name]: value });
    }, [updateFormSection]);

    const handleNewAddressChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setNewAddress(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }, []);

    const checkDuplicateAddress = useCallback((address) => {
        return shipFromAddresses.some(addr =>
            addr.address1.toLowerCase() === address.address1.toLowerCase() &&
            addr.city.toLowerCase() === address.city.toLowerCase() &&
            addr.stateProv === address.stateProv &&
            addr.zipPostal === address.zipPostal
        );
    }, [shipFromAddresses]);

    const resetLocalForm = () => {
        setNewAddress({
            nickname: '',
            companyName: '',
            address1: '',
            address2: '',
            city: '',
            stateProv: '',
            zipPostal: '',
            country: 'US',
            firstName: '',
            lastName: '',
            phone: '',
            email: '',
            isDefault: false
        });
        setCurrentStep(1);
    };

    const handleCloseLocalForm = () => {
        setShowAddAddressForm(false);
        resetLocalForm();
    };

    const handleAddAddress = useCallback(async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            if (!companyIdForAddress) throw new Error('Company ID not found.');

            const requiredFields = ['nickname', 'companyName', 'address1', 'city', 'stateProv', 'zipPostal', 'firstName', 'lastName', 'phone', 'email'];
            const missingFields = requiredFields.filter(field => !newAddress[field]);
            if (missingFields.length > 0) throw new Error(`Please fill required fields: ${missingFields.join(', ')}`);
            if (checkDuplicateAddress(newAddress)) throw new Error('Address already exists');

            // If this is going to be a default address, we need to update any existing default addresses
            if (newAddress.isDefault) {
                // Find all current default addresses
                const defaultAddressesQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'company'),
                    where('addressType', '==', 'origin'),
                    where('addressClassID', '==', companyIdForAddress),
                    where('isDefault', '==', true)
                );

                const defaultAddressesSnapshot = await getDocs(defaultAddressesQuery);

                // Update all current default addresses to not be default
                const updatePromises = defaultAddressesSnapshot.docs.map(docSnapshot => {
                    return updateDoc(doc(db, 'addressBook', docSnapshot.id), {
                        isDefault: false,
                        updatedAt: new Date()
                    });
                });

                await Promise.all(updatePromises);
            }

            // Create new address document in addressBook collection
            const newAddressData = {
                ...newAddress,
                addressClass: 'company',
                addressType: 'origin',
                addressClassID: companyIdForAddress,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log("ShipFrom: Adding new address to addressBook:", newAddressData);

            const newAddressRef = await addDoc(collection(db, 'addressBook'), newAddressData);
            const newAddressId = newAddressRef.id;

            // Add the ID to the address data
            const addressWithId = {
                ...newAddressData,
                id: newAddressId
            };

            // Update local state
            const updatedAddresses = [...shipFromAddresses, addressWithId];
            setShipFromAddresses(updatedAddresses);

            // Create the formatted address with both new and old field names
            const formattedAddress = {
                id: newAddressId,
                name: newAddress.nickname,
                company: newAddress.companyName,
                attention: `${newAddress.firstName} ${newAddress.lastName}`.trim(),
                street: newAddress.address1,
                street2: newAddress.address2 || '',
                city: newAddress.city,
                state: newAddress.stateProv,
                postalCode: newAddress.zipPostal,
                country: newAddress.country,
                contactName: `${newAddress.firstName} ${newAddress.lastName}`.trim(),
                contactPhone: newAddress.phone,
                contactEmail: newAddress.email,
                isDefault: newAddress.isDefault,
                nickname: newAddress.nickname,
                companyName: newAddress.companyName,
                address1: newAddress.address1,
                address2: newAddress.address2 || '',
                stateProv: newAddress.stateProv,
                zipPostal: newAddress.zipPostal,
                firstName: newAddress.firstName,
                lastName: newAddress.lastName,
                phone: newAddress.phone,
                email: newAddress.email,
                // Map all addresses in the list to have both formats
                shipFromAddresses: updatedAddresses.map(addr => ({
                    id: addr.id,
                    name: addr.nickname,
                    company: addr.companyName,
                    attention: `${addr.firstName} ${addr.lastName}`.trim(),
                    street: addr.address1,
                    street2: addr.address2 || '',
                    city: addr.city,
                    state: addr.stateProv,
                    postalCode: addr.zipPostal,
                    country: addr.country,
                    contactName: `${addr.firstName} ${addr.lastName}`.trim(),
                    contactPhone: addr.phone,
                    contactEmail: addr.email,
                    isDefault: addr.isDefault,
                    nickname: addr.nickname,
                    companyName: addr.companyName,
                    address1: addr.address1,
                    address2: addr.address2 || '',
                    stateProv: addr.stateProv,
                    zipPostal: addr.zipPostal,
                    firstName: addr.firstName,
                    lastName: addr.lastName,
                    phone: addr.phone,
                    email: addr.email
                }))
            };

            // Update the form context
            console.log("ShipFrom: Updating form with new address:", formattedAddress);
            updateFormSection('shipFrom', formattedAddress);

            setSelectedAddressId(newAddressId);
            setShowAddAddressForm(false);
            resetLocalForm();
            setSuccess('Address added successfully');
            setTimeout(() => setSuccess(null), 3000);

        } catch (err) {
            console.error('Error adding address:', err);
            setError(err.message || 'Failed to add address. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [newAddress, shipFromAddresses, companyIdForAddress, checkDuplicateAddress, updateFormSection]);

    const handleSubmit = useCallback(() => {
        if (!selectedAddressId) {
            setError('Please select or add a shipping origin address');
            return;
        }
        setError(null);
        onNext();
    }, [selectedAddressId, onNext]);

    // Helper function to get attention line from name fields
    const getAttentionLine = useCallback((address) => {
        if (address.firstName && address.lastName) {
            return `${address.firstName} ${address.lastName}`;
        } else if (address.firstName) {
            return address.firstName;
        } else if (address.lastName) {
            return address.lastName;
        }
        return '';
    }, []);

    const currentShipFromData = formData.shipFrom || {};

    // Log the current state of the component for debugging
    useEffect(() => {
        console.log("ShipFrom: Current state:", {
            companyId,
            companyIdForAddress,
            selectedAddressId,
            addressesCount: shipFromAddresses.length,
            addressIds: shipFromAddresses.map(a => a.id),
            formDataShipFrom: formData.shipFrom,
            formDataAddressIds: formData.shipFrom?.shipFromAddresses?.map(a => a.id) || []
        });
    }, [companyId, companyIdForAddress, selectedAddressId, shipFromAddresses, formData.shipFrom]);

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

                        {loading ? (
                            <div className="py-4">
                                <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
                                <Skeleton variant="rectangular" height={100} />
                            </div>
                        ) : showAddAddressForm ? (
                            <div className="add-address-form mb-4">
                                <div className="card border-primary">
                                    <div className="card-header bg-light d-flex justify-content-between align-items-center">
                                        <h6 className="mb-0">Add New Shipping Origin</h6>
                                        <button
                                            type="button"
                                            className="btn-close"
                                            onClick={handleCloseLocalForm}
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
                                            <div className="col-md-6">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newNickname">Address Label*</label>
                                                    <input
                                                        type="text"
                                                        id="newNickname"
                                                        name="nickname"
                                                        className="form-control"
                                                        value={newAddress.nickname}
                                                        onChange={handleNewAddressChange}
                                                        placeholder="e.g., Main Office, Warehouse"
                                                        required
                                                    />
                                                    <small className="form-text text-muted">Internal label to identify this address</small>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newCompanyName">Company Name*</label>
                                                    <input
                                                        type="text"
                                                        id="newCompanyName"
                                                        name="companyName"
                                                        className="form-control"
                                                        value={newAddress.companyName}
                                                        onChange={handleNewAddressChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newFirstName">First Name*</label>
                                                    <input
                                                        type="text"
                                                        id="newFirstName"
                                                        name="firstName"
                                                        className="form-control"
                                                        value={newAddress.firstName}
                                                        onChange={handleNewAddressChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newLastName">Last Name*</label>
                                                    <input
                                                        type="text"
                                                        id="newLastName"
                                                        name="lastName"
                                                        className="form-control"
                                                        value={newAddress.lastName}
                                                        onChange={handleNewAddressChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newAddress1">Street Address*</label>
                                                    <input
                                                        type="text"
                                                        id="newAddress1"
                                                        name="address1"
                                                        className="form-control"
                                                        value={newAddress.address1}
                                                        onChange={handleNewAddressChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newAddress2">Suite/Unit (Optional)</label>
                                                    <input
                                                        type="text"
                                                        id="newAddress2"
                                                        name="address2"
                                                        className="form-control"
                                                        value={newAddress.address2}
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
                                                    <label className="form-label" htmlFor="newStateProv">{getStateLabel(newAddress.country)}*</label>
                                                    <select
                                                        id="newStateProv"
                                                        name="stateProv"
                                                        className="form-control"
                                                        value={newAddress.stateProv}
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
                                                    <label className="form-label" htmlFor="newZipPostal">Postal Code*</label>
                                                    <input
                                                        type="text"
                                                        id="newZipPostal"
                                                        name="zipPostal"
                                                        className="form-control"
                                                        value={newAddress.zipPostal}
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
                                            <div className="col-md-6">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newPhone">Phone*</label>
                                                    <input
                                                        type="tel"
                                                        id="newPhone"
                                                        name="phone"
                                                        className="form-control"
                                                        value={newAddress.phone}
                                                        onChange={handleNewAddressChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="newEmail">Email*</label>
                                                    <input
                                                        type="email"
                                                        id="newEmail"
                                                        name="email"
                                                        className="form-control"
                                                        value={newAddress.email}
                                                        onChange={handleNewAddressChange}
                                                        required
                                                    />
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
                                                onClick={handleCloseLocalForm}
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
                                {shipFromAddresses.length > 0 ? (
                                    shipFromAddresses.map((address) => {
                                        const addressId = address.id;
                                        const isSelected = addressId === selectedAddressId && selectedAddressId !== null;
                                        const attentionLine = getAttentionLine(address);
                                        console.log(`Address ${address.nickname} (${addressId}): isSelected=${isSelected}, localSelectedId=${selectedAddressId}`);
                                        return (
                                            <div key={addressId} className="mb-2">
                                                <Card
                                                    sx={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        borderRadius: '8px',
                                                        width: '100%',
                                                        mb: 2,
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
                                                    onClick={() => handleAddressChange(addressId)}
                                                    data-selected={isSelected ? "true" : "false"}
                                                    data-address-id={addressId}
                                                >
                                                    <CardContent sx={{ p: 2 }}>
                                                        <Grid container alignItems="center" spacing={2}>
                                                            <Grid item xs={12} sm={4}>
                                                                <Box display="flex" alignItems="center">
                                                                    <Typography variant="subtitle1" fontWeight="500" sx={{ mr: 1 }}>
                                                                        {address.nickname}
                                                                    </Typography>
                                                                    {address.isDefault && (
                                                                        <Chip
                                                                            size="small"
                                                                            label="Default"
                                                                            color="primary"
                                                                            sx={{ height: 22 }}
                                                                        />
                                                                    )}
                                                                </Box>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {address.companyName}
                                                                </Typography>
                                                                {attentionLine && (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        <Box component="span" fontWeight="500">Attn:</Box> {attentionLine}
                                                                    </Typography>
                                                                )}
                                                            </Grid>
                                                            <Grid item xs={12} sm={4}>
                                                                <Typography variant="body2">
                                                                    {address.address1}
                                                                    {address.address2 && <>, {address.address2}</>}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {address.city}, {address.stateProv} {address.zipPostal}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={4}>
                                                                <Typography variant="body2">
                                                                    <Box component="span" fontWeight="500">Phone:</Box> {address.phone}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    <Box component="span" fontWeight="500">Email:</Box> {address.email}
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-4">
                                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                            No saved origin addresses found.
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<AddIcon />}
                                            onClick={() => setShowAddAddressForm(true)}
                                        >
                                            Add Origin Address
                                        </Button>
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
                            value={currentShipFromData.specialInstructions || ''}
                            onChange={handleInputChange}
                            rows="3"
                            placeholder="Enter any special handling instructions or notes for the carrier"
                        ></textarea>
                    </div>
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
                    disabled={!selectedAddressId}
                >
                    Next <i className="bi bi-arrow-right ms-2"></i>
                </button>
            </div>
        </form>
    );
};

export default ShipFrom; 