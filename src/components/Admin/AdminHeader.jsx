import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    IconButton,
    Button,
    Menu,
    MenuItem,
    Stack,
    TextField,
    InputAdornment,
    Tooltip,
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    GetApp as ExportIcon,
    Add as AddIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AdminBreadcrumb from './AdminBreadcrumb';
import './AdminHeader.css';

const AdminHeader = ({ title, subtitle, onAdd, onExport, onRefresh }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        // Add logout logic here
        navigate('/login');
    };

    return (
        <Box className="admin-header">
            <AdminBreadcrumb items={[title]} />

            <Paper className="header-paper">
                <Box className="header-content">
                    <Box className="header-left">
                        <Typography variant="h4" className="header-title">
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography variant="subtitle1" className="header-subtitle">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>

                    <Box className="header-right">
                        <Stack direction="row" spacing={2} alignItems="center">
                            <TextField
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                size="small"
                                className="search-input"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon />
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Tooltip title="Filter">
                                <IconButton className="filter-button">
                                    <FilterListIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Export">
                                <IconButton className="filter-button" onClick={onExport}>
                                    <ExportIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Refresh">
                                <IconButton className="filter-button" onClick={onRefresh}>
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>

                            {onAdd && (
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={onAdd}
                                    className="add-button"
                                >
                                    Add New
                                </Button>
                            )}

                            <IconButton
                                onClick={handleMenuClick}
                                className="menu-button"
                            >
                                <MoreVertIcon />
                            </IconButton>

                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={handleMenuClose}
                                className="action-menu"
                            >
                                <MenuItem onClick={() => { handleMenuClose(); navigate('/admin/profile'); }}>
                                    <PersonIcon fontSize="small" className="menu-icon" />
                                    Profile
                                </MenuItem>
                                <MenuItem onClick={() => { handleMenuClose(); navigate('/admin/settings'); }}>
                                    <SettingsIcon fontSize="small" className="menu-icon" />
                                    Settings
                                </MenuItem>
                                <MenuItem onClick={handleLogout}>
                                    <LogoutIcon fontSize="small" className="menu-icon" />
                                    Logout
                                </MenuItem>
                            </Menu>
                        </Stack>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default AdminHeader; 