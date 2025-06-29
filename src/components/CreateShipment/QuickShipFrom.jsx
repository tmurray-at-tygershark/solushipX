import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import {
    Skeleton,
    Card,
    CardContent,
    Grid,
    Box,
    Typography,
    Chip,
    Button,
    Alert,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import {
    Add as AddIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { getCountryFlag } from '../Shipments/utils/shipmentHelpers';

const QuickShipFrom = ({ onNext }) => {
    const { currentUser } = useAuth();
    const { companyData, companyIdForAddress, loading: companyLoading } = useCompany();
    const { formData, updateFormSection } = useShipmentForm();
    const [shipFromAddresses, setShipFromAddresses] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState(formData.shipFrom?.id || null);
    const [confirmedAddressId, setConfirmedAddressId] = useState(formData.shipFrom?.id || null);
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
        isDefault: false,
        specialInstructions: ''
    });

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

    useEffect(() => {
        const fetchAddresses = async () => {
            if (!companyIdForAddress) {
                setShipFromAddresses([]);
                setLoadingAddresses(false);
                return;
            }

            setLoadingAddresses(true);
            setError(null);
            try {
                const addressesQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'company'),
                    where('addressType', '==', 'origin'), // This should ONLY return origin addresses
                    where('addressClassID', '==', companyIdForAddress),
                    where('status', '!=', 'deleted')
                );

                console.log('🔍 QuickShipFrom: Database query parameters:', {
                    collection: 'addressBook',
                    addressClass: 'company',
                    addressType: 'origin', // CRITICAL: Only origin addresses should be returned
                    addressClassID: companyIdForAddress,
                    statusFilter: 'not deleted'
                });

                console.log('QuickShipFrom: Querying addresses with companyIdForAddress:', companyIdForAddress);

                const addressesSnapshot = await getDocs(addressesQuery);

                console.log('QuickShipFrom: Raw query results:', addressesSnapshot.docs.length, 'documents');

                // Log ALL raw addresses from database to debug what's actually being returned
                console.log('🔍 QuickShipFrom: ALL RAW ADDRESSES FROM DATABASE:');
                addressesSnapshot.docs.forEach(doc => {
                    const addr = doc.data();
                    console.log('📋 Raw DB Address:', {
                        id: doc.id,
                        nickname: addr.nickname,
                        companyName: addr.companyName,
                        address1: addr.address1,
                        addressClass: addr.addressClass,
                        addressType: addr.addressType,
                        addressClassID: addr.addressClassID,
                        status: addr.status
                    });
                });

                const fetchedAddresses = addressesSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(addr => {
                        // ULTRA STRICT FILTERING - Only pickup/origin addresses
                        const isValid = (
                            addr.addressClass === 'company' &&
                            addr.addressType === 'origin' && // MUST be 'origin' - NOT 'contact' or 'destination'
                            addr.addressClassID === companyIdForAddress &&
                            addr.status !== 'deleted' &&
                            // Ensure it's a real shipping address with physical location
                            addr.companyName &&
                            addr.address1 &&
                            addr.city &&
                            addr.stateProv &&
                            addr.zipPostal &&
                            // Additional safety check - exclude contact-type records
                            addr.addressType !== 'contact' &&
                            addr.addressType !== 'destination'
                        );

                        if (!isValid) {
                            const issues = [];
                            if (addr.addressClass !== 'company') issues.push(`addressClass: ${addr.addressClass} (expected: company)`);
                            if (addr.addressType !== 'origin') issues.push(`addressType: ${addr.addressType} (expected: origin, NOT contact/destination)`);
                            if (addr.addressType === 'contact') issues.push('BLOCKED: contact type address');
                            if (addr.addressType === 'destination') issues.push('BLOCKED: destination type address');
                            if (addr.addressClassID !== companyIdForAddress) issues.push(`addressClassID: ${addr.addressClassID} (expected: ${companyIdForAddress})`);
                            if (addr.status === 'deleted') issues.push('status: deleted');
                            if (!addr.companyName) issues.push('missing companyName');
                            if (!addr.address1) issues.push('missing address1');
                            if (!addr.city) issues.push('missing city');
                            if (!addr.stateProv) issues.push('missing stateProv');
                            if (!addr.zipPostal) issues.push('missing zipPostal');

                            console.warn('❌ QuickShipFrom: BLOCKING address:', {
                                id: addr.id,
                                nickname: addr.nickname,
                                companyName: addr.companyName,
                                address1: addr.address1,
                                addressType: addr.addressType,
                                issues: issues
                            });
                        } else {
                            console.log('✅ QuickShipFrom: ALLOWING address:', {
                                id: addr.id,
                                nickname: addr.nickname,
                                companyName: addr.companyName,
                                address1: addr.address1,
                                addressType: addr.addressType
                            });
                        }

                        return isValid;
                    });

                console.log('QuickShipFrom: Filtered addresses:', fetchedAddresses.length, 'valid addresses');

                fetchedAddresses.forEach(addr => {
                    console.log('QuickShipFrom: Valid address:', {
                        id: addr.id,
                        nickname: addr.nickname,
                        companyName: addr.companyName,
                        address1: addr.address1,
                        city: addr.city,
                        stateProv: addr.stateProv,
                        zipPostal: addr.zipPostal
                    });
                });

                setShipFromAddresses(fetchedAddresses);

                const currentShipFrom = formData.shipFrom || {};
                const hasExistingData = currentShipFrom.id || currentShipFrom.street || currentShipFrom.company;

                if (hasExistingData) {
                    if (currentShipFrom.id) {
                        const matchingAddress = fetchedAddresses.find(addr => addr.id === currentShipFrom.id);
                        if (matchingAddress) {
                            setSelectedAddressId(currentShipFrom.id);
                            setConfirmedAddressId(currentShipFrom.id);
                        } else {
                            const matchingByAddress = fetchedAddresses.find(addr =>
                                addr.address1?.toLowerCase() === currentShipFrom.street?.toLowerCase() &&
                                addr.city?.toLowerCase() === currentShipFrom.city?.toLowerCase() &&
                                addr.stateProv === currentShipFrom.state &&
                                addr.zipPostal === currentShipFrom.postalCode &&
                                addr.companyName?.toLowerCase() === currentShipFrom.company?.toLowerCase()
                            );
                            if (matchingByAddress) {
                                setSelectedAddressId(matchingByAddress.id);
                                setConfirmedAddressId(matchingByAddress.id);
                                updateFormSection('shipFrom', { ...currentShipFrom, id: matchingByAddress.id });
                            } else {
                                setSelectedAddressId(null);
                                setConfirmedAddressId(null);
                            }
                        }
                    }
                } else if (fetchedAddresses.length > 0) {
                    const defaultAddressDoc = fetchedAddresses.find(addr => addr.isDefault) || fetchedAddresses[0];
                    if (defaultAddressDoc) {
                        const defaultSelectedOrigin = mapAddressBookToShipFrom(defaultAddressDoc, companyData);
                        updateFormSection('shipFrom', defaultSelectedOrigin);
                        setSelectedAddressId(defaultSelectedOrigin.id);
                        setConfirmedAddressId(defaultSelectedOrigin.id);
                    }
                } else {
                    console.log('QuickShipFrom: No valid addresses found for company:', companyIdForAddress);
                    setSelectedAddressId(null);
                    setConfirmedAddressId(null);
                }
            } catch (err) {
                console.error('QuickShipFrom: Error fetching addresses:', err);
                setError(err.message || 'Failed to fetch shipping addresses.');
                setShipFromAddresses([]);
            } finally {
                setLoadingAddresses(false);
            }
        };
        fetchAddresses();
    }, [companyIdForAddress, companyData, formData.shipFrom?.id, updateFormSection]);

    const handleAddressChange = useCallback(async (addressId) => {
        const selectedDbAddress = shipFromAddresses.find(addr => addr.id === addressId);
        if (selectedDbAddress) {
            setSelectedAddressId(addressId);
            // Don't immediately update form section or call onNext - let user confirm first
        }
    }, [shipFromAddresses]);

    const handleChangeAddress = useCallback(() => {
        setConfirmedAddressId(null);
        setSelectedAddressId(null);
        setDropdownOpen(true); // Open dropdown for new selection
        updateFormSection('shipFrom', {}); // Clear the form section
    }, [updateFormSection]);

    const handleDropdownChange = useCallback((event) => {
        const addressId = event.target.value;
        if (addressId) {
            // Immediately confirm the selection - no need for separate confirmation step
            const selectedDbAddress = shipFromAddresses.find(addr => addr.id === addressId);
            if (selectedDbAddress) {
                setSelectedAddressId(addressId);
                setConfirmedAddressId(addressId);
                const shipFromObject = mapAddressBookToShipFrom(selectedDbAddress, companyData);
                updateFormSection('shipFrom', shipFromObject);
                setDropdownOpen(false);

                // Auto-submit when address is selected
                if (onNext) {
                    setTimeout(() => onNext(shipFromObject), 100);
                }
            }
        }
    }, [shipFromAddresses, companyData, updateFormSection, onNext]);

    const handleSelectedAddressInputChange = useCallback((e) => {
        const { name, value } = e.target;
        updateFormSection('shipFrom', { ...formData.shipFrom, [name]: value });
    }, [formData.shipFrom, updateFormSection]);

    const handleNewAddressChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setNewAddress(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }, []);

    const handleAddNewAddressSubmit = useCallback(async () => {
        setIsSubmittingNew(true);
        setError(null);
        setSuccess(null);
        try {
            if (!companyIdForAddress) throw new Error('Company ID not found. Cannot save address.');

            const requiredFields = ['nickname', 'companyName', 'address1', 'city', 'stateProv', 'zipPostal', 'country', 'firstName', 'lastName', 'phone', 'email'];
            const missingFields = requiredFields.filter(field => !newAddress[field]?.trim());
            if (missingFields.length > 0) throw new Error(`Please fill all required fields: ${missingFields.join(', ')}`);

            if (newAddress.isDefault) {
                const q = query(collection(db, 'addressBook'), where('addressClassID', '==', companyIdForAddress), where('addressType', '==', 'origin'), where('isDefault', '==', true));
                const defaultsSnapshot = await getDocs(q);
                const batchUpdates = defaultsSnapshot.docs.map(docSnapshot => updateDoc(doc(db, 'addressBook', docSnapshot.id), { isDefault: false }));
                await Promise.all(batchUpdates);
            }

            const addressDataToSave = {
                ...newAddress,
                addressClass: 'company',
                addressType: 'origin',
                addressClassID: companyIdForAddress,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, 'addressBook'), addressDataToSave);
            const newSavedAddress = { ...addressDataToSave, id: docRef.id };

            setShipFromAddresses(prev => [...prev, newSavedAddress]);
            setSelectedAddressId(docRef.id);
            setConfirmedAddressId(docRef.id); // Immediately confirm new addresses

            const shipFromObject = mapAddressBookToShipFrom(newSavedAddress, companyData);
            updateFormSection('shipFrom', shipFromObject);

            setShowAddAddressForm(false);
            setNewAddress({
                nickname: '', companyName: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '',
                country: 'US', firstName: '', lastName: '', phone: '', email: '', isDefault: false, specialInstructions: ''
            });
            setSuccess('New origin address added and selected!');
            setTimeout(() => setSuccess(null), 3000);

            // Auto-submit when new address is added
            if (onNext) {
                setTimeout(() => onNext(shipFromObject), 100);
            }
        } catch (err) {
            console.error('QuickShipFrom: Error adding new address:', err);
            setError(err.message || 'Failed to add address.');
        } finally {
            setIsSubmittingNew(false);
        }
    }, [newAddress, companyIdForAddress, companyData, updateFormSection, onNext]);

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
        <Box sx={{ p: 3 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    <Typography sx={{ fontSize: '12px' }}>{error}</Typography>
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                    <Typography sx={{ fontSize: '12px' }}>{success}</Typography>
                </Alert>
            )}

            <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600, mb: 2, color: '#374151' }}>
                Pickup Location
            </Typography>

            {/* Only show dropdown interface when no address is confirmed */}
            {!confirmedAddressId && (
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <FormControl fullWidth size="small" sx={{ mr: 2 }}>
                            <InputLabel sx={{ fontSize: '12px' }}>Select Pickup Location</InputLabel>
                            <Select
                                value={selectedAddressId || ''}
                                onChange={handleDropdownChange}
                                label="Select Pickup Location"
                                open={dropdownOpen}
                                onOpen={() => setDropdownOpen(true)}
                                onClose={() => setDropdownOpen(false)}
                                sx={{
                                    '& .MuiSelect-select': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            >
                                {!selectedAddressId && (
                                    <MenuItem value="" disabled sx={{ fontSize: '12px', fontStyle: 'italic', color: '#9ca3af' }}>
                                        Choose a pickup location...
                                    </MenuItem>
                                )}
                                {shipFromAddresses.map((address) => (
                                    <MenuItem key={address.id} value={address.id} sx={{ fontSize: '12px' }}>
                                        <Box sx={{ width: '100%' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>
                                                {address.nickname || 'Origin Address'}
                                                {address.isDefault && (
                                                    <Chip
                                                        label="Default"
                                                        size="small"
                                                        sx={{
                                                            fontSize: '9px',
                                                            height: '16px',
                                                            bgcolor: '#dcfdf7',
                                                            color: '#065f46',
                                                            ml: 1
                                                        }}
                                                    />
                                                )}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {address.companyName && `${address.companyName} • `}
                                                {address.address1}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                                {address.city}, {address.stateProv} {address.zipPostal} {getCountryFlag(address.country)}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {!showAddAddressForm && (
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setShowAddAddressForm(true)}
                                sx={{ fontSize: '12px', minWidth: '100px' }}
                            >
                                Add New
                            </Button>
                        )}
                    </Box>
                </Box>
            )}

            {loadingAddresses ? (
                <Box sx={{ py: 2 }}>
                    <Skeleton variant="rectangular" height={80} sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" height={80} />
                </Box>
            ) : confirmedAddressId ? (
                /* Show confirmed selected address with change button */
                (() => {
                    const confirmedAddress = shipFromAddresses.find(addr => addr.id === confirmedAddressId);
                    if (!confirmedAddress) return null;
                    const attentionLine = getAttentionLine(confirmedAddress);

                    return (
                        <Card sx={{
                            borderColor: '#10b981',
                            border: '2px solid #10b981',
                            borderLeft: '6px solid #10b981',
                            bgcolor: 'rgba(16, 185, 129, 0.08)',
                            borderRadius: '8px',
                            position: 'relative'
                        }}>
                            <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Box sx={{ flex: 1 }}>
                                        {/* Header */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
                                                    {confirmedAddress.nickname || 'Origin Address'}
                                                </Typography>
                                                <Chip
                                                    label="Selected"
                                                    size="small"
                                                    sx={{
                                                        fontSize: '10px',
                                                        height: '20px',
                                                        bgcolor: '#d1fae5',
                                                        color: '#065f46'
                                                    }}
                                                />
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {confirmedAddress.isDefault && (
                                                    <Chip
                                                        label="Default"
                                                        size="small"
                                                        sx={{
                                                            fontSize: '10px',
                                                            height: '20px',
                                                            bgcolor: '#dcfdf7',
                                                            color: '#065f46'
                                                        }}
                                                    />
                                                )}
                                                <Typography sx={{ fontSize: '16px' }}>
                                                    {getCountryFlag(confirmedAddress.country)}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* Address details */}
                                        <Grid container spacing={1}>
                                            <Grid item xs={12} md={4}>
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                    Company:
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                    {confirmedAddress.companyName}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                    Address:
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                    {confirmedAddress.address1}
                                                    {confirmedAddress.address2 && `, ${confirmedAddress.address2}`}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                    Location:
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                    {confirmedAddress.city}, {confirmedAddress.stateProv} {confirmedAddress.zipPostal}
                                                </Typography>
                                            </Grid>
                                        </Grid>

                                        {attentionLine && (
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af', mt: 1 }}>
                                                Contact: {attentionLine}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                {/* Change address button */}
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleChangeAddress}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Change Address
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    );
                })()
            ) : (
                /* Show dropdown prompt */
                <Box>
                    {shipFromAddresses.length > 0 ? (
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f9fafb', border: '1px dashed #d1d5db' }}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Use the dropdown above to select a pickup location
                                {shipFromAddresses.length === 1 ? '' : ` (${shipFromAddresses.length} available)`}
                            </Typography>
                        </Paper>
                    ) : (
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f9fafb', border: '1px dashed #d1d5db' }}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                No pickup locations available.
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={() => setShowAddAddressForm(true)}
                                    sx={{ fontSize: '12px', p: 0, minWidth: 'auto', ml: 0.5 }}
                                >
                                    Add a new location
                                </Button>
                            </Typography>
                        </Paper>
                    )}
                </Box>
            )}

            {/* Add New Address Dialog */}
            <Dialog
                open={showAddAddressForm}
                onClose={() => setShowAddAddressForm(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '14px', fontWeight: 600 }}>
                    Add New Pickup Location
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Location Nickname"
                                name="nickname"
                                value={newAddress.nickname}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Company Name"
                                name="companyName"
                                value={newAddress.companyName}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Street Address"
                                name="address1"
                                value={newAddress.address1}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Address Line 2 (Optional)"
                                name="address2"
                                value={newAddress.address2}
                                onChange={handleNewAddressChange}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                label="City"
                                name="city"
                                value={newAddress.city}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>State/Province</InputLabel>
                                <Select
                                    name="stateProv"
                                    value={newAddress.stateProv}
                                    onChange={handleNewAddressChange}
                                    label="State/Province"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {getStateOptions(newAddress.country).map(({ value, label }) => (
                                        <MenuItem key={value} value={value} sx={{ fontSize: '12px' }}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Postal Code"
                                name="zipPostal"
                                value={newAddress.zipPostal}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                <Select
                                    name="country"
                                    value={newAddress.country}
                                    onChange={handleNewAddressChange}
                                    label="Country"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="First Name"
                                name="firstName"
                                value={newAddress.firstName}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Last Name"
                                name="lastName"
                                value={newAddress.lastName}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Phone"
                                name="phone"
                                value={newAddress.phone}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Email"
                                name="email"
                                value={newAddress.email}
                                onChange={handleNewAddressChange}
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        name="isDefault"
                                        checked={newAddress.isDefault}
                                        onChange={handleNewAddressChange}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Set as default pickup location</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setShowAddAddressForm(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAddNewAddressSubmit}
                        variant="contained"
                        disabled={isSubmittingNew}
                        sx={{ fontSize: '12px' }}
                    >
                        {isSubmittingNew ? 'Adding...' : 'Add Location'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default QuickShipFrom; 