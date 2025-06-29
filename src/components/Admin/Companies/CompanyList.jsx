import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Chip,
    TextField,
    InputAdornment,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,

    Stack,
    Collapse,
    FormControl,
    InputLabel,
    Select,
    Checkbox,
    FormControlLabel,
    Grid,
    Alert,
    Tooltip,
    Avatar,
    Snackbar
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    FileDownload as ExportIcon,
    Business as BusinessIcon,
    ContentCopy as ContentCopyIcon,
    Close as CloseIcon,
    Dashboard as DashboardIcon
} from '@mui/icons-material';
import './CompanyList.css';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Link as MuiLink } from '@mui/material';
import { useCompany } from '../../../contexts/CompanyContext';
import { useAuth } from '../../../contexts/AuthContext';

// Import reusable components that match ShipmentsX patterns
import ModalHeader from '../../common/ModalHeader';
import AdminBreadcrumb from '../AdminBreadcrumb';

// Skeleton component for loading state
const CompaniesTableSkeleton = () => {
    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Checkbox disabled />
                            Business Name
                        </Box>
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Owner</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company ID</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customers</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carriers</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {[...Array(10)].map((_, index) => (
                    <TableRow key={index}>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox disabled />
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        bgcolor: '#e5e7eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    <BusinessIcon sx={{ fontSize: '16px', color: '#9ca3af' }} />
                                </Box>
                                <Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} />
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ width: 32, height: 32, bgcolor: '#e5e7eb', borderRadius: '50%' }} />
                                <Box sx={{ height: '16px', width: '100px', bgcolor: '#e5e7eb', borderRadius: '4px' }} />
                            </Box>
                        </TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '90px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '60px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '60px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell>
                            <IconButton size="small" disabled>
                                <MoreVertIcon />
                            </IconButton>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

// Custom pagination component matching ShipmentsX
const CompaniesPagination = ({
    totalCount,
    currentPage,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange
}) => {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    const startItem = (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalCount);

    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderTop: '1px solid #e5e7eb',
            bgcolor: '#fafafa'
        }}>
            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalCount.toLocaleString()} companies
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Rows per page:
                    </Typography>
                    <Select
                        size="small"
                        value={rowsPerPage}
                        onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                        sx={{ fontSize: '12px', minWidth: '60px' }}
                    >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                    </Select>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        First
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Prev
                    </Button>
                    <Typography variant="body2" sx={{ fontSize: '12px', px: 2, py: 1, bgcolor: '#f3f4f6', borderRadius: '4px' }}>
                        {currentPage} of {totalPages}
                    </Typography>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Next
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Last
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

const CompanyList = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    // Main data states
    const [companies, setCompanies] = useState([]);
    const [allCompanies, setAllCompanies] = useState([]);
    const [owners, setOwners] = useState({});
    const [customerCounts, setCustomerCounts] = useState({});
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Pagination and filter states
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selected, setSelected] = useState([]);

    // Filter states
    const [filters, setFilters] = useState({
        status: 'all',
        hasCarriers: 'all',
        dateRange: [null, null]
    });
    const [searchFields, setSearchFields] = useState({
        companyName: '',
        companyId: '',
        ownerName: ''
    });
    const [filtersOpen, setFiltersOpen] = useState(false);

    // UI states
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialog states
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();
    const { setCompanyContext } = useCompany();
    const { user } = useAuth();

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({
            open: true,
            message,
            severity
        });
    }, []);





    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = companies.map(company => company.id);
            setSelected(newSelected);
            return;
        }
        setSelected([]);
    };

    const handleSelect = (id) => {
        const selectedIndex = selected.indexOf(id);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1),
            );
        }

        setSelected(newSelected);
    };

    // Action menu handlers
    const handleActionMenuOpen = (event, company) => {
        setSelectedCompany(company);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedCompany(null);
        setActionMenuAnchorEl(null);
    };

    // Copy to clipboard handler
    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`${label} copied to clipboard`, 'success');
        } catch (error) {
            showSnackbar(`Failed to copy ${label}`, 'error');
        }
    };

    // Handle dashboard navigation with company context switch
    const handleDashboardNavigation = async (company) => {
        try {
            // Set the company context to the selected company and store current path
            await setCompanyContext({
                companyID: company.companyID,
                name: company.name,
                id: company.id,
                ...company // Include all company data
            }, location.pathname); // Store current admin path for return navigation

            // Navigate to dashboard
            navigate('/dashboard');

            showSnackbar(`Switched to ${company.name} dashboard`, 'success');
        } catch (error) {
            console.error('Error switching company context:', error);
            showSnackbar('Failed to switch company context', 'error');
        }
    };



    // Fetch owners for name lookup
    const fetchOwners = async () => {
        try {
            const usersRef = collection(db, 'users');
            const querySnapshot = await getDocs(usersRef);
            const ownersMap = {};
            querySnapshot.forEach(doc => {
                const user = doc.data();
                ownersMap[doc.id] = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            });
            setOwners(ownersMap);
        } catch (error) {
            console.error('Error fetching owners:', error);
        }
    };

    // Fetch customer counts for each company
    const fetchCustomerCounts = async () => {
        try {
            const customersRef = collection(db, 'customers');
            const querySnapshot = await getDocs(customersRef);
            const counts = {};

            querySnapshot.forEach(doc => {
                const customer = doc.data();
                // Use companyID (capital ID) which is the business identifier field
                const companyID = customer.companyID;
                if (companyID) {
                    counts[companyID] = (counts[companyID] || 0) + 1;
                }
            });

            setCustomerCounts(counts);
        } catch (error) {
            console.error('Error fetching customer counts:', error);
        }
    };

    // Load companies data
    const loadCompanies = async () => {
        setLoading(true);
        try {
            const companiesRef = collection(db, 'companies');
            const q = query(companiesRef, orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            const companiesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setAllCompanies(companiesData);
            setTotalCount(companiesData.length);
        } catch (error) {
            console.error('Error loading companies:', error);
            showSnackbar('Failed to load companies', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter and paginate companies
    useEffect(() => {
        let filtered = [...allCompanies];

        // Apply unified search filter (main search box)
        if (searchFields.companyName) {
            const searchTerm = searchFields.companyName.toLowerCase();
            filtered = filtered.filter(c => {
                const companyName = c.name.toLowerCase();
                const companyId = c.companyID?.toLowerCase() || '';
                const ownerName = (owners[c.ownerID] || '').toLowerCase();

                return companyName.includes(searchTerm) ||
                    companyId.includes(searchTerm) ||
                    ownerName.includes(searchTerm);
            });
        }

        // Apply individual filter fields (advanced filters)
        if (searchFields.companyId && searchFields.companyId !== searchFields.companyName) {
            const searchTerm = searchFields.companyId.toLowerCase();
            filtered = filtered.filter(c => {
                const companyId = c.companyID?.toLowerCase() || '';
                return companyId.includes(searchTerm);
            });
        }

        if (searchFields.ownerName && searchFields.ownerName !== searchFields.companyName) {
            const searchTerm = searchFields.ownerName.toLowerCase();
            filtered = filtered.filter(c => {
                const ownerName = (owners[c.ownerID] || '').toLowerCase();
                return ownerName.includes(searchTerm);
            });
        }

        // Apply advanced filters
        if (filters.status !== 'all') {
            filtered = filtered.filter(c => c.status === filters.status);
        }
        if (filters.hasCarriers !== 'all') {
            const hasCarriers = filters.hasCarriers === 'yes';
            filtered = filtered.filter(c => {
                const hasConnectedCarriers = c.connectedCarriers && c.connectedCarriers.length > 0;
                return hasCarriers ? hasConnectedCarriers : !hasConnectedCarriers;
            });
        }

        // Paginate
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedCompanies = filtered.slice(startIndex, endIndex);

        setCompanies(paginatedCompanies);
        setTotalCount(filtered.length);
    }, [allCompanies, searchFields, filters, page, rowsPerPage, owners]);

    // Load data on component mount
    useEffect(() => {
        loadCompanies();
        fetchOwners();
        fetchCustomerCounts();
    }, []);

    // Get status chip color
    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'inactive':
                return { color: '#dc2626', bgcolor: '#fef2f2' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    // Render table view
    const renderTableView = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                            Companies
                        </Typography>
                        {/* Breadcrumb */}
                        {!isModal && (
                            <AdminBreadcrumb />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ExportIcon />}
                            sx={{ fontSize: '12px' }}
                        >
                            Export
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/admin/companies/new')}
                            sx={{ fontSize: '12px' }}
                        >
                            Add Company
                        </Button>
                    </Box>
                </Box>

                {/* Search Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, maxWidth: '60%' }}>
                        <TextField
                            size="small"
                            placeholder="Search companies, IDs, owners..."
                            value={searchFields.companyName}
                            onChange={(e) => setSearchFields(prev => ({
                                ...prev,
                                companyName: e.target.value
                            }))}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '12px' }
                            }}
                            sx={{ width: '100%', maxWidth: '500px' }}
                        />
                    </Box>

                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FilterListIcon />}
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        sx={{ fontSize: '12px' }}
                    >
                        Filters
                    </Button>
                </Box>

                {/* Filters Panel */}
                <Collapse in={filtersOpen}>
                    <Paper sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search company name..."
                                    value={searchFields.companyName}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, companyName: e.target.value }))}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '16px' }} />
                                            </InputAdornment>
                                        ),
                                        sx: { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search company ID..."
                                    value={searchFields.companyId}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, companyId: e.target.value }))}
                                    InputProps={{
                                        sx: { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search owner name..."
                                    value={searchFields.ownerName}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, ownerName: e.target.value }))}
                                    InputProps={{
                                        sx: { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                        </Grid>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CloseIcon />}
                                onClick={() => {
                                    setSearchFields({ companyName: '', companyId: '', ownerName: '' });
                                    setFilters({ status: 'all', hasCarriers: 'all', dateRange: [null, null] });
                                    setPage(1); // Reset to first page when clearing filters
                                }}
                                sx={{ fontSize: '12px' }}
                            >
                                Clear Filters
                            </Button>
                        </Box>
                    </Paper>
                </Collapse>
            </Box>

            {/* Table Section */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ width: '100%', px: 2 }}>
                    {loading ? (
                        <CompaniesTableSkeleton />
                    ) : (
                        <Table sx={{ position: 'sticky', top: 0, zIndex: 100 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Checkbox
                                                indeterminate={selected.length > 0 && selected.length < companies.length}
                                                checked={companies.length > 0 && selected.length === companies.length}
                                                onChange={handleSelectAll}
                                                size="small"
                                            />
                                            Business Name
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Owner</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company ID</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Customers</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carriers</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {companies.map((company) => (
                                    <TableRow key={company.id} hover sx={{ verticalAlign: 'top' }}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Checkbox
                                                    checked={selected.indexOf(company.id) !== -1}
                                                    onChange={() => handleSelect(company.id)}
                                                    size="small"
                                                />
                                                <Box
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '50%',
                                                        border: '1px solid #e5e7eb',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: '#f8fafc',
                                                        overflow: 'hidden',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    {company.logoUrl ? (
                                                        <Box
                                                            component="img"
                                                            src={company.logoUrl}
                                                            alt={`${company.name} logo`}
                                                            sx={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <Box
                                                        sx={{
                                                            display: company.logoUrl ? 'none' : 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '100%',
                                                            height: '100%',
                                                            color: '#6b7280'
                                                        }}
                                                    >
                                                        <BusinessIcon sx={{ fontSize: '16px' }} />
                                                    </Box>
                                                </Box>
                                                <Box>
                                                    <MuiLink
                                                        component={RouterLink}
                                                        to={`/admin/companies/${company.id}`}
                                                        sx={{
                                                            textDecoration: 'none',
                                                            color: '#3b82f6',
                                                            fontWeight: 700,
                                                            fontSize: '12px',
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                textDecoration: 'none',
                                                                color: '#1d4ed8'
                                                            }
                                                        }}
                                                    >
                                                        {company.name}
                                                    </MuiLink>
                                                    {company.website && (
                                                        <Typography variant="caption" sx={{
                                                            display: 'block',
                                                            color: '#6b7280',
                                                            fontSize: '11px'
                                                        }}>
                                                            {company.website}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        bgcolor: '#3b82f6',
                                                        fontSize: '12px',
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    {owners[company.ownerID] ?
                                                        owners[company.ownerID].split(' ').map(n => n[0]).join('').toUpperCase() :
                                                        'NA'
                                                    }
                                                </Avatar>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {owners[company.ownerID] || 'No owner assigned'}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                    {company.companyID}
                                                </Typography>
                                                <Tooltip title="Copy Company ID">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyToClipboard(company.companyID, 'Company ID');
                                                        }}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {company.createdAt ? format(company.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {customerCounts[company.companyID] || 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {company.connectedCarriers ? company.connectedCarriers.length : 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    startIcon={<DashboardIcon sx={{ fontSize: '14px' }} />}
                                                    onClick={() => handleDashboardNavigation(company)}
                                                    sx={{
                                                        fontSize: '11px',
                                                        textTransform: 'none',
                                                        minWidth: 'auto',
                                                        px: 1,
                                                        py: 0.5
                                                    }}
                                                >
                                                    Dashboard
                                                </Button>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleActionMenuOpen(e, company)}
                                                >
                                                    <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {companies.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            <Box sx={{ py: 4 }}>
                                                <BusinessIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                                <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                    No companies found
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                    Try adjusting your search criteria or create a new company
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </Box>
            </Box>

            {/* Pagination Section */}
            <Box sx={{ flexShrink: 0 }}>
                <CompaniesPagination
                    totalCount={totalCount}
                    currentPage={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                />
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchorEl}
                open={Boolean(actionMenuAnchorEl)}
                onClose={handleActionMenuClose}
            >
                <MenuItem onClick={() => {
                    navigate(`/admin/companies/${selectedCompany.id}`);
                    handleActionMenuClose();
                }}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>View Details</Typography>
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                    navigate(`/admin/companies/${selectedCompany.id}/edit`);
                    handleActionMenuClose();
                }}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Edit Company</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );

    // Main render
    return (
        <Box sx={{
            backgroundColor: 'transparent',
            width: '100%',
            height: '100%'
        }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title="Companies"
                    onClose={onClose}
                    showBackButton={false}
                    showCloseButton={showCloseButton}
                />
            )}

            {/* Main Content */}
            <Box sx={{
                width: '100%',
                height: isModal ? 'calc(100% - 64px)' : '100%',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {renderTableView()}
            </Box>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                message={snackbar.message}
                sx={{
                    '& .MuiSnackbarContent-root': {
                        backgroundColor: snackbar.severity === 'success' ? '#10b981' :
                            snackbar.severity === 'error' ? '#ef4444' : '#3b82f6',
                        fontSize: '12px'
                    }
                }}
            />


        </Box>
    );
};

export default CompanyList; 