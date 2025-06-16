import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, limit, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Paper,
    Container,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Close as CloseIcon,
    ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import './ShipFrom.css';
import { getCountryFlag } from '../Shipments/utils/shipmentHelpers';

const ShipFrom = ({ onNext, onPrevious }) => {
    const { currentUser } = useAuth();
    const { companyData, companyIdForAddress, loading: companyLoading } = useCompany();
    const { formData, updateFormSection } = useShipmentForm();
    const [shipFromAddresses, setShipFromAddresses] = useState([]);
    const [filteredAddresses, setFilteredAddresses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
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
                    where('addressClassID', '==', companyIdForAddress),
                    where('status', '!=', 'deleted')
                );
                const addressesSnapshot = await getDocs(addressesQuery);
                const fetchedAddresses = addressesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`ShipFrom: Found ${fetchedAddresses.length} origin addresses from addressBook:`, fetchedAddresses);
                setShipFromAddresses(fetchedAddresses);
                setFilteredAddresses(fetchedAddresses);

                // Enhanced logic to handle partial draft data and pre-populated data
                const currentShipFrom = formData.shipFrom || {};
                const hasExistingData = currentShipFrom.id || currentShipFrom.street || currentShipFrom.company;

                console.log("ShipFrom: Current shipFrom data:", currentShipFrom);
                console.log("ShipFrom: Has existing data:", hasExistingData);

                if (hasExistingData) {
                    // If we have existing data, try to match it with an address from the list
                    if (currentShipFrom.id) {
                        // First try to match by exact ID
                        const matchingAddress = fetchedAddresses.find(addr => addr.id === currentShipFrom.id);
                        if (matchingAddress) {
                            console.log("ShipFrom: Found matching address for existing ID:", matchingAddress);
                            setSelectedAddressId(currentShipFrom.id);
                        } else {
                            console.log("ShipFrom: No matching address found for ID, trying address matching");
                            // Try to match by address details (for pre-populated data)
                            const matchingByAddress = fetchedAddresses.find(addr =>
                                addr.address1?.toLowerCase() === currentShipFrom.street?.toLowerCase() &&
                                addr.city?.toLowerCase() === currentShipFrom.city?.toLowerCase() &&
                                addr.stateProv === currentShipFrom.state &&
                                addr.zipPostal === currentShipFrom.postalCode &&
                                addr.companyName?.toLowerCase() === currentShipFrom.company?.toLowerCase()
                            );

                            if (matchingByAddress) {
                                console.log("ShipFrom: Found matching address by details:", matchingByAddress);
                                setSelectedAddressId(matchingByAddress.id);
                                // Update the form data with the correct ID
                                updateFormSection('shipFrom', { ...currentShipFrom, id: matchingByAddress.id });
                            } else {
                                console.log("ShipFrom: No matching address found, keeping current data as custom entry");
                                setSelectedAddressId(null);
                            }
                        }
                    } else {
                        // No ID but has other data - try to match by address details
                        console.log("ShipFrom: Trying to match pre-populated data by address details");
                        const matchingByAddress = fetchedAddresses.find(addr =>
                            addr.address1?.toLowerCase() === currentShipFrom.street?.toLowerCase() &&
                            addr.city?.toLowerCase() === currentShipFrom.city?.toLowerCase() &&
                            addr.stateProv === currentShipFrom.state &&
                            addr.zipPostal === currentShipFrom.postalCode &&
                            addr.companyName?.toLowerCase() === currentShipFrom.company?.toLowerCase()
                        );

                        if (matchingByAddress) {
                            console.log("ShipFrom: Found matching address by details for pre-populated data:", matchingByAddress);
                            setSelectedAddressId(matchingByAddress.id);
                            // Update the form data with the matched address including ID
                            const mappedAddress = mapAddressBookToShipFrom(matchingByAddress, companyData);
                            updateFormSection('shipFrom', mappedAddress);
                        } else {
                            console.log("ShipFrom: No matching address found, keeping as custom entry");
                            setSelectedAddressId(null);
                        }
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
                setFilteredAddresses([]);
            } finally {
                setLoadingAddresses(false);
            }
        };
        fetchAddresses();
    }, [companyIdForAddress, companyData, formData.shipFrom?.id, formData.shipFrom?.street, formData.shipFrom?.company, updateFormSection]); // Added updateFormSection to dependencies

    // Search functionality
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredAddresses(shipFromAddresses);
        } else {
            const filtered = shipFromAddresses.filter(address =>
                address.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.address1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                `${address.firstName} ${address.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredAddresses(filtered);
        }
    }, [searchTerm, shipFromAddresses]);

    const handleSearchChange = useCallback((e) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleAddressChange = useCallback(async (addressId) => {
        const selectedDbAddress = shipFromAddresses.find(addr => addr.id === addressId);
        if (selectedDbAddress) {
            console.log('🏠 ShipFrom: Address card clicked:', selectedDbAddress);
            setSelectedAddressId(addressId);
            const shipFromObject = mapAddressBookToShipFrom(selectedDbAddress, companyData);

            // Populate special instructions if they exist
            if (selectedDbAddress.specialInstructions) {
                shipFromObject.specialInstructions = selectedDbAddress.specialInstructions;
            }

            console.log('🏠 ShipFrom: Mapped shipFromObject:', shipFromObject);
            updateFormSection('shipFrom', shipFromObject);
            console.log("🏠 ShipFrom: Context updated with selected address");

            // Verify the update worked
            setTimeout(() => {
                console.log("🏠 ShipFrom: Verification - formData.shipFrom after update:", formData.shipFrom);
            }, 100);
        } else {
            console.error('❌ ShipFrom: Could not find address with ID:', addressId);
        }
    }, [shipFromAddresses, companyData, updateFormSection, formData.shipFrom]);

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
        setNewAddress({ nickname: '', companyName: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'US', firstName: '', lastName: '', phone: '', email: '', isDefault: false, specialInstructions: '' });
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

            const addressDataToSave = { ...newAddress, addressClass: 'company', addressType: 'origin', addressClassID: companyIdForAddress, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
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

        console.log("🔍 ShipFrom handleSubmit: Starting validation");
        console.log("🔍 selectedAddressId:", selectedAddressId);
        console.log("🔍 currentShipFrom from context:", currentShipFrom);
        console.log("🔍 formData.shipFrom:", formData.shipFrom);

        if (!selectedAddressId && !currentShipFrom.street) {
            validationErrorMessages.push('Please select or add a shipping origin address.');
            console.log("❌ No address selected and no street in currentShipFrom");
        } else {
            const requiredFields = ['company', 'street', 'city', 'state', 'postalCode', 'country', 'contactName', 'contactPhone', 'contactEmail'];
            const missingFields = requiredFields.filter(field => {
                const fieldValue = currentShipFrom[field];
                const isEmpty = !fieldValue || String(fieldValue).trim() === '';
                if (isEmpty) {
                    console.log(`❌ Missing field: ${field} = "${fieldValue}"`);
                }
                return isEmpty;
            });

            console.log("🔍 Required fields check:", {
                requiredFields,
                missingFields,
                currentShipFromKeys: Object.keys(currentShipFrom)
            });

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
            console.warn("❌ ShipFrom handleSubmit: Validation failed:", validationErrorMessages);
            return;
        }

        console.log("✅ ShipFrom handleSubmit: Validation passed. Calling onNext with data:", currentShipFrom);
        console.log("🚀 About to call onNext...");
        onNext(currentShipFrom);
        console.log("✅ onNext called successfully");
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
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error.split(' \n ').map((line, index) => <div key={index} style={{ fontSize: '12px' }}>{line}</div>)}
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
                    <Typography sx={{ fontSize: '12px' }}>{success}</Typography>
                </Alert>
            )}

            <Paper sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Pickup Location
                    </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search pickup locations..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: '#666', fontSize: '20px' }} />
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '12px' }
                            }}
                            sx={{ mr: 2, maxWidth: '400px' }}
                        />
                        {!showAddAddressForm && (
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setShowAddAddressForm(true)}
                                sx={{ fontSize: '12px', minWidth: '140px' }}
                            >
                                Add New
                            </Button>
                        )}
                    </Box>

                    {loadingAddresses ? (
                        <Box sx={{ py: 4 }}>
                            <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
                            <Skeleton variant="rectangular" height={100} />
                        </Box>
                    ) : (
                        <Box>
                            {filteredAddresses.length > 0 ? (
                                filteredAddresses.map((address) => {
                                    const addressId = address.id;
                                    const isSelected = addressId === selectedAddressId && selectedAddressId !== null;
                                    const attentionLine = getAttentionLine(address);

                                    return (
                                        <Card
                                            key={addressId}
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
                                        >
                                            <CardContent sx={{ p: 2, position: 'relative' }}>
                                                {/* Country Flag */}
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 12,
                                                        right: 12,
                                                        fontSize: '20px',
                                                        opacity: 0.8,
                                                        transition: 'opacity 0.2s ease',
                                                        '&:hover': {
                                                            opacity: 1
                                                        }
                                                    }}
                                                    title={address.country === 'US' ? 'United States' : address.country === 'CA' ? 'Canada' : address.country}
                                                >
                                                    {getCountryFlag(address.country)}
                                                </Box>

                                                <Grid container alignItems="center" spacing={2}>
                                                    <Grid item xs={12} sm={4}>
                                                        <Box display="flex" alignItems="center">
                                                            <Typography variant="subtitle1" fontWeight="500" sx={{ mr: 1, fontSize: '14px' }}>
                                                                {address.nickname}
                                                            </Typography>
                                                            {address.isDefault && (
                                                                <Chip
                                                                    size="small"
                                                                    label="Default"
                                                                    color="primary"
                                                                    sx={{ height: 22, fontSize: '10px' }}
                                                                />
                                                            )}
                                                        </Box>
                                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                            {address.companyName}
                                                        </Typography>
                                                        {attentionLine && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                                <Box component="span" fontWeight="500">Attn:</Box> {attentionLine}
                                                            </Typography>
                                                        )}
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                            {address.address1}
                                                            {address.address2 && <>, {address.address2}</>}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                            {address.city}, {address.stateProv} {address.zipPostal}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                            <Box component="span" fontWeight="500">Phone:</Box> {address.phone}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                            <Box component="span" fontWeight="500">Email:</Box> {address.email}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontSize: '12px' }}>
                                        {searchTerm ? 'No pickup locations found matching your search.' : 'No saved pickup locations found.'}
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<AddIcon />}
                                        onClick={() => setShowAddAddressForm(true)}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Add Pickup Location
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>

                <Box sx={{ mt: 4 }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1 }}>
                        Special Instructions (Optional)
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        name="specialInstructions"
                        value={formData.shipFrom?.specialInstructions || ''}
                        onChange={handleSelectedAddressInputChange}
                        placeholder="Enter any special handling instructions or notes for the carrier"
                        InputProps={{
                            sx: { fontSize: '12px' }
                        }}
                        sx={{ mb: 2 }}
                    />
                </Box>
            </Paper>

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                    variant="outlined"
                    onClick={onPrevious}
                    sx={{ px: 4, fontSize: '12px' }}
                >
                    Previous
                </Button>
                <Button
                    type="button"
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!selectedAddressId && !formData.shipFrom?.street}
                    sx={{
                        px: 6,
                        py: 1.5,
                        fontSize: '12px',
                        backgroundColor: '#10B981',
                        minWidth: '160px',
                        '&:hover': {
                            backgroundColor: '#059669'
                        },
                        '&:disabled': {
                            backgroundColor: '#cccccc'
                        }
                    }}
                    endIcon={<ArrowForwardIcon />}
                >
                    Next
                </Button>
            </Box>

            {/* Add New Address Dialog */}
            <Dialog
                open={showAddAddressForm}
                onClose={() => setShowAddAddressForm(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        maxHeight: '90vh'
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    pb: 2
                }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AddIcon color="primary" />
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Add New Pickup Location
                            </Typography>
                        </Box>
                        {companyData?.name && (
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b', ml: 3 }}>
                                for {companyData.name}
                            </Typography>
                        )}
                    </Box>
                    <Button
                        onClick={() => setShowAddAddressForm(false)}
                        sx={{
                            minWidth: 'auto',
                            p: 1,
                            color: '#64748b',
                            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                        }}
                        disabled={isSubmittingNew}
                    >
                        <CloseIcon />
                    </Button>
                </DialogTitle>

                <DialogContent sx={{ pt: 4 }}>
                    {error && (
                        <Paper sx={{
                            p: 2,
                            mb: 3,
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 1
                        }}>
                            <Typography sx={{ fontSize: '12px', color: '#dc2626' }}>
                                {error}
                            </Typography>
                        </Paper>
                    )}
                    <Grid container spacing={2}>
                        {/* Address Identification */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 2, color: '#374151' }}>
                                Address Information
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Company Name (at pickup location)"
                                name="companyName"
                                value={newAddress.companyName}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Address Nickname"
                                name="nickname"
                                value={newAddress.nickname}
                                onChange={handleNewAddressChange}
                                helperText="e.g., Main Office, Warehouse (optional)"
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        {/* Contact Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 1, color: '#374151' }}>
                                Contact Information
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact First Name"
                                name="firstName"
                                value={newAddress.firstName}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Last Name"
                                name="lastName"
                                value={newAddress.lastName}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Email"
                                name="email"
                                type="email"
                                value={newAddress.email}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Contact Phone"
                                name="phone"
                                value={newAddress.phone}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        {/* Physical Address */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 1, color: '#374151' }}>
                                Physical Address
                            </Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Street Address"
                                name="address1"
                                value={newAddress.address1}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Suite/Unit (Optional)"
                                name="address2"
                                value={newAddress.address2}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                label="City"
                                name="city"
                                value={newAddress.city}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small" disabled={isSubmittingNew}>
                                <InputLabel sx={{ fontSize: '12px' }}>{getStateLabel(newAddress.country)}</InputLabel>
                                <Select
                                    name="stateProv"
                                    value={newAddress.stateProv}
                                    onChange={handleNewAddressChange}
                                    label={getStateLabel(newAddress.country)}
                                    sx={{
                                        '& .MuiSelect-select': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                >
                                    {getStateOptions(newAddress.country).map(({ value, label }) => (
                                        <MenuItem key={value} value={value} sx={{ fontSize: '12px' }}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                label="Postal Code"
                                name="zipPostal"
                                value={newAddress.zipPostal}
                                onChange={handleNewAddressChange}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small" disabled={isSubmittingNew}>
                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                <Select
                                    name="country"
                                    value={newAddress.country}
                                    onChange={handleNewAddressChange}
                                    label="Country"
                                    sx={{
                                        '& .MuiSelect-select': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                >
                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        name="isDefault"
                                        checked={newAddress.isDefault}
                                        onChange={handleNewAddressChange}
                                        size="small"
                                        disabled={isSubmittingNew}
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px' }}>
                                        Set as default pickup location
                                    </Typography>
                                }
                            />
                        </Grid>

                        {/* Special Instructions */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 1, color: '#374151' }}>
                                Special Instructions
                            </Typography>
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                label="Special Instructions (Optional)"
                                name="specialInstructions"
                                value={newAddress.specialInstructions || ''}
                                onChange={handleNewAddressChange}
                                multiline
                                rows={3}
                                fullWidth
                                disabled={isSubmittingNew}
                                size="small"
                                placeholder="Enter any special pickup instructions or notes"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>

                <DialogActions sx={{
                    p: 3,
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Button
                        onClick={() => setShowAddAddressForm(false)}
                        disabled={isSubmittingNew}
                        variant="outlined"
                        sx={{
                            fontSize: '12px',
                            color: '#64748b',
                            borderColor: '#e2e8f0',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                borderColor: '#cbd5e1'
                            }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAddNewAddressSubmit}
                        variant="contained"
                        disabled={isSubmittingNew}
                        startIcon={isSubmittingNew ? null : <AddIcon />}
                        sx={{
                            fontSize: '12px',
                            backgroundColor: '#10B981',
                            px: 3,
                            py: 1,
                            '&:hover': {
                                backgroundColor: '#059669'
                            },
                            '&:disabled': {
                                backgroundColor: '#cccccc'
                            }
                        }}
                    >
                        {isSubmittingNew ? 'Adding...' : 'Add Pickup Location'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default ShipFrom; 