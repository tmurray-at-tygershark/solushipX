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
    ListItemText,
    Skeleton
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
    Add as AddIcon,
    ArrowBack,
    Edit as EditIcon,
    CloudUpload as UploadIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    Delete as DeleteIcon
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

    // State for customer selection
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('all');
    const [loadingCustomers, setLoadingCustomers] = useState(false);

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

    // Load customers for selected company
    const loadCustomersForCompany = useCallback(async (companyId) => {
        if (!companyId || companyId === 'all') {
            setAvailableCustomers([]);
            setSelectedCustomerId('all');
            return;
        }

        setLoadingCustomers(true);
        try {
            const customersRef = collection(db, 'customers');
            const q = query(
                customersRef,
                where('companyID', '==', companyId)
            );
            const customersSnapshot = await getDocs(q);
            const customers = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort customers by name
            customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            console.log(`Loaded ${customers.length} customers for company ${companyId}`);
            setAvailableCustomers(customers);
            setSelectedCustomerId('all'); // Reset customer selection when company changes
        } catch (error) {
            console.error('Error loading customers:', error);
            setAvailableCustomers([]);
            setSelectedCustomerId('all');
        } finally {
            setLoadingCustomers(false);
        }
    }, []);

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
            // Clear customers when "all" is selected
            setAvailableCustomers([]);
            setSelectedCustomerId('all');
            // Don't set company context for "all" mode to prevent the AddressBook 
            // component from filtering to a single company
        } else {
            // Set to single company mode
            setViewMode('single');

            // Find the selected company data
            const company = availableCompanies.find(c => c.companyID === companyId);
            console.log('[GlobalAddressList] Found company data:', company);
            setSelectedCompanyData(company);

            // Load customers for this company
            loadCustomersForCompany(companyId);

            // Update the company context for AddressBook
            if (company) {
                console.log('[GlobalAddressList] Setting company context:', company.companyID);
                setCompanyContext(company);
            }
        }

        // Trigger refresh of AddressBook
        setRefreshKey(prev => prev + 1);
    }, [availableCompanies, setCompanyContext, userRole, loadCustomersForCompany]);

    // Handle customer selection change
    const handleCustomerChange = useCallback((event) => {
        const customerId = event.target.value;
        console.log('[GlobalAddressList] Customer changed to:', customerId);
        setSelectedCustomerId(customerId);

        // Trigger refresh of AddressBook
        setRefreshKey(prev => prev + 1);
    }, []);

    // Loading state
    if (authLoading || companyLoading || loadingCompanies) {
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}>
                {/* Header Section Skeleton */}
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    {/* Title Row Skeleton */}
                    <Box sx={{ mb: 2 }}>
                        <Skeleton variant="text" width={200} height={32} sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width={400} height={16} />
                    </Box>

                    {/* Breadcrumb and Filter Row Skeleton */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Skeleton variant="text" width={150} height={20} />
                        <Skeleton variant="rectangular" width={300} height={40} sx={{ borderRadius: 1 }} />
                    </Box>
                </Box>

                {/* Main Content Area Skeleton */}
                <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <Paper sx={{
                        height: '100%',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: 'none',
                        p: 2
                    }}>
                        {/* Toolbar Skeleton */}
                        <Box sx={{ mb: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={6}>
                                    <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
                                        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
                                        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Box>

                        {/* Table Skeleton */}
                        <Box sx={{ flex: 1 }}>
                            {Array.from({ length: 8 }).map((_, index) => (
                                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 1 }}>
                                    <Skeleton variant="rectangular" width={20} height={20} />
                                    <Skeleton variant="text" width={150} />
                                    <Skeleton variant="circular" width={32} height={32} />
                                    <Skeleton variant="text" width={120} />
                                    <Skeleton variant="text" width={140} />
                                    <Skeleton variant="text" width={100} />
                                    <Skeleton variant="text" width={180} />
                                    <Skeleton variant="circular" width={24} height={24} />
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </Box>
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

                    {/* Filter Controls */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        {/* Company Selector */}
                        <FormControl
                            size="small"
                            sx={{
                                minWidth: 250,
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
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
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

                        {/* Customer Selector */}
                        <FormControl
                            size="small"
                            disabled={selectedCompanyId === 'all' || loadingCustomers}
                            sx={{
                                minWidth: 200,
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiSelect-select': { fontSize: '12px' }
                            }}
                        >
                            <InputLabel id="customer-select-label">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <PersonIcon sx={{ fontSize: 16 }} />
                                    Filter by Customer
                                </Box>
                            </InputLabel>
                            <Select
                                labelId="customer-select-label"
                                value={selectedCustomerId}
                                onChange={handleCustomerChange}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <PersonIcon sx={{ fontSize: 16 }} />
                                        Filter by Customer
                                    </Box>
                                }
                            >
                                {/* All Customers Option */}
                                <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        <ViewListIcon sx={{ fontSize: 18, color: '#059669' }} />
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            All Customers
                                        </Typography>
                                        {availableCustomers.length > 0 && (
                                            <Chip
                                                label={`${availableCustomers.length} Total`}
                                                size="small"
                                                color="primary"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '10px',
                                                    ml: 'auto'
                                                }}
                                            />
                                        )}
                                    </Box>
                                </MenuItem>

                                {/* Individual Customers */}
                                {availableCustomers.map(customer => (
                                    <MenuItem
                                        key={customer.customerID}
                                        value={customer.customerID}
                                        sx={{ fontSize: '12px' }}
                                    >
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
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {customer.customerID}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </MenuItem>
                                ))}

                                {/* Empty state when no customers available */}
                                {selectedCompanyId !== 'all' && !loadingCustomers && availableCustomers.length === 0 && (
                                    <MenuItem disabled sx={{ fontSize: '12px' }}>
                                        <Typography sx={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                                            No customers found for this company
                                        </Typography>
                                    </MenuItem>
                                )}

                                {/* Loading state */}
                                {loadingCustomers && (
                                    <MenuItem disabled sx={{ fontSize: '12px' }}>
                                        <Typography sx={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                                            Loading customers...
                                        </Typography>
                                    </MenuItem>
                                )}
                            </Select>
                        </FormControl>
                    </Box>
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
                        selectedCustomerId={selectedCustomerId}
                        viewMode={viewMode}
                    />
                </Paper>
            </Box>

        </Box>
    );
};

// Custom component to show addresses from all companies with full table functionality
const AllCompaniesAddressView = ({ companies, userRole, selectedCompanyId = 'all', selectedCustomerId = 'all', viewMode = 'all' }) => {
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

    // Enhanced filter function with comprehensive logic
    const filteredAddresses = React.useMemo(() => {
        let filtered = addresses;

        // Apply global search
        if (globalSearchQuery) {
            filtered = filtered.filter(address => {
                const term = globalSearchQuery.toLowerCase();
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
                    // Concatenated fields
                    `${address.firstName || ''} ${address.lastName || ''}`.trim(),
                    `${address.street || ''} ${address.street2 ? `, ${address.street2}` : ''}`.trim(),
                    `${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim(),
                ];
                return searchableFields.some(field =>
                    field && String(field).toLowerCase().includes(term)
                );
            });
        }

        // Apply customer filter
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filtered = filtered.filter(address =>
                address.addressClassID === selectedCustomerId ||
                address.customerOwnerCompanyID === selectedCustomerId
            );
        }

        return filtered;
    }, [addresses, globalSearchQuery, selectedCustomerId]);

    // Fetch addresses effect
    useEffect(() => {
        const fetchAllAddresses = async () => {
            setLoading(true);
            try {
                const allAddresses = [];

                // Fetch addresses for each company - ONLY CUSTOMER ADDRESSES
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
                        ownerCompanyName: company.name,
                        ownerCompanyLogo: company.logo || company.logoUrl
                    }));

                    // Filter for customer addresses only
                    const customerAddresses = rawAddresses.filter(addr => addr.addressClass === 'customer');
                    allAddresses.push(...customerAddresses);
                }

                // Enrich with customer data
                const enrichedAddresses = await Promise.all(
                    allAddresses.map(async (address) => {
                        if (address.addressClassID) {
                            try {
                                const customerQuery = query(
                                    collection(db, 'customers'),
                                    where('customerID', '==', address.addressClassID),
                                    limit(1)
                                );
                                const customerSnapshot = await getDocs(customerQuery);

                                if (!customerSnapshot.empty) {
                                    const customerData = customerSnapshot.docs[0].data();
                                    return {
                                        ...address,
                                        customerOwnerName: customerData.name || customerData.customerID,
                                        customerOwnerLogo: customerData.logo || customerData.logoUrl || null,
                                        customerOwnerCompanyID: customerData.customerID
                                    };
                                }
                            } catch (error) {
                                console.error('Error fetching customer data:', error);
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
        };

        if (companies.length > 0) {
            fetchAllAddresses();
        }
    }, [companies]);

    // Pagination
    const paginatedAddresses = React.useMemo(() => {
        const start = page * rowsPerPage;
        return filteredAddresses.slice(start, start + rowsPerPage);
    }, [filteredAddresses, page, rowsPerPage]);

    if (loading) {
        return (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading addresses...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Search Toolbar */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f8fafc' }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search addresses..."
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
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
                                    onClick={() => setGlobalSearchQuery('')}
                                    edge="end"
                                >
                                    <ClearIcon />
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                />
            </Box>

            {/* Results Info */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e0e0e0' }}>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Showing {filteredAddresses.length} of {totalCount} customer addresses
                    {selectedCustomerId !== 'all' && ` for selected customer`}
                </Typography>
            </Box>

            {/* Address Table */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {filteredAddresses.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                            No addresses found matching your criteria
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ width: '100%', px: 2 }}>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox" sx={{ width: 48, maxWidth: 48, minWidth: 48 }}>
                                        <Checkbox
                                            checked={selectedAddresses.size === filteredAddresses.length && filteredAddresses.length > 0}
                                            indeterminate={selectedAddresses.size > 0 && selectedAddresses.size < filteredAddresses.length}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setSelectedAddresses(new Set(filteredAddresses.map(addr => addr.id)));
                                                } else {
                                                    setSelectedAddresses(new Set());
                                                }
                                            }}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Company Name
                                    </TableCell>
                                    {viewMode === 'all' && (
                                        <TableCell sx={{
                                            bgcolor: '#f8fafc',
                                            fontWeight: 600,
                                            color: '#374151',
                                            fontSize: '12px'
                                        }}>
                                            Owner Company
                                        </TableCell>
                                    )}
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Customer
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Contact
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Email
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Phone
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Address
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Type
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Status
                                    </TableCell>
                                    <TableCell sx={{
                                        bgcolor: '#f8fafc',
                                        fontWeight: 600,
                                        color: '#374151',
                                        fontSize: '12px'
                                    }}>
                                        Actions
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedAddresses.map((address) => (
                                    <TableRow key={address.id} hover>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedAddresses.has(address.id)}
                                                onChange={(event) => {
                                                    const newSelected = new Set(selectedAddresses);
                                                    if (event.target.checked) {
                                                        newSelected.add(address.id);
                                                    } else {
                                                        newSelected.delete(address.id);
                                                    }
                                                    setSelectedAddresses(newSelected);
                                                }}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    color: '#1976d2',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    '&:hover': {
                                                        color: '#1565c0'
                                                    }
                                                }}
                                                onClick={() => {
                                                    // TODO: Add view address detail functionality
                                                    console.log('View address:', address.id);
                                                }}
                                            >
                                                {address.companyName || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        {viewMode === 'all' && (
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                                                    <Avatar
                                                        src={address.ownerCompanyLogo}
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            bgcolor: '#1976d2',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            border: '1px solid #e5e7eb',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {!address.ownerCompanyLogo && (
                                                            <BusinessIcon sx={{ fontSize: '16px', color: 'white' }} />
                                                        )}
                                                    </Avatar>
                                                    <Typography sx={{
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        minWidth: 0
                                                    }}>
                                                        {address.ownerCompanyName}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                                                <Avatar
                                                    src={address.customerOwnerLogo}
                                                    sx={{
                                                        width: 28,
                                                        height: 28,
                                                        bgcolor: '#059669',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        border: '1px solid #e5e7eb',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    {!address.customerOwnerLogo && (address.customerOwnerName || 'C').charAt(0).toUpperCase()}
                                                </Avatar>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography sx={{
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {address.customerOwnerName || 'Unknown Customer'}
                                                    </Typography>
                                                    <Typography sx={{
                                                        fontSize: '11px',
                                                        color: '#6b7280',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {address.customerOwnerCompanyID || address.addressClassID}
                                                    </Typography>
                                                </Box>
                                            </Box>
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
                                            <Chip
                                                label={address.isResidential ? 'Residential' : 'Commercial'}
                                                size="small"
                                                color={address.isResidential ? 'warning' : 'primary'}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={address.status === 'active' ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={address.status === 'active' ? 'success' : 'default'}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        // TODO: Add view functionality
                                                        console.log('View address:', address.id);
                                                    }}
                                                    title="View Address"
                                                >
                                                    <VisibilityIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        // TODO: Add edit functionality
                                                        console.log('Edit address:', address.id);
                                                    }}
                                                    title="Edit Address"
                                                >
                                                    <EditIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        // TODO: Add delete functionality
                                                        console.log('Delete address:', address.id);
                                                    }}
                                                    title="Delete Address"
                                                    color="error"
                                                >
                                                    <DeleteIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                )}
            </Box>

            {/* Pagination */}
            {filteredAddresses.length > 0 && (
                <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', bgcolor: '#fafafa' }}>
                    <ShipmentsPagination
                        count={filteredAddresses.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={(newPage) => setPage(newPage)}
                        onRowsPerPageChange={(newRowsPerPage) => {
                            setRowsPerPage(newRowsPerPage);
                            setPage(0);
                        }}
                        showFirstButton
                        showLastButton
                    />
                </Box>
            )}
        </Box>
    );
};

export default GlobalAddressList; 