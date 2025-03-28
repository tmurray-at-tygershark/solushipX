import React from 'react';
import { Link } from 'react-router-dom';
import {
    Box,
    Typography,
    Breadcrumbs,
    Link as MuiLink
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import './AdminBreadcrumb.css';

const AdminBreadcrumb = ({ items }) => {
    return (
        <Box className="admin-breadcrumb">
            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                aria-label="breadcrumb"
            >
                <MuiLink
                    component={Link}
                    to="/admin"
                    className="breadcrumb-link"
                    underline="hover"
                    color="inherit"
                >
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                    Admin
                </MuiLink>
                {items.map((item, index) => (
                    <Typography
                        key={index}
                        color={index === items.length - 1 ? 'text.primary' : 'inherit'}
                        className="breadcrumb-item"
                    >
                        {item}
                    </Typography>
                ))}
            </Breadcrumbs>
        </Box>
    );
};

export default AdminBreadcrumb; 