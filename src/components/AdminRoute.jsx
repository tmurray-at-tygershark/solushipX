import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

const ADMIN_ROLES = ['super_admin', 'admin', 'business_admin'];

export const AdminRoute = ({ children }) => {
    const { currentUser, userRole, loading, initialized } = useAuth();

    // Enhanced debug logging
    console.log('=== AdminRoute Debug ===');
    console.log('Current User:', currentUser?.email);
    console.log('User Role:', userRole);
    console.log('Loading State:', loading);
    console.log('Initialized:', initialized);
    console.log('Admin Roles:', ADMIN_ROLES);
    console.log('Is Role Valid:', ADMIN_ROLES.includes(userRole));
    console.log('=====================');

    // Show loading spinner while checking auth state
    if (loading || !initialized) {
        console.log('AdminRoute - Loading state, showing spinner');
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
        console.log('AdminRoute - No user, redirecting to login');
        return <Navigate to="/login" replace />;
    }

    // If authenticated but not an admin, redirect to dashboard
    if (!ADMIN_ROLES.includes(userRole)) {
        console.log('AdminRoute - Not admin role, redirecting to dashboard');
        console.log('Current role:', userRole);
        console.log('Allowed roles:', ADMIN_ROLES);
        return <Navigate to="/dashboard" replace />;
    }

    // If authenticated and is admin, show admin panel
    console.log('AdminRoute - Access granted');
    return children;
}; 