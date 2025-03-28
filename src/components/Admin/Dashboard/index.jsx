import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Card,
    CardContent,
    LinearProgress,
} from '@mui/material';
import {
    LocalShipping,
    Business,
    People,
    Receipt,
    TrendingUp,
} from '@mui/icons-material';
import './Dashboard.css';

const StatCard = ({ title, value, icon, color, trend }) => (
    <Card className="admin-stat-card">
        <CardContent>
            <Box className="stat-card-header">
                <Box className="stat-icon" style={{ backgroundColor: color }}>
                    {icon}
                </Box>
                <Typography variant="h6" component="div">
                    {title}
                </Typography>
            </Box>
            <Typography variant="h4" component="div" className="stat-value">
                {value}
            </Typography>
            <Box className="stat-trend">
                <TrendingUp className={trend >= 0 ? 'trend-up' : 'trend-down'} />
                <Typography variant="body2" color="text.secondary">
                    {Math.abs(trend)}% from last month
                </Typography>
            </Box>
        </CardContent>
    </Card>
);

const AdminDashboard = () => {
    // Mock data - replace with real data from Firebase
    const stats = {
        totalShipments: 1234,
        activeCompanies: 56,
        totalUsers: 789,
        monthlyRevenue: 45678,
        shipmentTrend: 12.5,
        companyTrend: 5.2,
        userTrend: 8.7,
        revenueTrend: 15.3,
    };

    return (
        <Box className="admin-dashboard">
            <Typography variant="h4" className="dashboard-title">
                Admin Dashboard
            </Typography>

            <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Shipments"
                        value={stats.totalShipments}
                        icon={<LocalShipping />}
                        color="#1976d2"
                        trend={stats.shipmentTrend}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Active Companies"
                        value={stats.activeCompanies}
                        icon={<Business />}
                        color="#2e7d32"
                        trend={stats.companyTrend}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Users"
                        value={stats.totalUsers}
                        icon={<People />}
                        color="#ed6c02"
                        trend={stats.userTrend}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Monthly Revenue"
                        value={`$${stats.monthlyRevenue.toLocaleString()}`}
                        icon={<Receipt />}
                        color="#9c27b0"
                        trend={stats.revenueTrend}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={3} className="dashboard-charts">
                <Grid item xs={12} md={8}>
                    <Paper className="chart-container">
                        <Typography variant="h6" className="chart-title">
                            Shipment Volume Trend
                        </Typography>
                        {/* Add chart component here */}
                        <Box className="chart-placeholder">
                            Chart will be implemented here
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper className="chart-container">
                        <Typography variant="h6" className="chart-title">
                            Revenue Distribution
                        </Typography>
                        {/* Add chart component here */}
                        <Box className="chart-placeholder">
                            Chart will be implemented here
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AdminDashboard; 