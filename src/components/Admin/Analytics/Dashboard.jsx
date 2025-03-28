import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Card,
    CardContent,
} from '@mui/material';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import {
    LocalShipping as ShippingIcon,
    TrendingUp as TrendingUpIcon,
    AttachMoney as MoneyIcon,
    Speed as SpeedIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Analytics.css';

const COLORS = ['#1a237e', '#4caf50', '#ff9800', '#f44336', '#9c27b0'];

const AnalyticsDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('month');
    const [metrics, setMetrics] = useState({
        totalShipments: 0,
        totalRevenue: 0,
        averageDeliveryTime: 0,
        onTimeDeliveryRate: 0,
    });
    const [shipmentTrends, setShipmentTrends] = useState([]);
    const [revenueByCarrier, setRevenueByCarrier] = useState([]);
    const [shipmentStatus, setShipmentStatus] = useState([]);

    useEffect(() => {
        fetchAnalyticsData();
    }, [timeRange]);

    const fetchAnalyticsData = async () => {
        try {
            setLoading(true);
            const shipmentsRef = collection(db, 'shipments');
            const startDate = getStartDate(timeRange);

            // Fetch shipments within the selected time range
            const q = query(
                shipmentsRef,
                where('createdAt', '>=', startDate),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const shipments = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate metrics
            const totalShipments = shipments.length;
            const totalRevenue = shipments.reduce((sum, shipment) =>
                sum + (shipment.rate?.amount || 0), 0);

            // Calculate average delivery time
            const deliveredShipments = shipments.filter(s =>
                s.status === 'delivered' && s.deliveredDate && s.createdAt);
            const avgDeliveryTime = deliveredShipments.length > 0
                ? deliveredShipments.reduce((sum, shipment) => {
                    const deliveryTime = shipment.deliveredDate.toDate() - shipment.createdAt.toDate();
                    return sum + deliveryTime;
                }, 0) / deliveredShipments.length / (1000 * 60 * 60 * 24) // Convert to days
                : 0;

            // Calculate on-time delivery rate
            const onTimeDeliveries = deliveredShipments.filter(s => {
                const deliveryTime = s.deliveredDate.toDate() - s.createdAt.toDate();
                return deliveryTime <= (s.estimatedDeliveryTime || 5) * 24 * 60 * 60 * 1000;
            }).length;
            const onTimeRate = deliveredShipments.length > 0
                ? (onTimeDeliveries / deliveredShipments.length) * 100
                : 0;

            setMetrics({
                totalShipments,
                totalRevenue,
                averageDeliveryTime: avgDeliveryTime.toFixed(1),
                onTimeDeliveryRate: onTimeRate.toFixed(1),
            });

            // Prepare shipment trends data
            const trends = prepareShipmentTrends(shipments);
            setShipmentTrends(trends);

            // Prepare revenue by carrier data
            const carrierRevenue = prepareCarrierRevenue(shipments);
            setRevenueByCarrier(carrierRevenue);

            // Prepare shipment status data
            const statusData = prepareShipmentStatus(shipments);
            setShipmentStatus(statusData);

        } catch (err) {
            setError('Error fetching analytics data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStartDate = (range) => {
        const now = new Date();
        switch (range) {
            case 'week':
                return new Date(now.setDate(now.getDate() - 7));
            case 'month':
                return new Date(now.setMonth(now.getMonth() - 1));
            case 'year':
                return new Date(now.setFullYear(now.getFullYear() - 1));
            default:
                return new Date(now.setDate(now.getDate() - 7));
        }
    };

    const prepareShipmentTrends = (shipments) => {
        const trends = {};
        shipments.forEach(shipment => {
            const date = shipment.createdAt.toDate().toLocaleDateString();
            trends[date] = (trends[date] || 0) + 1;
        });

        return Object.entries(trends).map(([date, count]) => ({
            date,
            shipments: count
        }));
    };

    const prepareCarrierRevenue = (shipments) => {
        const revenue = {};
        shipments.forEach(shipment => {
            const carrier = shipment.carrier || 'Unknown';
            revenue[carrier] = (revenue[carrier] || 0) + (shipment.rate?.amount || 0);
        });

        return Object.entries(revenue).map(([carrier, amount]) => ({
            carrier,
            revenue: amount
        }));
    };

    const prepareShipmentStatus = (shipments) => {
        const status = {};
        shipments.forEach(shipment => {
            status[shipment.status] = (status[shipment.status] || 0) + 1;
        });

        return Object.entries(status).map(([status, count]) => ({
            status,
            count
        }));
    };

    if (loading) {
        return (
            <Box className="analytics-loading">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box className="analytics-error">
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    return (
        <Box className="analytics-container">
            <Box className="analytics-header">
                <Typography variant="h4" className="analytics-title">
                    Analytics Dashboard
                </Typography>
                <FormControl className="analytics-time-range">
                    <InputLabel>Time Range</InputLabel>
                    <Select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        label="Time Range"
                    >
                        <MenuItem value="week">Last 7 Days</MenuItem>
                        <MenuItem value="month">Last 30 Days</MenuItem>
                        <MenuItem value="year">Last Year</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {/* Key Metrics */}
            <Grid container spacing={3} className="analytics-metrics">
                <Grid item xs={12} sm={6} md={3}>
                    <Card className="metric-card">
                        <CardContent>
                            <Box className="metric-icon">
                                <ShippingIcon />
                            </Box>
                            <Typography variant="h6" className="metric-value">
                                {metrics.totalShipments}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Total Shipments
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card className="metric-card">
                        <CardContent>
                            <Box className="metric-icon">
                                <MoneyIcon />
                            </Box>
                            <Typography variant="h6" className="metric-value">
                                ${metrics.totalRevenue.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Total Revenue
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card className="metric-card">
                        <CardContent>
                            <Box className="metric-icon">
                                <SpeedIcon />
                            </Box>
                            <Typography variant="h6" className="metric-value">
                                {metrics.averageDeliveryTime} days
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Avg. Delivery Time
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card className="metric-card">
                        <CardContent>
                            <Box className="metric-icon">
                                <TrendingUpIcon />
                            </Box>
                            <Typography variant="h6" className="metric-value">
                                {metrics.onTimeDeliveryRate}%
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                On-Time Delivery Rate
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={3} className="analytics-charts">
                <Grid item xs={12} md={8}>
                    <Paper className="chart-paper">
                        <Typography variant="h6" gutterBottom>
                            Shipment Trends
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={shipmentTrends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="shipments"
                                    stroke="#1a237e"
                                    name="Shipments"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper className="chart-paper">
                        <Typography variant="h6" gutterBottom>
                            Revenue by Carrier
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={revenueByCarrier}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="carrier" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    dataKey="revenue"
                                    fill="#1a237e"
                                    name="Revenue"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12}>
                    <Paper className="chart-paper">
                        <Typography variant="h6" gutterBottom>
                            Shipment Status Distribution
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={shipmentStatus}
                                    dataKey="count"
                                    nameKey="status"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label
                                >
                                    {shipmentStatus.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AnalyticsDashboard; 