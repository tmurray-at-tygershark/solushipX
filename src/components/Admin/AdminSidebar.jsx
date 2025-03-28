import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemButton,
    Divider,
    Box,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Business as BusinessIcon,
    People as PeopleIcon,
    LocalShipping as ShippingIcon,
    Receipt as BillingIcon,
    Assessment as AnalyticsIcon,
    Settings as SettingsIcon,
    Security as SecurityIcon,
} from '@mui/icons-material';
import './AdminSidebar.css';

const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin' },
    { text: 'Companies', icon: <BusinessIcon />, path: '/admin/companies' },
    { text: 'Users', icon: <PeopleIcon />, path: '/admin/users' },
    { text: 'Shipments', icon: <ShippingIcon />, path: '/admin/shipments' },
    { text: 'Billing', icon: <BillingIcon />, path: '/admin/billing' },
    { text: 'Analytics', icon: <AnalyticsIcon />, path: '/admin/analytics' },
    { text: 'Roles & Permissions', icon: <SecurityIcon />, path: '/admin/roles' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/admin/settings' },
];

const AdminSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Box className="admin-sidebar">
            <List>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton
                            selected={location.pathname === item.path}
                            onClick={() => navigate(item.path)}
                            className="admin-sidebar-item"
                        >
                            <ListItemIcon className="admin-sidebar-icon">
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

export default AdminSidebar; 