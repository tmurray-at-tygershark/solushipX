import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
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
    Pagination,
    Avatar,
    Stack,
    InputAdornment,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    DialogContentText,
    CircularProgress,
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

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [userAuthData, setUserAuthData] = useState({});
    const [companyMap, setCompanyMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const { userRole } = useAuth();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const ITEMS_PER_PAGE = 10;

    const fetchUsersAndAuthData = useCallback(async () => {
        setLoading(true);
        setError(null);
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
            setUsers(usersDataFromFirestore);
            setTotalPages(Math.ceil(usersDataFromFirestore.length / ITEMS_PER_PAGE));

            if (usersDataFromFirestore.length > 0) {
                const uidsToFetch = usersDataFromFirestore.map(u => u.id);
                try {
                    const getUsersAuthData = httpsCallable(functions, 'adminGetUsersAuthData');
                    const result = await getUsersAuthData({ uids: uidsToFetch });
                    setUserAuthData(result.data.usersAuthMap || {});
                    console.log("Fetched Auth Data:", result.data.usersAuthMap);
                } catch (authError) {
                    console.error("Error fetching user auth data:", authError);
                    enqueueSnackbar(`Could not load all user emails/logins: ${authError.message}`, { variant: 'warning' });
                    setUserAuthData(prev => prev || {});
                }
            }

        } catch (err) {
            console.error("Error fetching users from Firestore:", err);
            setError('Error fetching users: ' + err.message);
            enqueueSnackbar('Error fetching users: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchUsersAndAuthData();
    }, [page, fetchUsersAndAuthData]);

    useEffect(() => {
        const fetchCompanies = async () => {
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
        };
        fetchCompanies();
    }, []);

    const handleActionsClick = (event, user) => {
        setAnchorEl(event.currentTarget);
        setSelectedUser(user);
    };

    const handleActionsClose = () => {
        setAnchorEl(null);
    };

    const handleViewUser = () => {
        if (selectedUser) {
            navigate(`/admin/users/${selectedUser.id}`);
        }
        handleActionsClose();
    };

    const openDeleteDialog = (user) => {
        setUserToDelete(user);
        setDeleteDialogOpen(true);
        handleActionsClose();
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        setError(null);

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

    const filteredUsers = users.filter(user => {
        const authInfo = userAuthData[user.id] || {};
        const email = authInfo.email || '';
        const name = `${user.firstName || ''} ${user.lastName || ''}`;
        return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            email.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const paginatedUsers = filteredUsers.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    if (loading) {
        return <Box className="users-container" sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Box className="users-container" sx={{ p: 3 }}><Typography color="error">Error: {error}</Typography></Box>;
    }

    return (
        <Box className="users-container">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Users
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                    Manage user accounts and permissions
                </Typography>
            </Box>

            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    fullWidth
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/admin/users/new')}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    Add User
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>User</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Connected Companies</TableCell>
                            <TableCell>Last Login</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedUsers.map((user) => {
                            const companiesToDisplay = user.companiesForDisplay || [];
                            const authInfo = userAuthData[user.id] || {};
                            const userEmail = authInfo.email || 'No email in Auth';
                            const userLastLogin = authInfo.lastLogin ? format(new Date(authInfo.lastLogin), 'MMM d, yyyy HH:mm') : 'Never';

                            return (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <Box className="user-info" component={RouterLink} to={`/admin/users/${user.id}`} sx={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                                            <Avatar className="user-avatar" sx={{ mr: 1.5, width: 36, height: 36 }}>
                                                {user.firstName?.charAt(0) || userEmail?.charAt(0) || '?'}
                                            </Avatar>
                                            <Typography variant="body2" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                                                {user.firstName || ''} {user.lastName || ''}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{userEmail}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={user.role}
                                            size="small"
                                            color={getRoleColor(user.role)} />
                                    </TableCell>
                                    <TableCell>
                                        {companiesToDisplay.length > 0 ? (
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                {companiesToDisplay.slice(0, 3).map((companyId) => (
                                                    <Chip
                                                        key={companyId}
                                                        label={companyMap[companyId] || companyId}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                ))}
                                                {companiesToDisplay.length > 3 && (
                                                    <Tooltip title={companiesToDisplay.slice(3).map(id => companyMap[id] || id).join(', ')}>
                                                        <Chip label={`+${companiesToDisplay.length - 3} more`} size="small" />
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {userLastLogin}
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleActionsClick(e, user)}
                                        >
                                            <MoreVertIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {paginatedUsers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">
                                    <Typography sx={{ p: 2 }} color="text.secondary">No users found matching your search.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box className="users-pagination" sx={{ mt: 3 }}>
                <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                    color="primary"
                    showFirstButton
                    showLastButton
                />
            </Box>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleActionsClose}
            >
                <MenuItem onClick={handleViewUser}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>View Details</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => selectedUser && openDeleteDialog(selectedUser)} sx={{ color: 'error.main' }}>
                    <ListItemIcon>
                        <DeleteForeverIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText>Delete User</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => { setDeleteDialogOpen(false); setUserToDelete(null); }}
            >
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete user
                        <strong>{userToDelete?.firstName} {userToDelete?.lastName} ({(userAuthData[userToDelete?.id]?.email) || userToDelete?.email || 'N/A'})</strong>?
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setDeleteDialogOpen(false); setUserToDelete(null); }} disabled={isDeleting}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={isDeleting}>
                        {isDeleting ? <CircularProgress size={20} color="inherit" /> : 'Confirm Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserList; 