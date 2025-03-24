import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Avatar,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    IconButton,
    Paper,
    InputBase,
    Button,
    Box,
    Collapse
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Person as PersonIcon,
    Logout as LogoutIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import './Navigation.css';

const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [profileAnchorEl, setProfileAnchorEl] = useState(null);
    const [showTrackingSearch, setShowTrackingSearch] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');
    const location = useLocation();
    const navigate = useNavigate();

    const menuItems = [
        { path: '/', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
        { path: '/shipments', label: 'Shipments', icon: 'fas fa-list' },
        { path: '/create-shipment', label: 'Create Shipment', icon: 'fas fa-box' },
        { path: '/tracking', label: 'Track Shipment', icon: 'fas fa-truck' },
    ];

    const handleProfileClick = (event) => {
        setProfileAnchorEl(event.currentTarget);
    };

    const handleProfileClose = () => {
        setProfileAnchorEl(null);
    };

    const handleLogout = () => {
        handleProfileClose();
        navigate('/');
    };

    const handleTrackingClick = (e) => {
        e.preventDefault();
        setShowTrackingSearch(!showTrackingSearch);
    };

    const handleTrackingSubmit = (e) => {
        e.preventDefault();
        if (trackingNumber.trim()) {
            navigate(`/tracking/${trackingNumber.trim()}`);
            setShowTrackingSearch(false);
            setTrackingNumber('');
        }
    };

    return (
        <>
            <nav className="navbar navbar-expand-lg">
                <div className="container">
                    <Link className="navbar-brand" to="/">
                        <i className="fas fa-shipping-fast me-2"></i>
                        SolushipX
                    </Link>

                    <button
                        className="navbar-toggler"
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle navigation"
                    >
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    <div className={`navbar-collapse ${isOpen ? 'show' : ''}`}>
                        <ul className="navbar-nav ms-auto">
                            {menuItems.map((item) => (
                                <li className="nav-item" key={item.path}>
                                    <Link
                                        className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                        to={item.path}
                                        onClick={item.label === 'Track Shipment' ? handleTrackingClick : () => setIsOpen(false)}
                                    >
                                        <i className={item.icon}></i>
                                        <span className="ms-1">{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                            <li className="nav-item ms-2">
                                <IconButton
                                    onClick={handleProfileClick}
                                    size="small"
                                    sx={{
                                        ml: 2,
                                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                                        '&:hover': {
                                            bgcolor: 'rgba(255, 255, 255, 0.2)'
                                        }
                                    }}
                                >
                                    <Avatar
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            bgcolor: 'transparent',
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            fontWeight: 500
                                        }}
                                    >
                                        TM
                                    </Avatar>
                                </IconButton>
                            </li>
                        </ul>
                    </div>

                    {/* Profile Menu */}
                    <Menu
                        anchorEl={profileAnchorEl}
                        open={Boolean(profileAnchorEl)}
                        onClose={handleProfileClose}
                        onClick={handleProfileClose}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                overflow: 'visible',
                                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                mt: 1.5,
                                '& .MuiAvatar-root': {
                                    width: 32,
                                    height: 32,
                                    ml: -0.5,
                                    mr: 1,
                                },
                                '&:before': {
                                    content: '""',
                                    display: 'block',
                                    position: 'absolute',
                                    top: 0,
                                    right: 14,
                                    width: 10,
                                    height: 10,
                                    bgcolor: 'background.paper',
                                    transform: 'translateY(-50%) rotate(45deg)',
                                    zIndex: 0,
                                },
                            },
                        }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        <MenuItem onClick={handleProfileClose}>
                            <ListItemIcon>
                                <PersonIcon fontSize="small" />
                            </ListItemIcon>
                            Profile
                        </MenuItem>
                        <MenuItem onClick={handleProfileClose}>
                            <ListItemIcon>
                                <SettingsIcon fontSize="small" />
                            </ListItemIcon>
                            Settings
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon>
                                <LogoutIcon fontSize="small" />
                            </ListItemIcon>
                            Logout
                        </MenuItem>
                    </Menu>
                </div>
            </nav>

            {/* Tracking Search Box */}
            <Collapse in={showTrackingSearch}>
                <Box
                    sx={{
                        width: '100%',
                        bgcolor: '#f8f9fa',
                        borderBottom: '1px solid #e9ecef',
                        py: 2
                    }}
                >
                    <div className="container">
                        <form onSubmit={handleTrackingSubmit}>
                            <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
                                <Paper
                                    component="div"
                                    sx={{
                                        p: '2px 4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        flex: 1,
                                        boxShadow: 'none',
                                        border: '1px solid #dfe3e8'
                                    }}
                                >
                                    <SearchIcon sx={{ p: 1, color: 'action.active' }} />
                                    <InputBase
                                        sx={{ ml: 1, flex: 1 }}
                                        placeholder="Enter tracking number"
                                        value={trackingNumber}
                                        onChange={(e) => setTrackingNumber(e.target.value)}
                                    />
                                </Paper>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    sx={{
                                        bgcolor: '#2C6ECB',
                                        '&:hover': { bgcolor: '#235ba7' },
                                        minWidth: '120px'
                                    }}
                                >
                                    Track
                                </Button>
                            </Box>
                        </form>
                    </div>
                </Box>
            </Collapse>
        </>
    );
};

export default Navigation; 