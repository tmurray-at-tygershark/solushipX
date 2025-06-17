import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Chip,
    CircularProgress,
    Alert,
    Divider,
} from '@mui/material';
import {
    LocalShipping,
    Business,
    People,
    Receipt,
    TrendingUp,
    TrendingDown,
    Refresh as RefreshIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    AccessTime as AccessTimeIcon,
    FlightTakeoff as FreightIcon,
    CalendarToday,
    Timeline,
    Error as ErrorIcon,
    PendingActions,
    CompareArrows,
    AttachMoney,
    Speed as SpeedIcon,
} from '@mui/icons-material';
import { Line, Doughnut } from 'react-chartjs-2';
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
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ENHANCED_STATUSES, STATUS_GROUPS } from '../../../utils/enhancedStatusModel';
import { getStatusColor } from '../../../utils/universalDataModel';
import DateRangePickerWithQuickOptions from '../../common/DateRangePickerWithQuickOptions';
import './Dashboard.css';

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

const StatCard = ({ title, value, icon, trend, trendValue, color = '#3b82f6', alert = false }) => (
    <Card className="stat-card">
        <CardContent sx={{ padding: '20px', '&:last-child': { paddingBottom: '20px' } }}>
            <Box className="stat-card-header">
                <Box className="stat-icon" sx={{ color: color }}>
                    {icon}
                </Box>
                {alert && (
                    <WarningIcon sx={{ fontSize: 20, color: '#dc2626' }} />
                )}
            </Box>
            <Typography className="stat-title" component="div">
                {title}
            </Typography>
            <Typography className="stat-value" component="div">
                {value}
            </Typography>
            {trend && (
                <Box className="stat-trend">
                    {trend === 'up' ? (
                        <TrendingUp className="trend-up" sx={{ fontSize: 16 }} />
                    ) : (
                        <TrendingDown className="trend-down" sx={{ fontSize: 16 }} />
                    )}
                    <Typography className="stat-trend-text">
                        {trendValue} from yesterday
                    </Typography>
                </Box>
            )}
        </CardContent>
    </Card>
);

const ShipmentVolumeChart = ({ data, loading }) => {
    const chartData = {
        labels: data?.labels || [],
        datasets: [
            {
                label: 'Daily Shipments',
                data: data?.values || [],
                fill: true,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6,
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
                        size: 11
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
                        size: 11
                    }
                }
            }
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Shipment Volume Trend</h3>
                    <p className="chart-subtitle">Last 30 days</p>
                </div>
            </div>
            <div className="chart-container">
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress />
                    </Box>
                ) : (
                    <Line data={chartData} options={options} />
                )}
            </div>
        </div>
    );
};

const StatusDistributionChart = ({ data, loading }) => {
    const chartData = {
        labels: data?.labels || [],
        datasets: [{
            data: data?.values || [],
            backgroundColor: [
                '#16a34a', // Delivered - Green
                '#7c2d92', // In Transit - Purple  
                '#ea580c', // Awaiting Shipment - Orange
                '#2563eb', // Booked - Blue
                '#dc2626', // Exception - Red
                '#64748b'  // Others - Gray
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
                    font: {
                        size: 11
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value} (${percentage}%)`;
                    }
                }
            }
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Shipment Status Distribution</h3>
                    <p className="chart-subtitle">Current breakdown</p>
                </div>
            </div>
            <div className="chart-container">
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress />
                    </Box>
                ) : (
                    <Doughnut data={chartData} options={options} />
                )}
            </div>
        </div>
    );
};

const CarrierPerformanceTable = ({ data, loading }) => {
    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Carrier Performance</h3>
                    <p className="chart-subtitle">Last 30 days</p>
                </div>
            </div>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                Carrier
                            </TableCell>
                            <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                Shipments
                            </TableCell>
                            <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                On-Time Rate
                            </TableCell>
                            <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                Avg Transit
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            [...Array(5)].map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                                    <TableCell align="right"><Box sx={{ height: '16px', width: '40px', bgcolor: '#e5e7eb', borderRadius: '4px', ml: 'auto' }} /></TableCell>
                                    <TableCell align="right"><Box sx={{ height: '16px', width: '50px', bgcolor: '#e5e7eb', borderRadius: '4px', ml: 'auto' }} /></TableCell>
                                    <TableCell align="right"><Box sx={{ height: '16px', width: '60px', bgcolor: '#e5e7eb', borderRadius: '4px', ml: 'auto' }} /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            data?.map((carrier, index) => (
                                <TableRow key={index} hover>
                                    <TableCell sx={{ fontSize: '12px', color: '#374151' }}>
                                        {carrier.name}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        {carrier.shipments?.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={`${carrier.onTimeRate}%`}
                                            size="small"
                                            sx={{
                                                bgcolor: carrier.onTimeRate >= 95 ? '#dcfce7' : carrier.onTimeRate >= 85 ? '#fef3c7' : '#fee2e2',
                                                color: carrier.onTimeRate >= 95 ? '#16a34a' : carrier.onTimeRate >= 85 ? '#d97706' : '#dc2626',
                                                fontSize: '11px',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        {carrier.avgTransit} days
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
};

const RecentAlertsCard = ({ alerts, loading }) => {
    return (
        <div className="chart-card">
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">Recent Alerts</h3>
                    <p className="chart-subtitle">Issues requiring attention</p>
                </div>
            </div>
            <Box sx={{ mt: 2, maxHeight: '300px', overflowY: 'auto' }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                        <CircularProgress />
                    </Box>
                ) : alerts?.length > 0 ? (
                    alerts.map((alert, index) => (
                        <Alert
                            key={index}
                            severity={alert.severity}
                            sx={{
                                mb: 1,
                                fontSize: '12px',
                                '& .MuiAlert-message': { fontSize: '12px' }
                            }}
                        >
                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                {alert.title}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                {alert.description}
                            </Typography>
                        </Alert>
                    ))
                ) : (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="200px">
                        <CheckCircleIcon sx={{ fontSize: 48, color: '#16a34a', mb: 1 }} />
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            No active alerts
                        </Typography>
                    </Box>
                )}
            </Box>
        </div>
    );
};

const AdminDashboard = () => {
    const [dateRange, setDateRange] = useState([null, null]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Data states
    const [dashboardData, setDashboardData] = useState({
        stats: {},
        volumeChart: { labels: [], values: [] },
        statusChart: { labels: [], values: [] },
        carrierPerformance: [],
        alerts: []
    });

    // Calculate date ranges based on current selection or defaults
    const dateRanges = useMemo(() => {
        const now = dayjs();
        const today = now.startOf('day');
        const yesterday = now.subtract(1, 'day').startOf('day');

        // Use selected date range or default to last 30 days
        let startDate, endDate;
        if (dateRange && dateRange[0] && dateRange[1]) {
            startDate = dateRange[0].startOf('day');
            endDate = dateRange[1].endOf('day');
        } else {
            // Default to last 30 days
            startDate = now.subtract(30, 'day').startOf('day');
            endDate = now.endOf('day');
        }

        return {
            today: today.toDate(),
            yesterday: yesterday.toDate(),
            startDate: startDate.toDate(),
            endDate: endDate.toDate()
        };
    }, [dateRange]);

    // Fetch dashboard data
    const fetchDashboardData = useCallback(async (isAutoRefresh = false) => {
        try {
            // Don't show loading spinner for auto-refresh, only for initial load or manual refresh
            if (!isAutoRefresh) {
                setLoading(true);
            }

            const shipmentsRef = collection(db, 'shipments');
            const carriersRef = collection(db, 'carriers');
            const companiesRef = collection(db, 'companies');

            // Fetch shipments within the selected date range
            const shipmentsQuery = query(
                shipmentsRef,
                where('createdAt', '>=', dateRanges.startDate),
                where('createdAt', '<=', dateRanges.endDate),
                orderBy('createdAt', 'desc')
            );
            const shipmentsSnapshot = await getDocs(shipmentsQuery);
            const shipments = shipmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date()
            }));

            // Fetch carriers
            const carriersSnapshot = await getDocs(carriersRef);
            const carriers = carriersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Fetch companies
            const companiesSnapshot = await getDocs(companiesRef);
            const companies = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Process data
            const processedData = processShipmentData(shipments, carriers, companies, dateRanges);
            setDashboardData(processedData);
            setLastUpdated(new Date());

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [dateRanges]);

    // Set up automatic refresh every 5 minutes
    useEffect(() => {
        fetchDashboardData();

        // Set up interval for auto-refresh every 5 minutes (300000ms)
        const refreshInterval = setInterval(() => {
            fetchDashboardData(true); // Pass true to indicate this is an auto-refresh
        }, 300000);

        // Cleanup interval on unmount or dependency change
        return () => {
            clearInterval(refreshInterval);
        };
    }, [fetchDashboardData]);

    // Format last updated time
    const formatLastUpdated = (timestamp) => {
        if (!timestamp) return '';

        const now = dayjs();
        const updated = dayjs(timestamp);
        const diffMinutes = now.diff(updated, 'minute');

        if (diffMinutes < 1) {
            return 'Just updated';
        } else if (diffMinutes < 60) {
            return `Updated ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        } else {
            return `Updated at ${updated.format('h:mm A')}`;
        }
    };

    // Process shipment data into dashboard metrics
    const processShipmentData = (shipments, carriers, companies, ranges) => {
        const { today, yesterday } = ranges;

        // Today's shipments
        const todayShipments = shipments.filter(s =>
            s.createdAt >= today
        );
        const yesterdayShipments = shipments.filter(s =>
            s.createdAt >= yesterday && s.createdAt < today
        );

        // Status distribution
        const statusCounts = {};
        const statusGroups = ['COMPLETED', 'TRANSIT', 'PRE_SHIPMENT', 'BOOKING', 'EXCEPTIONS'];

        statusGroups.forEach(group => {
            statusCounts[group] = 0;
        });

        shipments.forEach(shipment => {
            const status = shipment.status?.toLowerCase();
            if (status === 'delivered') statusCounts.COMPLETED++;
            else if (status === 'in_transit' || status === 'picked_up') statusCounts.TRANSIT++;
            else if (status === 'awaiting_shipment' || status === 'ready') statusCounts.PRE_SHIPMENT++;
            else if (status === 'booked' || status === 'scheduled') statusCounts.BOOKING++;
            else if (status === 'exception' || status === 'on_hold' || status === 'delayed') statusCounts.EXCEPTIONS++;
            else statusCounts.PRE_SHIPMENT++;
        });

        // Volume chart data (daily for the selected range)
        const volumeData = generateVolumeChartData(shipments, ranges.startDate);

        // Carrier performance
        const carrierPerformance = calculateCarrierPerformance(shipments, carriers);

        // Generate alerts
        const alerts = generateAlerts(shipments, carrierPerformance);

        // Calculate statistics
        const activeShipments = shipments.filter(s =>
            ['booked', 'scheduled', 'awaiting_shipment', 'in_transit', 'picked_up'].includes(s.status?.toLowerCase())
        ).length;

        const deliveredToday = shipments.filter(s =>
            s.status?.toLowerCase() === 'delivered' && s.createdAt >= today
        ).length;

        const delayedShipments = shipments.filter(s =>
            ['delayed', 'on_hold'].includes(s.status?.toLowerCase())
        ).length;

        const cancelledShipments = shipments.filter(s =>
            ['cancelled', 'canceled', 'void', 'voided'].includes(s.status?.toLowerCase())
        ).length;

        return {
            stats: {
                totalShipments: shipments.length,
                todayShipments: todayShipments.length,
                yesterdayShipments: yesterdayShipments.length,
                activeShipments,
                deliveredToday,
                delayedShipments,
                totalCompanies: companies.filter(c => c.enabled !== false).length,
                activeCarriers: carriers.filter(c => c.enabled === true).length,
                cancelledShipments
            },
            volumeChart: volumeData,
            statusChart: {
                labels: ['Delivered', 'In Transit', 'Ready to Ship', 'Booked', 'Exceptions'],
                values: [
                    statusCounts.COMPLETED,
                    statusCounts.TRANSIT,
                    statusCounts.PRE_SHIPMENT,
                    statusCounts.BOOKING,
                    statusCounts.EXCEPTIONS
                ]
            },
            carrierPerformance,
            alerts
        };
    };

    // Generate volume chart data
    const generateVolumeChartData = (shipments, startDate) => {
        const labels = [];
        const values = [];
        const now = new Date();

        // Convert startDate to Date object if it's not already
        const start = startDate instanceof Date ? startDate : new Date(startDate);

        for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            labels.push(dateStr);

            const dayStart = new Date(d);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);

            const dayShipments = shipments.filter(s =>
                s.createdAt >= dayStart && s.createdAt <= dayEnd
            ).length;

            values.push(dayShipments);
        }

        return { labels, values };
    };

    // Calculate carrier performance
    const calculateCarrierPerformance = (shipments, carriers) => {
        const carrierStats = {};

        // Initialize stats for all carriers
        carriers.forEach(carrier => {
            if (carrier.enabled && carrier.name) {
                carrierStats[carrier.name] = {
                    name: carrier.name,
                    shipments: 0,
                    delivered: 0,
                    delayed: 0,
                    cancelled: 0,
                    transitTimes: []
                };
            }
        });

        // Process shipments to gather carrier statistics
        shipments.forEach(shipment => {
            // Try to get carrier name from various possible fields
            const carrierName = shipment.selectedRate?.carrier ||
                shipment.carrier ||
                shipment.carrierName ||
                shipment.selectedCarrier;

            if (carrierName && carrierStats[carrierName]) {
                const stats = carrierStats[carrierName];
                stats.shipments++;

                const status = shipment.status?.toLowerCase();

                // Count delivered shipments
                if (status === 'delivered') {
                    stats.delivered++;
                }

                // Count delayed shipments
                if (['delayed', 'on_hold'].includes(status)) {
                    stats.delayed++;
                }

                // Count cancelled shipments
                if (['cancelled', 'canceled', 'void', 'voided'].includes(status)) {
                    stats.cancelled++;
                }

                // Calculate transit time for delivered shipments
                if (status === 'delivered' && shipment.createdAt) {
                    const deliveredDate = shipment.deliveredAt?.toDate ?
                        shipment.deliveredAt.toDate() :
                        shipment.deliveredAt || new Date();
                    const createdDate = shipment.createdAt.toDate ?
                        shipment.createdAt.toDate() :
                        shipment.createdAt;

                    const transitDays = Math.ceil((deliveredDate - createdDate) / (1000 * 60 * 60 * 24));
                    if (transitDays > 0 && transitDays < 30) { // Reasonable transit time
                        stats.transitTimes.push(transitDays);
                    }
                }
            }
        });

        // Process and return carrier performance data
        return Object.values(carrierStats)
            .filter(carrier => carrier.shipments > 0) // Only show carriers with shipments
            .map(carrier => {
                // Calculate on-time rate (delivered + in-transit vs delayed + cancelled)
                const onTimeShipments = carrier.delivered + (carrier.shipments - carrier.delivered - carrier.delayed - carrier.cancelled);
                const onTimeRate = carrier.shipments > 0 ?
                    Math.round((onTimeShipments / carrier.shipments) * 100) : 0;

                // Calculate average transit time
                const avgTransit = carrier.transitTimes.length > 0 ?
                    Math.round(carrier.transitTimes.reduce((a, b) => a + b, 0) / carrier.transitTimes.length) : 0;

                return {
                    name: carrier.name,
                    shipments: carrier.shipments,
                    onTimeRate: Math.min(100, Math.max(0, onTimeRate)), // Ensure 0-100 range
                    avgTransit: avgTransit || 0
                };
            })
            .sort((a, b) => b.shipments - a.shipments) // Sort by shipment count
            .slice(0, 5); // Top 5 carriers
    };

    // Generate alerts
    const generateAlerts = (shipments, carrierPerformance) => {
        const alerts = [];

        // Check for carriers with low on-time rates
        carrierPerformance.forEach(carrier => {
            if (carrier.onTimeRate < 85 && carrier.shipments > 10) {
                alerts.push({
                    severity: 'warning',
                    title: `${carrier.name} Performance Issue`,
                    description: `On-time rate dropped to ${carrier.onTimeRate}% (${carrier.shipments} shipments)`
                });
            }
        });

        // Check for high delayed shipment rate
        const delayedCount = shipments.filter(s =>
            ['delayed', 'on_hold'].includes(s.status?.toLowerCase())
        ).length;

        if (shipments.length > 0 && (delayedCount / shipments.length) > 0.10) {
            alerts.push({
                severity: 'warning',
                title: 'High Delayed Shipment Rate',
                description: `${delayedCount} of ${shipments.length} shipments are currently delayed`
            });
        }

        // Check for cancelled shipments trend
        const cancelledCount = shipments.filter(s =>
            ['cancelled', 'canceled', 'void', 'voided'].includes(s.status?.toLowerCase())
        ).length;

        if (cancelledCount > 5) {
            alerts.push({
                severity: 'error',
                title: 'High Cancellation Count',
                description: `${cancelledCount} shipments have been cancelled`
            });
        }

        // Check for shipments without tracking
        const untracked = shipments.filter(s =>
            ['booked', 'scheduled', 'in_transit'].includes(s.status?.toLowerCase()) &&
            !s.trackingNumber && !s.confirmationNumber
        );

        if (untracked.length > 0) {
            alerts.push({
                severity: 'info',
                title: 'Untracked Shipments',
                description: `${untracked.length} active shipments missing tracking information`
            });
        }

        return alerts.slice(0, 5); // Limit to 5 alerts
    };

    const { stats } = dashboardData;

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <div className="dashboard-title-section">
                    <h1 className="dashboard-title">Dashboard</h1>
                    <div>
                        <p className="dashboard-subtitle">Real-time shipment analytics and performance metrics</p>
                        {lastUpdated && (
                            <Typography
                                variant="caption"
                                sx={{
                                    color: '#6b7280',
                                    fontSize: '11px',
                                    display: 'block',
                                    mt: 0.5
                                }}
                            >
                                {formatLastUpdated(lastUpdated)}
                            </Typography>
                        )}
                    </div>
                </div>
                <div className="dashboard-actions">
                    <DateRangePickerWithQuickOptions
                        value={dateRange}
                        onChange={setDateRange}
                        label="Select Date Range"
                        sx={{
                            width: 320,
                            '& .MuiInputBase-input': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </div>
            </div>

            <div className="dashboard-stats">
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Today's Shipments"
                            value={loading ? '-' : (stats.todayShipments || 0).toLocaleString()}
                            icon={<LocalShipping sx={{ fontSize: 24 }} />}
                            trend={stats.todayShipments > stats.yesterdayShipments ? 'up' : 'down'}
                            trendValue={`${Math.abs((stats.todayShipments || 0) - (stats.yesterdayShipments || 0))}`}
                            color="#3b82f6"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Active Shipments"
                            value={loading ? '-' : (stats.activeShipments || 0).toLocaleString()}
                            icon={<Timeline sx={{ fontSize: 24 }} />}
                            color="#7c2d92"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Delivered Today"
                            value={loading ? '-' : (stats.deliveredToday || 0).toLocaleString()}
                            icon={<CheckCircleIcon sx={{ fontSize: 24 }} />}
                            color="#16a34a"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Delayed Shipments"
                            value={loading ? '-' : (stats.delayedShipments || 0).toLocaleString()}
                            icon={<AccessTimeIcon sx={{ fontSize: 24 }} />}
                            color="#f59e0b"
                            alert={stats.delayedShipments > 10}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Active Companies"
                            value={loading ? '-' : (stats.totalCompanies || 0).toLocaleString()}
                            icon={<Business sx={{ fontSize: 24 }} />}
                            color="#ea580c"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Active Carriers"
                            value={loading ? '-' : (stats.activeCarriers || 0).toLocaleString()}
                            icon={<FreightIcon sx={{ fontSize: 24 }} />}
                            color="#7c3aed"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Cancelled Shipments"
                            value={loading ? '-' : (stats.cancelledShipments || 0).toLocaleString()}
                            icon={<ErrorIcon sx={{ fontSize: 24 }} />}
                            color="#dc2626"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="30-Day Volume"
                            value={loading ? '-' : (stats.totalShipments || 0).toLocaleString()}
                            icon={<CompareArrows sx={{ fontSize: 24 }} />}
                            color="#0891b2"
                        />
                    </Grid>
                </Grid>
            </div>

            <div className="dashboard-charts">
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <ShipmentVolumeChart data={dashboardData.volumeChart} loading={loading} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <StatusDistributionChart data={dashboardData.statusChart} loading={loading} />
                    </Grid>
                    <Grid item xs={12} md={8}>
                        <CarrierPerformanceTable data={dashboardData.carrierPerformance} loading={loading} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <RecentAlertsCard alerts={dashboardData.alerts} loading={loading} />
                    </Grid>
                </Grid>
            </div>
        </div>
    );
};

export default AdminDashboard; 