import React from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Navigation from './Navigation/Header';

const AppLayout = ({ children }) => {
    const location = useLocation();

    // Define routes where the main header should NOT be shown
    const immersiveRoutes = [
        '/dashboard',
        '/shipments',
        '/create-shipment',
        '/tracking',
        '/customers',
        '/reports',
        '/billing',
        '/profile',
        '/carriers',
        '/notifications',
        '/set-password'
    ];

    // Check if the current route or any of its sub-paths match the immersive routes
    const isImmersiveRoute = immersiveRoutes.some(route => location.pathname.startsWith(route));

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {!isImmersiveRoute && <Navigation />}
            <Box component="main" sx={{ flexGrow: 1 }}>
                {children}
            </Box>
        </Box>
    );
};

export default AppLayout; 