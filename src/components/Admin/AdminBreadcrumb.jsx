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
    showEntityName = true,
    detailContext = null, // For showing detail breadcrumbs like "Shipments > Shipment Detail"
    onNavigateBack = null // Callback for modal navigation instead of route navigation
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
            'customers': 'Customers',
            'users': 'Users',
            'shipments': 'Shipments',
            'addresses': 'Addresses',
            'billing': 'Billing',
            'carriers': 'Carriers',
            'organizations': 'Organizations',
            'roles': 'Roles',
            'role-permissions': 'Role Permissions',
            'settings': 'Settings',
            'markups': 'Markups',
            'carrier-keys': 'Carrier Keys',
            'edi-mapping': 'EDI Mapping',
            'followups': 'Follow-ups',
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

            // Skip ID segments (they look like random strings, are numeric, or follow shipment ID patterns)
            const isShipmentId = /^[A-Z]{2,6}-[A-Z0-9]{6,}$/i.test(segment); // Matches patterns like ICAL-210C88
            const isFirebaseId = segment.length > 15 || /^[a-zA-Z0-9]{15,}$/.test(segment);
            const isNumericId = /^\d+$/.test(segment);

            if (isShipmentId || isFirebaseId || isNumericId) {
                continue;
            }

            const displayName = routeMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

            // FORCE certain sections to always be clickable, regardless of position
            const forceClickableSections = ['shipments', 'companies', 'customers', 'users', 'carriers', 'billing', 'markups'];
            const isForceClickable = forceClickableSections.includes(segment);

            // Always make these sections clickable, even if they appear to be the last segment
            if (isForceClickable) {
                breadcrumbs.push({
                    label: displayName,
                    path: `/admin/${segment}`,
                    isLink: true
                });
            } else {
                // For other segments, only make clickable if not the last
                const isLast = i === relevantSegments.length - 1;
                if (!isLast) {
                    breadcrumbs.push({
                        label: displayName,
                        path: `/admin/${segment}`,
                        isLink: true
                    });
                } else {
                    breadcrumbs.push({
                        label: displayName,
                        isLink: false
                    });
                }
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

    // Add detail context if provided (e.g., for modal details)
    if (detailContext && breadcrumbItems.length > 0) {
        // Make sure the last item is clickable (e.g., "Shipments" should be clickable)
        if (breadcrumbItems.length > 0 && !breadcrumbItems[breadcrumbItems.length - 1].isLink) {
            // Convert the last item to a clickable link
            const lastItem = breadcrumbItems[breadcrumbItems.length - 1];
            if (lastItem.label === 'Shipments') {
                breadcrumbItems[breadcrumbItems.length - 1] = {
                    ...lastItem,
                    isLink: true,
                    path: '/admin/shipments',
                    onClick: onNavigateBack // Use callback for modal navigation
                };
            }
        }

        // DON'T add the detail context as a visible breadcrumb item
        // We only use detailContext to make the previous item clickable
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
                        // If item has onClick callback, use it instead of navigation
                        if (item.onClick) {
                            return (
                                <MuiLink
                                    key={index}
                                    component="button"
                                    onClick={item.onClick}
                                    className="breadcrumb-link"
                                    underline="hover"
                                    color="inherit"
                                    sx={{
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        border: 'none',
                                        background: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
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
                        }
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