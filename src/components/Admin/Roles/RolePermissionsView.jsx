import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Card,
    CardContent,
    Grid,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Avatar,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Tooltip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Alert,
    Snackbar,
    CircularProgress,
    Menu,
    ListItemButton,
    Checkbox,
    FormGroup,
    Fab,
    SpeedDial,
    SpeedDialIcon,
    SpeedDialAction
} from '@mui/material';
import {
    CheckCircle as CheckIcon,
    Cancel as CancelIcon,
    ExpandMore as ExpandMoreIcon,
    Person as PersonIcon,
    Security as SecurityIcon,
    Business as BusinessIcon,
    LocalShipping as ShippingIcon,
    People as PeopleIcon,
    Receipt as BillingIcon,
    Assessment as ReportsIcon,
    Settings as SettingsIcon,
    Route as RouteIcon,
    Info as InfoIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    MoreVert as MoreVertIcon,
    Save as SaveIcon,
    Close as CloseIcon,
    GroupAdd as GroupAddIcon,
    LockOpen as PermissionIcon,
    Category as CategoryIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, ROUTE_PERMISSIONS } from '../../../utils/rolePermissions';
import { getFunctions, httpsCallable } from 'firebase/functions';

const RolePermissionsView = () => {
    const { currentUser } = useAuth();
    const functions = getFunctions();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [permissionCategories, setPermissionCategories] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState(['all']);

    // Dialog states
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userAssignmentOpen, setUserAssignmentOpen] = useState(false);

    // Form states
    const [editingRole, setEditingRole] = useState(null);
    const [editingPermission, setEditingPermission] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selectedRole, setSelectedRole] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Menu states
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuContext, setMenuContext] = useState(null);

    // Initialize data from hardcoded values if database is empty
    useEffect(() => {
        initializeData();
    }, []);

    const initializeData = async () => {
        try {
            setLoading(true);

            // Check if roles exist in database
            const rolesSnapshot = await getDocs(collection(db, 'roles'));
            if (rolesSnapshot.empty) {
                // Initialize with hardcoded roles
                const batch = writeBatch(db);

                // Add system roles
                Object.entries(ROLES).forEach(([key, value]) => {
                    const roleRef = doc(collection(db, 'roles'));
                    batch.set(roleRef, {
                        id: value,
                        name: getRoleDisplayName(value),
                        description: getRoleDescription(value),
                        color: getRoleColor(value),
                        isSystem: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                });

                await batch.commit();
            }

            // Check if permissions exist in database
            const permissionsSnapshot = await getDocs(collection(db, 'permissions'));
            if (permissionsSnapshot.empty) {
                // Initialize with hardcoded permissions
                const batch = writeBatch(db);

                Object.entries(PERMISSIONS).forEach(([key, value]) => {
                    const permRef = doc(collection(db, 'permissions'));
                    batch.set(permRef, {
                        id: value,
                        key: key,
                        name: value.replace(/_/g, ' ').toLowerCase(),
                        category: getPermissionCategory(key),
                        isSystem: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                });

                await batch.commit();
            }

            // Set up real-time listeners
            setupListeners();

        } catch (error) {
            console.error('Error initializing data:', error);
            showSnackbar('Error initializing data', 'error');
        }
    };

    const setupListeners = () => {
        // Listen to roles
        const unsubscribeRoles = onSnapshot(collection(db, 'roles'), (snapshot) => {
            const rolesData = snapshot.docs.map(doc => ({
                docId: doc.id,
                ...doc.data()
            }));
            setRoles(rolesData);
        });

        // Listen to permissions
        const unsubscribePermissions = onSnapshot(collection(db, 'permissions'), (snapshot) => {
            const permsData = snapshot.docs.map(doc => ({
                docId: doc.id,
                ...doc.data()
            }));
            setPermissions(permsData);

            // Group permissions by category
            const categories = {};
            permsData.forEach(perm => {
                if (!categories[perm.category]) {
                    categories[perm.category] = {
                        icon: getCategoryIcon(perm.category),
                        permissions: []
                    };
                }
                categories[perm.category].permissions.push(perm.id);
            });
            setPermissionCategories(categories);
        });

        // Listen to users
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
            setLoading(false);
        });

        // Cleanup
        return () => {
            unsubscribeRoles();
            unsubscribePermissions();
            unsubscribeUsers();
        };
    };

    // Helper functions
    const getRoleDisplayName = (role) => {
        switch (role) {
            case 'superadmin': return 'Super Admin';
            case 'admin': return 'Admin';
            case 'user': return 'Company Admin';
            default: return role;
        }
    };

    const getRoleDescription = (role) => {
        switch (role) {
            case 'superadmin': return 'Full system access with no limitations';
            case 'admin': return 'Administrative access to manage the system';
            case 'user': return 'Company-level access for daily operations';
            default: return '';
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'superadmin': return '#9c27b0';
            case 'admin': return '#2196f3';
            case 'user': return '#4caf50';
            default: return '#757575';
        }
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'superadmin': return <SecurityIcon />;
            case 'admin': return <BusinessIcon />;
            case 'user': return <PersonIcon />;
            default: return <PersonIcon />;
        }
    };

    const getPermissionCategory = (permissionKey) => {
        if (permissionKey.includes('DASHBOARD')) return 'Dashboard & Access';
        if (permissionKey.includes('USER')) return 'User Management';
        if (permissionKey.includes('COMPANY') || permissionKey.includes('COMPANIES')) return 'Company Management';
        if (permissionKey.includes('ORGANIZATION')) return 'Organization Management';
        if (permissionKey.includes('SHIPMENT')) return 'Shipment Management';
        if (permissionKey.includes('CUSTOMER')) return 'Customer Management';
        if (permissionKey.includes('BILLING') || permissionKey.includes('INVOICE')) return 'Billing & Invoicing';
        if (permissionKey.includes('CARRIER')) return 'Carrier Management';
        if (permissionKey.includes('REPORT') || permissionKey.includes('ANALYTICS')) return 'Reports & Analytics';
        if (permissionKey.includes('TRACKING')) return 'Tracking';
        if (permissionKey.includes('PROFILE')) return 'Profile Management';
        if (permissionKey.includes('NOTIFICATION')) return 'Notification Management';
        if (permissionKey.includes('SETTINGS') || permissionKey.includes('ROLES') || permissionKey.includes('MARKUPS')) return 'System Settings';
        if (permissionKey.includes('QUICKSHIP') || permissionKey.includes('AI') || permissionKey.includes('ROUTING')) return 'Advanced Features';
        return 'Other';
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'Dashboard & Access': return <BusinessIcon />;
            case 'User Management': return <PeopleIcon />;
            case 'Company Management': return <BusinessIcon />;
            case 'Organization Management': return <BusinessIcon />;
            case 'Shipment Management': return <ShippingIcon />;
            case 'Customer Management': return <PeopleIcon />;
            case 'Billing & Invoicing': return <BillingIcon />;
            case 'Carrier Management': return <ShippingIcon />;
            case 'Reports & Analytics': return <ReportsIcon />;
            case 'System Settings': return <SettingsIcon />;
            case 'Advanced Features': return <RouteIcon />;
            default: return <CategoryIcon />;
        }
    };

    const hasPermission = (roleId, permissionId) => {
        // Check hardcoded permissions first (for system roles)
        const role = roles.find(r => r.id === roleId);
        if (role?.isSystem) {
            if (ROLE_PERMISSIONS[roleId]?.['*']) return true;
            return ROLE_PERMISSIONS[roleId]?.[permissionId] === true;
        }

        // For custom roles, check database (to be implemented)
        return false;
    };

    // CRUD Operations
    const handleAddRole = () => {
        setEditingRole({
            name: '',
            description: '',
            color: '#757575',
            permissions: {}
        });
        setRoleDialogOpen(true);
    };

    const handleEditRole = (role) => {
        if (role.id === 'superadmin') {
            showSnackbar('Super Admin role cannot be edited', 'warning');
            return;
        }
        setEditingRole(role);
        setRoleDialogOpen(true);
    };

    const handleDeleteRole = (role) => {
        if (role.isSystem) {
            showSnackbar('System roles cannot be deleted', 'warning');
            return;
        }
        setDeleteTarget({ type: 'role', item: role });
        setDeleteDialogOpen(true);
    };

    const handleSaveRole = async () => {
        try {
            setSaving(true);

            if (editingRole.docId) {
                // Update existing role
                const updateRole = httpsCallable(functions, 'adminUpdateRole');
                await updateRole({
                    roleId: editingRole.id,
                    name: editingRole.name,
                    description: editingRole.description,
                    color: editingRole.color
                });
            } else {
                // Create new role
                const createRole = httpsCallable(functions, 'adminCreateRole');
                await createRole({
                    name: editingRole.name,
                    description: editingRole.description,
                    color: editingRole.color,
                    permissions: editingRole.permissions || {}
                });
            }

            setRoleDialogOpen(false);
            setEditingRole(null);
            showSnackbar('Role saved successfully', 'success');
        } catch (error) {
            console.error('Error saving role:', error);
            showSnackbar(error.message || 'Error saving role', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePermission = async (roleId, permissionId) => {
        if (roleId === 'superadmin') {
            showSnackbar('Super Admin permissions cannot be modified', 'warning');
            return;
        }

        try {
            const role = roles.find(r => r.id === roleId);
            if (role.isSystem && roleId !== 'admin' && roleId !== 'user') {
                showSnackbar('System role permissions cannot be modified', 'info');
                return;
            }

            // Get current permission state
            const currentlyGranted = hasPermission(roleId, permissionId);

            // Update permissions
            const updateRolePermissions = httpsCallable(functions, 'adminUpdateRolePermissions');
            await updateRolePermissions({
                roleId,
                permissions: {
                    [permissionId]: !currentlyGranted
                }
            });

            showSnackbar('Permission updated', 'success');

            // Refresh data
            await initializeData();
        } catch (error) {
            console.error('Error toggling permission:', error);
            showSnackbar(error.message || 'Error updating permission', 'error');
        }
    };

    const handleAssignUsers = () => {
        setUserAssignmentOpen(true);
    };

    const handleSaveUserAssignments = async () => {
        try {
            setSaving(true);

            const bulkAssignRole = httpsCallable(functions, 'adminBulkAssignRole');
            await bulkAssignRole({
                userIds: selectedUsers,
                roleId: selectedRole
            });

            setUserAssignmentOpen(false);
            setSelectedUsers([]);
            showSnackbar('User roles updated successfully', 'success');
        } catch (error) {
            console.error('Error updating user roles:', error);
            showSnackbar(error.message || 'Error updating user roles', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        try {
            setSaving(true);

            if (deleteTarget.type === 'role') {
                const deleteRole = httpsCallable(functions, 'adminDeleteRole');
                await deleteRole({ roleId: deleteTarget.item.id });
                showSnackbar('Role deleted successfully', 'success');
            } else if (deleteTarget.type === 'permission') {
                // Permission deletion not implemented in cloud functions yet
                showSnackbar('Permission deletion not yet implemented', 'info');
            }

            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        } catch (error) {
            console.error('Error deleting:', error);
            showSnackbar(error.message || 'Error deleting item', 'error');
        } finally {
            setSaving(false);
        }
    };

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCategoryToggle = (category) => {
        if (category === 'all') {
            setExpandedCategories(
                expandedCategories.includes('all') ? [] : ['all', ...Object.keys(permissionCategories)]
            );
        } else {
            setExpandedCategories(prev => {
                const newExpanded = prev.includes(category)
                    ? prev.filter(c => c !== category && c !== 'all')
                    : [...prev.filter(c => c !== 'all'), category];

                if (newExpanded.length === Object.keys(permissionCategories).length) {
                    return ['all', ...newExpanded];
                }

                return newExpanded;
            });
        }
    };

    // Group users by role
    const usersByRole = users.reduce((acc, user) => {
        const role = user.role || 'user';
        if (!acc[role]) acc[role] = [];
        acc[role].push(user);
        return acc;
    }, {});

    const canManageRoles = currentUser?.role === 'superadmin';

    if (loading) {
        return (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600 }}>
                        Role Permissions Management
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px' }}>
                        Manage roles, permissions, and user assignments
                    </Typography>
                </Box>

                {canManageRoles && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            startIcon={<GroupAddIcon />}
                            onClick={handleAddRole}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Add Role
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<PermissionIcon />}
                            onClick={() => setPermissionDialogOpen(true)}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Manage Permissions
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<PeopleIcon />}
                            onClick={handleAssignUsers}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Assign Users
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Role Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {roles.map((role) => {
                    const userCount = usersByRole[role.id]?.length || 0;

                    return (
                        <Grid item xs={12} md={4} key={role.id}>
                            <Card sx={{
                                height: '100%',
                                borderTop: `4px solid ${role.color}`,
                                '&:hover': { boxShadow: 3 }
                            }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Avatar sx={{ bgcolor: role.color, mr: 2 }}>
                                            {getRoleIcon(role.id)}
                                        </Avatar>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                                {role.name}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px' }}>
                                                {userCount} user{userCount !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
                                        {canManageRoles && (
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    setAnchorEl(e.currentTarget);
                                                    setMenuContext({ type: 'role', item: role });
                                                }}
                                            >
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Box>
                                    <Typography variant="body2" sx={{ mb: 2, fontSize: '12px' }}>
                                        {role.description}
                                    </Typography>

                                    {/* Key Permissions */}
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '12px', fontWeight: 600 }}>
                                            Key Permissions:
                                        </Typography>
                                        {role.id === 'superadmin' ? (
                                            <Chip
                                                label="All Permissions"
                                                size="small"
                                                color="primary"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        ) : (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {permissions
                                                    .filter(p => hasPermission(role.id, p.id))
                                                    .slice(0, 5)
                                                    .map((permission) => (
                                                        <Chip
                                                            key={permission.id}
                                                            label={permission.name}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontSize: '10px', textTransform: 'capitalize' }}
                                                        />
                                                    ))}
                                                {permissions.filter(p => hasPermission(role.id, p.id)).length > 5 && (
                                                    <Chip
                                                        label={`+${permissions.filter(p => hasPermission(role.id, p.id)).length - 5} more`}
                                                        size="small"
                                                        sx={{ fontSize: '10px' }}
                                                    />
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Permission Matrix */}
            <Paper sx={{ mb: 4 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Permission Matrix
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px', mt: 0.5 }}>
                        {canManageRoles ? 'Click on permissions to toggle them' : 'View permissions by role and category'}
                    </Typography>
                </Box>

                <Box sx={{ p: 2 }}>
                    <Box sx={{ mb: 2 }}>
                        <Chip
                            label={expandedCategories.includes('all') ? 'Collapse All' : 'Expand All'}
                            onClick={() => handleCategoryToggle('all')}
                            color="primary"
                            size="small"
                            sx={{ fontSize: '11px' }}
                        />
                    </Box>

                    {Object.entries(permissionCategories).map(([category, { icon, permissions: categoryPerms }]) => (
                        <Accordion
                            key={category}
                            expanded={expandedCategories.includes('all') || expandedCategories.includes(category)}
                            onChange={() => handleCategoryToggle(category)}
                            sx={{ mb: 1 }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {icon}
                                    <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                        {category}
                                    </Typography>
                                    <Chip
                                        label={categoryPerms.length}
                                        size="small"
                                        sx={{ fontSize: '10px', height: '20px' }}
                                    />
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    Permission
                                                </TableCell>
                                                {roles.map(role => (
                                                    <TableCell key={role.id} align="center" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {role.name}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {categoryPerms.map(permId => {
                                                const permission = permissions.find(p => p.id === permId);
                                                if (!permission) return null;

                                                return (
                                                    <TableRow key={permission.id}>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                {permission.name}
                                                                <Tooltip title={`Permission: ${permission.id}`}>
                                                                    <InfoIcon sx={{ fontSize: '14px', color: 'text.secondary' }} />
                                                                </Tooltip>
                                                            </Box>
                                                        </TableCell>
                                                        {roles.map(role => (
                                                            <TableCell key={role.id} align="center">
                                                                {canManageRoles && role.id !== 'superadmin' ? (
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleTogglePermission(role.id, permission.id)}
                                                                        disabled={role.isSystem}
                                                                    >
                                                                        {hasPermission(role.id, permission.id) ? (
                                                                            <CheckIcon sx={{ color: 'success.main', fontSize: '20px' }} />
                                                                        ) : (
                                                                            <CancelIcon sx={{ color: 'text.disabled', fontSize: '20px' }} />
                                                                        )}
                                                                    </IconButton>
                                                                ) : (
                                                                    hasPermission(role.id, permission.id) ? (
                                                                        <CheckIcon sx={{ color: 'success.main', fontSize: '20px' }} />
                                                                    ) : (
                                                                        <CancelIcon sx={{ color: 'text.disabled', fontSize: '20px' }} />
                                                                    )
                                                                )}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            </Paper>

            {/* Context Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                {menuContext?.type === 'role' && (
                    <>
                        <MenuItem onClick={() => {
                            handleEditRole(menuContext.item);
                            setAnchorEl(null);
                        }}>
                            <ListItemIcon>
                                <EditIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Edit Role" />
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                handleDeleteRole(menuContext.item);
                                setAnchorEl(null);
                            }}
                            disabled={menuContext.item.isSystem}
                        >
                            <ListItemIcon>
                                <DeleteIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Delete Role" />
                        </MenuItem>
                    </>
                )}
            </Menu>

            {/* Role Dialog */}
            <Dialog
                open={roleDialogOpen}
                onClose={() => setRoleDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px' }}>
                    {editingRole?.docId ? 'Edit Role' : 'Add New Role'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="Role Name"
                            value={editingRole?.name || ''}
                            onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                            fullWidth
                            size="small"
                            required
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                        />
                        <TextField
                            label="Description"
                            value={editingRole?.description || ''}
                            onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                            fullWidth
                            size="small"
                            multiline
                            rows={2}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                        />
                        <TextField
                            label="Color"
                            type="color"
                            value={editingRole?.color || '#757575'}
                            onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                            fullWidth
                            size="small"
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleDialogOpen(false)} size="small">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveRole}
                        variant="contained"
                        size="small"
                        disabled={saving || !editingRole?.name}
                    >
                        {saving ? <CircularProgress size={20} /> : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* User Assignment Dialog */}
            <Dialog
                open={userAssignmentOpen}
                onClose={() => setUserAssignmentOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px' }}>
                    Assign Users to Roles
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                            <InputLabel sx={{ fontSize: '12px' }}>Select Role</InputLabel>
                            <Select
                                value={selectedRole || ''}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                label="Select Role"
                                sx={{ fontSize: '12px' }}
                            >
                                {roles.filter(r => r.id !== 'superadmin').map(role => (
                                    <MenuItem key={role.id} value={role.id} sx={{ fontSize: '12px' }}>
                                        {role.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Typography variant="subtitle2" sx={{ mb: 2, fontSize: '12px' }}>
                            Select users to assign to this role:
                        </Typography>

                        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                            {users.map(user => (
                                <ListItem key={user.id} disablePadding>
                                    <ListItemButton
                                        onClick={() => {
                                            setSelectedUsers(prev =>
                                                prev.includes(user.id)
                                                    ? prev.filter(id => id !== user.id)
                                                    : [...prev, user.id]
                                            );
                                        }}
                                        dense
                                    >
                                        <ListItemIcon>
                                            <Checkbox
                                                checked={selectedUsers.includes(user.id)}
                                                tabIndex={-1}
                                                disableRipple
                                            />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={`${user.firstName || ''} ${user.lastName || ''}`}
                                            secondary={`${user.email} - Current role: ${getRoleDisplayName(user.role)}`}
                                            primaryTypographyProps={{ fontSize: '12px' }}
                                            secondaryTypographyProps={{ fontSize: '11px' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUserAssignmentOpen(false)} size="small">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveUserAssignments}
                        variant="contained"
                        size="small"
                        disabled={saving || !selectedRole || selectedUsers.length === 0}
                    >
                        {saving ? <CircularProgress size={20} /> : 'Assign Users'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="error" />
                    Confirm Delete
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.
                    </Alert>
                    {deleteTarget?.type === 'role' && (
                        <Typography variant="body2" sx={{ mt: 2, fontSize: '12px' }}>
                            Role: <strong>{deleteTarget.item.name}</strong>
                            <br />
                            Users with this role will need to be reassigned.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} size="small">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        variant="contained"
                        color="error"
                        size="small"
                        disabled={saving}
                    >
                        {saving ? <CircularProgress size={20} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default RolePermissionsView; 