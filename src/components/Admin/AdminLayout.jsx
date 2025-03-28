import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import AdminSidebar from './AdminSidebar';
import './AdminLayout.css';
import { Suspense } from 'react';

const AdminLayout = () => {
    return (
        <Box className="admin-layout">
            <Box className="admin-container">
                <Box className="admin-sidebar">
                    <AdminSidebar />
                </Box>
                <Box className="admin-content">
                    <Box className="admin-main-content">
                        <Suspense fallback={<div>Loading...</div>}>
                            <Outlet />
                        </Suspense>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default AdminLayout; 