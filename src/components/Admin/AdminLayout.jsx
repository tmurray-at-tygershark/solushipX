import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Container, Grid } from '@mui/material';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import './AdminLayout.css';

const AdminLayout = () => {
    return (
        <Box className="admin-layout">
            <AdminHeader />
            <Grid container className="admin-container">
                <Grid item xs={12} md={3} lg={2} className="admin-sidebar">
                    <AdminSidebar />
                </Grid>
                <Grid item xs={12} md={9} lg={10} className="admin-content">
                    <Container maxWidth="xl" className="admin-main-content">
                        <Outlet />
                    </Container>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AdminLayout; 