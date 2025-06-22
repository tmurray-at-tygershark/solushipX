import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconButton, Avatar, Menu, MenuItem, ListItemIcon } from '@mui/material';
import {
    Person as PersonIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './AdminHeader.css';

const AdminHeader = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, currentUser } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navbarRef = useRef(null);

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleMobileToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const handleMobileMenuClose = () => {
        setMobileMenuOpen(false);
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

    // Handle outside clicks to close mobile menu
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (navbarRef.current && !navbarRef.current.contains(event.target) && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };

        if (mobileMenuOpen) {
            document.addEventListener('click', handleOutsideClick);
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [mobileMenuOpen]);

    return (
        <nav className="navbar navbar-expand-lg" ref={navbarRef}>
            <div className="container">
                <Link className="navbar-brand" to="/admin">
                    <img
                        src="/images/integratedcarrriers_logo_white.png"
                        alt="SolushipX Logo"
                        style={{ height: '30px' }}
                    />
                </Link>
                <IconButton
                    className="navbar-toggler"
                    onClick={handleMobileToggle}
                    aria-label="Toggle navigation"
                    sx={{ display: { xs: 'flex', lg: 'none' }, color: '#0f172a' }}
                >
                    {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                </IconButton>
                <div className={`navbar-collapse ${mobileMenuOpen ? 'show' : ''}`}>
                    <ul className="navbar-nav me-auto"></ul>
                    <ul className="navbar-nav ms-auto">
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.startsWith('/admin/carriers') ? 'active' : ''}`}
                                to="/admin/carriers"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Carriers</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.startsWith('/admin/organizations') ? 'active' : ''}`}
                                to="/admin/organizations"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Organizations</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.startsWith('/admin/companies') ? 'active' : ''}`}
                                to="/admin/companies"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Companies</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.startsWith('/admin/users') ? 'active' : ''}`}
                                to="/admin/users"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Users</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.startsWith('/admin/shipments') ? 'active' : ''}`}
                                to="/admin/shipments"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Shipments</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.startsWith('/admin/billing') ? 'active' : ''}`}
                                to="/admin/billing"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Billing</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.startsWith('/admin/markups') ? 'active' : ''}`}
                                to="/admin/markups"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Markups</span>
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link
                                className={`nav-link ${location.pathname.includes('/admin/role-permissions') ? 'active' : ''}`}
                                to="/admin/role-permissions"
                                onClick={handleMobileMenuClose}
                            >
                                <span>Permissions</span>
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