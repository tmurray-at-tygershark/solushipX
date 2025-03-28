import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Checkbox,
    Chip,
    Alert,
    Tooltip,
    Divider,
    CircularProgress
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Security as SecurityIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Roles.css';

const PERMISSIONS = {
    // User Management
    VIEW_USERS: 'View Users',
    CREATE_USERS: 'Create Users',
    EDIT_USERS: 'Edit Users',
    DELETE_USERS: 'Delete Users',

    // Company Management
    VIEW_COMPANIES: 'View Companies',
    CREATE_COMPANIES: 'Create Companies',
    EDIT_COMPANIES: 'Edit Companies',
    DELETE_COMPANIES: 'Delete Companies',

    // Shipment Management
    VIEW_SHIPMENTS: 'View Shipments',
    CREATE_SHIPMENTS: 'Create Shipments',
    EDIT_SHIPMENTS: 'Edit Shipments',
    DELETE_SHIPMENTS: 'Delete Shipments',

    // Billing Management
    VIEW_BILLING: 'View Billing',
    CREATE_INVOICES: 'Create Invoices',
    EDIT_INVOICES: 'Edit Invoices',
    DELETE_INVOICES: 'Delete Invoices',

    // Analytics
    VIEW_ANALYTICS: 'View Analytics',
    EXPORT_DATA: 'Export Data',

    // System Settings
    MANAGE_ROLES: 'Manage Roles',
    MANAGE_SETTINGS: 'Manage Settings',
};

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        permissions: {},
    });

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const rolesRef = collection(db, 'roles');
            const querySnapshot = await getDocs(rolesRef);
            const rolesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRoles(rolesData);
        } catch (err) {
            setError('Error fetching roles: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (role = null) => {
        if (role) {
            setSelectedRole(role);
            setFormData({
                name: role.name,
                description: role.description,
                permissions: role.permissions || {},
            });
        } else {
            setSelectedRole(null);
            setFormData({
                name: '',
                description: '',
                permissions: {},
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setSelectedRole(null);
        setFormData({
            name: '',
            description: '',
            permissions: {},
        });
        setOpenDialog(false);
    };

    const handlePermissionChange = (permission) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [permission]: !prev.permissions[permission]
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const roleData = {
                name: formData.name,
                description: formData.description,
                permissions: formData.permissions,
                updatedAt: new Date(),
            };

            if (selectedRole) {
                // Update existing role
                await updateDoc(doc(db, 'roles', selectedRole.id), roleData);
            } else {
                // Create new role
                roleData.createdAt = new Date();
                await addDoc(collection(db, 'roles'), roleData);
            }

            fetchRoles();
            handleCloseDialog();
        } catch (err) {
            setError('Error saving role: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (roleId) => {
        if (window.confirm('Are you sure you want to delete this role?')) {
            try {
                setLoading(true);
                await deleteDoc(doc(db, 'roles', roleId));
                fetchRoles();
            } catch (err) {
                setError('Error deleting role: ' + err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const getPermissionChips = (permissions) => {
        return Object.entries(permissions)
            .filter(([_, enabled]) => enabled)
            .map(([key, _]) => (
                <Chip
                    key={key}
                    label={PERMISSIONS[key]}
                    size="small"
                    className="permission-chip"
                />
            ));
    };

    if (loading) {
        return (
            <Box className="roles-loading">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box className="roles-container">
            <Box className="roles-header">
                <Typography variant="h4" className="roles-title">
                    Role Management
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Create Role
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <TableContainer component={Paper} className="roles-table">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Role Name</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Permissions</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {roles.map((role) => (
                            <TableRow key={role.id}>
                                <TableCell>{role.name}</TableCell>
                                <TableCell>{role.description}</TableCell>
                                <TableCell>
                                    <Box className="permissions-container">
                                        {getPermissionChips(role.permissions)}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="Edit Role">
                                        <IconButton
                                            color="primary"
                                            onClick={() => handleOpenDialog(role)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Role">
                                        <IconButton
                                            color="error"
                                            onClick={() => handleDelete(role.id)}
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

            {/* Role Form Dialog */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {selectedRole ? 'Edit Role' : 'Create New Role'}
                </DialogTitle>
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Role Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        name: e.target.value
                                    }))}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={2}
                                    label="Description"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        description: e.target.value
                                    }))}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="h6" gutterBottom>
                                    Permissions
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Grid container spacing={2}>
                                    {Object.entries(PERMISSIONS).map(([key, label]) => (
                                        <Grid item xs={12} sm={6} md={4} key={key}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={formData.permissions[key] || false}
                                                        onChange={() => handlePermissionChange(key)}
                                                    />
                                                }
                                                label={label}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="outlined"
                            startIcon={<CancelIcon />}
                            onClick={handleCloseDialog}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            startIcon={<SaveIcon />}
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Role'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
};

export default RoleManagement; 