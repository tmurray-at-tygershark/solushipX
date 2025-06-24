import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    TextField,
    Chip,
    Tooltip,
    Stack,
    InputAdornment,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Tabs,
    Tab,
    Badge,
    Collapse,
    Grid,
    Checkbox,
    Avatar
} from '@mui/material';
import {
    Add as AddIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
    Search as SearchIcon,
    DeleteForever as DeleteForeverIcon,
    Apartment as ApartmentIcon,
    FilterList as FilterListIcon,
    FileDownload as ExportIcon,
    Close as CloseIcon,
    ContentCopy as ContentCopyIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';

// Import reusable components that match ShipmentsX patterns
import ModalHeader from '../../common/ModalHeader';
import AdminBreadcrumb from '../AdminBreadcrumb';

// Skeleton component for loading state
const OrganizationsTableSkeleton = () => {
    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Checkbox disabled />
                            Organization
                        </Box>
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Org ID</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Owner</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Companies</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Last Updated</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {[...Array(10)].map((_, index) => (
                    <TableRow key={index}>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox disabled />
                                <Avatar sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}>
                                    <ApartmentIcon sx={{ fontSize: '14px' }} />
                                </Avatar>
                                <Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} />
                            </Box>
                        </TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '100px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Chip label="Loading" size="small" sx={{ bgcolor: '#e5e7eb', color: 'transparent' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '60px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '90px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
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
const OrganizationsPagination = ({
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
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalCount.toLocaleString()} organizations
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Rows per page:
                    </Typography>
                    <select
                        value={rowsPerPage}
                        onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                        style={{ fontSize: '12px', minWidth: '60px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
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

const OrganizationList = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    // Main data states
    const [organizations, setOrganizations] = useState([]);
    const [allOrganizations, setAllOrganizations] = useState([]);
    const [companyMap, setCompanyMap] = useState({});
    const [ownerMap, setOwnerMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Tab and filter states
    const [selectedTab, setSelectedTab] = useState('all');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selected, setSelected] = useState([]);

    // Filter states
    const [filters, setFilters] = useState({
        status: 'all',
        hasCompanies: 'all'
    });
    const [searchFields, setSearchFields] = useState({
        orgName: '',
        orgId: '',
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
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [orgToDelete, setOrgToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({
            open: true,
            message,
            severity
        });
    }, []);

    // Calculate stats
    const stats = useMemo(() => {
        const total = allOrganizations.length;
        const active = allOrganizations.filter(o => o.status === 'active').length;
        const inactive = allOrganizations.filter(o => o.status === 'inactive').length;
        const withCompanies = allOrganizations.filter(o => o.connectedCompanies && o.connectedCompanies.length > 0).length;
        const withoutCompanies = total - withCompanies;

        return {
            total,
            active,
            inactive,
            withCompanies,
            withoutCompanies
        };
    }, [allOrganizations]);

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
        setPage(1); // Reset to first page when tab changes
    };

    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = organizations.map(org => org.id);
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
    const handleActionMenuOpen = (event, org) => {
        setSelectedOrg(org);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedOrg(null);
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

    // Delete handlers
    const openDeleteDialog = (org) => {
        setOrgToDelete(org);
        setShowDeleteDialog(true);
        handleActionMenuClose();
    };

    const handleConfirmDelete = async () => {
        if (!orgToDelete) return;
        setIsDeleting(true);
        try {
            await setDoc(doc(db, 'organizations', orgToDelete.id), {
                status: 'deleted',
                updatedAt: serverTimestamp()
            }, { merge: true });

            enqueueSnackbar(`Organization '${orgToDelete.name}' deleted successfully.`, { variant: 'success' });
            setShowDeleteDialog(false);
            setOrgToDelete(null);
            fetchOrganizations();
        } catch (err) {
            console.error('Error deleting organization:', err);
            enqueueSnackbar(`Failed to delete organization: ${err.message}`, { variant: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    // Fetch data functions
    const fetchCompaniesAndOwners = async () => {
        try {
            // Fetch companies
            const companiesSnap = await getDocs(collection(db, 'companies'));
            const newCompanyMap = {};
            companiesSnap.forEach(doc => {
                const companyData = doc.data();
                if (companyData.companyID && companyData.name) {
                    newCompanyMap[companyData.companyID] = companyData.name;
                }
            });
            setCompanyMap(newCompanyMap);

            // Fetch users for owner mapping
            const usersSnap = await getDocs(collection(db, 'users'));
            const newOwnerMap = {};
            usersSnap.forEach(doc => {
                const userData = doc.data();
                newOwnerMap[doc.id] = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
            });
            setOwnerMap(newOwnerMap);
        } catch (err) {
            console.error("Error fetching companies and owners:", err);
        }
    };

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const orgsRef = collection(db, 'organizations');
            const q = query(orgsRef, orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            const orgsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Filter out deleted organizations
            const activeOrgs = orgsData.filter(org => org.status !== 'deleted');
            setAllOrganizations(activeOrgs);
            setTotalCount(activeOrgs.length);
        } catch (error) {
            console.error('Error loading organizations:', error);
            showSnackbar('Failed to load organizations', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter and paginate organizations
    useEffect(() => {
        let filtered = [...allOrganizations];

        // Apply tab filter
        if (selectedTab !== 'all') {
            switch (selectedTab) {
                case 'active':
                    filtered = filtered.filter(o => o.status === 'active');
                    break;
                case 'inactive':
                    filtered = filtered.filter(o => o.status === 'inactive');
                    break;
                case 'with-companies':
                    filtered = filtered.filter(o => o.connectedCompanies && o.connectedCompanies.length > 0);
                    break;
                case 'without-companies':
                    filtered = filtered.filter(o => !o.connectedCompanies || o.connectedCompanies.length === 0);
                    break;
            }
        }

        // Apply search filters
        if (searchFields.orgName) {
            filtered = filtered.filter(o =>
                o.name.toLowerCase().includes(searchFields.orgName.toLowerCase())
            );
        }
        if (searchFields.orgId) {
            filtered = filtered.filter(o =>
                o.orgID && o.orgID.toLowerCase().includes(searchFields.orgId.toLowerCase())
            );
        }
        if (searchFields.ownerName) {
            filtered = filtered.filter(o => {
                const ownerName = ownerMap[o.ownerID] || '';
                return ownerName.toLowerCase().includes(searchFields.ownerName.toLowerCase());
            });
        }

        // Apply advanced filters
        if (filters.status !== 'all') {
            filtered = filtered.filter(o => o.status === filters.status);
        }
        if (filters.hasCompanies !== 'all') {
            const hasCompanies = filters.hasCompanies === 'yes';
            filtered = filtered.filter(o => {
                const hasConnectedCompanies = o.connectedCompanies && o.connectedCompanies.length > 0;
                return hasCompanies ? hasConnectedCompanies : !hasConnectedCompanies;
            });
        }

        // Paginate
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedOrgs = filtered.slice(startIndex, endIndex);

        setOrganizations(paginatedOrgs);
        setTotalCount(filtered.length);
    }, [allOrganizations, selectedTab, searchFields, filters, page, rowsPerPage, ownerMap]);

    // Load data on component mount
    useEffect(() => {
        fetchCompaniesAndOwners();
        fetchOrganizations();
    }, []);

    // Format date helper
    const formatDate = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        try {
            return format(timestamp.toDate(), 'MMM d, yyyy');
        } catch (e) {
            return 'Invalid Date';
        }
    };

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
                            Organizations
                        </Typography>
                        {/* Breadcrumb */}
                        {!isModal && (
                            <AdminBreadcrumb currentPage="Organizations" />
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
                            onClick={() => navigate('/admin/organizations/new')}
                            sx={{ fontSize: '12px' }}
                        >
                            Add Organization
                        </Button>
                    </Box>
                </Box>

                {/* Tabs and Filters Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tabs
                        value={selectedTab}
                        onChange={handleTabChange}
                        sx={{
                            '& .MuiTab-root': {
                                fontSize: '11px',
                                minHeight: '36px',
                                textTransform: 'none',
                                fontWeight: 500,
                                padding: '6px 12px'
                            }
                        }}
                    >
                        <Tab label={`All (${stats.total})`} value="all" />
                        <Tab label={`Active (${stats.active})`} value="active" />
                        <Tab label={
                            <Badge badgeContent={stats.inactive} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '10px' } }}>
                                Inactive
                            </Badge>
                        } value="inactive" />
                        <Tab label={`With Companies (${stats.withCompanies})`} value="with-companies" />
                        <Tab label={`No Companies (${stats.withoutCompanies})`} value="without-companies" />
                    </Tabs>

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
                                    placeholder="Search organization name..."
                                    value={searchFields.orgName}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, orgName: e.target.value }))}
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
                                    placeholder="Search org ID..."
                                    value={searchFields.orgId}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, orgId: e.target.value }))}
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
                                    setSearchFields({ orgName: '', orgId: '', ownerName: '' });
                                    setFilters({ status: 'all', hasCompanies: 'all' });
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
                        <OrganizationsTableSkeleton />
                    ) : (
                        <Table sx={{ position: 'sticky', top: 0, zIndex: 100 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Checkbox
                                                indeterminate={selected.length > 0 && selected.length < organizations.length}
                                                checked={organizations.length > 0 && selected.length === organizations.length}
                                                onChange={handleSelectAll}
                                                size="small"
                                            />
                                            Organization
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Org ID</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Owner</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Companies</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Last Updated</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {organizations.map((org) => (
                                    <TableRow key={org.id} hover sx={{ verticalAlign: 'top' }}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Checkbox
                                                    checked={selected.indexOf(org.id) !== -1}
                                                    onChange={() => handleSelect(org.id)}
                                                    size="small"
                                                />
                                                <Avatar sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}>
                                                    <ApartmentIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                                </Avatar>
                                                <Box>
                                                    <Typography
                                                        component={RouterLink}
                                                        to={`/admin/organizations/${org.id}`}
                                                        sx={{
                                                            textDecoration: 'none',
                                                            color: '#1f2937',
                                                            fontWeight: 500,
                                                            fontSize: '12px',
                                                            '&:hover': {
                                                                textDecoration: 'underline',
                                                                color: '#3b82f6'
                                                            }
                                                        }}
                                                    >
                                                        {org.name}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                    {org.orgID || 'N/A'}
                                                </Typography>
                                                {org.orgID && (
                                                    <Tooltip title="Copy Org ID">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyToClipboard(org.orgID, 'Org ID');
                                                            }}
                                                        >
                                                            <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {ownerMap[org.ownerID] || 'No owner assigned'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={org.status || 'unknown'}
                                                size="small"
                                                sx={{
                                                    backgroundColor: getStatusColor(org.status).bgcolor,
                                                    color: getStatusColor(org.status).color,
                                                    fontWeight: 500,
                                                    fontSize: '11px',
                                                    '& .MuiChip-label': { px: 1.5 }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {org.connectedCompanies && org.connectedCompanies.length > 0 ? (
                                                <Tooltip title={org.connectedCompanies.map(id => companyMap[id] || id).join(', ')}>
                                                    <Chip
                                                        label={`${org.connectedCompanies.length}`}
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                </Tooltip>
                                            ) : (
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>0</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {formatDate(org.updatedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleActionMenuOpen(e, org)}
                                            >
                                                <MoreVertIcon sx={{ fontSize: '16px' }} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {organizations.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            <Box sx={{ py: 4 }}>
                                                <ApartmentIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                                <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                    No organizations found
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                    Try adjusting your search criteria or create a new organization
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
                <OrganizationsPagination
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
                    navigate(`/admin/organizations/${selectedOrg.id}`);
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
                    navigate(`/admin/organizations/${selectedOrg.id}/edit`);
                    handleActionMenuClose();
                }}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Edit Organization</Typography>
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={() => selectedOrg && openDeleteDialog(selectedOrg)} sx={{ color: 'error.main' }}>
                    <ListItemIcon>
                        <DeleteForeverIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Delete Organization</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={showDeleteDialog}
                onClose={() => { setShowDeleteDialog(false); setOrgToDelete(null); }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete the organization
                        <strong> "{orgToDelete?.name}"</strong>?
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => { setShowDeleteDialog(false); setOrgToDelete(null); }}
                        disabled={isDeleting}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        color="error"
                        variant="contained"
                        disabled={isDeleting}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {isDeleting ? <CircularProgress size={16} color="inherit" /> : 'Confirm Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
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
                    title="Organizations"
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
        </Box>
    );
};

export default OrganizationList; 