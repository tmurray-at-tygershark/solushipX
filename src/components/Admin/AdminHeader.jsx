import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
    IconButton,
    Avatar,
    Menu,
    MenuItem,
    ListItemIcon,
    Box,
    Typography,
    Paper,
    Grid,
    Divider,
    Button
} from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
    Person as PersonIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    Close as CloseIcon,
    Business as BusinessIcon,
    People as PeopleIcon,
    LocalShipping as ShippingIcon,
    LocationOn as LocationIcon,
    LocalAtm as BillingIcon,
    Assessment as ReportsIcon,
    Security as SecurityIcon,
    Dashboard as DashboardIcon,
    TrendingUp as MarkupIcon,
    IntegrationInstructions as IntegrationIcon,
    Receipt as InvoiceIcon,
    CreditCard as PaymentIcon,
    DataUsage as EdiIcon,
    AdminPanelSettings as AdminIcon,
    BarChart as MetricsIcon,
    BarChart,
    MonitorHeart as HealthIcon,
    ExpandMore as ExpandMoreIcon,
    Add as AddIcon,
    FlashOn as QuickIcon,
    Assessment as AssessmentIcon,
    Build as ConfigIcon,
    Assignment as TaskIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import './AdminHeader.css';

const AdminHeader = () => {
    const location = useLocation();
    const { logout, currentUser } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [megaMenuOpen, setMegaMenuOpen] = useState(null);
    const [userProfileData, setUserProfileData] = useState({});
    const navbarRef = useRef(null);
    const megaMenuTimeoutRef = useRef(null);

    // Mega menu configuration
    const megaMenuConfig = {
        operations: {
            title: 'Accounts',
            icon: <BusinessIcon />,
            color: '#3b82f6',
            items: [
                { title: 'Organizations', description: 'Organizational structure', icon: <AdminIcon />, path: '/admin/organizations' },
                { title: 'Companies', description: 'Manage company profiles and settings', icon: <BusinessIcon />, path: '/admin/companies' },
                { title: 'Customers', description: 'Customer database and relationships', icon: <PeopleIcon />, path: '/admin/customers' },
                { title: 'Addresses', description: 'Address book management', icon: <LocationIcon />, path: '/admin/addresses' }
            ]
        },
        shipments: {
            title: 'Shipments',
            icon: <ShippingIcon />,
            color: '#059669',
            items: [
                { title: 'View Shipments', description: 'View and manage all shipments', icon: <ShippingIcon />, path: '/admin/shipments' },
                { title: 'Quick Ship', description: 'Create shipments quickly', icon: <AddIcon />, path: '/admin/shipments?action=quickship' },
                { title: 'Real Time Rates', description: 'Get instant shipping rates', icon: <AssessmentIcon />, path: '/admin/shipments?action=rates' },
                { title: 'Follow-ups', description: 'Manage shipment follow-up tasks and workflows', icon: <TaskIcon />, path: '/admin/followups' }
            ]
        },
        logistics: {
            title: 'Carriers',
            icon: <ShippingIcon />,
            color: '#10b981',
            items: [
                { title: 'Carriers', description: 'Carrier integrations and management', icon: <ShippingIcon />, path: '/admin/carriers' },
                { title: 'Markups', description: 'Rate markups and pricing rules', icon: <MarkupIcon />, path: '/admin/markups' },
                { title: 'Integrations', description: 'API connections and webhooks', icon: <IntegrationIcon />, path: '/admin/integrations' }
            ]
        },
        financial: {
            title: 'Billing',
            icon: <BillingIcon />,
            color: '#f59e0b',
            items: [
                { title: 'Billing Overview', description: 'Financial dashboard and metrics', icon: <BillingIcon />, path: '/admin/billing/overview' },
                { title: 'Invoices', description: 'Invoice generation and management', icon: <InvoiceIcon />, path: '/admin/billing' },
                { title: 'Payment Terms', description: 'Payment configurations', icon: <PaymentIcon />, path: '/admin/billing/payment-terms' },
                { title: 'EDI Processing', description: 'Electronic data interchange', icon: <EdiIcon />, path: '/admin/billing/ap-processing' }
            ]
        },
        access: {
            title: 'Access',
            icon: <SecurityIcon />,
            color: '#8b5cf6',
            items: [
                { title: 'Users', description: 'User accounts and profiles', icon: <PeopleIcon />, path: '/admin/users' },
                { title: 'Permissions', description: 'Role-based access control', icon: <SecurityIcon />, path: '/admin/role-permissions' }
            ]
        },
        analytics: {
            title: 'Reporting',
            icon: <ReportsIcon />,
            color: '#ef4444',
            items: [
                { title: 'Dashboard', description: 'Real-time system overview', icon: <DashboardIcon />, path: '/admin/dashboard' },
                { title: 'Reports', description: 'Custom reports and analytics', icon: <ReportsIcon />, path: '/admin/reports' },
                { title: 'Performance', description: 'System performance metrics', icon: <MetricsIcon />, path: '/admin/performance' },
                { title: 'System Health', description: 'Monitor system status', icon: <HealthIcon />, path: '/admin/health' }
            ]
        }
    };

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



    // Load user profile data for avatar
    useEffect(() => {
        const loadUserProfileData = async () => {
            if (currentUser?.uid) {
                try {
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserProfileData({
                            firstName: userData.firstName || '',
                            lastName: userData.lastName || '',
                            photoURL: userData.photoURL || currentUser.photoURL || '',
                            email: userData.email || currentUser.email || ''
                        });
                    } else {
                        // Fallback to auth data if no Firestore document
                        setUserProfileData({
                            firstName: '',
                            lastName: '',
                            photoURL: currentUser.photoURL || '',
                            email: currentUser.email || ''
                        });
                    }
                } catch (error) {
                    console.error('Error loading user profile data:', error);
                    // Fallback to auth data
                    setUserProfileData({
                        firstName: '',
                        lastName: '',
                        photoURL: currentUser.photoURL || '',
                        email: currentUser.email || ''
                    });
                }
            }
        };

        loadUserProfileData();
    }, [currentUser]);

    // Close mega menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (navbarRef.current && !navbarRef.current.contains(event.target)) {
                setMegaMenuOpen(null);
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape') {
                setMegaMenuOpen(null);
            }
        };

        if (megaMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [megaMenuOpen]);

    const handleLogout = async () => {
        try {
            await logout();
            hardRedirect('/login');
        } catch (error) {
            console.error('Failed to log out:', error);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    const isActiveCategory = (categoryKey) => {
        const category = megaMenuConfig[categoryKey];
        return category.items.some(item => location.pathname.startsWith(item.path));
    };

    const isAnyPageActive = () => {
        return Object.values(megaMenuConfig).some(category =>
            category.items.some(item => location.pathname.startsWith(item.path))
        );
    };

    // Hard redirect function to reset all state and navigate
    const hardRedirect = (path) => {
        window.location.href = path;
    };

    // Handle outside clicks to close mobile menu and window resize
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (navbarRef.current && !navbarRef.current.contains(event.target) && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape') {
                if (mobileMenuOpen) setMobileMenuOpen(false);
                if (megaMenuOpen) setMegaMenuOpen(null);
            }
        };

        const handleResize = () => {
            if (window.innerWidth >= 900 && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleEscapeKey);

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('keydown', handleEscapeKey);
            if (megaMenuTimeoutRef.current) {
                clearTimeout(megaMenuTimeoutRef.current);
            }
        };
    }, [mobileMenuOpen, megaMenuOpen]);

    const renderCategoryMegaMenu = (categoryKey, category) => {
        if (megaMenuOpen !== categoryKey) return null;

        return (
            <Box
                sx={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 999999,
                    mt: 0, // Remove gap between button and menu
                    width: '320px',
                    maxWidth: '90vw'
                }}
                onMouseEnter={() => {
                    if (megaMenuTimeoutRef.current) {
                        clearTimeout(megaMenuTimeoutRef.current);
                    }
                    setMegaMenuOpen(categoryKey);
                }}
                onMouseLeave={() => {
                    megaMenuTimeoutRef.current = setTimeout(() => {
                        setMegaMenuOpen(null);
                    }, 150);
                }}
            >
                <Paper
                    elevation={12}
                    sx={{
                        borderRadius: 2,
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        mt: 1 // Add small gap back for visual separation
                    }}
                >
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                            <Box sx={{ color: category.color, mr: 1, fontSize: '18px' }}>
                                {category.icon}
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#111827',
                                    lineHeight: 1.2
                                }}
                            >
                                {category.title}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {category.items.map((item, index) => (
                                <Box
                                    key={index}
                                    onClick={() => {
                                        setMegaMenuOpen(null);
                                        hardRedirect(item.path);
                                    }}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 1,
                                        transition: 'all 0.15s ease',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        backgroundColor: location.pathname.startsWith(item.path) ? `${category.color}10` : 'transparent',
                                        border: location.pathname.startsWith(item.path) ? `1px solid ${category.color}30` : '1px solid transparent',
                                        '&:hover': {
                                            backgroundColor: `${category.color}15`,
                                            transform: 'translateX(2px)',
                                            border: `1px solid ${category.color}40`
                                        }
                                    }}
                                >
                                    <Box sx={{ color: category.color, mr: 1.5, fontSize: '16px' }}>
                                        {item.icon}
                                    </Box>
                                    <Box>
                                        <Typography
                                            sx={{
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: '#111827',
                                                lineHeight: 1.2,
                                                mb: 0.5
                                            }}
                                        >
                                            {item.title}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                fontSize: '11px',
                                                color: '#6b7280',
                                                lineHeight: 1.3
                                            }}
                                        >
                                            {item.description}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Paper>
            </Box>
        );
    };

    const renderQuickActionsMenu = () => {
        if (megaMenuOpen !== 'quickActions') return null;

        const quickActions = [
            {
                title: 'Quickship',
                description: 'Create Shipments Quickly',
                icon: <ShippingIcon />,
                action: () => hardRedirect('/admin/shipments?action=quickship'),
                color: '#10b981'
            },
            {
                title: 'Real-Time Rates',
                description: 'Get Instant Shipping Rates',
                icon: <ShippingIcon />,
                action: () => hardRedirect('/admin/shipments?action=rates'),
                color: '#059669'
            },
            { title: 'New Company', description: 'Add a new company', icon: <BusinessIcon />, path: '/admin/companies/new', color: '#3b82f6' },
            { title: 'New Address', description: 'Add a new address', icon: <LocationIcon />, path: '/admin/addresses/new', color: '#f59e0b' },
            { title: 'New User', description: 'Create a new user account', icon: <PeopleIcon />, path: '/admin/users/new', color: '#8b5cf6' }
        ];

        return (
            <Box
                sx={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 999999,
                    mt: 0, // Remove gap between button and menu
                    width: '280px',
                    maxWidth: '90vw'
                }}
                onMouseEnter={() => {
                    if (megaMenuTimeoutRef.current) {
                        clearTimeout(megaMenuTimeoutRef.current);
                    }
                    setMegaMenuOpen('quickActions');
                }}
                onMouseLeave={() => {
                    megaMenuTimeoutRef.current = setTimeout(() => {
                        setMegaMenuOpen(null);
                    }, 150);
                }}
            >
                <Paper
                    elevation={12}
                    sx={{
                        borderRadius: 2,
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        mt: 1 // Add small gap back for visual separation
                    }}
                >
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                            <Box sx={{ color: '#6366f1', mr: 1, fontSize: '18px' }}>
                                <QuickIcon />
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#111827',
                                    lineHeight: 1.2
                                }}
                            >
                                Quick Actions
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {quickActions.map((action, index) => {
                                // Handle actions with custom functions vs regular path links
                                if (action.action) {
                                    return (
                                        <Box
                                            key={index}
                                            onClick={() => {
                                                setMegaMenuOpen(null);
                                                action.action();
                                            }}
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 1,
                                                transition: 'all 0.15s ease',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                border: '1px solid transparent',
                                                '&:hover': {
                                                    backgroundColor: `${action.color}15`,
                                                    transform: 'translateX(2px)',
                                                    border: `1px solid ${action.color}40`
                                                }
                                            }}
                                        >
                                            <Box sx={{ color: action.color, mr: 1.5, fontSize: '16px' }}>
                                                {action.icon}
                                            </Box>
                                            <Box>
                                                <Typography
                                                    sx={{
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        color: '#111827',
                                                        lineHeight: 1.2,
                                                        mb: 0.5
                                                    }}
                                                >
                                                    {action.title}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: '11px',
                                                        color: '#6b7280',
                                                        lineHeight: 1.3
                                                    }}
                                                >
                                                    {action.description}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                } else {
                                    return (
                                        <Box
                                            key={index}
                                            onClick={() => {
                                                setMegaMenuOpen(null);
                                                hardRedirect(action.path);
                                            }}
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 1,
                                                transition: 'all 0.15s ease',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                border: '1px solid transparent',
                                                '&:hover': {
                                                    backgroundColor: `${action.color}15`,
                                                    transform: 'translateX(2px)',
                                                    border: `1px solid ${action.color}40`
                                                }
                                            }}
                                        >
                                            <Box sx={{ color: action.color, mr: 1.5, fontSize: '16px' }}>
                                                {action.icon}
                                            </Box>
                                            <Box>
                                                <Typography
                                                    sx={{
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        color: '#111827',
                                                        lineHeight: 1.2,
                                                        mb: 0.5
                                                    }}
                                                >
                                                    {action.title}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: '11px',
                                                        color: '#6b7280',
                                                        lineHeight: 1.3
                                                    }}
                                                >
                                                    {action.description}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                }
                            })}
                        </Box>
                    </Box>
                </Paper>
            </Box>
        );
    };

    const renderSettingsMenu = () => {
        if (megaMenuOpen !== 'settings') return null;

        const settingsOptions = [
            {
                title: 'System Configuration',
                description: 'Configure additional services and system components',
                icon: <ConfigIcon />,
                path: '/admin/configuration',
                color: '#7c3aed'
            },
            {
                title: 'System Settings',
                description: 'Global system settings and preferences',
                icon: <SettingsIcon />,
                path: '/admin/settings',
                color: '#6b7280'
            }
        ];

        return (
            <Box
                sx={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 999999,
                    mt: 0,
                    width: '280px',
                    maxWidth: '90vw'
                }}
                onMouseEnter={() => {
                    if (megaMenuTimeoutRef.current) {
                        clearTimeout(megaMenuTimeoutRef.current);
                    }
                    setMegaMenuOpen('settings');
                }}
                onMouseLeave={() => {
                    megaMenuTimeoutRef.current = setTimeout(() => {
                        setMegaMenuOpen(null);
                    }, 150);
                }}
            >
                <Paper
                    elevation={12}
                    sx={{
                        borderRadius: 2,
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        mt: 1
                    }}
                >
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                            <Box sx={{ color: '#6b7280', mr: 1, fontSize: '18px' }}>
                                <SettingsIcon />
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#111827',
                                    lineHeight: 1.2
                                }}
                            >
                                Settings & Configuration
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {settingsOptions.map((option, index) => (
                                <Box
                                    key={index}
                                    onClick={() => {
                                        setMegaMenuOpen(null);
                                        hardRedirect(option.path);
                                    }}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 1,
                                        transition: 'all 0.15s ease',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        border: '1px solid transparent',
                                        '&:hover': {
                                            backgroundColor: `${option.color}15`,
                                            transform: 'translateX(2px)',
                                            border: `1px solid ${option.color}40`
                                        }
                                    }}
                                >
                                    <Box sx={{ color: option.color, mr: 1.5, fontSize: '16px' }}>
                                        {option.icon}
                                    </Box>
                                    <Box>
                                        <Typography
                                            sx={{
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: '#111827',
                                                lineHeight: 1.2,
                                                mb: 0.5
                                            }}
                                        >
                                            {option.title}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                fontSize: '11px',
                                                color: '#6b7280',
                                                lineHeight: 1.3
                                            }}
                                        >
                                            {option.description}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Paper>
            </Box>
        );
    };

    return (
        <nav className="navbar navbar-expand-lg" ref={navbarRef} style={{ position: 'relative' }}>
            <div className="container">
                <Box
                    className="navbar-brand"
                    onClick={() => hardRedirect('/admin')}
                    sx={{ cursor: 'pointer' }}
                >
                    <img
                        src="/images/solushipx_logo_white.png"
                        alt="SolushipX Logo"
                        style={{ height: '52px' }}
                    />
                </Box>
                <IconButton
                    className="navbar-toggler"
                    onClick={handleMobileToggle}
                    aria-label="Toggle navigation"
                    sx={{ display: { xs: 'flex', lg: 'none' }, color: '#0f172a' }}
                >
                    {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                </IconButton>

                {/* Desktop Navigation */}
                <Box sx={{ display: { xs: 'none', lg: 'flex' }, flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Mega Menu */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
                        {Object.entries(megaMenuConfig).map(([key, category]) => (
                            <Box
                                key={key}
                                sx={{ position: 'relative' }}
                                onMouseEnter={() => {
                                    if (megaMenuTimeoutRef.current) {
                                        clearTimeout(megaMenuTimeoutRef.current);
                                    }
                                    setMegaMenuOpen(key);
                                }}
                                onMouseLeave={() => {
                                    megaMenuTimeoutRef.current = setTimeout(() => {
                                        setMegaMenuOpen(null);
                                    }, 150);
                                }}
                            >
                                <Button
                                    onClick={() => setMegaMenuOpen(megaMenuOpen === key ? null : key)}
                                    endIcon={<ExpandMoreIcon />}
                                    sx={{
                                        color: '#ffffff',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        textTransform: 'none',
                                        px: 2,
                                        py: 1,
                                        borderRadius: 1,
                                        backgroundColor: (megaMenuOpen === key || isActiveCategory(key)) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            color: '#ffffff'
                                        },
                                        '& .MuiButton-endIcon': {
                                            transition: 'transform 0.2s ease',
                                            transform: megaMenuOpen === key ? 'rotate(180deg)' : 'rotate(0deg)'
                                        }
                                    }}
                                >
                                    {category.title}
                                </Button>
                                {renderCategoryMegaMenu(key, category)}
                            </Box>
                        ))}
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Quick Actions Button */}
                        <Box
                            sx={{ position: 'relative' }}
                            onMouseEnter={() => {
                                if (megaMenuTimeoutRef.current) {
                                    clearTimeout(megaMenuTimeoutRef.current);
                                }
                                setMegaMenuOpen('quickActions');
                            }}
                            onMouseLeave={() => {
                                megaMenuTimeoutRef.current = setTimeout(() => {
                                    setMegaMenuOpen(null);
                                }, 150);
                            }}
                        >
                            <IconButton
                                onClick={() => setMegaMenuOpen(megaMenuOpen === 'quickActions' ? null : 'quickActions')}
                                sx={{
                                    backgroundColor: '#ffffff',
                                    color: '#374151',
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    border: '2px solid rgba(255, 255, 255, 0.9)',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        backgroundColor: '#f8fafc',
                                        transform: 'scale(1.05)',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)'
                                    }
                                }}
                            >
                                <AddIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                            {renderQuickActionsMenu()}
                        </Box>

                        {/* Settings Dropdown */}
                        <Box
                            sx={{ position: 'relative' }}
                            onMouseEnter={() => {
                                if (megaMenuTimeoutRef.current) {
                                    clearTimeout(megaMenuTimeoutRef.current);
                                }
                                setMegaMenuOpen('settings');
                            }}
                            onMouseLeave={() => {
                                megaMenuTimeoutRef.current = setTimeout(() => {
                                    setMegaMenuOpen(null);
                                }, 150);
                            }}
                        >
                            <IconButton
                                onClick={() => setMegaMenuOpen(megaMenuOpen === 'settings' ? null : 'settings')}
                                sx={{
                                    backgroundColor: '#ffffff',
                                    color: '#374151',
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    border: '2px solid rgba(255, 255, 255, 0.9)',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        backgroundColor: '#f8fafc',
                                        transform: 'scale(1.05)',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)'
                                    }
                                }}
                            >
                                <SettingsIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                            {renderSettingsMenu()}
                        </Box>
                    </Box>
                </Box>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: '#1e40af',
                            zIndex: 999999,
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            display: { xs: 'block', lg: 'none' }
                        }}
                    >
                        <Box sx={{ p: 2 }}>
                            {Object.entries(megaMenuConfig).map(([key, category]) => (
                                <Box key={key} sx={{ mb: 2 }}>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', mb: 1 }}>
                                        {category.title}
                                    </Typography>
                                    {category.items.map((item, index) => (
                                        <Box
                                            key={index}
                                            onClick={() => {
                                                handleMobileMenuClose();
                                                hardRedirect(item.path);
                                            }}
                                            sx={{
                                                cursor: 'pointer',
                                                display: 'block',
                                                padding: '8px 16px',
                                                color: location.pathname.startsWith(item.path) ? '#60a5fa' : '#e2e8f0',
                                                backgroundColor: location.pathname.startsWith(item.path) ? 'rgba(96, 165, 250, 0.1)' : 'transparent',
                                                borderRadius: '4px',
                                                marginBottom: '4px',
                                                fontSize: '12px',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(96, 165, 250, 0.2)'
                                                }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ fontSize: '14px' }}>
                                                    {item.icon}
                                                </Box>
                                                <span>{item.title}</span>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Profile Avatar - Desktop */}
                <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                    <IconButton
                        size="small"
                        onClick={handleMenuClick}
                        className="profile-button"
                        sx={{
                            p: 0, // Remove padding to make avatar fill the button
                            width: 40,
                            height: 40,
                            borderRadius: '50%'
                        }}
                    >
                        <Avatar
                            src={userProfileData.photoURL}
                            className="profile-avatar"
                            sx={{
                                width: 40,
                                height: 40,
                                border: '2px solid #ffffff',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    transform: 'scale(1.05)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                                }
                            }}
                        >
                            {!userProfileData.photoURL && (
                                userProfileData.firstName && userProfileData.lastName
                                    ? `${userProfileData.firstName[0]}${userProfileData.lastName[0]}`
                                    : getInitials(currentUser?.displayName)
                            )}
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
                        <MenuItem onClick={() => { handleMenuClose(); hardRedirect('/admin/profile'); }}>
                            <ListItemIcon>
                                <PersonIcon fontSize="small" />
                            </ListItemIcon>
                            Profile
                        </MenuItem>
                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon>
                                <LogoutIcon fontSize="small" />
                            </ListItemIcon>
                            Logout
                        </MenuItem>
                    </Menu>
                </Box>
            </div>
        </nav>
    );
};

export default AdminHeader;