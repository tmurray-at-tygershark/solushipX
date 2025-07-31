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
    Switch,
    CircularProgress,
    Snackbar,
    Alert,
    Dialog,
    TextField
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
    Save as SaveIcon,
    Close as CloseIcon,
    AttachMoney as PricingIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, ROUTE_PERMISSIONS } from '../../../utils/rolePermissions';
import { getFunctions, httpsCallable } from 'firebase/functions';
import AdminBreadcrumb from '../AdminBreadcrumb';

const RolePermissionsView = () => {
    const { currentUser, userRole } = useAuth();
    const functions = getFunctions();
    const [users, setUsers] = useState([]);
    const [dynamicRoles, setDynamicRoles] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState(['all']);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Dialog states
    const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
    const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
    const [deleteRoleDialogOpen, setDeleteRoleDialogOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);

    // Form states
    const [roleForm, setRoleForm] = useState({
        roleId: '',
        displayName: '',
        description: '',
        color: '#757575',
        permissions: {},
        isActive: true
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            await Promise.all([
                fetchUsers(),
                fetchDynamicRoles()
            ]);
            setLoading(false);
        } catch (error) {
            console.error('Error loading data:', error);
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersData = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchDynamicRoles = async () => {
        try {
            const getRolesFunction = httpsCallable(functions, 'getRoles');
            const result = await getRolesFunction();
            if (result.data.success) {
                setDynamicRoles(result.data.roles);
            }
        } catch (error) {
            console.error('Error fetching dynamic roles:', error);
            // Continue with hardcoded roles if dynamic roles fail
        }
    };

    const handleCreateRole = async () => {
        try {
            setSaving(true);
            const createRoleFunction = httpsCallable(functions, 'createRole');
            const result = await createRoleFunction(roleForm);

            if (result.data.success) {
                showSnackbar(`Role "${roleForm.displayName}" created successfully`, 'success');
                setAddRoleDialogOpen(false);
                resetRoleForm();
                await fetchDynamicRoles();
            }
        } catch (error) {
            console.error('Error creating role:', error);
            showSnackbar(error.message || 'Failed to create role', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateRole = async () => {
        try {
            setSaving(true);
            const updateRoleFunction = httpsCallable(functions, 'updateRole');
            const result = await updateRoleFunction({
                roleId: selectedRole,
                updates: {
                    displayName: roleForm.displayName,
                    description: roleForm.description,
                    color: roleForm.color,
                    permissions: roleForm.permissions,
                    isActive: roleForm.isActive
                }
            });

            if (result.data.success) {
                showSnackbar(`Role updated successfully`, 'success');
                setEditRoleDialogOpen(false);
                setSelectedRole(null);
                resetRoleForm();
                await fetchDynamicRoles();
            }
        } catch (error) {
            console.error('Error updating role:', error);
            showSnackbar(error.message || 'Failed to update role', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async () => {
        try {
            setSaving(true);
            const deleteRoleFunction = httpsCallable(functions, 'deleteRole');
            const result = await deleteRoleFunction({
                roleId: selectedRole,
                force: false // Don't force delete by default
            });

            if (result.data.success) {
                showSnackbar(`Role deleted successfully`, 'success');
                setDeleteRoleDialogOpen(false);
                setSelectedRole(null);
                await fetchDynamicRoles();
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            if (error.message.includes('users are still assigned')) {
                showSnackbar('Cannot delete role: users are still assigned to this role', 'warning');
            } else {
                showSnackbar(error.message || 'Failed to delete role', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    const resetRoleForm = () => {
        setRoleForm({
            roleId: '',
            displayName: '',
            description: '',
            color: '#757575',
            permissions: {},
            isActive: true
        });
    };

    const openEditDialog = (roleId) => {
        const role = dynamicRoles[roleId] || {};
        setSelectedRole(roleId);
        setRoleForm({
            roleId: roleId,
            displayName: role.displayName || '',
            description: role.description || '',
            color: role.color || '#757575',
            permissions: role.permissions || {},
            isActive: role.isActive !== false
        });
        setEditRoleDialogOpen(true);
    };

    const openDeleteDialog = (roleId) => {
        setSelectedRole(roleId);
        setDeleteRoleDialogOpen(true);
    };

    // Helper functions
    const getRoleDisplayName = (role) => {
        // Check dynamic roles first
        if (dynamicRoles[role]) {
            return dynamicRoles[role].displayName;
        }

        // Fallback to hardcoded roles
        switch (role) {
            case 'superadmin': return 'Super Admin';
            case 'admin': return 'Admin';
            case 'user': return 'Company Admin';
            case 'accounting': return 'Accounting';
            case 'company_staff': return 'Company Staff';
            case 'manufacturer': return 'Manufacturer';
            default: return role;
        }
    };

    const getRoleDescription = (role) => {
        // Check dynamic roles first
        if (dynamicRoles[role]) {
            return dynamicRoles[role].description;
        }

        // Fallback to hardcoded roles
        switch (role) {
            case 'superadmin': return 'Full system access with no limitations';
            case 'admin': return 'Administrative access to manage the system';
            case 'user': return 'Company-level access for daily operations';
            case 'accounting': return 'Access to billing, invoicing, and financial reports';
            case 'company_staff': return 'Basic operational access for company staff';
            case 'manufacturer': return 'Limited access for manufacturing partners';
            default: return '';
        }
    };

    const getRoleColor = (role) => {
        // Check dynamic roles first
        if (dynamicRoles[role]) {
            return dynamicRoles[role].color;
        }

        // Fallback to hardcoded roles
        switch (role) {
            case 'superadmin': return '#9c27b0';
            case 'admin': return '#2196f3';
            case 'user': return '#4caf50';
            case 'accounting': return '#ff9800';
            case 'company_staff': return '#00bcd4';
            case 'manufacturer': return '#607d8b';
            default: return '#757575';
        }
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'superadmin': return <SecurityIcon />;
            case 'admin': return <BusinessIcon />;
            case 'user': return <PersonIcon />;
            case 'accounting': return <BillingIcon />;
            case 'company_staff': return <PeopleIcon />;
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
        if (permissionKey.includes('RATE') || permissionKey.includes('PRICING') || permissionKey.includes('BREAKDOWN')) return 'Rate & Pricing Visibility';
        if (permissionKey.includes('BILL_TYPE') || permissionKey.includes('ETA') || permissionKey.includes('DECLARED_VALUE') || permissionKey.includes('FREIGHT_CLASS')) return 'Form Field Visibility';
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
            case 'Rate & Pricing Visibility': return <PricingIcon />;
            case 'Form Field Visibility': return <VisibilityIcon />;
            default: return <BusinessIcon />;
        }
    };

    const hasPermission = (role, permission) => {
        // Check dynamic roles first, then fall back to hardcoded roles
        if (dynamicRoles[role]?.permissions?.[permission] !== undefined) {
            return dynamicRoles[role].permissions[permission];
        }

        // Fall back to hardcoded ROLE_PERMISSIONS
        if (ROLE_PERMISSIONS[role]?.['*']) return true;
        return ROLE_PERMISSIONS[role]?.[permission] === true;
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

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    // Group permissions by category
    const permissionCategories = {};
    Object.entries(PERMISSIONS).forEach(([key, value]) => {
        const category = getPermissionCategory(key);
        if (!permissionCategories[category]) {
            permissionCategories[category] = {
                icon: getCategoryIcon(category),
                permissions: []
            };
        }
        permissionCategories[category].permissions.push({ key, value });
    });

    // Combine hardcoded and dynamic roles
    const allRoles = {
        ...ROLES,
        ...Object.keys(dynamicRoles).reduce((acc, roleId) => {
            acc[roleId.toUpperCase()] = roleId;
            return acc;
        }, {})
    };

    // Group users by role
    const usersByRole = users.reduce((acc, user) => {
        const role = user.role || 'user';
        if (!acc[role]) acc[role] = [];
        acc[role].push(user);
        return acc;
    }, {});

    const canEditPermissions = userRole === 'superadmin';

    if (loading) {
        return (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600, mb: 1 }}>
                        Role Permissions
                    </Typography>
                    <AdminBreadcrumb currentPage="Role Permissions" />
                </Box>

                {canEditPermissions && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            startIcon={<PersonIcon />}
                            onClick={() => setAddRoleDialogOpen(true)}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Add New Role
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Role Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {Object.entries(allRoles).map(([key, roleId]) => {
                    const userCount = usersByRole[roleId]?.length || 0;
                    const keyPermissions = Object.entries(PERMISSIONS)
                        .filter(([_, permId]) => hasPermission(roleId, permId))
                        .slice(0, 5);

                    const isDynamicRole = !!dynamicRoles[roleId];

                    return (
                        <Grid item xs={12} md={4} key={roleId}>
                            <Card sx={{
                                height: '100%',
                                borderTop: `4px solid ${getRoleColor(roleId)}`,
                                '&:hover': { boxShadow: 3 }
                            }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Avatar sx={{ bgcolor: getRoleColor(roleId), mr: 2 }}>
                                            {getRoleIcon(roleId)}
                                        </Avatar>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                                    {getRoleDisplayName(roleId)}
                                                </Typography>
                                                {isDynamicRole && (
                                                    <Chip
                                                        label="Custom"
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ fontSize: '10px', height: '18px' }}
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px' }}>
                                                {userCount} user{userCount !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
                                        {canEditPermissions && isDynamicRole && (
                                            <Box>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => openEditDialog(roleId)}
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => openDeleteDialog(roleId)}
                                                    sx={{ fontSize: '12px', color: 'error.main' }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        )}
                                    </Box>
                                    <Typography variant="body2" sx={{ mb: 2, fontSize: '12px' }}>
                                        {getRoleDescription(roleId)}
                                    </Typography>

                                    {/* Key Permissions */}
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '12px', fontWeight: 600 }}>
                                            Key Permissions:
                                        </Typography>
                                        {roleId === 'superadmin' ? (
                                            <Chip
                                                label="All Permissions"
                                                size="small"
                                                color="primary"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        ) : (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {keyPermissions.map(([key, permId]) => (
                                                    <Chip
                                                        key={permId}
                                                        label={permId.replace(/_/g, ' ').toLowerCase()}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '10px', textTransform: 'capitalize' }}
                                                    />
                                                ))}
                                                {Object.entries(PERMISSIONS).filter(([_, permId]) => hasPermission(roleId, permId)).length > 5 && (
                                                    <Chip
                                                        label={`+${Object.entries(PERMISSIONS).filter(([_, permId]) => hasPermission(roleId, permId)).length - 5} more`}
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
                        View permissions by role and category. Use role dialogs to edit permissions.
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

                    {Object.entries(permissionCategories).map(([category, { icon, permissions }]) => (
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
                                        label={permissions.length}
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
                                                {Object.values(ROLES).map(roleId => (
                                                    <TableCell key={roleId} align="center" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        <Box>
                                                            {getRoleDisplayName(roleId)}
                                                        </Box>
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {permissions.map(({ key, value: permId }) => (
                                                <TableRow key={permId}>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {permId.replace(/_/g, ' ').toLowerCase()}
                                                            <Tooltip title={`Permission: ${permId}`}>
                                                                <InfoIcon sx={{ fontSize: '14px', color: 'text.secondary' }} />
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                    {Object.values(ROLES).map(roleId => (
                                                        <TableCell key={roleId} align="center">
                                                            {hasPermission(roleId, permId) ? (
                                                                <CheckIcon sx={{ color: 'success.main', fontSize: '20px' }} />
                                                            ) : (
                                                                <CancelIcon sx={{ color: 'text.disabled', fontSize: '20px' }} />
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            </Paper>

            {/* Route Access Control */}
            <Paper sx={{ mb: 4 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Route Access Control
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px', mt: 0.5 }}>
                        Admin routes and required permissions
                    </Typography>
                </Box>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Route</TableCell>
                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Required Permissions</TableCell>
                                {Object.values(ROLES).map(roleId => (
                                    <TableCell key={roleId} align="center" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        {getRoleDisplayName(roleId)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(ROUTE_PERMISSIONS)
                                .filter(([route]) => route.startsWith('/admin'))
                                .map(([route, permissions]) => {
                                    const permArray = Array.isArray(permissions) ? permissions : [permissions];

                                    return (
                                        <TableRow key={route}>
                                            <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                {route}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {permArray.map(perm => (
                                                        <Chip
                                                            key={perm}
                                                            label={perm.replace(/_/g, ' ').toLowerCase()}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontSize: '10px', textTransform: 'capitalize' }}
                                                        />
                                                    ))}
                                                </Box>
                                            </TableCell>
                                            {Object.values(ROLES).map(roleId => {
                                                const hasAccess = permArray.some(perm => hasPermission(roleId, perm));
                                                return (
                                                    <TableCell key={roleId} align="center">
                                                        {hasAccess ? (
                                                            <CheckIcon sx={{ color: 'success.main', fontSize: '20px' }} />
                                                        ) : (
                                                            <CancelIcon sx={{ color: 'text.disabled', fontSize: '20px' }} />
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Users by Role */}
            <Paper>
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Users by Role
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px', mt: 0.5 }}>
                        Current user assignments
                    </Typography>
                </Box>

                <Box sx={{ p: 2 }}>
                    <Grid container spacing={3}>
                        {Object.entries(ROLES).map(([key, roleId]) => (
                            <Grid item xs={12} md={4} key={roleId}>
                                <Box sx={{ mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Avatar sx={{ bgcolor: getRoleColor(roleId), width: 32, height: 32 }}>
                                            {getRoleIcon(roleId)}
                                        </Avatar>
                                        <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                            {getRoleDisplayName(roleId)}
                                        </Typography>
                                        <Chip
                                            label={usersByRole[roleId]?.length || 0}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </Box>
                                    <List dense>
                                        {usersByRole[roleId]?.map(user => (
                                            <ListItem key={user.id} sx={{ px: 0 }}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <Avatar sx={{ width: 28, height: 28, fontSize: '12px' }}>
                                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                                    </Avatar>
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={`${user.firstName || ''} ${user.lastName || ''}`}
                                                    secondary={user.email}
                                                    primaryTypographyProps={{ fontSize: '12px' }}
                                                    secondaryTypographyProps={{ fontSize: '11px' }}
                                                />
                                            </ListItem>
                                        ))}
                                        {(!usersByRole[roleId] || usersByRole[roleId].length === 0) && (
                                            <ListItem sx={{ px: 0 }}>
                                                <ListItemText
                                                    primary="No users assigned"
                                                    primaryTypographyProps={{ fontSize: '12px', color: 'text.secondary' }}
                                                />
                                            </ListItem>
                                        )}
                                    </List>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Paper>

            {/* Add Role Dialog */}
            <Dialog
                open={addRoleDialogOpen}
                onClose={() => {
                    setAddRoleDialogOpen(false);
                    resetRoleForm();
                }}
                maxWidth="md"
                fullWidth
            >
                <Box sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Add New Role
                    </Typography>

                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Role ID"
                                value={roleForm.roleId}
                                onChange={(e) => setRoleForm({ ...roleForm, roleId: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') })}
                                size="small"
                                sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                                helperText="Lowercase letters and underscores only"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Display Name"
                                value={roleForm.displayName}
                                onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
                                size="small"
                                sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={roleForm.description}
                                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                                size="small"
                                multiline
                                rows={2}
                                sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Color"
                                type="color"
                                value={roleForm.color}
                                onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                                size="small"
                                sx={{ '& .MuiInputLabel-root': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Switch
                                    checked={roleForm.isActive}
                                    onChange={(e) => setRoleForm({ ...roleForm, isActive: e.target.checked })}
                                    size="small"
                                />
                                <Typography sx={{ fontSize: '12px' }}>Active</Typography>
                            </Box>
                        </Grid>

                        {/* Permissions Section */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                Permissions
                            </Typography>
                            <Box sx={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e0e0e0', p: 2, borderRadius: 1 }}>
                                {Object.entries(permissionCategories).map(([category, { icon, permissions }]) => (
                                    <Accordion key={category} sx={{ mb: 1 }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {icon}
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {category}
                                                </Typography>
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Grid container spacing={1}>
                                                {permissions.map(({ key, value: permId }) => (
                                                    <Grid item xs={12} sm={6} key={permId}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Switch
                                                                checked={roleForm.permissions[permId] || false}
                                                                onChange={(e) => setRoleForm({
                                                                    ...roleForm,
                                                                    permissions: {
                                                                        ...roleForm.permissions,
                                                                        [permId]: e.target.checked
                                                                    }
                                                                })}
                                                                size="small"
                                                            />
                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                {permId.replace(/_/g, ' ').toLowerCase()}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                ))}
                            </Box>
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 3 }}>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setAddRoleDialogOpen(false);
                                resetRoleForm();
                            }}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleCreateRole}
                            disabled={saving || !roleForm.roleId || !roleForm.displayName}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Create Role
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            {/* Edit Role Dialog */}
            <Dialog
                open={editRoleDialogOpen}
                onClose={() => {
                    setEditRoleDialogOpen(false);
                    setSelectedRole(null);
                    resetRoleForm();
                }}
                maxWidth="md"
                fullWidth
            >
                <Box sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Edit Role: {roleForm.displayName}
                    </Typography>

                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Display Name"
                                value={roleForm.displayName}
                                onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
                                size="small"
                                sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Color"
                                type="color"
                                value={roleForm.color}
                                onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                                size="small"
                                sx={{ '& .MuiInputLabel-root': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={roleForm.description}
                                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                                size="small"
                                multiline
                                rows={2}
                                sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Switch
                                    checked={roleForm.isActive}
                                    onChange={(e) => setRoleForm({ ...roleForm, isActive: e.target.checked })}
                                    size="small"
                                />
                                <Typography sx={{ fontSize: '12px' }}>Active</Typography>
                            </Box>
                        </Grid>

                        {/* Permissions Section */}
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                Permissions
                            </Typography>
                            <Box sx={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e0e0e0', p: 2, borderRadius: 1 }}>
                                {Object.entries(permissionCategories).map(([category, { icon, permissions }]) => (
                                    <Accordion key={category} sx={{ mb: 1 }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {icon}
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {category}
                                                </Typography>
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Grid container spacing={1}>
                                                {permissions.map(({ key, value: permId }) => (
                                                    <Grid item xs={12} sm={6} key={permId}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Switch
                                                                checked={roleForm.permissions[permId] || false}
                                                                onChange={(e) => setRoleForm({
                                                                    ...roleForm,
                                                                    permissions: {
                                                                        ...roleForm.permissions,
                                                                        [permId]: e.target.checked
                                                                    }
                                                                })}
                                                                size="small"
                                                            />
                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                {permId.replace(/_/g, ' ').toLowerCase()}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                ))}
                            </Box>
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 3 }}>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setEditRoleDialogOpen(false);
                                setSelectedRole(null);
                                resetRoleForm();
                            }}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleUpdateRole}
                            disabled={saving || !roleForm.displayName}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Update Role
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            {/* Delete Role Dialog */}
            <Dialog
                open={deleteRoleDialogOpen}
                onClose={() => {
                    setDeleteRoleDialogOpen(false);
                    setSelectedRole(null);
                }}
                maxWidth="sm"
                fullWidth
            >
                <Box sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Delete Role
                    </Typography>

                    <Typography sx={{ fontSize: '12px', mb: 3 }}>
                        Are you sure you want to delete the role "{getRoleDisplayName(selectedRole)}"?
                        This action cannot be undone.
                    </Typography>

                    {usersByRole[selectedRole]?.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            <Typography sx={{ fontSize: '12px' }}>
                                Warning: {usersByRole[selectedRole].length} user{usersByRole[selectedRole].length !== 1 ? 's are' : ' is'} currently assigned to this role.
                                They will be automatically reassigned to the "user" role.
                            </Typography>
                        </Alert>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setDeleteRoleDialogOpen(false);
                                setSelectedRole(null);
                            }}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleDeleteRole}
                            disabled={saving}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Delete Role
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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