import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Avatar,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    IconButton,
    Button,
    Box,
    Typography,
    Popper,
    ClickAwayListener,
    ListItem,
    ListItemText
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Person as PersonIcon,
    Logout as LogoutIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import './Navigation.css';
import { useAuth } from '../../contexts/AuthContext';

const Navigation = () => {
    const [profileAnchorEl, setProfileAnchorEl] = useState(null);
    const [featuresAnchorEl, setFeaturesAnchorEl] = useState(null);
    const [integrationsAnchorEl, setIntegrationsAnchorEl] = useState(null);
    const [resourcesAnchorEl, setResourcesAnchorEl] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();

    // Close mobile menu when screen size changes to tablet/desktop and force re-render for dynamic styles
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsOpen(false);
            }
            // Force re-render to update dynamic styles
            setIsOpen(prev => prev);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    // Check if we're on an admin page
    const isAdminPage = location.pathname.startsWith('/admin');

    // Update authentication check to include homepage and admin pages
    const isAuthenticated = location.pathname !== '/login' &&
        location.pathname !== '/signup' &&
        location.pathname !== '/';

    // If we're on an admin page, don't render the navigation
    if (isAdminPage) {
        return null;
    }

    const menuItems = isAuthenticated ? [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/shipments', label: 'Shipments' },
        { path: '/tracking', label: 'Track Shipment' },
        { path: '/customers', label: 'Customers' },
        { path: '/carriers', label: 'Carriers' },
        { path: '/reports', label: 'Reports' }
    ] : [];

    const featuresMenuItems = [
        {
            title: 'Shipping Management',
            description: 'Streamline your shipping operations with powerful tools',
            icon: 'fas fa-shipping-fast',
            items: [
                { label: 'Multi-Carrier Shipping', icon: 'fas fa-truck' },
                { label: 'Rate Shopping', icon: 'fas fa-search-dollar' },
                { label: 'Label Generation', icon: 'fas fa-tag' },
                { label: 'Batch Processing', icon: 'fas fa-layer-group' }
            ]
        },
        {
            title: 'AI Intelligence',
            description: 'Leverage AI-powered insights for smarter shipping decisions',
            icon: 'fas fa-robot',
            items: [
                { label: 'Shipment Analysis', icon: 'fas fa-chart-line' },
                { label: 'Real-Time Shipment Optics', icon: 'fas fa-eye' },
                { label: 'Carrier Analysis', icon: 'fas fa-chart-bar' },
                { label: 'Route Analysis', icon: 'fas fa-route' }
            ]
        },
        {
            title: 'Customer Engagement',
            description: 'Enhance your customer experience',
            icon: 'fas fa-comments',
            items: [
                { label: 'Branded Tracking', icon: 'fas fa-search' },
                { label: 'Customer Portal', icon: 'fas fa-user-circle' },
                { label: 'Email Notifications', icon: 'fas fa-envelope' },
                { label: 'Customer Support', icon: 'fas fa-headset' }
            ]
        }
    ];

    const integrationsMenuItems = [
        {
            title: 'Carriers',
            description: 'Connect with major shipping carriers',
            icon: 'fas fa-truck',
            items: [
                { label: 'UPS', icon: 'fas fa-truck' },
                { label: 'FedEx', icon: 'fas fa-truck' },
                { label: 'USPS', icon: 'fas fa-mail-bulk' },
                { label: 'DHL', icon: 'fas fa-truck' }
            ]
        },
        {
            title: 'Ecommerce Platforms',
            description: 'Integrate with popular online stores',
            icon: 'fas fa-store',
            items: [
                { label: 'Shopify', icon: 'fas fa-store' },
                { label: 'WooCommerce', icon: 'fab fa-wordpress' },
                { label: 'Magento', icon: 'fas fa-store' },
                { label: 'BigCommerce', icon: 'fas fa-store' }
            ]
        },
        {
            title: 'Marketplaces',
            description: 'Connect with major marketplaces',
            icon: 'fas fa-globe',
            items: [
                { label: 'Amazon', icon: 'fab fa-amazon' },
                { label: 'eBay', icon: 'fab fa-ebay' },
                { label: 'Walmart', icon: 'fas fa-store' },
                { label: 'Etsy', icon: 'fab fa-etsy' }
            ]
        }
    ];

    const resourcesMenuItems = [
        {
            title: 'Learning Center',
            description: 'Resources to help you succeed',
            icon: 'fas fa-graduation-cap',
            items: [
                { label: 'Documentation', icon: 'fas fa-book' },
                { label: 'Video Tutorials', icon: 'fas fa-play-circle' },
                { label: 'Best Practices', icon: 'fas fa-star' },
                { label: 'API Reference', icon: 'fas fa-code' }
            ]
        },
        {
            title: 'Support',
            description: 'Get help when you need it',
            icon: 'fas fa-headset',
            items: [
                { label: 'Help Center', icon: 'fas fa-question-circle' },
                { label: 'Community Forum', icon: 'fas fa-comments' },
                { label: 'Contact Support', icon: 'fas fa-envelope' },
                { label: 'Status Page', icon: 'fas fa-info-circle' }
            ]
        }
    ];

    const profileMenuItems = isAuthenticated ? [
        { label: 'Profile', icon: 'fas fa-user' },
        { label: 'Notifications', icon: 'fas fa-bell' },
        { label: 'Billing', icon: 'fas fa-credit-card' },
        { label: 'Settings', icon: 'fas fa-cog' },
        { label: 'Logout', icon: 'fas fa-sign-out-alt' }
    ] : [];

    const handleProfileClick = (event) => {
        setProfileAnchorEl(event.currentTarget);
    };

    const handleProfileClose = () => {
        setProfileAnchorEl(null);
    };

    const handleFeaturesClick = (event) => {
        setFeaturesAnchorEl(event.currentTarget);
    };

    const handleIntegrationsClick = (event) => {
        setIntegrationsAnchorEl(event.currentTarget);
    };

    const handleResourcesClick = (event) => {
        setResourcesAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setFeaturesAnchorEl(null);
        setIntegrationsAnchorEl(null);
        setResourcesAnchorEl(null);
    };

    const handleLogout = async () => {
        try {
            await logout();
            handleProfileClose();
            navigate('/');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const handleMenuItemClick = (path) => {
        navigate(path);
        setFeaturesAnchorEl(null);
        setIntegrationsAnchorEl(null);
        setResourcesAnchorEl(null);
    };

    const handleProfileMenuItemClick = (label) => {
        handleProfileClose();
        switch (label) {
            case 'Profile':
                navigate('/profile');
                break;
            case 'Notifications':
                navigate('/notifications');
                break;
            case 'Billing':
                navigate('/billing');
                break;
            case 'Settings':
                navigate('/settings');
                break;
            case 'Logout':
                handleLogout();
                break;
            default:
                break;
        }
    };

    const renderMenuItems = (items) => {
        return items.map((item, index) => (
            <ListItem
                key={index}
                button
                onClick={() => handleMenuItemClick(item.path || `/${item.label.toLowerCase().replace(/\s+/g, '-')}`)}
                sx={{
                    py: 1,
                    '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.04)'
                    }
                }}
            >
                <ListItemIcon>
                    <i className={item.icon} style={{ marginRight: 12, fontSize: '1rem', color: '#000000' }}></i>
                </ListItemIcon>
                <ListItemText primary={item.label} />
            </ListItem>
        ));
    };

    return (
        <>
            <nav className="navbar navbar-expand-lg">
                <div className="container" onClick={(e) => {
                    // Close mobile menu when clicking outside of it
                    if (isOpen && !e.target.closest('.navbar-collapse') && !e.target.closest('.navbar-toggler')) {
                        setIsOpen(false);
                    }
                }}>
                    <Link className="navbar-brand" to={isAuthenticated ? "/dashboard" : "/homepage"}>
                        <img
                            src="/images/solushipx_logo_white.png"
                            alt="SolushipX Logo"
                            style={{
                                height: window.innerWidth >= 1200 ? '32px' :
                                    window.innerWidth >= 992 ? '30px' :
                                        window.innerWidth >= 768 ? '28px' : '26px'
                            }}
                        />
                    </Link>

                    <button
                        className="navbar-toggler d-lg-none"
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle navigation"
                    >
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    <div className={`collapse navbar-collapse ${isOpen ? 'show' : ''}`} id="navbarNav">
                        <ul className="navbar-nav me-auto">
                            {isAuthenticated ? menuItems.map((item) => (
                                <li className="nav-item" key={item.path}>
                                    <Link
                                        className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                        to={item.path}
                                        onClick={() => setIsOpen(false)}
                                        style={{
                                            fontSize: window.innerWidth >= 1200 ? '1rem' :
                                                window.innerWidth >= 992 ? '0.9rem' : '0.85rem'
                                        }}
                                    >
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            )) : (
                                <>
                                    {/* Features - Desktop and Tablet with progressive sizing */}
                                    <li className="nav-item d-none d-md-block">
                                        <Button
                                            className="nav-link"
                                            onClick={handleFeaturesClick}
                                            endIcon={<ExpandMoreIcon />}
                                            sx={{
                                                color: 'inherit',
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                fontSize: window.innerWidth >= 1200 ? '1rem' :
                                                    window.innerWidth >= 992 ? '0.9rem' : '0.85rem',
                                                px: window.innerWidth >= 992 ? 2 : 1.5
                                            }}
                                        >
                                            Features
                                        </Button>
                                    </li>
                                    {/* Features - Mobile only */}
                                    <li className="nav-item d-md-none">
                                        <Link
                                            className="nav-link"
                                            to="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setIsOpen(false);
                                            }}
                                        >
                                            Features
                                        </Link>
                                    </li>

                                    {/* Pricing - All sizes with progressive font sizing */}
                                    <li className="nav-item">
                                        <Link
                                            className={`nav-link ${location.pathname === '/pricing' ? 'active' : ''}`}
                                            to="/pricing"
                                            onClick={() => setIsOpen(false)}
                                            style={{
                                                fontSize: window.innerWidth >= 1200 ? '1rem' :
                                                    window.innerWidth >= 992 ? '0.9rem' :
                                                        window.innerWidth >= 768 ? '0.85rem' : '1rem',
                                                paddingLeft: window.innerWidth >= 992 ? '16px' : '12px',
                                                paddingRight: window.innerWidth >= 992 ? '16px' : '12px'
                                            }}
                                        >
                                            Pricing
                                        </Link>
                                    </li>

                                    {/* Integrations - Desktop and Tablet with progressive sizing */}
                                    <li className="nav-item d-none d-md-block">
                                        <Button
                                            className="nav-link"
                                            onClick={handleIntegrationsClick}
                                            endIcon={<ExpandMoreIcon />}
                                            sx={{
                                                color: 'inherit',
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                fontSize: window.innerWidth >= 1200 ? '1rem' :
                                                    window.innerWidth >= 992 ? '0.9rem' : '0.85rem',
                                                px: window.innerWidth >= 992 ? 2 : 1.5
                                            }}
                                        >
                                            Integrations
                                        </Button>
                                    </li>
                                    {/* Integrations - Mobile only */}
                                    <li className="nav-item d-md-none">
                                        <Link
                                            className="nav-link"
                                            to="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setIsOpen(false);
                                            }}
                                        >
                                            Integrations
                                        </Link>
                                    </li>

                                    {/* Resources - Desktop and Tablet with progressive sizing */}
                                    <li className="nav-item d-none d-md-block">
                                        <Button
                                            className="nav-link"
                                            onClick={handleResourcesClick}
                                            endIcon={<ExpandMoreIcon />}
                                            sx={{
                                                color: 'inherit',
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                fontSize: window.innerWidth >= 1200 ? '1rem' :
                                                    window.innerWidth >= 992 ? '0.9rem' : '0.85rem',
                                                px: window.innerWidth >= 992 ? 2 : 1.5
                                            }}
                                        >
                                            Resources
                                        </Button>
                                    </li>
                                    {/* Resources - Mobile only */}
                                    <li className="nav-item d-md-none">
                                        <Link
                                            className="nav-link"
                                            to="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setIsOpen(false);
                                            }}
                                        >
                                            Resources
                                        </Link>
                                    </li>
                                </>
                            )}
                        </ul>
                        <ul className="navbar-nav ms-auto">
                            {isAuthenticated ? (
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
                            ) : (
                                <>
                                    <li className="nav-item">
                                        <Link
                                            className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                                            to="/login"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            Sign in
                                        </Link>
                                    </li>
                                    <li className="nav-item">
                                        <Link
                                            className={`nav-link ${location.pathname === '/signup' ? 'active' : ''}`}
                                            to="/signup"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            Sign up
                                        </Link>
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>

                    {/* Features Mega Menu - Desktop and Tablet */}
                    <Menu
                        anchorEl={featuresAnchorEl}
                        open={Boolean(featuresAnchorEl)}
                        onClose={handleMenuClose}
                        sx={{ display: { xs: 'none', md: 'block' } }}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                overflow: 'visible',
                                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                mt: 0,
                                width: '100vw',
                                maxHeight: { xs: '50vh', sm: '60vh', md: '600px' },
                                borderRadius: 0,
                                borderTop: '1px solid #e0e0e0',
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
                        <Box sx={{ p: 4, maxWidth: '1200px', mx: 'auto' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                                {featuresMenuItems.map((section) => (
                                    <Box key={section.title}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <i className={section.icon} style={{ fontSize: '1.5rem', marginRight: 12, color: '#000000' }}></i>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {section.title}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, pl: 7 }}>
                                            {section.description}
                                        </Typography>
                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                            {section.items.map((item) => (
                                                <MenuItem
                                                    key={item.label}
                                                    onClick={handleMenuClose}
                                                    sx={{
                                                        borderRadius: 1,
                                                        py: 1.5,
                                                        pl: 7,
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(44, 110, 203, 0.04)'
                                                        }
                                                    }}
                                                >
                                                    <ListItemIcon>
                                                        <i className={item.icon} style={{ marginRight: 12, fontSize: '1rem', color: '#000000' }}></i>
                                                    </ListItemIcon>
                                                    <Typography variant="body2">{item.label}</Typography>
                                                </MenuItem>
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Menu>

                    {/* Integrations Mega Menu - Desktop and Tablet */}
                    <Menu
                        anchorEl={integrationsAnchorEl}
                        open={Boolean(integrationsAnchorEl)}
                        onClose={handleMenuClose}
                        sx={{ display: { xs: 'none', md: 'block' } }}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                overflow: 'visible',
                                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                mt: 0,
                                width: '100vw',
                                maxHeight: '600px',
                                borderRadius: 0,
                                borderTop: '1px solid #e0e0e0',
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
                        <Box sx={{ p: 4, maxWidth: '1200px', mx: 'auto' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                                {integrationsMenuItems.map((section) => (
                                    <Box key={section.title}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <i className={section.icon} style={{ fontSize: '1.5rem', marginRight: 12, color: '#000000' }}></i>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {section.title}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, pl: 7 }}>
                                            {section.description}
                                        </Typography>
                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                            {section.items.map((item) => (
                                                <MenuItem
                                                    key={item.label}
                                                    onClick={handleMenuClose}
                                                    sx={{
                                                        borderRadius: 1,
                                                        py: 1.5,
                                                        pl: 7,
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(44, 110, 203, 0.04)'
                                                        }
                                                    }}
                                                >
                                                    <ListItemIcon>
                                                        <i className={item.icon} style={{ marginRight: 12, fontSize: '1rem', color: '#000000' }}></i>
                                                    </ListItemIcon>
                                                    <Typography variant="body2">{item.label}</Typography>
                                                </MenuItem>
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Menu>

                    {/* Resources Mega Menu - Desktop and Tablet */}
                    <Menu
                        anchorEl={resourcesAnchorEl}
                        open={Boolean(resourcesAnchorEl)}
                        onClose={handleMenuClose}
                        sx={{ display: { xs: 'none', md: 'block' } }}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                overflow: 'visible',
                                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                mt: 0,
                                width: '100vw',
                                maxHeight: '600px',
                                borderRadius: 0,
                                borderTop: '1px solid #e0e0e0',
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
                        <Box sx={{ p: 4, maxWidth: '1200px', mx: 'auto' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                                {resourcesMenuItems.map((section) => (
                                    <Box key={section.title}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <i className={section.icon} style={{ fontSize: '1.5rem', marginRight: 12, color: '#000000' }}></i>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {section.title}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, pl: 7 }}>
                                            {section.description}
                                        </Typography>
                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                            {section.items.map((item) => (
                                                <MenuItem
                                                    key={item.label}
                                                    onClick={handleMenuClose}
                                                    sx={{
                                                        borderRadius: 1,
                                                        py: 1.5,
                                                        pl: 7,
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(44, 110, 203, 0.04)'
                                                        }
                                                    }}
                                                >
                                                    <ListItemIcon>
                                                        <i className={item.icon} style={{ marginRight: 12, fontSize: '1rem', color: '#000000' }}></i>
                                                    </ListItemIcon>
                                                    <Typography variant="body2">{item.label}</Typography>
                                                </MenuItem>
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Menu>

                    {/* Profile Menu */}
                    <Menu
                        anchorEl={profileAnchorEl}
                        open={Boolean(profileAnchorEl)}
                        onClose={handleProfileClose}
                        PaperProps={{
                            sx: {
                                mt: 1.5,
                                minWidth: 180,
                                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        {profileMenuItems.map((item, index) => (
                            <MenuItem
                                key={index}
                                onClick={() => handleProfileMenuItemClick(item.label)}
                                sx={{
                                    py: 1,
                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' }
                                }}
                            >
                                <ListItemIcon>
                                    <i className={item.icon} style={{ fontSize: '1rem', color: '#666' }}></i>
                                </ListItemIcon>
                                <ListItemText primary={item.label} />
                            </MenuItem>
                        ))}
                    </Menu>
                </div>
            </nav>
        </>
    );
};

export default Navigation; 