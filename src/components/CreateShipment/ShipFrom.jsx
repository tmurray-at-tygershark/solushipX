import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, limit, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import { Skeleton, Card, CardContent, Grid, Box, Typography, Chip, Button, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import './ShipFrom.css';

const ShipFrom = ({ onNext, onPrevious }) => {
    const { currentUser } = useAuth();
    const { companyData, companyIdForAddress, loading: companyLoading } = useCompany();
    const { formData, updateFormSection } = useShipmentForm();
    const [shipFromAddresses, setShipFromAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(formData.shipFrom?.id || null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showAddAddressForm, setShowAddAddressForm] = useState(false);
    const [isSubmittingNew, setIsSubmittingNew] = useState(false);
    const [loadingAddresses, setLoadingAddresses] = useState(true);
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

    useEffect(() => {
        const fetchAddresses = async () => {
            if (!companyIdForAddress) {
                console.log("ShipFrom: No company ID for address lookup yet.");
                setShipFromAddresses([]);
                setLoadingAddresses(false);
                return;
            }

            console.log(`ShipFrom: Fetching origin addresses for company ID: ${companyIdForAddress}`);
            setLoadingAddresses(true);
            setError(null);
            try {
                const addressesQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'company'),
                    where('addressType', '==', 'origin'),
                    where('addressClassID', '==', companyIdForAddress)
                );
                const addressesSnapshot = await getDocs(addressesQuery);
                const fetchedAddresses = addressesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`ShipFrom: Found ${fetchedAddresses.length} origin addresses from addressBook:`, fetchedAddresses);
                setShipFromAddresses(fetchedAddresses);

                // Enhanced logic to handle partial draft data
                const currentShipFrom = formData.shipFrom || {};
                const hasExistingData = currentShipFrom.id || currentShipFrom.street || currentShipFrom.company;

                console.log("ShipFrom: Current shipFrom data:", currentShipFrom);
                console.log("ShipFrom: Has existing data:", hasExistingData);

                if (hasExistingData) {
                    // If we have existing data, try to match it with an address from the list
                    if (currentShipFrom.id) {
                        const matchingAddress = fetchedAddresses.find(addr => addr.id === currentShipFrom.id);
                        if (matchingAddress) {
                            console.log("ShipFrom: Found matching address for existing ID:", matchingAddress);
                            setSelectedAddressId(currentShipFrom.id);
                        } else {
                            console.log("ShipFrom: No matching address found for ID, keeping current data");
                            setSelectedAddressId(null);
                        }
                    } else {
                        // No ID but has other data - this is custom/manual entry
                        console.log("ShipFrom: Existing data without ID - keeping as custom entry");
                        setSelectedAddressId(null);
                    }
                } else if (fetchedAddresses.length > 0) {
                    // No existing data - apply default
                    const defaultAddressDoc = fetchedAddresses.find(addr => addr.isDefault) || fetchedAddresses[0];
                    if (defaultAddressDoc) {
                        console.log("ShipFrom: No existing data, applying default origin address:", defaultAddressDoc);
                        const defaultSelectedOrigin = mapAddressBookToShipFrom(defaultAddressDoc, companyData);
                        updateFormSection('shipFrom', defaultSelectedOrigin);
                        setSelectedAddressId(defaultSelectedOrigin.id);
                    }
                } else {
                    // No addresses available and no existing data
                    console.log("ShipFrom: No addresses available and no existing data");
                    setSelectedAddressId(null);
                }

            } catch (err) {
                console.error('ShipFrom: Error fetching addresses:', err);
                setError(err.message || 'Failed to fetch shipping addresses.');
                setShipFromAddresses([]);
            } finally {
                setLoadingAddresses(false);
            }
        };
        fetchAddresses();
    }, [companyIdForAddress, companyData, formData.shipFrom?.id]); // Added formData.shipFrom?.id to dependencies

    const mapAddressBookToShipFrom = (addressDoc, currentCompanyData) => {
        if (!addressDoc) return {};
        const firstName = addressDoc.firstName || '';
        const lastName = addressDoc.lastName || '';
        const contactName = firstName || lastName ? `${firstName} ${lastName}`.trim() : addressDoc.nickname || '';
        return {
            id: addressDoc.id,
            name: addressDoc.nickname || '',
            company: addressDoc.companyName || currentCompanyData?.name || '',
            attention: contactName,
            street: addressDoc.address1 || '',
            street2: addressDoc.address2 || '',
            city: addressDoc.city || '',
            state: addressDoc.stateProv || '',
            postalCode: addressDoc.zipPostal || '',
            country: addressDoc.country || 'US',
            contactName: contactName,
            contactPhone: addressDoc.phone || '',
            contactEmail: addressDoc.email || '',
            specialInstructions: addressDoc.specialInstructions || '',
            isDefault: addressDoc.isDefault || false,
        };
    };

    const handleAddressChange = useCallback(async (addressId) => {
        const selectedDbAddress = shipFromAddresses.find(addr => addr.id === addressId);
        if (selectedDbAddress) {
            console.log('ShipFrom: Address card clicked:', selectedDbAddress);
            setSelectedAddressId(addressId);
            const shipFromObject = mapAddressBookToShipFrom(selectedDbAddress, companyData);
            updateFormSection('shipFrom', shipFromObject);
            console.log("ShipFrom: Context updated with selected address:", shipFromObject);
        }
    }, [shipFromAddresses, companyData, updateFormSection]);

    const handleSelectedAddressInputChange = useCallback((e) => {
        const { name, value } = e.target;
        updateFormSection('shipFrom', { ...formData.shipFrom, [name]: value });
    }, [formData.shipFrom, updateFormSection]);

    const handleNewAddressChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setNewAddress(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }, []);

    const checkDuplicateAddress = useCallback((addressToCheck) => {
        return shipFromAddresses.some(addr =>
            addr.address1?.toLowerCase() === addressToCheck.address1?.toLowerCase() &&
            addr.city?.toLowerCase() === addressToCheck.city?.toLowerCase() &&
            addr.stateProv === addressToCheck.stateProv &&
            addr.zipPostal === addressToCheck.zipPostal &&
            (addr.companyName?.toLowerCase() === addressToCheck.companyName?.toLowerCase() || (!addr.companyName && !addressToCheck.companyName))
        );
    }, [shipFromAddresses]);

    const resetNewAddressForm = () => {
        setNewAddress({ nickname: '', companyName: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'US', firstName: '', lastName: '', phone: '', email: '', isDefault: false });
    };

    const handleAddNewAddressSubmit = useCallback(async () => {
        setIsSubmittingNew(true);
        setError(null);
        setSuccess(null);
        try {
            if (!companyIdForAddress) throw new Error('Company ID not found. Cannot save address.');
            const requiredFields = ['nickname', 'companyName', 'address1', 'city', 'stateProv', 'zipPostal', 'country', 'firstName', 'lastName', 'phone', 'email'];
            const missingFields = requiredFields.filter(field => !newAddress[field]?.trim());
            if (missingFields.length > 0) throw new Error(`Please fill all required fields for the new address: ${missingFields.join(', ')}`);
            if (checkDuplicateAddress(newAddress)) throw new Error('This address appears to already exist.');

            if (newAddress.isDefault) {
                const q = query(collection(db, 'addressBook'), where('addressClassID', '==', companyIdForAddress), where('addressType', '==', 'origin'), where('isDefault', '==', true));
                const defaultsSnapshot = await getDocs(q);
                const batchUpdates = defaultsSnapshot.docs.map(docSnapshot => updateDoc(doc(db, 'addressBook', docSnapshot.id), { isDefault: false }));
                await Promise.all(batchUpdates);
            }

            const addressDataToSave = { ...newAddress, addressClass: 'company', addressType: 'origin', addressClassID: companyIdForAddress, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
            const docRef = await addDoc(collection(db, 'addressBook'), addressDataToSave);
            const newSavedAddress = { ...addressDataToSave, id: docRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

            setShipFromAddresses(prev => [...prev, newSavedAddress]);
            setSelectedAddressId(docRef.id);

            const shipFromObject = mapAddressBookToShipFrom(newSavedAddress, companyData);
            updateFormSection('shipFrom', shipFromObject);
            console.log("ShipFrom: New address added and set as current shipFrom in context:", shipFromObject);

            setShowAddAddressForm(false);
            resetNewAddressForm();
            setSuccess('New origin address added and selected!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('ShipFrom: Error adding new address:', err);
            setError(err.message || 'Failed to add address.');
        } finally {
            setIsSubmittingNew(false);
        }
    }, [newAddress, companyIdForAddress, shipFromAddresses, checkDuplicateAddress, updateFormSection, companyData, mapAddressBookToShipFrom]);

    const handleSubmit = useCallback(() => {
        setError(null);
        const currentShipFrom = formData.shipFrom || {};
        let validationErrorMessages = [];

        console.log("ShipFrom handleSubmit: Validating currentShipFrom from context:", currentShipFrom);

        if (!selectedAddressId && !currentShipFrom.street) {
            validationErrorMessages.push('Please select or add a shipping origin address.');
        } else {
            const requiredFields = ['company', 'street', 'city', 'state', 'postalCode', 'country', 'contactName', 'contactPhone', 'contactEmail'];
            const missingFields = requiredFields.filter(field => !currentShipFrom[field] || String(currentShipFrom[field]).trim() === '');

            if (missingFields.length > 0) {
                missingFields.forEach(field => {
                    let fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                    if (field === 'contactPhone') fieldName = 'Contact Phone';
                    if (field === 'contactEmail') fieldName = 'Contact Email';
                    if (field === 'contactName') fieldName = 'Contact Name';
                    if (field === 'postalCode') fieldName = 'Postal Code';
                    validationErrorMessages.push(`Origin ${fieldName} is required.`);
                });
            }
        }

        if (validationErrorMessages.length > 0) {
            const errorMessage = validationErrorMessages.join(' \n ');
            setError(errorMessage);
            console.warn("ShipFrom handleSubmit: Validation failed:", validationErrorMessages);
            return;
        }

        console.log("ShipFrom handleSubmit: Validation passed. Calling onNext with data from context:", currentShipFrom);
        onNext(currentShipFrom);
    }, [selectedAddressId, formData.shipFrom, onNext, companyData]);

    const getAttentionLine = useCallback((address) => {
        if (!address) return '';

        const firstName = address.firstName || '';
        const lastName = address.lastName || '';

        if (firstName && lastName) {
            return `${firstName} ${lastName}`;
        } else if (firstName) {
            return firstName;
        } else if (lastName) {
            return lastName;
        }
        return '';
    }, []);

    return (
        <form className="ship-from-form">
            {error && (
                <Alert severity="error" sx={{ mb: 2, mt: 2 }}
                    onClose={() => setError(null)}
                >
                    {error.split(' \n ').map((line, index) => <div key={index}>{line}</div>)}
                </Alert>
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

                        {loadingAddresses ? (
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
                                            onClick={() => setShowAddAddressForm(false)}
                                            disabled={isSubmittingNew}
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
                                                onClick={() => setShowAddAddressForm(false)}
                                                disabled={isSubmittingNew}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-success"
                                                onClick={handleAddNewAddressSubmit}
                                                disabled={isSubmittingNew}
                                            >
                                                {isSubmittingNew ? (
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
                            value={formData.shipFrom?.specialInstructions || ''}
                            onChange={handleSelectedAddressInputChange}
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
                    disabled={!selectedAddressId && !formData.shipFrom?.street}
                >
                    Next <i className="bi bi-arrow-right ms-2"></i>
                </button>
            </div>
        </form>
    );
};

export default ShipFrom; 