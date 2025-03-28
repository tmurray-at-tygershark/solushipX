import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

export const ProtectedRoute = ({ children }) => {
    const { currentUser, loading, initialized } = useAuth();

    // Enhanced debug logging
    console.log('=== ProtectedRoute Debug ===');
    console.log('Current User:', currentUser?.email);
    console.log('Loading State:', loading);
    console.log('Initialized:', initialized);
    console.log('=====================');

    // Show loading spinner while checking auth state
    if (loading || !initialized) {
        console.log('ProtectedRoute - Loading state, showing spinner');
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
        console.log('ProtectedRoute - No user, redirecting to login');
        return <Navigate to="/login" replace />;
    }

    // If authenticated, show protected content
    console.log('ProtectedRoute - Access granted');
    return children;
}; 