import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';
import { ROLES, hasPermission, PERMISSIONS, canAccessRoute } from '../utils/rolePermissions';

export const AdminRoute = ({ children }) => {
    const { currentUser, userRole, loading, initialized } = useAuth();
    const location = useLocation();

    // Log only on mount and when auth state changes
    useEffect(() => {
        if (initialized && !loading) {
            const currentPath = location.pathname;
            const hasAccess = canAccessRoute(userRole, currentPath);
            const hasBasicAdminAccess = hasPermission(userRole, PERMISSIONS.VIEW_ADMIN_DASHBOARD);

            console.log('=== AdminRoute Auth State ===');
            console.log('Current User:', currentUser?.email);
            console.log('User Role:', userRole);
            console.log('User Role Type:', typeof userRole);
            console.log('Current Path:', currentPath);
            console.log('PERMISSIONS.VIEW_ADMIN_DASHBOARD:', PERMISSIONS.VIEW_ADMIN_DASHBOARD);
            console.log('Has Basic Admin Access:', hasBasicAdminAccess);
            console.log('Has Route Access:', hasAccess);
            console.log('Will Redirect:', !hasBasicAdminAccess || !hasAccess);
            console.log('=====================');
        }
    }, [currentUser, userRole, loading, initialized, location.pathname]);

    // Show loading spinner while checking auth state
    if (loading || !initialized) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh'
            }}>
                <CircularProgress />
            </Box>
        );
    }

    // If not authenticated, redirect to login
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // BULLETPROOF: SUPERADMIN ALWAYS HAS ACCESS - NO EXCEPTIONS, NO PERMISSION CHECKS
    if (userRole === 'superadmin') {
        console.log('✅ SUPERADMIN: Full access granted - bypassing all permission checks');
        return children;
    }

    // For all other roles, do normal permission checks
    const currentPath = location.pathname;
    const hasRouteAccess = canAccessRoute(userRole, currentPath);
    const hasBasicAdminAccess = hasPermission(userRole, PERMISSIONS.VIEW_ADMIN_DASHBOARD);

    // TEMPORARY FIX: Always allow access to role-permissions route
    if (currentPath === '/admin/role-permissions') {
        if (!hasBasicAdminAccess) {
            console.warn(`🚫 Access denied to ${currentPath} for role ${userRole} - no basic admin access`);
            return <Navigate to="/dashboard" replace />;
        }
        // Allow access to role-permissions for anyone with basic admin access
        return children;
    }

    // If user doesn't have basic admin access or specific route access, redirect to dashboard
    if (!hasBasicAdminAccess || !hasRouteAccess) {
        console.warn(`🚫 Access denied to ${currentPath} for role ${userRole}`);
        return <Navigate to="/dashboard" replace />;
    }

    // If authenticated and has proper access, show admin panel
    return children;
}; 