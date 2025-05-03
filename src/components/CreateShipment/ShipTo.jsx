import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import './ShipTo.css';
import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress, Pagination, Card, CardContent, Grid, Button, Divider, List, TablePagination, Skeleton, IconButton } from '@mui/material';
import {
    LocationOn as LocationOnIcon,
    LocalPhone as LocalPhoneIcon,
    Email as EmailIcon,
    Business as BusinessIcon,
    Home as HomeIcon,
    Add as AddIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    Person as PersonIcon
} from '@mui/icons-material';

const ShipTo = ({ onNext, onPrevious }) => {
    const { currentUser } = useAuth();
    const { formData, updateFormSection } = useShipmentForm();

    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [customersPerPage] = useState(5);
    const [totalPages, setTotalPages] = useState(1);

    const [loading, setLoading] = useState(true);
    const [loadingDestinations, setLoadingDestinations] = useState(false);
    const [error, setError] = useState(null);
    const [companyId, setCompanyId] = useState(null);

    useEffect(() => {
        if (formData.shipTo?.selectedCustomer) {
            setSelectedCustomer(formData.shipTo.selectedCustomer);
        }
        if (formData.shipTo?.selectedAddressId) {
            setSelectedAddressId(formData.shipTo.selectedAddressId);
        }
    }, [formData.shipTo?.selectedCustomer, formData.shipTo?.selectedAddressId]);

    useEffect(() => {
        setTotalPages(Math.ceil(customers.length / customersPerPage));
    }, [customers, customersPerPage]);

    // Define fetchCustomers before any useEffect that depends on it
    const fetchCustomers = useCallback(async (id) => {
        if (!id) return;
        try {
            setError(null);
            console.log("Fetching customers for company ID:", id);
            console.log("Company ID type:", typeof id);
            console.log("Company ID length:", id.length);
            console.log("Company ID hex:", [...id].map(c => c.charCodeAt(0).toString(16)).join(' '));

            // Direct Firestore query using both field name variations
            console.log(`Querying customers collection where companyID == "${id}"`);

            // First try with uppercase field name
            let customersSnapshot = await getDocs(
                query(collection(db, 'customers'), where('companyID', '==', id))
            );

            // If no results, try with lowercase field name
            if (customersSnapshot.empty) {
                console.log(`No results with uppercase companyID, trying lowercase companyId field...`);
                customersSnapshot = await getDocs(
                    query(collection(db, 'customers'), where('companyId', '==', id))
                );
            }

            // Process the results
            let customersData = [];

            if (!customersSnapshot.empty) {
                console.log(`Found ${customersSnapshot.size} customers for company ID: ${id}`);

                customersData = customersSnapshot.docs.map(doc => {
                    const data = doc.data();

                    // Handle timestamp conversion
                    let createdAt = null;
                    let updatedAt = null;

                    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                        createdAt = data.createdAt.toDate().toISOString();
                    }

                    if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
                        updatedAt = data.updatedAt.toDate().toISOString();
                    }

                    // Create customer object
                    return {
                        id: doc.id,
                        customerID: data.customerID || doc.id, // Prefer field from doc, fall back to doc ID
                        customerId: data.customerID || doc.id, // For backward compatibility
                        ...data,
                        createdAt,
                        updatedAt
                    };
                });
            } else {
                console.log(`No customers found for company ID: ${id}`);
            }

            console.log('Raw customersData received:', customersData);

            if (Array.isArray(customersData) && customersData.length === 0) {
                console.log('No customers found for this company ID. You may need to add customers first.');
            }

            const sortedCustomers = [...customersData].sort((a, b) =>
                (a.name || '').localeCompare(b.name || '')
            );
            console.log('Sorted customers before setting state:', sortedCustomers);

            setCustomers(sortedCustomers);
            setCurrentPage(1);
        } catch (err) {
            console.error('Error fetching customers - Exception details:', {
                message: err.message,
                name: err.name,
                stack: err.stack,
                code: err.code,
                fullError: err
            });
            setError('Failed to load customers. Please try again.');
            // Set empty customers array rather than leaving in loading state
            setCustomers([]);
        }
    }, []);

    useEffect(() => {
        const fetchCompanyId = async () => {
            if (!currentUser) return;
            try {
                setError(null);
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    setError('User data not found.');
                    setLoading(false);
                    return;
                }
                const userData = userDoc.data();

                // Look for company ID in various possible locations in the user profile
                let id = null;

                // Try different field names and locations
                if (userData.companyID) {
                    id = userData.companyID;
                } else if (userData.companyId) {
                    id = userData.companyId;
                } else if (userData.connectedCompanies?.companies?.length > 0) {
                    id = userData.connectedCompanies.companies[0];
                } else if (userData.companies?.length > 0) {
                    id = userData.companies[0];
                }

                if (!id) {
                    setError('No company associated with this user.');
                    setLoading(false);
                    return;
                }

                console.log(`Found company ID in user profile: ${id}`);
                setCompanyId(id);
                await fetchCustomers(id);
            } catch (err) {
                console.error('Error fetching company ID:', err);
                setError('Failed to load company data. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchCompanyId();
    }, [currentUser, fetchCustomers]);

    const loadAndProcessAddresses = useCallback(async (customer) => {
        // Support both field naming conventions for backward compatibility
        const customerID = customer?.customerID || customer?.customerId || customer?.id;

        if (!customerID) {
            setCustomerAddresses([]);
            return;
        }

        setLoadingDestinations(true);
        setError(null);

        try {
            let addressesToProcess = [];
            if (customer.addresses && customer.addresses.length > 0 && customer.addresses[0]?.street) {
                console.log('Using addresses directly from customer object:', customer.addresses);
                addressesToProcess = customer.addresses;
            } else {
                console.log('Fetching destinations from addressBook for customer:', customerID);

                // Direct Firestore query for customer addresses in addressBook
                const addressesQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'customer'),
                    where('addressType', '==', 'destination'),
                    where('addressClassID', '==', customerID)
                );

                const addressesSnapshot = await getDocs(addressesQuery);
                console.log(`Found ${addressesSnapshot.docs.length} addresses in addressBook for customer ${customerID}`);

                if (!addressesSnapshot.empty) {
                    // Updated mapping to match new addressBook format
                    addressesToProcess = addressesSnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            type: 'shipping',
                            street: data.address1, // Using address1 as street
                            street2: data.address2 || '',
                            city: data.city,
                            state: data.stateProv, // Using stateProv as state
                            zip: data.zipPostal, // Using zipPostal as zip
                            country: data.country || 'US',
                            attention: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
                            name: data.nickname || data.companyName, // Using nickname for name
                            default: data.isDefault || false,
                            specialInstructions: data.specialInstructions || '',
                            // Include direct contact info from the address record
                            contactName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
                            contactPhone: data.phone || '',
                            contactEmail: data.email || ''
                        };
                    });
                } else {
                    console.log('No addresses found in addressBook, checking legacy customer document');

                    // If no addresses in addressBook, try the customer document directly
                    const customerRef = doc(db, 'customers', customerID);
                    const customerDoc = await getDoc(customerRef);

                    if (customerDoc.exists() && customerDoc.data().addresses && Array.isArray(customerDoc.data().addresses)) {
                        addressesToProcess = customerDoc.data().addresses;
                    } else {
                        console.log('No addresses found for this customer');
                        addressesToProcess = [];
                    }
                }
            }

            // Updated mapping for legacy addresses from customer record
            const primaryContact = customer.contacts?.find(contact => contact.isPrimary === true) || customer.contacts?.[0] || {};
            const formattedAddresses = addressesToProcess
                .filter(addr => addr?.type === 'shipping')
                .map((addr, index) => {
                    // Check if this is an addressBook record (contains contactName, contactPhone, contactEmail)
                    const isAddressBookRecord =
                        'contactName' in addr ||
                        'contactPhone' in addr ||
                        'contactEmail' in addr;

                    return {
                        id: addr.id || `addr_${index}`,
                        customerId: customerID,
                        attention: addr.attention || '',
                        name: addr.name || customer.name || '',
                        // Use contact info directly from address record if available
                        contactName: addr.contactName ||
                            (addr.firstName && addr.lastName ?
                                `${addr.firstName} ${addr.lastName}`.trim() :
                                primaryContact.name || ''),
                        contactPhone: addr.contactPhone || addr.phone || primaryContact.phone || '',
                        contactEmail: addr.contactEmail || addr.email || primaryContact.email || '',
                        default: addr.default || addr.isDefault || false,
                        street: addr.street || addr.address1 || '',
                        street2: addr.street2 || addr.address2 || '',
                        city: addr.city || '',
                        state: addr.state || addr.stateProv || '',
                        postalCode: addr.postalCode || addr.zip || addr.zipPostal || '',
                        country: addr.country || 'US',
                        specialInstructions: addr.specialInstructions || ''
                    };
                });

            formattedAddresses.sort((a, b) => {
                if (a.default === true && b.default !== true) return -1;
                if (a.default !== true && b.default === true) return 1;
                return 0;
            });

            setCustomerAddresses(formattedAddresses);
            console.log('Processed and sorted addresses:', formattedAddresses);

            let addressToSelect = null;
            const contextAddressId = formData.shipTo?.selectedAddressId;

            if (contextAddressId) {
                addressToSelect = formattedAddresses.find(addr => String(addr.id) === String(contextAddressId));
                console.log(`Address Selection: Found match for context ID (${contextAddressId})?`, !!addressToSelect);
            }

            if (!addressToSelect && formattedAddresses.length > 0) {
                addressToSelect = formattedAddresses.find(addr => addr.default === true) || formattedAddresses[0];
                console.log('Address Selection: Using default/first address:', addressToSelect?.id);
            }

            if (addressToSelect) {
                setSelectedAddressId(String(addressToSelect.id));
                const needsContextUpdate = (
                    !formData.shipTo?.selectedAddressId ||
                    String(formData.shipTo.selectedAddressId) !== String(addressToSelect.id) ||
                    !formData.shipTo?.street
                );

                if (needsContextUpdate) {
                    console.log(`Updating context with details for address ID: ${addressToSelect.id}`);
                    updateFormSection('shipTo', {
                        selectedCustomer: customer,
                        selectedAddressId: String(addressToSelect.id),
                        name: addressToSelect.name || '',
                        company: customer.company || addressToSelect.companyName || '',
                        attention: addressToSelect.attention || '',
                        street: addressToSelect.street || '',
                        street2: addressToSelect.street2 || '',
                        city: addressToSelect.city || '',
                        state: addressToSelect.state || '',
                        postalCode: addressToSelect.postalCode || '',
                        country: addressToSelect.country || 'US',
                        contactName: addressToSelect.contactName || '',
                        contactPhone: addressToSelect.contactPhone || '',
                        contactEmail: addressToSelect.contactEmail || '',
                        specialInstructions: addressToSelect.specialInstructions || ''
                    });
                } else {
                    console.log("Context already reflects selected address, no update needed.");
                }

            } else if (formattedAddresses.length === 0) {
                console.log("No addresses found, clearing address in context.");
                setSelectedAddressId(null);
                updateFormSection('shipTo', {
                    selectedCustomer: customer,
                    selectedAddressId: null,
                    name: '', company: '', attention: '', street: '', street2: '',
                    city: '', state: '', postalCode: '', country: 'US',
                    contactName: '', contactPhone: '', contactEmail: '', specialInstructions: ''
                });
            }

        } catch (err) {
            console.error('Error loading/processing addresses:', err);
            setError(`Failed to load addresses: ${err.message}`);
            setCustomerAddresses([]);
        } finally {
            setLoadingDestinations(false);
        }
    }, [updateFormSection, formData.shipTo]);

    useEffect(() => {
        const customerFromContext = formData.shipTo?.selectedCustomer;
        const addressIdFromContext = formData.shipTo?.selectedAddressId;
        console.log("Context Sync Effect: Checking context...");

        if (selectedCustomer?.customerId !== customerFromContext?.customerId) {
            console.log(`Context Sync Effect: Updating local customer from ${selectedCustomer?.customerId} to ${customerFromContext?.customerId}`);
            setSelectedCustomer(customerFromContext || null);
        }

        if (selectedAddressId !== addressIdFromContext) {
            console.log(`Context Sync Effect: Updating local address ID from ${selectedAddressId} to ${addressIdFromContext}`);
            setSelectedAddressId(addressIdFromContext || null);
        }
    }, [formData.shipTo?.selectedCustomer, formData.shipTo?.selectedAddressId]);

    useEffect(() => {
        if (selectedCustomer && selectedCustomer.customerId) {
            const addressesLoadedForThisCustomer = customerAddresses.length > 0 &&
                customerAddresses[0]?.customerId === selectedCustomer.customerId;

            if (!addressesLoadedForThisCustomer) {
                console.log(`Load Address Effect: Triggering address load for customer ${selectedCustomer.customerId}`);
                loadAndProcessAddresses(selectedCustomer);
            } else {
                console.log(`Load Address Effect: Addresses seem already loaded for customer ${selectedCustomer.customerId}`);
            }
        } else {
            if (customerAddresses.length > 0) {
                console.log("Load Address Effect: No selected customer, clearing addresses.");
                setCustomerAddresses([]);
            }
        }
    }, [selectedCustomer, loadAndProcessAddresses]);

    const handleCustomerSelect = useCallback((customer) => {
        if (!customer) {
            console.log("Customer selection cleared");
            setSelectedCustomer(null);
            setSelectedAddressId(null);
            setCustomerAddresses([]);
            updateFormSection('shipTo', {
                selectedCustomer: null, selectedAddressId: null, name: '', company: '', attention: '',
                street: '', street2: '', city: '', state: '', postalCode: '', country: 'US',
                contactName: '', contactPhone: '', contactEmail: '', specialInstructions: ''
            });
            return;
        }

        // Support both field naming conventions for backward compatibility
        const customerID = customer?.customerID || customer?.customerId || customer?.id;

        console.log("Customer selected interactively:", customerID);

        // Ensure both field names exist for backward compatibility
        if (customer.customerId && !customer.customerID) {
            customer.customerID = customer.customerId;
        } else if (customer.customerID && !customer.customerId) {
            customer.customerId = customer.customerID;
        }

        setSelectedCustomer(customer);
        setSelectedAddressId(null);
        setCustomerAddresses([]);

        updateFormSection('shipTo', { selectedCustomer: customer, selectedAddressId: null });

        loadAndProcessAddresses(customer);

    }, [updateFormSection, loadAndProcessAddresses]);

    // Fix contact name issues by consistently ensuring contact fields are filled
    useEffect(() => {
        // If the form has an attention field but missing contactName, fix it
        if (formData.shipTo &&
            formData.shipTo.attention &&
            !formData.shipTo.contactName) {

            console.log("ShipTo: Found attention but no contactName, copying value:", formData.shipTo.attention);

            // Update the form with the attention value copied to contactName
            updateFormSection('shipTo', {
                contactName: formData.shipTo.attention,
                // If we're missing phone/email, check the database
                contactPhone: formData.shipTo.contactPhone || formData.shipTo.phone || '',
                contactEmail: formData.shipTo.contactEmail || formData.shipTo.email || ''
            });
        }
    }, [formData.shipTo, updateFormSection]);

    // Add a utility function to ensure all contact fields are properly set
    const ensureContactFields = useCallback((data) => {
        // Make sure contactName is set if attention exists
        if (!data.contactName && data.attention) {
            data.contactName = data.attention;
        }

        // Make sure contactPhone is set
        if (!data.contactPhone && data.phone) {
            data.contactPhone = data.phone;
        }

        // Make sure contactEmail is set
        if (!data.contactEmail && data.email) {
            data.contactEmail = data.email;
        }

        return data;
    }, []);

    const handleAddressChange = useCallback((addressId) => {
        const addressIdStr = addressId ? String(addressId) : null;
        console.log(`Address selection changed to ID: "${addressIdStr}"`);
        if (!addressIdStr || !selectedCustomer) return;

        setSelectedAddressId(addressIdStr);

        const selectedAddress = customerAddresses.find(addr => String(addr.id) === addressIdStr);

        if (selectedAddress) {
            console.log("Found matching address in local state:", selectedAddress);

            // Directly query the address from the database to get the latest data
            const fetchAddressDetails = async () => {
                try {
                    const addressRef = doc(db, 'addressBook', addressIdStr);
                    const addressSnap = await getDoc(addressRef);

                    // Get the most up-to-date contact information
                    let firstName = selectedAddress.firstName || '';
                    let lastName = selectedAddress.lastName || '';
                    let phone = selectedAddress.phone || selectedAddress.contactPhone || '';
                    let email = selectedAddress.email || selectedAddress.contactEmail || '';

                    if (addressSnap.exists()) {
                        const data = addressSnap.data();
                        firstName = data.firstName || firstName;
                        lastName = data.lastName || lastName;
                        phone = data.phone || phone;
                        email = data.email || email;
                    }

                    // Ensure contact name is properly set
                    const contactName = firstName && lastName
                        ? `${firstName} ${lastName}`
                        : selectedAddress.attention || selectedAddress.contactName || selectedAddress.name || "Receiving Department";

                    // If we don't have contact info from the address, try to get it from the customer's primary contact
                    if (!phone || !email) {
                        const primaryContact = selectedCustomer.contacts?.find(c => c.isPrimary) || selectedCustomer.contacts?.[0];
                        if (primaryContact) {
                            phone = phone || primaryContact.phone || '';
                            email = email || primaryContact.email || '';
                        }
                    }

                    const formattedAddress = {
                        ...selectedAddress,
                        name: selectedAddress.nickname || selectedAddress.name || '',
                        company: selectedAddress.company || selectedAddress.companyName || '',
                        attention: contactName,
                        street: selectedAddress.address1 || selectedAddress.street || '',
                        street2: selectedAddress.address2 || selectedAddress.street2 || '',
                        city: selectedAddress.city || '',
                        state: selectedAddress.stateProv || selectedAddress.state || '',
                        postalCode: selectedAddress.zipPostal || selectedAddress.postalCode || '',
                        country: selectedAddress.country || 'US',
                        contactName: contactName,
                        contactPhone: phone,
                        contactEmail: email,
                        specialInstructions: selectedAddress.specialInstructions || '',
                        firstName,
                        lastName,
                        phone,
                        email,
                        selectedCustomer,
                        selectedAddressId: addressIdStr
                    };

                    console.log("ShipTo: Updating form with address including contact information:", {
                        contactName: formattedAddress.contactName,
                        contactPhone: formattedAddress.contactPhone,
                        contactEmail: formattedAddress.contactEmail
                    });

                    updateFormSection('shipTo', formattedAddress);
                } catch (err) {
                    console.error("Error fetching address details:", err);

                    // Fall back to using the data we already have
                    const contactName = selectedAddress.firstName && selectedAddress.lastName
                        ? `${selectedAddress.firstName} ${selectedAddress.lastName}`
                        : selectedAddress.attention || selectedAddress.contactName || selectedAddress.name || "Receiving Department";

                    const primaryContact = selectedCustomer.contacts?.find(c => c.isPrimary) || selectedCustomer.contacts?.[0] || {};
                    const phone = selectedAddress.phone || selectedAddress.contactPhone || primaryContact.phone || '';
                    const email = selectedAddress.email || selectedAddress.contactEmail || primaryContact.email || '';

                    const formattedAddress = {
                        ...selectedAddress,
                        name: selectedAddress.nickname || selectedAddress.name || '',
                        company: selectedAddress.company || selectedAddress.companyName || '',
                        attention: contactName,
                        street: selectedAddress.address1 || selectedAddress.street || '',
                        street2: selectedAddress.address2 || selectedAddress.street2 || '',
                        city: selectedAddress.city || '',
                        state: selectedAddress.stateProv || selectedAddress.state || '',
                        postalCode: selectedAddress.zipPostal || selectedAddress.postalCode || '',
                        country: selectedAddress.country || 'US',
                        contactName: contactName,
                        contactPhone: phone,
                        contactEmail: email,
                        specialInstructions: selectedAddress.specialInstructions || '',
                        selectedCustomer,
                        selectedAddressId: addressIdStr
                    };

                    updateFormSection('shipTo', formattedAddress);
                }
            };

            fetchAddressDetails();
        } else {
            console.error(`No address found with ID: ${addressIdStr}`);
        }
    }, [customerAddresses, selectedCustomer, updateFormSection]);

    const handleSubmit = useCallback(() => {
        const currentShipToData = formData.shipTo || {};
        setError(null);

        if (!currentShipToData.selectedCustomer) {
            setError('Please select a customer');
            return;
        }
        if (!currentShipToData.selectedAddressId && !currentShipToData.street) {
            setError('Please select or confirm a shipping address');
            return;
        }
        const requiredFields = ['street', 'city', 'state', 'postalCode', 'country'];
        const missingFields = requiredFields.filter(field => !currentShipToData[field]);
        if (missingFields.length > 0) {
            setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
            return;
        }
        onNext();
    }, [formData.shipTo, onNext]);

    const handleClearCustomer = useCallback(() => {
        setSelectedCustomer(null);
        setSelectedAddressId(null);
        setCustomerAddresses([]);
        updateFormSection('shipTo', {
            selectedCustomer: null, selectedAddressId: null, name: '', company: '', attention: '', street: '', street2: '',
            city: '', state: '', postalCode: '', country: 'US', contactName: '', contactPhone: '', contactEmail: '', specialInstructions: ''
        });
    }, [updateFormSection]);

    const handleAddCustomerClick = () => {
        console.log("Add new customer clicked");
    };

    const handleAddAddressClick = () => {
        console.log("Add new address clicked", selectedCustomer?.id);
    };

    const renderCustomerSearch = () => (
        <div className="customer-search mb-4">
            <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.name || ''}
                value={selectedCustomer}
                onChange={(event, newValue) => {
                    handleCustomerSelect(newValue);
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Search Customers"
                        variant="outlined"
                        fullWidth
                        placeholder="Start typing to search customers..."
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'white',
                                '&:hover': {
                                    backgroundColor: 'white',
                                },
                            },
                        }}
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
                    const searchValue = inputValue.toLowerCase();
                    return options.filter(option =>
                        option.name?.toLowerCase().includes(searchValue) ||
                        option.contacts?.some(contact =>
                            contact.name?.toLowerCase().includes(searchValue) ||
                            contact.email?.toLowerCase().includes(searchValue)
                        )
                    );
                }}
                ListboxProps={{
                    sx: {
                        maxHeight: '300px',
                        '& .MuiAutocomplete-option': {
                            padding: '8px 16px',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            },
                        },
                    },
                }}
                disablePortal
                disableClearable
                blurOnSelect
            />
        </div>
    );

    const getCurrentPageCustomers = () => {
        const startIndex = (currentPage - 1) * customersPerPage;
        const endIndex = startIndex + customersPerPage;
        return customers.slice(startIndex, endIndex);
    };

    const renderCustomerList = () => {
        if (loading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (customers.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No customers found. Please add a new customer.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        sx={{ mt: 2 }}
                        onClick={handleAddCustomerClick}
                    >
                        Add Customer
                    </Button>
                </Box>
            );
        }

        const filteredCustomers = searchQuery
            ? customers.filter(
                customer =>
                    (customer.name && customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (customer.company && customer.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (customer.contacts && customer.contacts.some(contact =>
                        (contact.name && contact.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    ))
            )
            : customers;

        const indexOfLastCustomer = currentPage * customersPerPage;
        const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
        const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
        const totalCustomerPages = Math.ceil(filteredCustomers.length / customersPerPage);

        if (filteredCustomers.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No customers match your search. Try a different query.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<ClearIcon />}
                        onClick={() => setSearchQuery('')}
                        sx={{ mt: 2 }}
                    >
                        Clear Search
                    </Button>
                </Box>
            );
        }

        return (
            <>
                <Grid container spacing={2}>
                    {currentCustomers.map((customer, index) => {
                        // Support both field naming conventions
                        const customerID = customer?.customerID || customer?.customerId || customer?.id;
                        const isSelected = selectedCustomer && (
                            (selectedCustomer?.customerID && selectedCustomer.customerID === customerID) ||
                            (selectedCustomer?.customerId && selectedCustomer.customerId === customerID) ||
                            selectedCustomer?.id === customerID
                        );
                        const customerName = customer.name || 'Unnamed Customer';
                        const customerCompany = customer.company || '';
                        const primaryContact = customer.contacts?.[0] || {};

                        return (
                            <Grid item xs={12} key={index}>
                                <Card
                                    sx={{
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        borderRadius: '8px',
                                        width: '100%',
                                        mb: 1,
                                        ...(isSelected
                                            ? {
                                                borderColor: '#6b46c1 !important',
                                                border: '2px solid #6b46c1 !important',
                                                bgcolor: 'rgba(107, 70, 193, 0.12) !important',
                                                boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                                transform: 'scale(1.01) !important',
                                                position: 'relative',
                                                '&:hover': {
                                                    boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                                    borderColor: '#6b46c1 !important',
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
                                                borderColor: 'rgba(0, 0, 0, 0.12)',
                                                border: '1px solid rgba(0, 0, 0, 0.12)',
                                                bgcolor: 'transparent',
                                                background: 'none',
                                                boxShadow: 'none',
                                                transform: 'none',
                                                '&:hover': {
                                                    boxShadow: '0 4px 12px 0 rgba(0,0,0,0.08)',
                                                    transform: 'translateY(-4px)',
                                                }
                                            })
                                    }}
                                    onClick={() => handleCustomerSelect(customer)}
                                    data-selected={isSelected ? "true" : "false"}
                                    data-customer-id={customerID}
                                >
                                    <CardContent>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <Box sx={{ mb: 1 }}>
                                                    <Typography
                                                        variant="subtitle1"
                                                        component="div"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color: 'text.primary',
                                                            fontSize: '1.1rem'
                                                        }}
                                                    >
                                                        {customerName}
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{
                                                            fontSize: '0.75rem',
                                                            letterSpacing: '0.5px',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        ID: {customer.customerID || customer.customerId || customer.id}
                                                    </Typography>
                                                </Box>

                                                {customerCompany && (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{
                                                            mb: 1
                                                        }}
                                                    >
                                                        {customerCompany}
                                                    </Typography>
                                                )}
                                            </Grid>

                                            <Grid item xs={12} sm={6}>
                                                {primaryContact.name && (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            mb: 1
                                                        }}
                                                    >
                                                        {primaryContact.name}
                                                    </Typography>
                                                )}

                                                {primaryContact.email && (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            mb: 1
                                                        }}
                                                    >
                                                        {primaryContact.email}
                                                    </Typography>
                                                )}

                                                {primaryContact.phone && (
                                                    <Typography
                                                        variant="body2"
                                                    >
                                                        {primaryContact.phone}
                                                    </Typography>
                                                )}
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>

                {totalCustomerPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination
                            count={totalCustomerPages}
                            page={currentPage}
                            onChange={(e, page) => setCurrentPage(page)}
                            color="primary"
                        />
                    </Box>
                )}
            </>
        );
    };

    const renderAddressSuggestions = () => {
        if (!selectedCustomer) {
            return (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                    <Typography variant="body1" color="text.secondary">
                        Please select a customer first to see their addresses.
                    </Typography>
                </Box>
            );
        }

        if (loadingDestinations) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (customerAddresses.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                        No addresses found for this customer.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        sx={{ mt: 2 }}
                        onClick={handleAddAddressClick}
                    >
                        Add New Address
                    </Button>
                </Box>
            );
        }

        console.log("Address objects structure:", customerAddresses);
        if (customerAddresses.length > 0) {
            console.log("First address fields:",
                Object.keys(customerAddresses[0]).map(key => `${key}: ${typeof customerAddresses[0][key]}`));
            console.log("First address object:", customerAddresses[0]);
        }

        return (
            <Grid container spacing={2}>
                {customerAddresses.map((address, index) => {
                    const isSelected = String(selectedAddressId) === String(address.id);

                    if (isSelected) {
                        console.log(`Selected address ${index}: ${address.name} (ID: ${address.id}, default: ${address.default})`);
                    }

                    return (
                        <Grid item xs={12} key={index}>
                            <Card
                                sx={{
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    borderRadius: '8px',
                                    width: '100%',
                                    mb: 1,
                                    ...(isSelected
                                        ? {
                                            borderColor: '#6b46c1 !important',
                                            border: '2px solid #6b46c1 !important',
                                            borderLeft: '8px solid #6b46c1 !important',
                                            bgcolor: 'rgba(107, 70, 193, 0.12) !important',
                                            boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15) !important',
                                            transform: 'scale(1.01) !important',
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
                                            borderColor: 'rgba(0, 0, 0, 0.12)',
                                            border: '1px solid rgba(0, 0, 0, 0.12)',
                                            borderLeft: '1px solid rgba(0, 0, 0, 0.12)',
                                            bgcolor: 'transparent',
                                            background: 'none',
                                            boxShadow: 'none',
                                            transform: 'none',
                                            '&:hover': {
                                                boxShadow: '0 4px 12px 0 rgba(0,0,0,0.08)',
                                                transform: 'translateY(-4px)',
                                                borderLeft: '4px solid rgba(107, 70, 193, 0.5)',
                                            }
                                        })
                                }}
                                onClick={() => handleAddressChange(address.id)}
                                data-selected={isSelected ? "true" : "false"}
                                data-address-id={address.id}
                                data-is-default={address.default ? "true" : "false"}
                            >
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="subtitle1" component="h6" sx={{ mr: 1 }}>
                                                    {address.name || "Unnamed Address"}
                                                </Typography>
                                                {address.default && (
                                                    <Chip
                                                        label="Default"
                                                        color="primary"
                                                        size="small"
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="body2">
                                                {selectedCustomer?.name || address.company || ""}
                                            </Typography>
                                            {address.attention && (
                                                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                                                    Attn: {address.attention}
                                                </Typography>
                                            )}
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.street || "(Address Line 1 Missing)"}
                                            </Typography>
                                            {address.street2 && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    {address.street2}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.city || "(City Missing)"}, {address.state || "(State Missing)"} {address.postalCode || "(Postal Code Missing)"}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {address.country || "US"}
                                            </Typography>
                                            {address.specialInstructions && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, fontStyle: 'italic' }}>
                                                    Note: {address.specialInstructions}
                                                </Typography>
                                            )}
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            {(typeof address.contactName === 'string' || typeof address.contact?.name === 'string') && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Contact:</Box>
                                                    {address.contactName || address.contact?.name}
                                                </Typography>
                                            )}
                                            {(typeof address.contactPhone === 'string' || typeof address.contact?.phone === 'string') && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Phone:</Box>
                                                    {address.contactPhone || address.contact?.phone}
                                                </Typography>
                                            )}
                                            {(typeof address.contactEmail === 'string' || typeof address.contact?.email === 'string') && (
                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                    <Box component="span" sx={{ fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>Email:</Box>
                                                    {address.contactEmail || address.contact?.email}
                                                </Typography>
                                            )}
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        );
    };

    if (loading) {
        return (
            <div className="ship-to-container">
                <div className="section-title mb-4">
                    <Skeleton variant="text" width={200} height={40} />
                    <Skeleton variant="text" width={300} height={20} />
                </div>

                <Box sx={{ mb: 4 }}>
                    <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
                </Box>

                <Grid container spacing={2}>
                    {[1, 2, 3].map((index) => (
                        <Grid item xs={12} key={index}>
                            <Card sx={{ mb: 2 }}>
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Skeleton variant="text" width={200} height={30} />
                                            <Skeleton variant="text" width={150} height={20} />
                                            <Skeleton variant="text" width={180} height={20} />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Skeleton variant="text" width={200} height={20} />
                                            <Skeleton variant="text" width={180} height={20} />
                                            <Skeleton variant="text" width={160} height={20} />
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Skeleton variant="rectangular" width={120} height={40} />
                    <Skeleton variant="rectangular" width={120} height={40} />
                </Box>
            </div>
        );
    }

    const currentShipToData = formData.shipTo || {};

    return (
        <div className="ship-to-container">
            <div className="section-title mb-4">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <h2>Ship To</h2>
                        <p className="text-muted">Select or search for a customer to ship to</p>
                    </div>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={selectedCustomer ? handleAddAddressClick : handleAddCustomerClick}
                    >
                        {selectedCustomer ? "Add Address" : "Add Customer"}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger mb-3" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                </div>
            )}

            {renderCustomerSearch()}

            {!selectedCustomer && renderCustomerList()}

            {selectedCustomer && (
                <>
                    <div className="selected-customer mb-4">
                        <div className="d-flex justify-content-between align-items-start w-100">
                            <div className="customer-info">
                                <div>
                                    <h3>{selectedCustomer.name}</h3>
                                    {selectedCustomer.contacts?.[0] && (
                                        <p className="text-muted mb-0">
                                            <i className="bi bi-person me-1"></i> {selectedCustomer.contacts[0].name}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={handleClearCustomer}
                                aria-label="Clear selected customer"
                            >
                                <i className="bi bi-x-lg"></i> Change Customer
                            </button>
                        </div>
                    </div>

                    {renderAddressSuggestions()}
                </>
            )}

            <div className="navigation-buttons">
                <button
                    type="button"
                    className="btn btn-outline-primary btn-navigation"
                    onClick={onPrevious}
                >
                    <i className="bi bi-arrow-left"></i> Previous
                </button>
                <button
                    type="button"
                    className="btn btn-primary btn-navigation"
                    onClick={handleSubmit}
                    disabled={!selectedCustomer || (!currentShipToData.selectedAddressId && !currentShipToData.street)}
                >
                    Next <i className="bi bi-arrow-right"></i>
                </button>
            </div>

            {selectedCustomer && !currentShipToData.selectedAddressId && !currentShipToData.street && (
                <div className="text-center mt-3">
                    <small className="text-danger">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        Please select a destination address to continue
                    </small>
                </div>
            )}
        </div>
    );
};

export default ShipTo; 