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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Tooltip,
    Avatar,
    Stack,
    InputAdornment,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    DialogContentText,
    CircularProgress,
    Tabs,
    Tab,
    Badge,
    Collapse,
    Grid,
    FormControl,
    InputLabel,
    Select,
    Checkbox
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
    Search as SearchIcon,
    Business as BusinessIcon,
    Lock as LockIcon,
    DeleteForever as DeleteForeverIcon,
    Person as PersonIcon,
    FilterList as FilterListIcon,
    FileDownload as ExportIcon,
    Close as CloseIcon,
    ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, functions } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import './Users.css';
import { collection as fbCollection, getDocs as fbGetDocs } from 'firebase/firestore';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { Link as MuiLink } from '@mui/material';

// Import reusable components that match ShipmentsX patterns
import ModalHeader from '../../common/ModalHeader';

// Skeleton component for loading state
const UsersTableSkeleton = () => {
    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Checkbox disabled />
                            User
                        </Box>
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Email</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Role</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Connected Companies</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Last Login</TableCell>
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
                                    <PersonIcon sx={{ fontSize: '14px' }} />
                                </Avatar>
                                <Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} />
                            </Box>
                        </TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '150px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Chip label="Loading" size="small" sx={{ bgcolor: '#e5e7eb', color: 'transparent' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '100px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
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
const UsersPagination = ({
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
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalCount.toLocaleString()} users
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

const UserList = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    // Main data states
    const [users, setUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [userAuthData, setUserAuthData] = useState({});
    const [companyMap, setCompanyMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Tab and filter states
    const [selectedTab, setSelectedTab] = useState('all');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selected, setSelected] = useState([]);

    // Filter states
    const [filters, setFilters] = useState({
        role: 'all',
        hasCompanies: 'all',
        loginStatus: 'all'
    });
    const [searchFields, setSearchFields] = useState({
        name: '',
        email: '',
        companyName: ''
    });
    const [filtersOpen, setFiltersOpen] = useState(false);

    // UI states
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialog states
    const [selectedUser, setSelectedUser] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { userRole } = useAuth();
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
        const total = allUsers.length;
        const superAdmins = allUsers.filter(u => u.role === 'super_admin').length;
        const admins = allUsers.filter(u => u.role === 'admin').length;
        const businessAdmins = allUsers.filter(u => u.role === 'business_admin').length;
        const withCompanies = allUsers.filter(u => u.companiesForDisplay && u.companiesForDisplay.length > 0).length;
        const withoutCompanies = total - withCompanies;

        return {
            total,
            superAdmins,
            admins,
            businessAdmins,
            withCompanies,
            withoutCompanies
        };
    }, [allUsers]);

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
        setPage(1); // Reset to first page when tab changes
    };

    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = users.map(user => user.id);
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
    const handleActionMenuOpen = (event, user) => {
        setSelectedUser(user);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedUser(null);
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
    const openDeleteDialog = (user) => {
        setUserToDelete(user);
        setDeleteDialogOpen(true);
        handleActionMenuClose();
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);

        try {
            const checkOwnershipFunc = httpsCallable(functions, 'checkUserCompanyOwnership');
            const ownershipResult = await checkOwnershipFunc({ userIdToCheck: userToDelete.id });

            if (ownershipResult.data.isOwner) {
                enqueueSnackbar(
                    `Cannot delete ${userToDelete.firstName}: User owns company '${ownershipResult.data.companyName}'. Transfer ownership first.`,
                    { variant: 'error' }
                );
                setDeleteDialogOpen(false);
                setUserToDelete(null);
                setIsDeleting(false);
                return;
            }

            const deleteUserFunc = httpsCallable(functions, 'adminDeleteUser');
            await deleteUserFunc({ userIdToDelete: userToDelete.id });

            enqueueSnackbar(`User ${userToDelete.firstName} ${userToDelete.lastName} deleted successfully.`, { variant: 'success' });
            setDeleteDialogOpen(false);
            setUserToDelete(null);
            fetchUsersAndAuthData();

        } catch (err) {
            console.error('Error during delete process:', err);
            enqueueSnackbar(`Failed to delete user: ${err.message || 'Unknown error'}`, { variant: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    // Fetch data functions
    const fetchUsersAndAuthData = useCallback(async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('lastName'));
            const querySnapshot = await getDocs(q);
            const usersDataFromFirestore = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const companyIds = (data.connectedCompanies && Array.isArray(data.connectedCompanies.companies))
                    ? data.connectedCompanies.companies
                    : [];
                return {
                    id: doc.id,
                    ...data,
                    companiesForDisplay: companyIds
                };
            });

            setAllUsers(usersDataFromFirestore);
            setTotalCount(usersDataFromFirestore.length);

            if (usersDataFromFirestore.length > 0) {
                const uidsToFetch = usersDataFromFirestore.map(u => u.id);
                try {
                    const getUsersAuthData = httpsCallable(functions, 'adminGetUsersAuthData');
                    const result = await getUsersAuthData({ uids: uidsToFetch });
                    setUserAuthData(result.data.usersAuthMap || {});
                } catch (authError) {
                    console.error("Error fetching user auth data:", authError);
                    enqueueSnackbar(`Could not load all user emails/logins: ${authError.message}`, { variant: 'warning' });
                    setUserAuthData(prev => prev || {});
                }
            }

        } catch (err) {
            console.error("Error fetching users from Firestore:", err);
            showSnackbar('Error fetching users: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar, showSnackbar]);

    const fetchCompanies = useCallback(async () => {
        try {
            const companiesRef = fbCollection(db, 'companies');
            const companiesSnap = await fbGetDocs(companiesRef);
            const map = {};
            companiesSnap.forEach(doc => {
                const data = doc.data();
                map[data.companyID] = data.name || data.companyID;
            });
            setCompanyMap(map);
        } catch (err) {
            console.error("Error fetching companies:", err);
        }
    }, []);

    // Filter and paginate users
    useEffect(() => {
        let filtered = [...allUsers];

        // Apply tab filter
        if (selectedTab !== 'all') {
            switch (selectedTab) {
                case 'super-admins':
                    filtered = filtered.filter(u => u.role === 'super_admin');
                    break;
                case 'admins':
                    filtered = filtered.filter(u => u.role === 'admin');
                    break;
                case 'business-admins':
                    filtered = filtered.filter(u => u.role === 'business_admin');
                    break;
                case 'with-companies':
                    filtered = filtered.filter(u => u.companiesForDisplay && u.companiesForDisplay.length > 0);
                    break;
                case 'without-companies':
                    filtered = filtered.filter(u => !u.companiesForDisplay || u.companiesForDisplay.length === 0);
                    break;
            }
        }

        // Apply search filters
        if (searchFields.name) {
            filtered = filtered.filter(u => {
                const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
                return name.includes(searchFields.name.toLowerCase());
            });
        }
        if (searchFields.email) {
            filtered = filtered.filter(u => {
                const authInfo = userAuthData[u.id] || {};
                const email = authInfo.email || '';
                return email.toLowerCase().includes(searchFields.email.toLowerCase());
            });
        }
        if (searchFields.companyName) {
            filtered = filtered.filter(u => {
                if (!u.companiesForDisplay) return false;
                return u.companiesForDisplay.some(companyId => {
                    const companyName = companyMap[companyId] || '';
                    return companyName.toLowerCase().includes(searchFields.companyName.toLowerCase());
                });
            });
        }

        // Apply advanced filters
        if (filters.role !== 'all') {
            filtered = filtered.filter(u => u.role === filters.role);
        }
        if (filters.hasCompanies !== 'all') {
            const hasCompanies = filters.hasCompanies === 'yes';
            filtered = filtered.filter(u => {
                const hasConnectedCompanies = u.companiesForDisplay && u.companiesForDisplay.length > 0;
                return hasCompanies ? hasConnectedCompanies : !hasConnectedCompanies;
            });
        }

        // Paginate
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedUsers = filtered.slice(startIndex, endIndex);

        setUsers(paginatedUsers);
        setTotalCount(filtered.length);
    }, [allUsers, selectedTab, searchFields, filters, page, rowsPerPage, userAuthData, companyMap]);

    // Load data on component mount
    useEffect(() => {
        fetchUsersAndAuthData();
        fetchCompanies();
    }, [fetchUsersAndAuthData, fetchCompanies]);

    // Get role color
    const getRoleColor = (role) => {
        switch (role) {
            case 'super_admin':
                return 'error';
            case 'admin':
                return 'primary';
            case 'business_admin':
                return 'success';
            default:
                return 'default';
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
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                            Users
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                            Manage user accounts and permissions
                        </Typography>
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
                            onClick={() => navigate('/admin/users/new')}
                            sx={{ fontSize: '12px' }}
                        >
                            Add User
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
                        <Tab label={
                            <Badge badgeContent={stats.superAdmins} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '10px' } }}>
                                Super Admins
                            </Badge>
                        } value="super-admins" />
                        <Tab label={
                            <Badge badgeContent={stats.admins} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '10px' } }}>
                                Admins
                            </Badge>
                        } value="admins" />
                        <Tab label={
                            <Badge badgeContent={stats.businessAdmins} color="success" sx={{ '& .MuiBadge-badge': { fontSize: '10px' } }}>
                                Business Admins
                            </Badge>
                        } value="business-admins" />
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
                                    placeholder="Search name..."
                                    value={searchFields.name}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, name: e.target.value }))}
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
                                    placeholder="Search email..."
                                    value={searchFields.email}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, email: e.target.value }))}
                                    InputProps={{
                                        sx: { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search company..."
                                    value={searchFields.companyName}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, companyName: e.target.value }))}
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
                                    setSearchFields({ name: '', email: '', companyName: '' });
                                    setFilters({ role: 'all', hasCompanies: 'all', loginStatus: 'all' });
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
                        <UsersTableSkeleton />
                    ) : (
                        <Table sx={{ position: 'sticky', top: 0, zIndex: 100 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Checkbox
                                                indeterminate={selected.length > 0 && selected.length < users.length}
                                                checked={users.length > 0 && selected.length === users.length}
                                                onChange={handleSelectAll}
                                                size="small"
                                            />
                                            User
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Email</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Role</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Connected Companies</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Last Login</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => {
                                    const companiesToDisplay = user.companiesForDisplay || [];
                                    const authInfo = userAuthData[user.id] || {};
                                    const userEmail = authInfo.email || 'No email in Auth';
                                    const userLastLogin = authInfo.lastLogin ? format(new Date(authInfo.lastLogin), 'MMM d, yyyy HH:mm') : 'Never';

                                    return (
                                        <TableRow key={user.id} hover sx={{ verticalAlign: 'top' }}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Checkbox
                                                        checked={selected.indexOf(user.id) !== -1}
                                                        onChange={() => handleSelect(user.id)}
                                                        size="small"
                                                    />
                                                    <Avatar sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                            {user.firstName?.charAt(0) || userEmail?.charAt(0) || '?'}
                                                        </Typography>
                                                    </Avatar>
                                                    <Box>
                                                        <MuiLink
                                                            component={RouterLink}
                                                            to={`/admin/users/${user.id}`}
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
                                                            {user.firstName || ''} {user.lastName || ''}
                                                        </MuiLink>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        {userEmail}
                                                    </Typography>
                                                    <Tooltip title="Copy Email">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyToClipboard(userEmail, 'Email');
                                                            }}
                                                        >
                                                            <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={user.role}
                                                    size="small"
                                                    color={getRoleColor(user.role)}
                                                    sx={{ fontSize: '11px' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {companiesToDisplay.length > 0 ? (
                                                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                        {companiesToDisplay.slice(0, 2).map((companyId) => (
                                                            <Chip
                                                                key={companyId}
                                                                label={companyMap[companyId] || companyId}
                                                                size="small"
                                                                variant="outlined"
                                                                sx={{ fontSize: '10px' }}
                                                            />
                                                        ))}
                                                        {companiesToDisplay.length > 2 && (
                                                            <Tooltip title={companiesToDisplay.slice(2).map(id => companyMap[id] || id).join(', ')}>
                                                                <Chip
                                                                    label={`+${companiesToDisplay.length - 2} more`}
                                                                    size="small"
                                                                    sx={{ fontSize: '10px' }}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                ) : (
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>—</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {userLastLogin}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleActionMenuOpen(e, user)}
                                                >
                                                    <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {users.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <Box sx={{ py: 4 }}>
                                                <PersonIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                                <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                    No users found
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                    Try adjusting your search criteria or create a new user
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
                <UsersPagination
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
                    navigate(`/admin/users/${selectedUser.id}`);
                    handleActionMenuClose();
                }}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>View Details</Typography>
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={() => selectedUser && openDeleteDialog(selectedUser)} sx={{ color: 'error.main' }}>
                    <ListItemIcon>
                        <DeleteForeverIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Delete User</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => { setDeleteDialogOpen(false); setUserToDelete(null); }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete user
                        <strong> {userToDelete?.firstName} {userToDelete?.lastName} ({(userAuthData[userToDelete?.id]?.email) || userToDelete?.email || 'N/A'})</strong>?
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => { setDeleteDialogOpen(false); setUserToDelete(null); }}
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
                    title="Users"
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

export default UserList; 