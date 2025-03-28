import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Badge, Box } from '@mui/material';
import {
    Notifications as NotificationsIcon,
    AccountCircle,
    Menu as MenuIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const AdminHeader = () => {
    const { currentUser } = useAuth();

    return (
        <AppBar position="fixed" className="admin-header">
            <Toolbar>
                <IconButton
                    edge="start"
                    color="inherit"
                    aria-label="menu"
                    className="menu-button"
                >
                    <MenuIcon />
                </IconButton>

                <Typography variant="h6" className="admin-title">
                    SolushipX Admin
                </Typography>

                <Box className="admin-header-right">
                    <IconButton color="inherit">
                        <Badge badgeContent={4} color="secondary">
                            <NotificationsIcon />
                        </Badge>
                    </IconButton>

                    <Box className="admin-user-info">
                        <Typography variant="body2">
                            {currentUser?.email}
                        </Typography>
                        <IconButton color="inherit">
                            <AccountCircle />
                        </IconButton>
                    </Box>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default AdminHeader; 