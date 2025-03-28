import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Card,
    CardContent,
    IconButton,
} from '@mui/material';
import {
    LocalShipping,
    Business,
    People,
    Receipt,
    TrendingUp,
    TrendingDown,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { LineChart, PieChart } from '@mui/x-charts';
import AdminBreadcrumb from '../AdminBreadcrumb';
import './Dashboard.css';
import { Line } from 'react-chartjs-2';
import { DateRangePicker } from '@mui/x-date-pickers-pro';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    Legend
);

const StatCard = ({ title, value, icon }) => (
    <Card className="stat-card">
        <CardContent sx={{ padding: 0, '&:last-child': { paddingBottom: 0 } }}>
            <Box className="stat-card-header">
                <Box className="stat-icon">
                    {icon}
                </Box>
                <Box>
                    <Typography className="stat-title" component="div">
                        {title}
                    </Typography>
                </Box>
            </Box>
            <Typography className="stat-value" component="div">
                {value}
            </Typography>
            <Box className="stat-trend">
                <TrendingUp className="trend-up" sx={{ fontSize: 16 }} />
                <Typography className="stat-trend-text">
                    12.5% from last month
                </Typography>
            </Box>
        </CardContent>
    </Card>
);

const ShipmentVolumeChart = () => {
    const data = {
        labels: Array.from({ length: 31 }, (_, i) => `Mar ${i + 1}`),
        datasets: [
            {
                label: 'Total Shipments',
                data: Array.from({ length: 31 }, () => Math.floor(Math.random() * 80) + 20),
                fill: true,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#fff',
                titleColor: '#0f172a',
                bodyColor: '#64748b',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    title: (context) => context[0].label,
                    label: (context) => `${context.dataset.label}: ${context.parsed.y}`
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#64748b',
                    font: {
                        size: 12
                    }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: '#e2e8f0'
                },
                ticks: {
                    color: '#64748b',
                    font: {
                        size: 12
                    }
                }
            }
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Total Shipment Volume</h3>
                    <p className="chart-subtitle">Last 30 days</p>
                </div>
                <div className="chart-legend">
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#3b82f6' }} />
                        <span>Volume</span>
                    </div>
                </div>
            </div>
            <div className="chart-container">
                <Line data={data} options={options} />
            </div>
        </div>
    );
};

const RevenueChart = () => {
    const data = {
        labels: Array.from({ length: 31 }, (_, i) => `Mar ${i + 1}`),
        datasets: [
            {
                label: 'Revenue',
                data: Array.from({ length: 31 }, () => Math.floor(Math.random() * 5000) + 1000),
                fill: true,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#fff',
                titleColor: '#0f172a',
                bodyColor: '#64748b',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    title: (context) => context[0].label,
                    label: (context) => `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#64748b',
                    font: {
                        size: 12
                    }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: '#e2e8f0'
                },
                ticks: {
                    color: '#64748b',
                    font: {
                        size: 12
                    },
                    callback: (value) => `$${value.toLocaleString()}`
                }
            }
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Shipment Revenue</h3>
                    <p className="chart-subtitle">Last 30 days</p>
                </div>
                <div className="chart-legend">
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#22c55e' }} />
                        <span>Revenue</span>
                    </div>
                </div>
            </div>
            <div className="chart-container">
                <Line data={data} options={options} />
            </div>
        </div>
    );
};

const AdminDashboard = () => {
    // Mock data - replace with real data from Firebase
    const stats = {
        totalShipments: '1,234',
        activeCompanies: '56',
        totalUsers: '789',
        monthlyRevenue: '$45,678',
        shipmentTrend: 12.5,
        companyTrend: 5.2,
        userTrend: 8.7,
        revenueTrend: 15.3,
    };

    // Chart data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const shipmentVolume = [650, 590, 800, 810, 960, 1200];
    const revenue = [25000, 28000, 32000, 34000, 42000, 45000];

    const pieData = [
        { id: 0, value: 45, label: 'Ground', color: '#1976d2' },
        { id: 1, value: 25, label: 'Express', color: '#2e7d32' },
        { id: 2, value: 20, label: 'International', color: '#ed6c02' },
        { id: 3, value: 10, label: 'Freight', color: '#9c27b0' },
    ];

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Dashboard</h1>
                    <p className="dashboard-subtitle">Overview of your business</p>
                </div>
                <div className="dashboard-actions">
                    <DateRangePicker />
                    <IconButton>
                        <RefreshIcon />
                    </IconButton>
                </div>
            </div>

            <div className="dashboard-stats">
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Total Shipments"
                            value={stats.totalShipments}
                            icon={<LocalShipping sx={{ fontSize: 28 }} />}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Active Companies"
                            value={stats.activeCompanies}
                            icon={<Business sx={{ fontSize: 28 }} />}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Total Users"
                            value={stats.totalUsers}
                            icon={<People sx={{ fontSize: 28 }} />}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Monthly Revenue"
                            value={stats.monthlyRevenue}
                            icon={<Receipt sx={{ fontSize: 28 }} />}
                        />
                    </Grid>
                </Grid>
            </div>

            <div className="dashboard-charts">
                <ShipmentVolumeChart />
                <RevenueChart />
            </div>
        </div>
    );
};

export default AdminDashboard; 