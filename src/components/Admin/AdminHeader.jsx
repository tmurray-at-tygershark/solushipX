import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconButton, Avatar, Menu, MenuItem, ListItemIcon } from '@mui/material';
import {
    Person as PersonIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './AdminHeader.css';

const AdminHeader = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, currentUser } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out:', error);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    return (
        <nav className="navbar navbar-expand-lg">
            <div className="container">
                <Link className="navbar-brand" to="/admin">
                    <img
                        src="/images/solushipx_logo_white.png"
                        alt="SolushipX Logo"
                        style={{ height: '30px' }}
                    />
                </Link>
                <button className="navbar-toggler" type="button" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="navbar-collapse">
                    <ul className="navbar-nav me-auto"></ul>
                    <ul className="navbar-nav ms-auto">
                        <li className="nav-item">
                            <Link className={`nav-link ${location.pathname === '/admin' || location.pathname === '/admin/' ? 'active' : ''}`} to="/admin">
                                <span>Dashboard</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className={`nav-link ${location.pathname.startsWith('/admin/organizations') ? 'active' : ''}`} to="/admin/organizations">
                                <span>Organizations</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className={`nav-link ${location.pathname.startsWith('/admin/companies') ? 'active' : ''}`} to="/admin/companies">
                                <span>Companies</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className={`nav-link ${location.pathname.startsWith('/admin/users') ? 'active' : ''}`} to="/admin/users">
                                <span>Users</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className={`nav-link ${location.pathname.startsWith('/admin/shipments') ? 'active' : ''}`} to="/admin/shipments">
                                <span>Shipments</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className={`nav-link ${location.pathname.startsWith('/admin/billing') ? 'active' : ''}`} to="/admin/billing">
                                <span>Billing</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className={`nav-link ${location.pathname.startsWith('/admin/roles') ? 'active' : ''}`} to="/admin/roles">
                                <span>Roles</span>
                            </Link>
                        </li>
                        <li className="nav-item ms-2">
                            <IconButton
                                size="small"
                                onClick={handleMenuClick}
                                className="profile-button"
                            >
                                <Avatar className="profile-avatar">
                                    {getInitials(currentUser?.displayName)}
                                </Avatar>
                            </IconButton>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={handleMenuClose}
                                className="profile-menu"
                                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                            >
                                <MenuItem onClick={() => { handleMenuClose(); navigate('/admin/profile'); }}>
                                    <ListItemIcon>
                                        <PersonIcon fontSize="small" />
                                    </ListItemIcon>
                                    Profile
                                </MenuItem>
                                <MenuItem onClick={() => { handleMenuClose(); navigate('/admin/settings'); }}>
                                    <ListItemIcon>
                                        <SettingsIcon fontSize="small" />
                                    </ListItemIcon>
                                    Settings
                                </MenuItem>
                                <MenuItem onClick={handleLogout}>
                                    <ListItemIcon>
                                        <LogoutIcon fontSize="small" />
                                    </ListItemIcon>
                                    Logout
                                </MenuItem>
                            </Menu>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default AdminHeader; 