import React, { useState } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Card,
    CardContent,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    TextField,
    InputAdornment,
} from '@mui/material';
import {
    LocalShipping,
    Business,
    People,
    Receipt,
    TrendingUp,
    TrendingDown,
    Refresh as RefreshIcon,
    LocalShipping as CourierIcon,
    Public,
    Person,
    Timeline,
    Schedule,
    PendingActions,
    FlightTakeoff as FreightIcon,
    CalendarToday,
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts';
import AdminBreadcrumb from '../AdminBreadcrumb';
import './Dashboard.css';
import { Line, Pie } from 'react-chartjs-2';
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
    Legend,
    ArcElement
} from 'chart.js';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    Legend,
    ArcElement
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

const CarrierPieChart = () => {
    const data = {
        labels: ['FedEx', 'UPS', 'DHL', 'USPS', 'Others'],
        datasets: [{
            data: [35, 25, 20, 15, 5],
            backgroundColor: [
                '#3b82f6',
                '#22c55e',
                '#f59e0b',
                '#ef4444',
                '#64748b'
            ],
            borderWidth: 0,
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                }
            }
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Shipments by Carrier</h3>
                    <p className="chart-subtitle">Distribution across carriers</p>
                </div>
            </div>
            <div className="chart-container">
                <Pie data={data} options={options} />
            </div>
        </div>
    );
};

const RevenueByCarrierChart = () => {
    const data = {
        labels: ['FedEx', 'UPS', 'DHL', 'USPS', 'Others'],
        datasets: [{
            data: [45000, 35000, 28000, 22000, 8000],
            backgroundColor: [
                '#3b82f6',
                '#22c55e',
                '#f59e0b',
                '#ef4444',
                '#64748b'
            ],
            borderWidth: 0,
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                }
            }
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Revenue by Carrier</h3>
                    <p className="chart-subtitle">Monthly revenue distribution</p>
                </div>
            </div>
            <div className="chart-container">
                <Pie data={data} options={options} />
            </div>
        </div>
    );
};

const TopCustomersTable = () => {
    const customers = [
        { name: 'Acme Corp', shipments: 245, revenue: '$45,678' },
        { name: 'Tech Solutions', shipments: 198, revenue: '$38,456' },
        { name: 'Global Industries', shipments: 167, revenue: '$32,789' },
        { name: 'Retail Plus', shipments: 145, revenue: '$28,901' },
        { name: 'Manufacturing Co', shipments: 132, revenue: '$25,432' },
    ];

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Top 5 Customers</h3>
                    <p className="chart-subtitle">By shipment volume</p>
                </div>
            </div>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Company</TableCell>
                            <TableCell align="right">Shipments</TableCell>
                            <TableCell align="right">Revenue</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {customers.map((customer, index) => (
                            <TableRow key={index}>
                                <TableCell>{customer.name}</TableCell>
                                <TableCell align="right">{customer.shipments}</TableCell>
                                <TableCell align="right">{customer.revenue}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
};

const AdminDashboard = () => {
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

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
        courierShipments: '856',
        freightShipments: '378',
        usShipments: '892',
        canadaShipments: '342',
        activeShipments: '245',
        inTransitShipments: '189',
        awaitingShipments: '156',
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
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div className="admin-dashboard">
                <div className="dashboard-header">
                    <div className="dashboard-title-section">
                        <h1 className="dashboard-title">Dashboard</h1>
                        <p className="dashboard-subtitle">Overview of your business</p>
                    </div>
                    <div className="dashboard-actions">
                        <div className="date-range-picker">
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{
                                    textField: {
                                        variant: "outlined",
                                        size: "medium",
                                        InputProps: {
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton>
                                                        <CalendarToday />
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                    },
                                }}
                            />
                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                slotProps={{
                                    textField: {
                                        variant: "outlined",
                                        size: "medium",
                                        InputProps: {
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton>
                                                        <CalendarToday />
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                    },
                                }}
                            />
                        </div>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<RefreshIcon />}
                            size="medium"
                        >
                            Refresh
                        </Button>
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
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="Courier Shipments"
                                value={stats.courierShipments}
                                icon={<CourierIcon sx={{ fontSize: 28 }} />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="Freight Shipments"
                                value={stats.freightShipments}
                                icon={<FreightIcon sx={{ fontSize: 28 }} />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="US Shipments"
                                value={stats.usShipments}
                                icon={<Public sx={{ fontSize: 28 }} />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="Canada Shipments"
                                value={stats.canadaShipments}
                                icon={<Public sx={{ fontSize: 28 }} />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="Active Shipments"
                                value={stats.activeShipments}
                                icon={<Timeline sx={{ fontSize: 28 }} />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="In-Transit"
                                value={stats.inTransitShipments}
                                icon={<LocalShipping sx={{ fontSize: 28 }} />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="Awaiting Shipping"
                                value={stats.awaitingShipments}
                                icon={<PendingActions sx={{ fontSize: 28 }} />}
                            />
                        </Grid>
                    </Grid>
                </div>

                <div className="dashboard-charts">
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <ShipmentVolumeChart />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RevenueChart />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <CarrierPieChart />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <RevenueByCarrierChart />
                        </Grid>
                        <Grid item xs={12}>
                            <TopCustomersTable />
                        </Grid>
                    </Grid>
                </div>
            </div>
        </LocalizationProvider>
    );
};

export default AdminDashboard; 