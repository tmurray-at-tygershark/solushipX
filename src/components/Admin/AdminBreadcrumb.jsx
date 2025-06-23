import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
    Box,
    Typography,
    Breadcrumbs,
    Link as MuiLink
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import './AdminBreadcrumb.css';

const AdminBreadcrumb = ({
    items = null,
    currentPage = null,
    entityName = null,
    showEntityName = true
}) => {
    const location = useLocation();
    const params = useParams();

    // Generate breadcrumbs automatically based on route if items not provided
    const generateBreadcrumbs = () => {
        const pathSegments = location.pathname.split('/').filter(segment => segment !== '');
        const breadcrumbs = [];

        // Remove 'admin' from the beginning since we always show it as root
        const adminIndex = pathSegments.indexOf('admin');
        const relevantSegments = pathSegments.slice(adminIndex + 1);

        // Route mapping for better display names
        const routeMap = {
            'companies': 'Companies',
            'users': 'Users',
            'shipments': 'Shipments',
            'addresses': 'Addresses',
            'billing': 'Billing',
            'carriers': 'Carriers',
            'organizations': 'Organizations',
            'roles': 'Roles',
            'settings': 'Settings',
            'markups': 'Markups',
            'carrier-keys': 'Carrier Keys',
            'edi-mapping': 'EDI Mapping',
            'new': 'New',
            'edit': 'Edit',
            'generate': 'Generate Invoices',
            'overview': 'Overview',
            'edi': 'EDI',
            'business': 'Business',
            'payments': 'Payments',
            'payment-terms': 'Payment Terms',
            'invoice': 'Invoice',
            'reset-password': 'Reset Password'
        };

        // Build breadcrumb items
        let currentPath = '/admin';

        for (let i = 0; i < relevantSegments.length; i++) {
            const segment = relevantSegments[i];
            currentPath += `/${segment}`;

            // Skip ID segments (they look like random strings or are numeric)
            if (segment.length > 15 || /^[a-zA-Z0-9]{15,}$/.test(segment) || /^\d+$/.test(segment)) {
                continue;
            }

            const displayName = routeMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

            // Don't make the last segment a link unless it's not the final segment
            const isLast = i === relevantSegments.length - 1;

            if (!isLast) {
                breadcrumbs.push({
                    label: displayName,
                    path: currentPath,
                    isLink: true
                });
            } else {
                breadcrumbs.push({
                    label: displayName,
                    isLink: false
                });
            }
        }

        return breadcrumbs;
    };

    // Use provided items or generate automatically
    let breadcrumbItems = [];

    if (items) {
        // Convert string items to objects
        breadcrumbItems = items.map((item, index) => {
            if (typeof item === 'string') {
                return {
                    label: item,
                    isLink: false
                };
            }
            return item;
        });
    } else if (currentPage) {
        breadcrumbItems = [{
            label: currentPage,
            isLink: false
        }];
    } else {
        breadcrumbItems = generateBreadcrumbs();
    }

    // Add entity name if provided and showEntityName is true
    if (entityName && showEntityName && breadcrumbItems.length > 0) {
        // Replace the last item with the entity name
        breadcrumbItems[breadcrumbItems.length - 1] = {
            label: entityName,
            isLink: false
        };
    }

    return (
        <Box className="admin-breadcrumb">
            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                aria-label="breadcrumb"
                sx={{ fontSize: '12px' }}
            >
                <MuiLink
                    component={Link}
                    to="/admin"
                    className="breadcrumb-link"
                    underline="hover"
                    color="inherit"
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '12px',
                        color: '#6b7280',
                        '&:hover': {
                            color: '#374151',
                            textDecoration: 'underline'
                        }
                    }}
                >
                    <HomeIcon sx={{ mr: 0.5, fontSize: '16px' }} />
                    Admin
                </MuiLink>

                {breadcrumbItems.map((item, index) => {
                    if (item.isLink && item.path) {
                        return (
                            <MuiLink
                                key={index}
                                component={Link}
                                to={item.path}
                                className="breadcrumb-link"
                                underline="hover"
                                color="inherit"
                                sx={{
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    '&:hover': {
                                        color: '#374151',
                                        textDecoration: 'underline'
                                    }
                                }}
                            >
                                {item.label}
                            </MuiLink>
                        );
                    } else {
                        return (
                            <Typography
                                key={index}
                                color="text.primary"
                                className="breadcrumb-item"
                                sx={{
                                    fontSize: '12px',
                                    color: '#374151',
                                    fontWeight: 500
                                }}
                            >
                                {item.label}
                            </Typography>
                        );
                    }
                })}
            </Breadcrumbs>
        </Box>
    );
};

export default AdminBreadcrumb; 