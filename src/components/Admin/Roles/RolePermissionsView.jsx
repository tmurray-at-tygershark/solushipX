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
    Alert
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
    Close as CloseIcon
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
    const [loading, setLoading] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState(['all']);
    const [editMode, setEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState({});
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersData = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            setLoading(false);
        }
    };

    // Helper functions
    const getRoleDisplayName = (role) => {
        switch (role) {
            case 'superadmin': return 'Super Admin';
            case 'admin': return 'Admin';
            case 'user': return 'Company Admin';
            case 'accounting': return 'Accounting';
            case 'company_staff': return 'Company Staff';
            default: return role;
        }
    };

    const getRoleDescription = (role) => {
        switch (role) {
            case 'superadmin': return 'Full system access with no limitations';
            case 'admin': return 'Administrative access to manage the system';
            case 'user': return 'Company-level access for daily operations';
            case 'accounting': return 'Access to billing, invoicing, and financial reports';
            case 'company_staff': return 'Basic operational access for company staff';
            default: return '';
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'superadmin': return '#9c27b0';
            case 'admin': return '#2196f3';
            case 'user': return '#4caf50';
            case 'accounting': return '#ff9800';
            case 'company_staff': return '#00bcd4';
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
            default: return <BusinessIcon />;
        }
    };

    const hasPermission = (role, permission) => {
        // Check pending changes first
        const pendingKey = `${role}_${permission}`;
        if (pendingChanges[pendingKey] !== undefined) {
            return pendingChanges[pendingKey];
        }

        // Then check hardcoded permissions
        if (ROLE_PERMISSIONS[role]?.['*']) return true;
        return ROLE_PERMISSIONS[role]?.[permission] === true;
    };

    const handlePermissionToggle = (role, permission) => {
        if (role === 'superadmin') {
            showSnackbar('Super Admin permissions cannot be modified', 'warning');
            return;
        }

        const key = `${role}_${permission}`;
        const currentValue = hasPermission(role, permission);

        setPendingChanges(prev => ({
            ...prev,
            [key]: !currentValue
        }));
    };

    const handleSaveChanges = async () => {
        try {
            setSaving(true);

            // Process pending changes and create a summary
            const changedRoles = {};
            Object.entries(pendingChanges).forEach(([key, value]) => {
                const [role, permission] = key.split('_');
                if (!changedRoles[role]) {
                    changedRoles[role] = { added: [], removed: [] };
                }

                const currentValue = ROLE_PERMISSIONS[role]?.[permission] === true;
                if (value && !currentValue) {
                    changedRoles[role].added.push(permission);
                } else if (!value && currentValue) {
                    changedRoles[role].removed.push(permission);
                }
            });

            // Create a detailed message about what needs to be updated
            let message = 'To persist these changes, update the ROLE_PERMISSIONS object in src/utils/rolePermissions.js:\n\n';

            Object.entries(changedRoles).forEach(([role, changes]) => {
                if (changes.added.length > 0 || changes.removed.length > 0) {
                    message += `Role: ${role}\n`;
                    if (changes.added.length > 0) {
                        message += `  Add permissions: ${changes.added.join(', ')}\n`;
                    }
                    if (changes.removed.length > 0) {
                        message += `  Remove permissions: ${changes.removed.join(', ')}\n`;
                    }
                    message += '\n';
                }
            });

            console.log(message);

            setPendingChanges({});
            setEditMode(false);
            showSnackbar('Permission changes saved locally. Check console for instructions to persist changes.', 'info');
        } catch (error) {
            console.error('Error saving permissions:', error);
            showSnackbar(error.message || 'Error saving permissions', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setPendingChanges({});
        setEditMode(false);
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
                    <Box>
                        {editMode ? (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<CloseIcon />}
                                    onClick={handleCancelEdit}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    onClick={handleSaveChanges}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                    disabled={saving || Object.keys(pendingChanges).length === 0}
                                >
                                    Save Changes
                                </Button>
                            </Box>
                        ) : (
                            <Button
                                variant="contained"
                                startIcon={<EditIcon />}
                                onClick={() => setEditMode(true)}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Edit
                            </Button>
                        )}
                    </Box>
                )}
            </Box>

            {/* Role Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {Object.entries(ROLES).map(([key, roleId]) => {
                    const userCount = usersByRole[roleId]?.length || 0;
                    const keyPermissions = Object.entries(PERMISSIONS)
                        .filter(([_, permId]) => hasPermission(roleId, permId))
                        .slice(0, 5);

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
                                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                                {getRoleDisplayName(roleId)}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px' }}>
                                                {userCount} user{userCount !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
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
                        {editMode ? 'Click on permissions to toggle them' : 'View permissions by role and category'}
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
                                                            {editMode && roleId !== 'superadmin' ? (
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handlePermissionToggle(roleId, permId)}
                                                                >
                                                                    {hasPermission(roleId, permId) ? (
                                                                        <CheckIcon sx={{ color: 'success.main', fontSize: '20px' }} />
                                                                    ) : (
                                                                        <CancelIcon sx={{ color: 'text.disabled', fontSize: '20px' }} />
                                                                    )}
                                                                </IconButton>
                                                            ) : (
                                                                hasPermission(roleId, permId) ? (
                                                                    <CheckIcon sx={{ color: 'success.main', fontSize: '20px' }} />
                                                                ) : (
                                                                    <CancelIcon sx={{ color: 'text.disabled', fontSize: '20px' }} />
                                                                )
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