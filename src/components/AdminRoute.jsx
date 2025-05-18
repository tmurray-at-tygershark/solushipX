import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

const ADMIN_ROLES = ['super_admin', 'admin', 'business_admin'];

export const AdminRoute = ({ children }) => {
    const { currentUser, userRole, loading, initialized } = useAuth();

    // Log only on mount and when auth state changes
    useEffect(() => {
        if (initialized && !loading) {
            console.log('=== AdminRoute Auth State ===');
            console.log('Current User:', currentUser?.email);
            console.log('User Role:', userRole);
            console.log('Is Role Valid:', ADMIN_ROLES.includes(userRole));
            console.log('=====================');
        }
    }, [currentUser, userRole, loading, initialized]);

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

    // If authenticated but not an admin, redirect to dashboard
    if (!ADMIN_ROLES.includes(userRole)) {
        return <Navigate to="/dashboard" replace />;
    }

    // If authenticated and is admin, show admin panel
    return children;
}; 