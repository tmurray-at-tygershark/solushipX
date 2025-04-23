import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../contexts/AuthContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import { Skeleton, Card, CardContent, Grid, Box, Typography, Chip, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import './ShipFrom.css';

const ShipFrom = ({ onDataChange, onNext, onPrevious, apiKey }) => {
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
    const [isAddressesLoading, setIsAddressesLoading] = useState(true);

    // Fetch company data and addresses using cloud functions
    useEffect(() => {
        const fetchCompanyData = async () => {
            try {
                console.log('Current user:', currentUser);

                if (!currentUser) {
                    setError('User not logged in. Please log in to continue.');
                    setLoading(false);
                    return;
                }

                // First, fetch the user's data from the users collection to get the company ID
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

                try {
                    // Use the Firebase Functions SDK to call our cloud function
                    const functions = getFunctions();

                    // Configure region if needed
                    // const functions = getFunctions(app, 'us-central1');

                    const getCompanyShipmentOriginsFunction = httpsCallable(functions, 'getCompanyShipmentOrigins');

                    // Create object with just companyId - no API key needed
                    const requestData = {
                        companyId: companyId
                    };

                    console.log('Making cloud function call with company ID:', companyId);

                    // Implement a retry mechanism
                    let response;
                    let retryCount = 0;
                    const maxRetries = 3;

                    while (retryCount < maxRetries) {
                        try {
                            // Call the function with the request data
                            console.log(`Attempt ${retryCount + 1}: Calling function with data:`, JSON.stringify(requestData));

                            // Set a timeout to prevent hanging forever
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Function call timed out')), 30000)
                            );

                            // Race between the function call and timeout
                            response = await Promise.race([
                                getCompanyShipmentOriginsFunction(requestData),
                                timeoutPromise
                            ]);

                            console.log('Cloud function response received:', response);
                            break; // Success, exit the retry loop
                        } catch (callError) {
                            retryCount++;
                            console.error(`Cloud function call attempt ${retryCount} failed:`, callError);
                            console.error('Error details:', {
                                message: callError.message,
                                code: callError.code,
                                details: callError.details,
                                stack: callError.stack
                            });

                            if (retryCount >= maxRetries) {
                                throw callError; // Rethrow if max retries reached
                            }

                            // Wait before retrying (exponential backoff)
                            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                        }
                    }

                    // Check if the call was successful
                    if (!response.data.success) {
                        throw new Error(response.data.error?.message || 'Failed to fetch company addresses');
                    }

                    // Get the data from the response
                    const { shipFromAddresses } = response.data.data;

                    console.log('Received shipFromAddresses:', shipFromAddresses);

                    // Update state with the addresses and ensure all addresses have IDs
                    const processedAddresses = (shipFromAddresses || []).map((addr, index) => {
                        // Ensure each address has an ID (use index as fallback)
                        if (!addr.id) {
                            console.log(`Address "${addr.name}" is missing ID, using index ${index} as fallback`);
                            return { ...addr, id: `address_${index}` };
                        }
                        return addr;
                    });
                    setCompanyAddresses(processedAddresses);

                    // Find and set default address
                    const defaultAddress = processedAddresses.find(addr => addr.isDefault);
                    if (defaultAddress?.id) {
                        // Convert ID to string without trimming
                        const defaultAddressId = String(defaultAddress.id);
                        console.log(`Setting default address ID to: "${defaultAddressId}"`);

                        // Verify the default address exists in the list before setting it
                        if (processedAddresses.some(addr => addr.id && String(addr.id) === defaultAddressId)) {
                            // Set the selected address ID directly without setting to null first
                            setSelectedAddressId(defaultAddressId);
                            console.log(`Default address verified and set to: ${defaultAddressId}`);

                            // Update form data with the default address
                            setFormData(defaultAddress);
                        } else {
                            console.warn('Default address ID not found in loaded addresses');
                        }
                    }
                } catch (err) {
                    console.error('Error fetching company data:', err);
                    setError('Failed to load company data. Please try again or contact support.');
                } finally {
                    setLoading(false);
                    setIsAddressesLoading(false);
                }
            } catch (err) {
                console.error('Error fetching company data:', err);
                setError('Failed to load company data. Please try again or contact support.');
                setLoading(false);
                setIsAddressesLoading(false);
            }
        };

        if (currentUser) {
            fetchCompanyData();
        }
    }, [currentUser]);

    // Debug log to confirm API key is properly passed from parent
    console.log('ShipFrom component received API key:', {
        received: !!apiKey,
        length: apiKey?.length || 0,
        firstFive: apiKey ? apiKey.substring(0, 5) : 'undefined',
        lastFive: apiKey ? apiKey.substring(apiKey.length - 5) : 'undefined',
        type: typeof apiKey
    });

    // Debug log to see the current selectedAddressId in component state
    console.log('Current selectedAddressId in component state:', {
        selectedAddressId,
        type: typeof selectedAddressId,
        nullCheck: selectedAddressId === null,
        length: selectedAddressId?.length || 0
    });

    const handleAddressChange = useCallback((addressId, addressIndex) => {
        // If addressId is null/undefined but index is provided, use index as fallback
        if ((!addressId || addressId === 'undefined') && addressIndex !== undefined) {
            addressId = `address_${addressIndex}`;
            console.log(`Using fallback ID: ${addressId} based on index ${addressIndex}`);
        }

        // Simple validation and conversion
        if (!addressId) {
            console.error('Address ID is null or undefined and no index fallback provided');
            return;
        }

        // Convert to string format consistently
        const addressIdStr = String(addressId);
        console.log(`Attempting to set selected address ID to: "${addressIdStr}"`);

        // Set the state directly
        setSelectedAddressId(addressIdStr);
        console.log(`Set selectedAddressId state to: "${addressIdStr}"`);

        // Find and update form data - try ID first, then fallback to position
        let selectedAddress = companyAddresses.find(addr =>
            addr.id && String(addr.id) === addressIdStr
        );

        // If not found by ID, try to find by index if it was an index-based ID
        if (!selectedAddress && addressIdStr.startsWith('address_')) {
            const index = parseInt(addressIdStr.replace('address_', ''));
            if (!isNaN(index) && index < companyAddresses.length) {
                selectedAddress = companyAddresses[index];
            }
        }

        if (selectedAddress) {
            setFormData(selectedAddress);
            // Notify parent component
            onDataChange(selectedAddress);
            console.log('Selected address found and form updated:', selectedAddress.name);
        } else {
            console.error('No matching address found for ID:', addressIdStr);
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

    const nextStep = () => {
        setCurrentStep(prev => Math.min(prev + 1, 3));
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const resetForm = () => {
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

            // Get the user's data to find company ID
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (!userDoc.exists()) {
                throw new Error('User data not found. Please contact support.');
            }

            const userData = userDoc.data();
            const companyId = userData.connectedCompanies?.companies?.[0];

            if (!companyId) {
                throw new Error('No company ID found. Please contact support.');
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
                await updateDoc(doc(db, 'companies', companyId), {
                    shipFromAddresses: updatedAddresses
                });
                setCompanyAddresses(updatedAddresses);
                setSelectedAddressId(addressId);
                setFormData(addressToAdd);
                setTimeout(() => onDataChange(addressToAdd), 0);
            } else {
                await updateDoc(doc(db, 'companies', companyId), {
                    shipFromAddresses: arrayUnion(addressToAdd)
                });
                setCompanyAddresses(prev => [...prev, addressToAdd]);
            }

            setShowAddAddressForm(false);
            resetForm();
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
            <div className="ship-from-skeleton">
                <div className="card shadow-sm mb-4">
                    <div className="card-body">
                        <Skeleton variant="text" width="40%" height={40} style={{ marginBottom: '24px' }} />

                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <Skeleton variant="text" width="30%" height={30} />
                            <Skeleton variant="rectangular" width={150} height={36} />
                        </div>

                        <div className="address-list-skeleton">
                            {isAddressesLoading && (
                                <div className="address-list-skeleton">
                                    {[1, 2, 3].map((key) => (
                                        <div key={key} className="mb-2">
                                            <Card sx={{ width: '100%', p: 2 }}>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} sm={3}>
                                                        <Skeleton variant="text" width="70%" height={28} />
                                                        <Skeleton variant="text" width="50%" />
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Skeleton variant="text" width="90%" />
                                                        <Skeleton variant="text" width="60%" />
                                                    </Grid>
                                                    <Grid item xs={12} sm={3}>
                                                        <Skeleton variant="text" width="80%" />
                                                        <Skeleton variant="text" width="70%" />
                                                    </Grid>
                                                    <Grid item xs={12} sm={2} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                                                        <Skeleton variant="rectangular" width={80} height={32} sx={{ ml: { xs: 0, sm: 'auto' } }} />
                                                    </Grid>
                                                </Grid>
                                            </Card>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-4">
                            <Skeleton variant="text" width="30%" height={24} style={{ marginBottom: '8px' }} />
                            <Skeleton variant="rectangular" width="100%" height={100} />
                        </div>
                    </div>
                </div>

                <div className="navigation-buttons d-flex justify-content-between mt-4">
                    <Skeleton variant="rectangular" width={120} height={40} />
                    <Skeleton variant="rectangular" width={120} height={40} />
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
                                {isAddressesLoading && (
                                    <div className="address-list-skeleton">
                                        {[1, 2, 3].map((key) => (
                                            <div key={key} className="mb-2">
                                                <Card sx={{ width: '100%', p: 2 }}>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={12} sm={3}>
                                                            <Skeleton variant="text" width="70%" height={28} />
                                                            <Skeleton variant="text" width="50%" />
                                                        </Grid>
                                                        <Grid item xs={12} sm={4}>
                                                            <Skeleton variant="text" width="90%" />
                                                            <Skeleton variant="text" width="60%" />
                                                        </Grid>
                                                        <Grid item xs={12} sm={3}>
                                                            <Skeleton variant="text" width="80%" />
                                                            <Skeleton variant="text" width="70%" />
                                                        </Grid>
                                                        <Grid item xs={12} sm={2} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                                                            <Skeleton variant="rectangular" width={80} height={32} sx={{ ml: { xs: 0, sm: 'auto' } }} />
                                                        </Grid>
                                                    </Grid>
                                                </Card>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!isAddressesLoading && (
                                    <>
                                        {companyAddresses.length > 0 ? (
                                            <div className="address-list">
                                                {companyAddresses.map((address, index) => {
                                                    // Generate a fallback ID if needed
                                                    const addressId = address.id || `address_${index}`;
                                                    // Simple string conversion for comparison
                                                    const stateId = String(selectedAddressId || '');
                                                    const isSelected = addressId === stateId && selectedAddressId !== null;

                                                    // Log selection state for debugging
                                                    console.log(`Address ${address.name} (${addressId}): isSelected=${isSelected}, selectedId=${stateId}`);

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
                                                                onClick={() => handleAddressChange(addressId, index)}
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
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                                    No saved addresses found
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    startIcon={<AddIcon />}
                                                    onClick={() => setShowAddAddressForm(true)}
                                                >
                                                    Add Your First Address
                                                </Button>
                                            </div>
                                        )}
                                    </>
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