import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Stack,
    InputAdornment,
    Collapse,
    Grid,
    Checkbox,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Avatar,
    Menu,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    Business as BusinessIcon,
    ViewList as ViewListIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
    GetApp as ExportIcon,
    Person as PersonIcon,
    Email as EmailIcon,
    LocationOn as LocationIcon,
    SearchOff as SearchOffIcon,
    FilterAlt as FilterAltIcon,
    Add,
    ArrowBack,
    Edit as EditIcon,
    CloudUpload as UploadIcon,
    MoreVert as MoreVertIcon,
    Visibility as ViewIcon
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useNavigate } from 'react-router-dom';
import AdminBreadcrumb from '../AdminBreadcrumb';

// Import the reusable AddressBook component
import AddressBook from '../../AddressBook/AddressBook';
import AddressDetail from '../../AddressBook/AddressDetail';
import AddressForm from '../../AddressBook/AddressForm';
import AddressImport from '../../AddressBook/AddressImport';
import ShipmentsPagination from '../../Shipments/components/ShipmentsPagination';

const GlobalAddressList = () => {
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const { setCompanyContext, loading: companyLoading } = useCompany();

    // Debug logging
    console.log('[GlobalAddressList] Debug info:', {
        user: user?.uid,
        userRole,
        authLoading,
        companyLoading
    });

    // State for company selection
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [selectedCompanyData, setSelectedCompanyData] = useState(null);
    const [viewMode, setViewMode] = useState('all'); // 'all' or 'single'

    // State for refresh trigger
    const [refreshKey, setRefreshKey] = useState(0);

    // Load available companies based on user role
    useEffect(() => {
        const loadCompanies = async () => {
            if (authLoading || !user) return;

            setLoadingCompanies(true);
            try {
                let companiesQuery;
                let connectedCompanyIds = [];

                if (userRole === 'superadmin') {
                    // Super admins can see all companies
                    companiesQuery = query(
                        collection(db, 'companies')
                    );
                } else if (userRole === 'admin') {
                    // Admins can see companies they're connected to
                    const userDoc = await getDocs(
                        query(collection(db, 'users'), where('uid', '==', user.uid))
                    );

                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data();
                        connectedCompanyIds = userData.connectedCompanies?.companies || [];

                        if (connectedCompanyIds.length > 0) {
                            companiesQuery = query(
                                collection(db, 'companies'),
                                where('companyID', 'in', connectedCompanyIds)
                            );
                        } else {
                            setAvailableCompanies([]);
                            return;
                        }
                    }
                } else {
                    // Regular users shouldn't access this page
                    setAvailableCompanies([]);
                    return;
                }

                const companiesSnapshot = await getDocs(companiesQuery);
                const companies = companiesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Sort companies by name after fetching
                companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                console.log('Loaded companies:', companies.length, companies);

                setAvailableCompanies(companies);

                // For super admins and admins, default to "All Companies" view
                if (userRole === 'superadmin' || userRole === 'admin') {
                    setSelectedCompanyId('all');
                    setViewMode('all');

                    // Create a special "all companies" context
                    const allCompaniesContext = {
                        companyID: 'all',
                        name: 'All Companies',
                        isAdminView: true,
                        companyIds: userRole === 'superadmin' ? 'all' : connectedCompanyIds
                    };
                    setSelectedCompanyData(allCompaniesContext);
                }
            } catch (error) {
                console.error('Error loading companies - Full error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                setAvailableCompanies([]);
            } finally {
                setLoadingCompanies(false);
            }
        };

        loadCompanies();
    }, [user, userRole, authLoading]);

    // Handle company selection change
    const handleCompanyChange = useCallback((event) => {
        const companyId = event.target.value;
        console.log('[GlobalAddressList] Company changed to:', companyId);
        setSelectedCompanyId(companyId);

        if (companyId === 'all') {
            // Set to "All Companies" mode
            setViewMode('all');

            // Get connected company IDs for admins
            const connectedIds = userRole === 'admin'
                ? availableCompanies.map(c => c.companyID)
                : 'all';

            const allCompaniesContext = {
                companyID: 'all',
                name: 'All Companies',
                isAdminView: true,
                companyIds: connectedIds
            };
            setSelectedCompanyData(allCompaniesContext);
            // Don't set company context for "all" mode to prevent the AddressBook 
            // component from filtering to a single company
        } else {
            // Set to single company mode
            setViewMode('single');

            // Find the selected company data
            const company = availableCompanies.find(c => c.companyID === companyId);
            console.log('[GlobalAddressList] Found company data:', company);
            setSelectedCompanyData(company);

            // Update the company context for AddressBook
            if (company) {
                console.log('[GlobalAddressList] Setting company context:', company.companyID);
                setCompanyContext(company);
            }
        }

        // Trigger refresh of AddressBook
        setRefreshKey(prev => prev + 1);
    }, [availableCompanies, setCompanyContext, userRole]);

    // Loading state
    if (authLoading || companyLoading || loadingCompanies) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // No companies available
    if (availableCompanies.length === 0 && userRole === 'admin') {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning" sx={{ fontSize: '12px' }}>
                    No companies available. You need to be connected to at least one company.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title Row */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                        Customer Address Book
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                        {viewMode === 'all'
                            ? `Viewing customer shipping addresses from ${userRole === 'superadmin' ? 'all companies' : 'all connected companies'}`
                            : 'View and manage customer shipping addresses'}
                    </Typography>
                </Box>

                {/* Breadcrumb and Filter Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    {/* Breadcrumb */}
                    <AdminBreadcrumb currentPage="Addresses" />

                    {/* Company Selector */}
                    <FormControl
                        size="small"
                        sx={{
                            minWidth: 300,
                            '& .MuiInputLabel-root': { fontSize: '12px' },
                            '& .MuiSelect-select': { fontSize: '12px' }
                        }}
                    >
                        <InputLabel id="company-select-label">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <BusinessIcon sx={{ fontSize: 16 }} />
                                Filter by Company
                            </Box>
                        </InputLabel>
                        <Select
                            labelId="company-select-label"
                            value={selectedCompanyId}
                            onChange={handleCompanyChange}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <BusinessIcon sx={{ fontSize: 16 }} />
                                    Filter by Company
                                </Box>
                            }
                        >
                            {/* All Companies Option */}
                            <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    <ViewListIcon sx={{ fontSize: 18, color: '#1976d2' }} />
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        All Companies
                                    </Typography>
                                    <Chip
                                        label={userRole === 'superadmin' ? 'All' : `${availableCompanies.length} Connected`}
                                        size="small"
                                        color="primary"
                                        sx={{
                                            height: 20,
                                            fontSize: '10px',
                                            ml: 'auto'
                                        }}
                                    />
                                </Box>
                            </MenuItem>

                            {/* Individual Companies */}
                            {availableCompanies.map(company => (
                                <MenuItem
                                    key={company.companyID}
                                    value={company.companyID}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                        <Avatar
                                            src={company.logoURL || company.logo || company.logoUrl}
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                bgcolor: company.logoURL || company.logo || company.logoUrl ? 'transparent' : '#1976d2',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                border: '1px solid #e5e7eb'
                                            }}
                                        >
                                            {(!company.logoURL && !company.logo && !company.logoUrl) && (
                                                <BusinessIcon sx={{ fontSize: '16px', color: 'white' }} />
                                            )}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {company.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                {company.companyID}
                                            </Typography>
                                        </Box>
                                        {company.status === 'active' ? (
                                            <Chip
                                                label="Active"
                                                size="small"
                                                color="success"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '10px'
                                                }}
                                            />
                                        ) : (
                                            <Chip
                                                label="Inactive"
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '10px'
                                                }}
                                            />
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>




            </Box>

            {/* Main Content Area - Use consistent sliding navigation for both views */}
            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {console.log('[GlobalAddressList] Rendering main content - selectedCompanyId:', selectedCompanyId, 'viewMode:', viewMode)}
                <Paper sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: 'none'
                }}>
                    {/* Use AllCompaniesAddressView for both "all" and individual company views */}
                    <AllCompaniesAddressView
                        companies={viewMode === 'all' ? availableCompanies : availableCompanies.filter(c => c.companyID === selectedCompanyId)}
                        userRole={userRole}
                        selectedCompanyId={selectedCompanyId}
                        viewMode={viewMode}
                    />
                </Paper>
            </Box>
        </Box>
    );
};

// Custom component to show addresses from all companies with full table functionality
const AllCompaniesAddressView = ({ companies, userRole, selectedCompanyId = 'all', viewMode = 'all' }) => {
    const navigate = useNavigate();
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Enhanced search fields matching AddressBook pattern
    const [searchFields, setSearchFields] = useState({
        companyName: '',
        contactName: '',
        email: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: ''
    });

    // Filter states
    const [filters, setFilters] = useState({
        country: 'all'
    });

    // Selection state for export
    const [selectedAddresses, setSelectedAddresses] = useState(new Set());

    // Sliding navigation state
    const [currentView, setCurrentView] = useState('table'); // 'table', 'detail', 'edit', 'add'
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [isSliding, setIsSliding] = useState(false);

    // Import state
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

    // Actions menu state
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [selectedAddressForActions, setSelectedAddressForActions] = useState(null);

    // Add address state for super admins
    const [selectedCompanyForAdd, setSelectedCompanyForAdd] = useState('');
    const [selectedCustomerForAdd, setSelectedCustomerForAdd] = useState('');
    const [customersForSelectedCompany, setCustomersForSelectedCompany] = useState([]);

    useEffect(() => {
        const fetchAllAddresses = async () => {
            setLoading(true);
            try {
                const allAddresses = [];

                // Fetch addresses for each company - ONLY CUSTOMER ADDRESSES (shipping addresses)
                for (const company of companies) {
                    const addressesRef = collection(db, 'addressBook');

                    // First, let's get all addresses for debugging
                    console.log(`[GlobalAddressList] Fetching addresses for company: ${company.name} (${company.companyID})`);

                    const q = query(
                        addressesRef,
                        where('companyID', '==', company.companyID),
                        where('status', '!=', 'deleted')
                    );

                    const querySnapshot = await getDocs(q);
                    const rawAddresses = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        ownerCompanyName: company.name, // Add company name for display
                        ownerCompanyLogo: company.logo || company.logoUrl // Add company logo for display
                    }));

                    console.log(`[GlobalAddressList] Found ${rawAddresses.length} total addresses for ${company.name}`);

                    // Filter for customer addresses only
                    const customerAddresses = rawAddresses.filter(addr => {
                        const isCustomerAddress = addr.addressClass === 'customer';
                        if (!isCustomerAddress) {
                            console.log(`[GlobalAddressList] Filtering out non-customer address:`, {
                                id: addr.id,
                                addressClass: addr.addressClass,
                                companyName: addr.companyName
                            });
                        }
                        return isCustomerAddress;
                    });

                    console.log(`[GlobalAddressList] Found ${customerAddresses.length} customer addresses for ${company.name}`);
                    allAddresses.push(...customerAddresses);
                }

                // Now fetch customer owner information for customer addresses
                const enrichedAddresses = await Promise.all(
                    allAddresses.map(async (address, index) => {

                        // Check for customer addresses - try multiple conditions
                        const isCustomerAddress = address.addressClass === 'customer' ||
                            address.companyName; // If it has a business name, it might be a customer

                        if (isCustomerAddress && (address.addressClassID || address.companyName)) {
                            try {
                                let customerData = null;

                                // First try to find by addressClassID
                                if (address.addressClassID) {
                                    const customerQuery = query(
                                        collection(db, 'customers'),
                                        where('customerID', '==', address.addressClassID),
                                        limit(1)
                                    );
                                    const customerSnapshot = await getDocs(customerQuery);

                                    if (!customerSnapshot.empty) {
                                        customerData = customerSnapshot.docs[0].data();
                                    }
                                }

                                // If not found by addressClassID, try to find by company name
                                if (!customerData && address.companyName) {
                                    const customerByNameQuery = query(
                                        collection(db, 'customers'),
                                        where('name', '==', address.companyName),
                                        limit(1)
                                    );
                                    const customerByNameSnapshot = await getDocs(customerByNameQuery);

                                    if (!customerByNameSnapshot.empty) {
                                        customerData = customerByNameSnapshot.docs[0].data();
                                        if (index < 3) console.log(`✅ Found customer by name:`, customerData.name);
                                    }
                                }

                                if (customerData) {
                                    // Show the customer name instead of the master company
                                    return {
                                        ...address,
                                        customerOwnerName: customerData.name || customerData.customerID,
                                        customerOwnerLogo: customerData.logo || customerData.logoUrl || null,
                                        customerOwnerCompanyID: customerData.customerID
                                    };
                                }
                            } catch (error) {
                                console.error('Error fetching customer owner data:', error);
                            }
                        }
                        return address;
                    })
                );

                // Sort by company name, then by address company name
                enrichedAddresses.sort((a, b) => {
                    const companyCompare = (a.ownerCompanyName || '').localeCompare(b.ownerCompanyName || '');
                    if (companyCompare !== 0) return companyCompare;
                    return (a.companyName || '').localeCompare(b.companyName || '');
                });

                console.log(`[GlobalAddressList] Final result: ${enrichedAddresses.length} customer addresses total`);
                setAddresses(enrichedAddresses);
                setTotalCount(enrichedAddresses.length);
            } catch (error) {
                console.error('Error fetching addresses:', error);
            } finally {
                setLoading(false);
            }
        };

        if (companies.length > 0) {
            fetchAllAddresses();
        }
    }, [companies]);

    // Enhanced comprehensive search function
    const searchAddress = (address, searchTerm) => {
        if (!searchTerm) return true;

        const term = searchTerm.toLowerCase();
        const searchableFields = [
            address.companyName,
            address.ownerCompanyName,
            address.firstName,
            address.lastName,
            address.email,
            address.phone,
            address.street,
            address.street2,
            address.city,
            address.state,
            address.postalCode,
            address.country,
            address.specialInstructions,
            address.status,
            // Concatenated fields
            `${address.firstName || ''} ${address.lastName || ''}`.trim(),
            `${address.street || ''} ${address.street2 ? `, ${address.street2}` : ''}`.trim(),
            `${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim(),
        ];

        return searchableFields.some(field =>
            field && String(field).toLowerCase().includes(term)
        );
    };

    // Enhanced filter function with comprehensive logic
    const filteredAddresses = React.useMemo(() => {
        let filtered = addresses;

        // Apply global search
        if (globalSearchQuery) {
            filtered = filtered.filter(address => searchAddress(address, globalSearchQuery));
        }

        // Apply specific field searches
        if (searchFields.companyName) {
            filtered = filtered.filter(address =>
                address.companyName?.toLowerCase().includes(searchFields.companyName.toLowerCase()) ||
                address.ownerCompanyName?.toLowerCase().includes(searchFields.companyName.toLowerCase())
            );
        }

        if (searchFields.contactName) {
            const contactSearch = searchFields.contactName.toLowerCase();
            filtered = filtered.filter(address => {
                const fullName = `${address.firstName || ''} ${address.lastName || ''}`.trim().toLowerCase();
                const firstName = (address.firstName || '').toLowerCase();
                const lastName = (address.lastName || '').toLowerCase();
                return fullName.includes(contactSearch) ||
                    firstName.includes(contactSearch) ||
                    lastName.includes(contactSearch);
            });
        }

        if (searchFields.email) {
            filtered = filtered.filter(address =>
                address.email?.toLowerCase().includes(searchFields.email.toLowerCase())
            );
        }

        if (searchFields.street) {
            const streetSearch = searchFields.street.toLowerCase();
            filtered = filtered.filter(address => {
                const street1 = (address.street || '').toLowerCase();
                const street2 = (address.street2 || '').toLowerCase();
                return street1.includes(streetSearch) || street2.includes(streetSearch);
            });
        }

        if (searchFields.city) {
            filtered = filtered.filter(address =>
                address.city?.toLowerCase().includes(searchFields.city.toLowerCase())
            );
        }

        if (searchFields.state) {
            filtered = filtered.filter(address =>
                address.state?.toLowerCase().includes(searchFields.state.toLowerCase())
            );
        }

        if (searchFields.postalCode) {
            filtered = filtered.filter(address =>
                address.postalCode?.toLowerCase().includes(searchFields.postalCode.toLowerCase())
            );
        }

        if (searchFields.country) {
            filtered = filtered.filter(address =>
                address.country?.toLowerCase().includes(searchFields.country.toLowerCase())
            );
        }

        // Apply filters
        if (filters.country !== 'all') {
            filtered = filtered.filter(address => address.country === filters.country);
        }

        return filtered;
    }, [addresses, globalSearchQuery, searchFields, filters]);

    // Pagination
    const paginatedAddresses = React.useMemo(() => {
        const start = page * rowsPerPage;
        return filteredAddresses.slice(start, start + rowsPerPage);
    }, [filteredAddresses, page, rowsPerPage]);

    // Get unique countries for filter dropdown
    const availableCountries = React.useMemo(() => {
        const countries = [...new Set(addresses.map(addr => addr.country).filter(Boolean))];
        return countries.sort();
    }, [addresses]);



    // Function to refresh all addresses
    const fetchAllAddresses = React.useCallback(async () => {
        setLoading(true);
        try {
            const allAddresses = [];

            // Fetch addresses for each company - ONLY CUSTOMER ADDRESSES (shipping addresses)
            for (const company of companies) {
                const addressesRef = collection(db, 'addressBook');
                const q = query(
                    addressesRef,
                    where('companyID', '==', company.companyID),
                    where('status', '!=', 'deleted')
                );

                const querySnapshot = await getDocs(q);
                const rawAddresses = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    ownerCompanyName: company.name, // Add company name for display
                    ownerCompanyLogo: company.logo || company.logoUrl // Add company logo for display
                }));

                // Filter for customer addresses only
                const customerAddresses = rawAddresses.filter(addr => addr.addressClass === 'customer');
                allAddresses.push(...customerAddresses);
            }

            // Now fetch customer owner information for customer addresses
            const enrichedAddresses = await Promise.all(
                allAddresses.map(async (address, index) => {
                    // Check for customer addresses - try multiple conditions
                    const isCustomerAddress = address.addressClass === 'customer' ||
                        address.companyName; // If it has a business name, it might be a customer

                    if (isCustomerAddress && (address.addressClassID || address.companyName)) {
                        try {
                            let customerData = null;

                            // First try to find by addressClassID
                            if (address.addressClassID) {
                                const customerQuery = query(
                                    collection(db, 'customers'),
                                    where('customerID', '==', address.addressClassID),
                                    limit(1)
                                );
                                const customerSnapshot = await getDocs(customerQuery);

                                if (!customerSnapshot.empty) {
                                    customerData = customerSnapshot.docs[0].data();
                                }
                            }

                            // If not found by addressClassID, try to find by company name
                            if (!customerData && address.companyName) {
                                const customerByNameQuery = query(
                                    collection(db, 'customers'),
                                    where('name', '==', address.companyName),
                                    limit(1)
                                );
                                const customerByNameSnapshot = await getDocs(customerByNameQuery);

                                if (!customerByNameSnapshot.empty) {
                                    customerData = customerByNameSnapshot.docs[0].data();
                                }
                            }

                            if (customerData) {
                                // Show the customer name instead of the master company
                                return {
                                    ...address,
                                    customerOwnerName: customerData.name || customerData.customerID,
                                    customerOwnerLogo: customerData.logo || customerData.logoUrl || null,
                                    customerOwnerCompanyID: customerData.customerID
                                };
                            }
                        } catch (error) {
                            console.error('Error fetching customer owner data:', error);
                        }
                    }
                    return address;
                })
            );

            // Sort by company name, then by address company name
            enrichedAddresses.sort((a, b) => {
                const companyCompare = (a.ownerCompanyName || '').localeCompare(b.ownerCompanyName || '');
                if (companyCompare !== 0) return companyCompare;
                return (a.companyName || '').localeCompare(b.companyName || '');
            });

            setAddresses(enrichedAddresses);
            setTotalCount(enrichedAddresses.length);
        } catch (error) {
            console.error('Error fetching addresses:', error);
        } finally {
            setLoading(false);
        }
    }, [companies]);

    // Search handlers
    const handleGlobalSearchChange = (event) => {
        setGlobalSearchQuery(event.target.value);
        setPage(0);
    };

    const handleSearchFieldChange = (field, value) => {
        setSearchFields(prev => ({
            ...prev,
            [field]: value
        }));
        setPage(0);
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
        setPage(0);
    };

    const clearAllFilters = () => {
        setGlobalSearchQuery('');
        setSearchFields({
            companyName: '',
            contactName: '',
            email: '',
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
        });
        setFilters({
            country: 'all'
        });
        setPage(0);
    };

    // Check if any filters are active
    const hasActiveFilters = React.useMemo(() => {
        return globalSearchQuery ||
            Object.values(searchFields).some(value => value.trim()) ||
            Object.values(filters).some(value => value !== 'all');
    }, [globalSearchQuery, searchFields, filters]);

    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = new Set(filteredAddresses.map(address => address.id));
            setSelectedAddresses(newSelected);
        } else {
            setSelectedAddresses(new Set());
        }
    };

    const handleSelectAddress = (addressId, event) => {
        event.stopPropagation();
        const newSelected = new Set(selectedAddresses);
        if (newSelected.has(addressId)) {
            newSelected.delete(addressId);
        } else {
            newSelected.add(addressId);
        }
        setSelectedAddresses(newSelected);
    };

    const isSelected = (addressId) => selectedAddresses.has(addressId);

    // Sliding navigation handlers
    const handleViewAddress = (address) => {
        setIsSliding(true);
        setTimeout(() => {
            setSelectedAddress(address);
            setSelectedAddressId(address.id);
            setCurrentView('detail');
            setIsSliding(false);
        }, 150);
    };

    const handleEditAddress = (address) => {
        setIsSliding(true);
        setTimeout(() => {
            setSelectedAddress(address);
            setSelectedAddressId(address.id);
            setCurrentView('edit');
            setIsSliding(false);
        }, 150);
    };

    const handleAddAddress = () => {
        setIsSliding(true);
        setTimeout(() => {
            setSelectedAddress(null);
            setSelectedAddressId(null);
            setCurrentView('add');
            setIsSliding(false);
        }, 150);
    };

    const handleBackToTable = () => {
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('table');
            setSelectedAddress(null);
            setSelectedAddressId(null);
            setIsSliding(false);
            // Refresh data when returning to table
            fetchAllAddresses();
        }, 150);
    };

    const handleBackToDetail = () => {
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('detail');
            setIsSliding(false);
        }, 150);
    };

    const handleAddressDeleted = () => {
        handleBackToTable();
    };

    const handleAddressUpdated = () => {
        // Refresh the address data and go back to detail view
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('detail');
            setIsSliding(false);
            // Refresh data
            fetchAllAddresses();
        }, 150);
    };

    const handleAddressCreated = (newAddressId) => {
        // Navigate to the new address detail view
        setIsSliding(true);
        setTimeout(async () => {
            // Fetch the new address data
            try {
                const addressDoc = await getDoc(doc(db, 'addressBook', newAddressId));
                if (addressDoc.exists()) {
                    const newAddress = { id: addressDoc.id, ...addressDoc.data() };
                    setSelectedAddress(newAddress);
                    setSelectedAddressId(newAddressId);
                    setCurrentView('detail');
                }
            } catch (error) {
                console.error('Error fetching new address:', error);
                setCurrentView('table');
            }
            setIsSliding(false);
            // Refresh table data
            fetchAllAddresses();
        }, 150);
    };

    // Import handlers
    const handleImportOpen = () => {
        setIsImportDialogOpen(true);
    };

    const handleImportClose = () => {
        setIsImportDialogOpen(false);
    };

    const handleImportComplete = () => {
        fetchAllAddresses(); // Refresh the address list
        setIsImportDialogOpen(false);
    };

    // Actions menu handlers
    const handleActionsMenuOpen = (event, address) => {
        event.stopPropagation();
        setActionsMenuAnchor(event.currentTarget);
        setSelectedAddressForActions(address);
    };

    const handleActionsMenuClose = () => {
        setActionsMenuAnchor(null);
        setSelectedAddressForActions(null);
    };

    const handleActionsView = () => {
        if (selectedAddressForActions) {
            handleViewAddress(selectedAddressForActions);
        }
        handleActionsMenuClose();
    };

    const handleActionsEdit = () => {
        if (selectedAddressForActions) {
            handleEditAddress(selectedAddressForActions);
        }
        handleActionsMenuClose();
    };

    // Navigation handlers
    const handleNavigateToCustomer = (customerOwnerCompanyID) => {
        if (customerOwnerCompanyID) {
            navigate(`/admin/customers/${customerOwnerCompanyID}`);
        }
    };

    const handleNavigateToCompany = (companyID) => {
        if (companyID) {
            // Find the company document ID from the companyID
            const company = companies.find(c => c.companyID === companyID);
            if (company) {
                navigate(`/admin/companies/${company.id}`);
            }
        }
    };

    // Load customers for selected company
    const loadCustomersForCompany = async (companyID) => {
        if (!companyID) {
            setCustomersForSelectedCompany([]);
            return;
        }

        try {
            const customersRef = collection(db, 'customers');
            const q = query(
                customersRef,
                where('companyID', '==', companyID)
            );
            const querySnapshot = await getDocs(q);
            const customers = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`[GlobalAddressList] Loaded ${customers.length} customers for company ${companyID}`);
            console.log('[GlobalAddressList] Customer data:', customers);
            setCustomersForSelectedCompany(customers);
        } catch (error) {
            console.error('Error loading customers:', error);
            setCustomersForSelectedCompany([]);
        }
    };

    // Handle company selection for add address
    const handleCompanySelectionForAdd = (companyID) => {
        setSelectedCompanyForAdd(companyID);
        setSelectedCustomerForAdd(''); // Reset customer selection
        loadCustomersForCompany(companyID);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sliding Container */}
            <Box sx={{
                width: '400%',
                height: '100%',
                display: 'flex',
                transform: currentView === 'table' ? 'translateX(0%)' :
                    currentView === 'detail' ? 'translateX(-25%)' :
                        currentView === 'edit' ? 'translateX(-50%)' : 'translateX(-75%)',
                transition: 'transform 0.3s ease-in-out',
                opacity: isSliding ? 0.8 : 1
            }}>
                {/* Table View */}
                <Box sx={{ width: '25%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Toolbar */}
                    <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f8fafc' }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder={viewMode === 'all' ? "Search addresses across all companies..." : "Search addresses..."}
                                    value={globalSearchQuery}
                                    onChange={handleGlobalSearchChange}
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ color: '#6b7280' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: globalSearchQuery && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={clearAllFilters}
                                                    edge="end"
                                                >
                                                    <ClearIcon />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                    <Button
                                        variant="outlined"
                                        startIcon={<FilterIcon />}
                                        onClick={() => setFiltersOpen(!filtersOpen)}
                                        size="small"
                                    >
                                        Filters
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<ExportIcon />}
                                        disabled={filteredAddresses.length === 0}
                                        size="small"
                                    >
                                        Export
                                    </Button>
                                    {viewMode !== 'all' && (
                                        <Button
                                            variant="outlined"
                                            startIcon={<UploadIcon />}
                                            onClick={handleImportOpen}
                                            size="small"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Import
                                        </Button>
                                    )}
                                </Stack>
                            </Grid>
                        </Grid>

                        {/* Enhanced Advanced Filters - AddressBook Style */}
                        <Collapse in={filtersOpen}>
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <Grid container spacing={2} alignItems="center">
                                    {/* Company Name Search */}
                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                        <TextField
                                            fullWidth
                                            label="Company Name"
                                            placeholder="Search by company"
                                            value={searchFields.companyName}
                                            onChange={(e) => handleSearchFieldChange('companyName', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <BusinessIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchFields.companyName && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSearchFieldChange('companyName', '')}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>

                                    {/* Contact Name Search */}
                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                        <TextField
                                            fullWidth
                                            label="Contact Name"
                                            placeholder="Search by contact"
                                            value={searchFields.contactName}
                                            onChange={(e) => handleSearchFieldChange('contactName', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <PersonIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchFields.contactName && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSearchFieldChange('contactName', '')}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>

                                    {/* Email Search */}
                                    <Grid item xs={12} sm={6} md={4} lg={3}>
                                        <TextField
                                            fullWidth
                                            label="Email"
                                            placeholder="Search by email"
                                            value={searchFields.email}
                                            onChange={(e) => handleSearchFieldChange('email', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <EmailIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchFields.email && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSearchFieldChange('email', '')}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>
                                </Grid>

                                {/* Second Row - Address Fields and Filters */}
                                <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                                    {/* Street Address Search */}
                                    <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                        <TextField
                                            fullWidth
                                            label="Street Address"
                                            placeholder="Search by street"
                                            value={searchFields.street}
                                            onChange={(e) => handleSearchFieldChange('street', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LocationIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchFields.street && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSearchFieldChange('street', '')}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>

                                    {/* City Search */}
                                    <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                        <TextField
                                            fullWidth
                                            label="City"
                                            placeholder="Search by city"
                                            value={searchFields.city}
                                            onChange={(e) => handleSearchFieldChange('city', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchFields.city && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSearchFieldChange('city', '')}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>

                                    {/* State Search */}
                                    <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                        <TextField
                                            fullWidth
                                            label="State/Province"
                                            placeholder="Search by state"
                                            value={searchFields.state}
                                            onChange={(e) => handleSearchFieldChange('state', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchFields.state && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSearchFieldChange('state', '')}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>

                                    {/* Postal Code Search */}
                                    <Grid item xs={12} sm={6} md={1.5} lg={2.4}>
                                        <TextField
                                            fullWidth
                                            label="Postal Code"
                                            placeholder="Search by postal code"
                                            value={searchFields.postalCode}
                                            onChange={(e) => handleSearchFieldChange('postalCode', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchFields.postalCode && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSearchFieldChange('postalCode', '')}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Grid>

                                    {/* Country Filter */}
                                    <Grid item xs={12} sm={6} md={1.5} lg={2.4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                            <Select
                                                value={filters.country}
                                                onChange={(e) => handleFilterChange('country', e.target.value)}
                                                label="Country"
                                                sx={{
                                                    '& .MuiSelect-select': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                }}
                                            >
                                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                                                {availableCountries.map((country) => (
                                                    <MenuItem key={country} value={country} sx={{ fontSize: '12px' }}>
                                                        {country === 'US' ? 'United States' :
                                                            country === 'CA' ? 'Canada' : country}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    {/* Clear Filters Button */}
                                    {hasActiveFilters && (
                                        <Grid item xs={12} sm={12} md={12} lg={12} sx={{ mt: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <Button
                                                    variant="outlined"
                                                    onClick={clearAllFilters}
                                                    startIcon={<ClearIcon />}
                                                    sx={{
                                                        borderColor: '#e2e8f0',
                                                        color: '#64748b',
                                                        fontSize: '12px',
                                                        '&:hover': {
                                                            borderColor: '#cbd5e1',
                                                            bgcolor: '#f8fafc'
                                                        }
                                                    }}
                                                >
                                                    Clear All
                                                </Button>
                                            </Box>
                                        </Grid>
                                    )}
                                </Grid>

                                {/* Active Filters Display */}
                                {hasActiveFilters && (
                                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        <Typography variant="body2" sx={{ color: '#64748b', mr: 1, display: 'flex', alignItems: 'center' }}>
                                            <FilterAltIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                            Active Filters:
                                        </Typography>
                                        {globalSearchQuery && (
                                            <Chip
                                                label={`Global search: ${globalSearchQuery}`}
                                                onDelete={() => setGlobalSearchQuery('')}
                                                size="small"
                                                sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                            />
                                        )}
                                        {Object.entries(searchFields).map(([key, value]) => value && (
                                            <Chip
                                                key={key}
                                                label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}`}
                                                onDelete={() => handleSearchFieldChange(key, '')}
                                                size="small"
                                                sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                            />
                                        ))}
                                        {Object.entries(filters).map(([key, value]) => value !== 'all' && (
                                            <Chip
                                                key={key}
                                                label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${key === 'country' && value === 'US' ? 'United States' :
                                                    key === 'country' && value === 'CA' ? 'Canada' :
                                                        value
                                                    }`}
                                                onDelete={() => handleFilterChange(key, 'all')}
                                                size="small"
                                                sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Collapse>
                    </Box>

                    {/* Add Address Section for Super Admins */}
                    {userRole === 'superadmin' && (
                        <Box sx={{
                            p: 2,
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e0e0e0'
                        }}>
                            <Typography variant="h6" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                🔑 Super Admin: Create Address for Any Customer
                            </Typography>

                            <Grid container spacing={2} alignItems="center">
                                {/* Company Selection */}
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Select Company</InputLabel>
                                        <Select
                                            value={selectedCompanyForAdd}
                                            onChange={(e) => handleCompanySelectionForAdd(e.target.value)}
                                            label="Select Company"
                                            sx={{
                                                '& .MuiSelect-select': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                        >
                                            {companies.map((company) => (
                                                <MenuItem key={company.companyID} value={company.companyID} sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                        <Avatar
                                                            src={company.logoURL || company.logo || company.logoUrl}
                                                            sx={{
                                                                width: 28,
                                                                height: 28,
                                                                bgcolor: company.logoURL || company.logo || company.logoUrl ? 'transparent' : '#1976d2',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                border: '1px solid #e5e7eb'
                                                            }}
                                                        >
                                                            {(!company.logoURL && !company.logo && !company.logoUrl) && (
                                                                <BusinessIcon sx={{ fontSize: '14px', color: 'white' }} />
                                                            )}
                                                        </Avatar>
                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                {company.name}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                {company.companyID}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* Customer Selection */}
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Select Customer</InputLabel>
                                        <Select
                                            value={selectedCustomerForAdd}
                                            onChange={(e) => setSelectedCustomerForAdd(e.target.value)}
                                            label="Select Customer"
                                            disabled={!selectedCompanyForAdd || customersForSelectedCompany.length === 0}
                                            sx={{
                                                '& .MuiSelect-select': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                        >
                                            {customersForSelectedCompany.length === 0 ? (
                                                <MenuItem disabled sx={{ fontSize: '12px' }}>
                                                    {selectedCompanyForAdd ? 'No customers available' : 'Select company first'}
                                                </MenuItem>
                                            ) : (
                                                customersForSelectedCompany.map((customer) => (
                                                    <MenuItem key={customer.customerID} value={customer.customerID} sx={{ fontSize: '12px' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                            <Avatar
                                                                src={customer.logoURL || customer.logo || customer.logoUrl || customer.companyLogo}
                                                                sx={{
                                                                    width: 28,
                                                                    height: 28,
                                                                    bgcolor: (customer.logoURL || customer.logo || customer.logoUrl || customer.companyLogo) ? 'transparent' : '#059669',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    border: '1px solid #e5e7eb'
                                                                }}
                                                            >
                                                                {(!customer.logoURL && !customer.logo && !customer.logoUrl && !customer.companyLogo) && (customer.name || customer.customerID).charAt(0).toUpperCase()}
                                                            </Avatar>
                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {customer.name || customer.customerID}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                    {customer.customerID}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </MenuItem>
                                                ))
                                            )}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* Add Address Button */}
                                <Grid item xs={12} md={4}>
                                    <Button
                                        variant="contained"
                                        startIcon={<Add />}
                                        onClick={handleAddAddress}
                                        disabled={!selectedCompanyForAdd || !selectedCustomerForAdd}
                                        fullWidth
                                        size="small"
                                        sx={{
                                            fontSize: '12px',
                                            height: '40px'
                                        }}
                                    >
                                        Add Customer Address
                                    </Button>
                                </Grid>
                            </Grid>

                            {/* Info Message */}
                            {selectedCompanyForAdd && selectedCustomerForAdd && (
                                <Alert severity="info" sx={{ mt: 2, fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        Ready to create address for <strong>{customersForSelectedCompany.find(c => c.customerID === selectedCustomerForAdd)?.name || selectedCustomerForAdd}</strong>
                                        {' '}in company <strong>{companies.find(c => c.companyID === selectedCompanyForAdd)?.name}</strong>.
                                    </Typography>
                                </Alert>
                            )}
                        </Box>
                    )}

                    {/* Table */}
                    <Box sx={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
                        <Box sx={{ width: '100%', px: 2 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox" sx={{ width: 40, maxWidth: 40, minWidth: 40 }}>
                                            <Checkbox
                                                checked={selectedAddresses.size === filteredAddresses.length && filteredAddresses.length > 0}
                                                indeterminate={selectedAddresses.size > 0 && selectedAddresses.size < filteredAddresses.length}
                                                onChange={handleSelectAll}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Business Name</TableCell>
                                        {viewMode === 'all' && <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company Owner</TableCell>}
                                        <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customer Owner</TableCell>
                                        <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Contact</TableCell>
                                        <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Email</TableCell>
                                        <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Phone</TableCell>
                                        <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Address</TableCell>
                                        <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px', width: 80 }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedAddresses.length === 0 && filteredAddresses.length === 0 && hasActiveFilters ? (
                                        <TableRow>
                                            <TableCell colSpan={viewMode === 'all' ? 9 : 8} sx={{ textAlign: 'center', py: 4 }}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                                    <SearchOffIcon sx={{ fontSize: 48, color: '#9ca3af' }} />
                                                    <Typography variant="h6" sx={{ color: '#6b7280' }}>
                                                        No addresses found
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                                        Try adjusting your search criteria
                                                    </Typography>
                                                    <Button
                                                        variant="outlined"
                                                        onClick={clearAllFilters}
                                                        size="small"
                                                        sx={{ mt: 1 }}
                                                    >
                                                        Clear Filters
                                                    </Button>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : paginatedAddresses.length === 0 && filteredAddresses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={viewMode === 'all' ? 9 : 8} sx={{ textAlign: 'center', py: 4 }}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                                    <BusinessIcon sx={{ fontSize: 48, color: '#9ca3af' }} />
                                                    <Typography variant="h6" sx={{ color: '#6b7280' }}>
                                                        No addresses available
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                                        Select a specific company to view and manage addresses
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedAddresses.map((address) => (
                                            <TableRow
                                                key={address.id}
                                                hover
                                                selected={isSelected(address.id)}
                                            >
                                                <TableCell padding="checkbox" sx={{ width: 40, maxWidth: 40, minWidth: 40 }}>
                                                    <Checkbox
                                                        checked={isSelected(address.id)}
                                                        onChange={(e) => handleSelectAddress(address.id, e)}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Typography
                                                        variant="body2"
                                                        component="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewAddress(address);
                                                        }}
                                                        sx={{
                                                            fontSize: '12px',
                                                            fontWeight: 400,
                                                            color: '#1976d2',
                                                            textDecoration: 'none',
                                                            cursor: 'pointer',
                                                            background: 'none',
                                                            border: 'none',
                                                            padding: 0,
                                                            textAlign: 'left',
                                                            '&:hover': {
                                                                textDecoration: 'underline'
                                                            }
                                                        }}
                                                    >
                                                        {address.companyName || 'N/A'}
                                                    </Typography>
                                                </TableCell>
                                                {viewMode === 'all' && (
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <Avatar
                                                                src={address.ownerCompanyLogo || ''}
                                                                sx={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    bgcolor: address.ownerCompanyLogo ? 'transparent' : '#059669',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    border: '1px solid #e5e7eb'
                                                                }}
                                                            >
                                                                {!address.ownerCompanyLogo && (address.ownerCompanyName || 'N/A').charAt(0).toUpperCase()}
                                                            </Avatar>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                                                <Typography
                                                                    variant="body2"
                                                                    component="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleNavigateToCompany(address.companyID);
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        color: '#1976d2',
                                                                        textDecoration: 'none',
                                                                        cursor: 'pointer',
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        padding: 0,
                                                                        textAlign: 'left',
                                                                        '&:hover': {
                                                                            textDecoration: 'underline'
                                                                        }
                                                                    }}
                                                                >
                                                                    {address.ownerCompanyName || 'N/A'}
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                    ({address.companyID || 'N/A'})
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                )}
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {address.addressClass === 'customer' && address.customerOwnerName ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <Avatar
                                                                src={address.customerOwnerLogo || ''}
                                                                sx={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    bgcolor: address.customerOwnerLogo ? 'transparent' : '#1976d2',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    border: '1px solid #e5e7eb'
                                                                }}
                                                            >
                                                                {!address.customerOwnerLogo && address.customerOwnerName.charAt(0).toUpperCase()}
                                                            </Avatar>
                                                            <Typography
                                                                variant="body2"
                                                                component="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleNavigateToCustomer(address.customerOwnerCompanyID);
                                                                }}
                                                                sx={{
                                                                    fontSize: '12px',
                                                                    fontWeight: 500,
                                                                    color: '#1976d2',
                                                                    textDecoration: 'none',
                                                                    cursor: 'pointer',
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    padding: 0,
                                                                    textAlign: 'left',
                                                                    '&:hover': {
                                                                        textDecoration: 'underline'
                                                                    }
                                                                }}
                                                            >
                                                                {address.customerOwnerName}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                            N/A
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                        {`${address.firstName || ''} ${address.lastName || ''}`.trim() || 'N/A'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                        {address.email || 'N/A'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                        {address.phone || 'N/A'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                        {`${address.street || ''}${address.street2 ? `, ${address.street2}` : ''}`}
                                                        <br />
                                                        {`${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleActionsMenuOpen(e, address)}
                                                        sx={{ color: '#6b7280' }}
                                                    >
                                                        <MoreVertIcon sx={{ fontSize: 18 }} />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    </Box>

                    {/* Actions Menu */}
                    <Menu
                        anchorEl={actionsMenuAnchor}
                        open={Boolean(actionsMenuAnchor)}
                        onClose={handleActionsMenuClose}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        PaperProps={{
                            sx: {
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                minWidth: 120
                            }
                        }}
                    >
                        <MenuItem onClick={handleActionsView} sx={{ fontSize: '12px', py: 1 }}>
                            <ListItemIcon>
                                <ViewIcon sx={{ fontSize: 16 }} />
                            </ListItemIcon>
                            <ListItemText primary="View" sx={{ '& .MuiTypography-root': { fontSize: '12px' } }} />
                        </MenuItem>
                        <MenuItem onClick={handleActionsEdit} sx={{ fontSize: '12px', py: 1 }}>
                            <ListItemIcon>
                                <EditIcon sx={{ fontSize: 16 }} />
                            </ListItemIcon>
                            <ListItemText primary="Edit" sx={{ '& .MuiTypography-root': { fontSize: '12px' } }} />
                        </MenuItem>
                    </Menu>

                    {/* Pagination */}
                    <Box sx={{ flexShrink: 0, borderTop: '1px solid #e0e0e0', bgcolor: '#fafafa', mt: 2, mx: 2 }}>
                        <ShipmentsPagination
                            totalItems={filteredAddresses.length}
                            itemsPerPage={rowsPerPage}
                            currentPage={page}
                            onPageChange={(newPage) => setPage(newPage)}
                            onItemsPerPageChange={(newRowsPerPage) => {
                                setRowsPerPage(newRowsPerPage);
                                setPage(0);
                            }}
                            itemName="addresses"
                        />
                    </Box>

                </Box>

                {/* Detail View */}
                <Box sx={{ width: '25%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {currentView === 'detail' && selectedAddress && (
                        <AddressDetail
                            addressId={selectedAddressId}
                            onEdit={() => handleEditAddress(selectedAddress)}
                            onBack={handleBackToTable}
                            onDelete={handleAddressDeleted}
                            isModal={true}
                        />
                    )}
                </Box>

                {/* Edit View */}
                <Box sx={{ width: '25%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {currentView === 'edit' && selectedAddressId && (
                        <AddressForm
                            addressId={selectedAddressId}
                            onCancel={handleBackToDetail}
                            onSuccess={handleAddressUpdated}
                            isModal={true}
                        />
                    )}
                </Box>

                {/* Add View */}
                <Box sx={{ width: '25%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {currentView === 'add' && (
                        <AddressForm
                            onCancel={handleBackToTable}
                            onSuccess={handleAddressCreated}
                            isModal={true}
                            companyId={selectedCompanyForAdd}
                            customerId={selectedCustomerForAdd}
                        />
                    )}
                </Box>
            </Box>

            {/* Import Dialog */}
            {isImportDialogOpen && (
                <AddressImport
                    onClose={handleImportClose}
                    onImportComplete={handleImportComplete}
                />
            )}


        </Box>
    );
};

export default GlobalAddressList; 