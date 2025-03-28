import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box, Typography, CircularProgress } from '@mui/material';

const Logout = () => {
    const { logout, currentUser, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const performLogout = async () => {
            try {
                console.log('Logging out...');
                await logout();
                console.log('Logout successful, waiting for auth state to clear');

                // Wait for a short delay to ensure auth state is cleared
                await new Promise(resolve => setTimeout(resolve, 500));

                // Double check that user is actually logged out
                if (!currentUser) {
                    console.log('Auth state cleared, redirecting to login');
                    navigate('/login', { replace: true });
                } else {
                    console.log('User still logged in, retrying logout');
                    await logout();
                }
            } catch (error) {
                console.error('Error logging out:', error);
                // If there's an error, still try to navigate to login
                navigate('/login', { replace: true });
            }
        };

        performLogout();
    }, [logout, navigate, currentUser]);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            gap: 2
        }}>
            <CircularProgress />
            <Typography variant="h6">Logging out...</Typography>
            <Typography variant="body2" color="text.secondary">
                You will be redirected to the login page shortly.
            </Typography>
        </Box>
    );
};

export default Logout; 