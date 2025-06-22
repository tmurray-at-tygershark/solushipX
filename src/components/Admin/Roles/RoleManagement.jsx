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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { PERMISSIONS as ROLE_PERMISSIONS, ROLES, ROLE_PERMISSIONS as ROLE_PERMISSION_MATRIX } from '../../../utils/rolePermissions';
import AdminBreadcrumb from '../AdminBreadcrumb';
import './Roles.css';

// Create a display mapping for permissions
const PERMISSION_DISPLAY_NAMES = {
    [ROLE_PERMISSIONS.VIEW_DASHBOARD]: 'View Dashboard',
    [ROLE_PERMISSIONS.VIEW_ADMIN_DASHBOARD]: 'View Admin Dashboard',
    [ROLE_PERMISSIONS.VIEW_USERS]: 'View Users',
    [ROLE_PERMISSIONS.CREATE_USERS]: 'Create Users',
    [ROLE_PERMISSIONS.EDIT_USERS]: 'Edit Users',
    [ROLE_PERMISSIONS.DELETE_USERS]: 'Delete Users',
    [ROLE_PERMISSIONS.MANAGE_USER_ROLES]: 'Manage User Roles',
    [ROLE_PERMISSIONS.INVITE_USERS]: 'Invite Users',
    [ROLE_PERMISSIONS.RESET_USER_PASSWORD]: 'Reset User Password',
    [ROLE_PERMISSIONS.VIEW_COMPANIES]: 'View Companies',
    [ROLE_PERMISSIONS.CREATE_COMPANIES]: 'Create Companies',
    [ROLE_PERMISSIONS.EDIT_COMPANIES]: 'Edit Companies',
    [ROLE_PERMISSIONS.DELETE_COMPANIES]: 'Delete Companies',
    [ROLE_PERMISSIONS.VIEW_ALL_COMPANIES]: 'View All Companies',
    [ROLE_PERMISSIONS.VIEW_ORGANIZATIONS]: 'View Organizations',
    [ROLE_PERMISSIONS.CREATE_ORGANIZATIONS]: 'Create Organizations',
    [ROLE_PERMISSIONS.EDIT_ORGANIZATIONS]: 'Edit Organizations',
    [ROLE_PERMISSIONS.DELETE_ORGANIZATIONS]: 'Delete Organizations',
    [ROLE_PERMISSIONS.VIEW_SHIPMENTS]: 'View Shipments',
    [ROLE_PERMISSIONS.CREATE_SHIPMENTS]: 'Create Shipments',
    [ROLE_PERMISSIONS.EDIT_SHIPMENTS]: 'Edit Shipments',
    [ROLE_PERMISSIONS.DELETE_SHIPMENTS]: 'Delete Shipments',
    [ROLE_PERMISSIONS.VIEW_ALL_SHIPMENTS]: 'View All Shipments',
    [ROLE_PERMISSIONS.EXPORT_SHIPMENTS]: 'Export Shipments',
    [ROLE_PERMISSIONS.MANAGE_DRAFT_SHIPMENTS]: 'Manage Draft Shipments',
    [ROLE_PERMISSIONS.VIEW_CUSTOMERS]: 'View Customers',
    [ROLE_PERMISSIONS.CREATE_CUSTOMERS]: 'Create Customers',
    [ROLE_PERMISSIONS.EDIT_CUSTOMERS]: 'Edit Customers',
    [ROLE_PERMISSIONS.DELETE_CUSTOMERS]: 'Delete Customers',
    [ROLE_PERMISSIONS.VIEW_ALL_CUSTOMERS]: 'View All Customers',
    [ROLE_PERMISSIONS.VIEW_BILLING]: 'View Billing',
    [ROLE_PERMISSIONS.CREATE_INVOICES]: 'Create Invoices',
    [ROLE_PERMISSIONS.EDIT_INVOICES]: 'Edit Invoices',
    [ROLE_PERMISSIONS.DELETE_INVOICES]: 'Delete Invoices',
    [ROLE_PERMISSIONS.VIEW_ALL_INVOICES]: 'View All Invoices',
    [ROLE_PERMISSIONS.MANAGE_PAYMENT_TERMS]: 'Manage Payment Terms',
    [ROLE_PERMISSIONS.GENERATE_INVOICES]: 'Generate Invoices',
    [ROLE_PERMISSIONS.VIEW_CARRIERS]: 'View Carriers',
    [ROLE_PERMISSIONS.CREATE_CARRIERS]: 'Create Carriers',
    [ROLE_PERMISSIONS.EDIT_CARRIERS]: 'Edit Carriers',
    [ROLE_PERMISSIONS.DELETE_CARRIERS]: 'Delete Carriers',
    [ROLE_PERMISSIONS.MANAGE_CARRIER_KEYS]: 'Manage Carrier Keys',
    [ROLE_PERMISSIONS.MANAGE_EDI_MAPPING]: 'Manage EDI Mapping',
    [ROLE_PERMISSIONS.VIEW_REPORTS]: 'View Reports',
    [ROLE_PERMISSIONS.CREATE_REPORTS]: 'Create Reports',
    [ROLE_PERMISSIONS.SCHEDULE_REPORTS]: 'Schedule Reports',
    [ROLE_PERMISSIONS.VIEW_ALL_REPORTS]: 'View All Reports',
    [ROLE_PERMISSIONS.EXPORT_REPORTS]: 'Export Reports',
    [ROLE_PERMISSIONS.VIEW_ANALYTICS]: 'View Analytics',
    [ROLE_PERMISSIONS.VIEW_TRACKING]: 'View Tracking',
    [ROLE_PERMISSIONS.UPDATE_TRACKING]: 'Update Tracking',
    [ROLE_PERMISSIONS.VIEW_PROFILE]: 'View Profile',
    [ROLE_PERMISSIONS.EDIT_PROFILE]: 'Edit Profile',
    [ROLE_PERMISSIONS.VIEW_NOTIFICATIONS]: 'View Notifications',
    [ROLE_PERMISSIONS.MANAGE_NOTIFICATIONS]: 'Manage Notifications',
    [ROLE_PERMISSIONS.VIEW_SETTINGS]: 'View Settings',
    [ROLE_PERMISSIONS.MANAGE_SETTINGS]: 'Manage Settings',
    [ROLE_PERMISSIONS.MANAGE_ROLES]: 'Manage Roles',
    [ROLE_PERMISSIONS.MANAGE_MARKUPS]: 'Manage Markups',
    [ROLE_PERMISSIONS.USE_QUICKSHIP]: 'Use QuickShip',
    [ROLE_PERMISSIONS.USE_AI_AGENT]: 'Use AI Agent',
    [ROLE_PERMISSIONS.USE_ADVANCED_ROUTING]: 'Use Advanced Routing',
    [ROLE_PERMISSIONS.MANAGE_INTEGRATIONS]: 'Manage Integrations',
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
            // Check for duplicate role name (case-insensitive, excluding self on edit)
            const rolesRef = collection(db, 'roles');
            const querySnapshot = await getDocs(rolesRef);
            const nameLower = formData.name.trim().toLowerCase();
            const duplicate = querySnapshot.docs.find(docSnap => {
                const data = docSnap.data();
                return data.name && data.name.trim().toLowerCase() === nameLower && (!selectedRole || docSnap.id !== selectedRole.id);
            });
            if (duplicate) {
                setError('A role with this name already exists. Please choose a unique name.');
                setLoading(false);
                return;
            }

            const roleData = {
                name: formData.name,
                description: formData.description,
                permissions: formData.permissions,
                updatedAt: serverTimestamp(),
            };

            if (selectedRole) {
                // Update existing role
                await updateDoc(doc(db, 'roles', selectedRole.id), roleData);
            } else {
                // Create new role
                roleData.createdAt = serverTimestamp();
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
                    label={PERMISSION_DISPLAY_NAMES[key] || key}
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
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, fontSize: '22px' }}>
                    Role Management
                </Typography>
                <AdminBreadcrumb currentPage="Roles" />
            </Box>

            <Box className="roles-header">
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827' }}>
                    System Roles
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    size="small"
                    sx={{ fontSize: '12px' }}
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
                                    {Object.entries(PERMISSION_DISPLAY_NAMES).map(([key, label]) => (
                                        <Grid item xs={12} sm={6} md={4} key={key}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={formData.permissions[key] || false}
                                                        onChange={() => handlePermissionChange(key)}
                                                        size="small"
                                                    />
                                                }
                                                label={label}
                                                sx={{ '& .MuiFormControlLabel-label': { fontSize: '12px' } }}
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