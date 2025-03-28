import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import './Users.css';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const { userRole } = useAuth();

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        fetchUsers();
    }, [page]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                orderBy('email')
            );
            const querySnapshot = await getDocs(q);
            const usersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
            setTotalPages(Math.ceil(usersData.length / ITEMS_PER_PAGE));
        } catch (err) {
            setError('Error fetching users: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (user = null) => {
        setSelectedUser(user);
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setSelectedUser(null);
        setOpenDialog(false);
    };

    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
        setPage(1);
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

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const paginatedUsers = filteredUsers.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    return (
        <Box className="users-container">
            <Box className="users-header">
                <Typography variant="h4" className="users-title">
                    Users
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Add User
                </Button>
            </Box>

            <Paper className="users-search">
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
            </Paper>

            <TableContainer component={Paper} className="users-table">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>User</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Company</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Box className="user-info">
                                        <Avatar className="user-avatar">
                                            {user.name?.charAt(0) || user.email.charAt(0)}
                                        </Avatar>
                                        <Typography variant="body2">
                                            {user.name || 'N/A'}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={user.role}
                                        color={getRoleColor(user.role)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>{user.companyName || 'N/A'}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={user.status || 'active'}
                                        color={user.status === 'active' ? 'success' : 'default'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="View Details">
                                        <IconButton
                                            color="primary"
                                            onClick={() => handleOpenDialog(user)}
                                        >
                                            <ViewIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit User">
                                        <IconButton
                                            color="primary"
                                            onClick={() => handleOpenDialog(user)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete User">
                                        <IconButton
                                            color="error"
                                            onClick={() => handleOpenDialog(user)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box className="users-pagination">
                <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                    color="primary"
                    showFirstButton
                    showLastButton
                />
            </Box>

            {/* User Form Dialog */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {selectedUser ? 'Edit User' : 'Add New User'}
                </DialogTitle>
                <DialogContent>
                    {/* User form will be implemented here */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button variant="contained" color="primary">
                        {selectedUser ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserList; 