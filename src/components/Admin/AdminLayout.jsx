import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import AdminHeader from './AdminHeader';
import './AdminLayout.css';

const AdminLayout = () => {
    return (
        <Box className="admin-layout">
            <AdminHeader />
            <Box className="admin-content">
                <Box className="admin-main-content">
                    <Suspense fallback={<div>Loading...</div>}>
                        <Outlet />
                    </Suspense>
                </Box>
            </Box>
        </Box>
    );
};

export default AdminLayout; 