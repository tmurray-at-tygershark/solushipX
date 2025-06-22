import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';
import { ROLES, hasPermission, PERMISSIONS } from '../utils/rolePermissions';

export const AdminRoute = ({ children }) => {
    const { currentUser, userRole, loading, initialized } = useAuth();

    // Log only on mount and when auth state changes
    useEffect(() => {
        if (initialized && !loading) {
            console.log('=== AdminRoute Auth State ===');
            console.log('Current User:', currentUser?.email);
            console.log('User Role:', userRole);
            console.log('Has Admin Access:', hasPermission(userRole, PERMISSIONS.VIEW_ADMIN_DASHBOARD));
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

    // If authenticated but doesn't have admin access, redirect to dashboard
    if (!hasPermission(userRole, PERMISSIONS.VIEW_ADMIN_DASHBOARD)) {
        return <Navigate to="/dashboard" replace />;
    }

    // If authenticated and has admin access, show admin panel
    return children;
}; 