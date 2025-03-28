import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemButton,
    Box,
    Typography,
    Divider,
    Collapse,
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
    ExpandLess,
    ExpandMore,
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
    const [open, setOpen] = React.useState(true);

    const handleClick = () => {
        setOpen(!open);
    };

    return (
        <Box className="admin-sidebar">
            <Box className="admin-sidebar-header">
                <Typography variant="h6" component="div" className="admin-sidebar-title">
                    Admin Panel
                </Typography>
            </Box>
            <Divider />
            <List component="nav" className="admin-sidebar-list">
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton
                            selected={location.pathname === item.path}
                            onClick={() => navigate(item.path)}
                            className={`admin-sidebar-item ${location.pathname === item.path ? 'selected' : ''}`}
                        >
                            <ListItemIcon className="admin-sidebar-icon">
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                    style: {
                                        fontWeight: location.pathname === item.path ? 600 : 400,
                                        color: location.pathname === item.path ? '#0f172a' : '#64748b'
                                    }
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

export default AdminSidebar; 