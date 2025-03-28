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
    Button,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    Receipt as ReceiptIcon,
    Payment as PaymentIcon,
    TrendingUp as TrendingUpIcon,
    Download as DownloadIcon,
    Visibility as ViewIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';

const BillingDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('month');
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        outstandingBalance: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
    });
    const [revenueTrends, setRevenueTrends] = useState([]);
    const [revenueByCompany, setRevenueByCompany] = useState([]);
    const [recentInvoices, setRecentInvoices] = useState([]);

    useEffect(() => {
        fetchBillingData();
    }, [timeRange]);

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            const invoicesRef = collection(db, 'invoices');
            const startDate = getStartDate(timeRange);

            // Fetch invoices within the selected time range
            const q = query(
                invoicesRef,
                where('createdAt', '>=', startDate),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const invoices = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate metrics
            const totalRevenue = invoices.reduce((sum, invoice) =>
                sum + (invoice.status === 'paid' ? invoice.total : 0), 0);

            const outstandingBalance = invoices.reduce((sum, invoice) =>
                sum + (invoice.status === 'pending' ? invoice.total : 0), 0);

            const paidInvoices = invoices.filter(invoice => invoice.status === 'paid').length;
            const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending').length;

            setMetrics({
                totalRevenue,
                outstandingBalance,
                paidInvoices,
                pendingInvoices,
            });

            // Prepare revenue trends data
            const trends = prepareRevenueTrends(invoices);
            setRevenueTrends(trends);

            // Prepare revenue by company data
            const companyRevenue = prepareCompanyRevenue(invoices);
            setRevenueByCompany(companyRevenue);

            // Set recent invoices
            setRecentInvoices(invoices.slice(0, 5));

        } catch (err) {
            setError('Error fetching billing data: ' + err.message);
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

    const prepareRevenueTrends = (invoices) => {
        const trends = {};
        invoices.forEach(invoice => {
            const date = invoice.createdAt.toDate().toLocaleDateString();
            trends[date] = (trends[date] || 0) + (invoice.status === 'paid' ? invoice.total : 0);
        });

        return Object.entries(trends).map(([date, amount]) => ({
            date,
            revenue: amount
        }));
    };

    const prepareCompanyRevenue = (invoices) => {
        const revenue = {};
        invoices.forEach(invoice => {
            if (invoice.status === 'paid') {
                revenue[invoice.companyName] = (revenue[invoice.companyName] || 0) + invoice.total;
            }
        });

        return Object.entries(revenue).map(([company, amount]) => ({
            company,
            revenue: amount
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'paid':
                return 'success';
            case 'pending':
                return 'warning';
            case 'overdue':
                return 'error';
            default:
                return 'default';
        }
    };

    const handleExport = () => {
        // Implement export functionality
        console.log('Exporting billing data...');
    };

    if (loading) {
        return (
            <Box className="billing-loading">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box className="billing-error">
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    return (
        <Box className="billing-container">
            <Box className="billing-header">
                <Typography variant="h4" className="billing-title">
                    Billing Dashboard
                </Typography>
                <Box className="billing-actions">
                    <FormControl className="billing-time-range">
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
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleExport}
                    >
                        Export
                    </Button>
                </Box>
            </Box>

            {/* Key Metrics */}
            <Grid container spacing={3} className="billing-metrics">
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
                                <ReceiptIcon />
                            </Box>
                            <Typography variant="h6" className="metric-value">
                                ${metrics.outstandingBalance.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Outstanding Balance
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card className="metric-card">
                        <CardContent>
                            <Box className="metric-icon">
                                <PaymentIcon />
                            </Box>
                            <Typography variant="h6" className="metric-value">
                                {metrics.paidInvoices}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Paid Invoices
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
                                {metrics.pendingInvoices}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Pending Invoices
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={3} className="billing-charts">
                <Grid item xs={12} md={8}>
                    <Paper className="chart-paper">
                        <Typography variant="h6" gutterBottom>
                            Revenue Trends
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={revenueTrends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <ChartTooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#1a237e"
                                    name="Revenue"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper className="chart-paper">
                        <Typography variant="h6" gutterBottom>
                            Revenue by Company
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={revenueByCompany}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="company" />
                                <YAxis />
                                <ChartTooltip />
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
            </Grid>

            {/* Recent Invoices */}
            <Paper className="recent-invoices-paper">
                <Box className="recent-invoices-header">
                    <Typography variant="h6">
                        Recent Invoices
                    </Typography>
                    <Button
                        variant="text"
                        color="primary"
                        onClick={() => {/* Navigate to invoices list */ }}
                    >
                        View All
                    </Button>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Invoice #</TableCell>
                                <TableCell>Company</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell>Amount</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {recentInvoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell>{invoice.invoiceNumber}</TableCell>
                                    <TableCell>{invoice.companyName}</TableCell>
                                    <TableCell>
                                        {invoice.createdAt.toDate().toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>${invoice.total.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={invoice.status}
                                            color={getStatusColor(invoice.status)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title="View Details">
                                            <IconButton
                                                color="primary"
                                                onClick={() => {/* Open invoice details */ }}
                                            >
                                                <ViewIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit Invoice">
                                            <IconButton
                                                color="primary"
                                                onClick={() => {/* Open edit form */ }}
                                            >
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default BillingDashboard; 