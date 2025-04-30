import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../contexts/AuthContext';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import { Skeleton, Card, CardContent, Grid, Box, Typography, Chip, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import './ShipFrom.css';

const ShipFrom = ({ onNext, onPrevious }) => {
    const { currentUser } = useAuth();
    const { formData, updateFormSection } = useShipmentForm();
    const shipFromAddresses = formData.shipFrom?.shipFromAddresses || [];
    const [selectedAddressId, setSelectedAddressId] = useState(formData.shipFrom?.id || null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showAddAddressForm, setShowAddAddressForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
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

    const handleAddressChange = useCallback((addressId) => {
        const addressIdStr = addressId ? String(addressId) : null;
        console.log(`ShipFrom: handleAddressChange called with ID: "${addressIdStr}"`);
        if (!addressIdStr) return;

        setSelectedAddressId(addressIdStr);

        const selectedAddress = shipFromAddresses.find(addr => String(addr.id) === addressIdStr);

        if (selectedAddress) {
            console.log('Selected address found in context list:', selectedAddress);
            updateFormSection('shipFrom', {
                ...selectedAddress,
                id: addressIdStr,
                shipFromAddresses: shipFromAddresses
            });
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
            addr.street.toLowerCase() === address.street.toLowerCase() &&
            addr.city.toLowerCase() === address.city.toLowerCase() &&
            addr.state === address.state &&
            addr.postalCode === address.postalCode
        );
    }, [shipFromAddresses]);

    const nextLocalStep = () => {
        setCurrentStep(prev => Math.min(prev + 1, 3));
    };

    const prevLocalStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const resetLocalForm = () => {
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

            const requiredFields = ['name', 'company', 'street', 'city', 'state', 'postalCode', 'contactName', 'contactPhone', 'contactEmail'];
            const missingFields = requiredFields.filter(field => !newAddress[field]);
            if (missingFields.length > 0) throw new Error(`Please fill required fields: ${missingFields.join(', ')}`);
            if (checkDuplicateAddress(newAddress)) throw new Error('Address already exists');

            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (!userDoc.exists()) throw new Error('User data not found.');
            const userData = userDoc.data();
            const companyIdForUpdate = userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];
            if (!companyIdForUpdate) throw new Error('No company ID found.');

            const addressId = uuidv4();
            const addressToAdd = { ...newAddress, id: addressId, createdAt: new Date().toISOString() };

            let updatedAddressesForFirestore = [...shipFromAddresses];
            if (addressToAdd.isDefault || updatedAddressesForFirestore.length === 0) {
                updatedAddressesForFirestore = updatedAddressesForFirestore.map(addr => ({ ...addr, isDefault: false }));
                updatedAddressesForFirestore.push({ ...addressToAdd, isDefault: true });
            } else {
                updatedAddressesForFirestore.push(addressToAdd);
            }

            await updateDoc(doc(db, 'companies', companyIdForUpdate), {
                shipFromAddresses: updatedAddressesForFirestore
            });

            updateFormSection('shipFrom', {
                ...addressToAdd,
                id: addressId,
                shipFromAddresses: updatedAddressesForFirestore
            });
            setSelectedAddressId(addressId);
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
    }, [newAddress, shipFromAddresses, currentUser, checkDuplicateAddress, updateFormSection]);

    const handleSubmit = useCallback(() => {
        if (!selectedAddressId) {
            setError('Please select or add a shipping origin address');
            return;
        }
        setError(null);
        onNext();
    }, [selectedAddressId, onNext]);

    const currentShipFromData = formData.shipFrom || {};

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

                        {showAddAddressForm ? (
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
                                            <div className="col-md-6">
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
                                            <div className="col-md-6">
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
                                    shipFromAddresses.map((address, index) => {
                                        const addressId = address.id || `address_${index}`;
                                        const isSelected = addressId === selectedAddressId && selectedAddressId !== null;
                                        console.log(`Address ${address.name} (${addressId}): isSelected=${isSelected}, localSelectedId=${selectedAddressId}`);
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
                                                                        {address.name}
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
                                                                    {address.company}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={4}>
                                                                <Typography variant="body2">
                                                                    {address.street}
                                                                    {address.street2 && <>, {address.street2}</>}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {address.city}, {address.state} {address.postalCode}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={4}>
                                                                <Typography variant="body2">
                                                                    <Box component="span" fontWeight="500">Contact:</Box> {address.contactName}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    <Box component="span" fontWeight="500">Phone:</Box> {address.contactPhone}
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