import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Button,
    Menu,
    MenuItem,
    Grid,
    ListItemIcon,
    CircularProgress
} from '@mui/material';
import {
    MoreVert as MoreVertIcon,
    Add as AddIcon,
    LocalShipping as ShippingIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    Refresh as RefreshIcon,
    CalendarToday as CalendarIcon,
    LocalShipping as LocalShipping,
    ArrowForward as ArrowForwardIcon,
    Visibility as VisibilityIcon,
    Print as PrintIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart } from '@mui/x-charts/LineChart';
import './Dashboard.css';
import dayjs from 'dayjs';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';

// Helper function to format Firestore timestamp
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
};

// Helper function to format address
const formatAddress = (addressObj) => {
    if (!addressObj) return '';
    const parts = [
        addressObj.street,
        addressObj.street2,
        addressObj.city,
        addressObj.state,
        addressObj.postalCode,
        addressObj.country
    ].filter(Boolean);
    return parts.join(', ');
};

// Extract StatusBox component for reusability
const StatusBox = React.memo(({ title, count, icon: Icon, color, bgColor }) => (
    <Paper sx={{
        p: 3,
        bgcolor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
        borderRadius: 2,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
        }
    }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
                <Typography variant="subtitle1" sx={{ color: '#64748b', mb: 1, fontWeight: 500 }}>
                    {title}
                </Typography>
                <Typography variant="h4" sx={{ color, fontWeight: 600 }}>
                    {count}
                </Typography>
            </Box>
            <Box sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                bgcolor: bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon sx={{ color, fontSize: 24 }} />
            </Box>
        </Box>
    </Paper>
));

// Extract StatusChip component for reusability
const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
            case 'created':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Pending'
                };
            case 'booked':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Booked'
                };
            case 'awaiting pickup':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Awaiting Pickup'
                };
            case 'awaiting shipment':
                return {
                    color: '#3B82F6',
                    bgcolor: '#EFF6FF',
                    label: 'Awaiting Shipment'
                };
            case 'in transit':
                return {
                    color: '#6366F1',
                    bgcolor: '#EEF2FF',
                    label: 'In Transit'
                };
            case 'on hold':
                return {
                    color: '#7C3AED',
                    bgcolor: '#F5F3FF',
                    label: 'On Hold'
                };
            case 'delivered':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Delivered'
                };
            case 'cancelled':
                return {
                    color: '#EF4444',
                    bgcolor: '#FEE2E2',
                    label: 'Cancelled'
                };
            default:
                return {
                    color: '#6B7280',
                    bgcolor: '#F3F4F6',
                    label: status || 'Unknown'
                };
        }
    };

    const { color, bgcolor, label } = getStatusConfig(status);

    return (
        <Chip
            label={label}
            sx={{
                color: color,
                bgcolor: bgcolor,
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: '24px',
                '& .MuiChip-label': {
                    px: 2
                }
            }}
            size="small"
        />
    );
});

// Extract ShipmentRow component for reusability
const ShipmentRow = React.memo(({ shipment, onPrint }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const navigate = useNavigate();

    const handleMenuClick = (e) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handlePrint = () => {
        onPrint(shipment.id);
        handleMenuClose();
    };

    const handleRowClick = () => {
        // Use shipmentId (the display ID) for navigation, not the Firestore document ID
        const shipmentIdForRoute = shipment.shipmentId;
        console.log('Navigating to shipment detail:', shipmentIdForRoute);
        navigate(`/shipment/${shipmentIdForRoute}`);
    };

    return (
        <TableRow
            hover
            onClick={handleRowClick}
            sx={{
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
            }}
        >
            <TableCell
                align="top"
                onClick={(e) => e.stopPropagation()}
                sx={{ verticalAlign: 'top', paddingTop: '16px' }}
            >
                <Link
                    to={`/shipment/${shipment.shipmentId}`}
                    style={{ textDecoration: 'none', color: '#3b82f6' }}
                >
                    {shipment.shipmentId}
                </Link>
            </TableCell>
            <TableCell align="top" sx={{ verticalAlign: 'top', paddingTop: '16px' }}>{shipment.customer}</TableCell>
            <TableCell align="top" sx={{ verticalAlign: 'top', paddingTop: '16px' }}>{shipment.origin}</TableCell>
            <TableCell align="top" sx={{ verticalAlign: 'top', paddingTop: '16px' }}>{shipment.destination}</TableCell>
            <TableCell align="top" sx={{ verticalAlign: 'top', paddingTop: '16px' }}>{shipment.carrier}</TableCell>
            <TableCell align="top" sx={{ verticalAlign: 'top', paddingTop: '16px' }}>{shipment.shipmentType}</TableCell>
            <TableCell align="top" sx={{ verticalAlign: 'top', paddingTop: '16px' }}>
                <StatusChip status={shipment.status} />
            </TableCell>
            <TableCell align="top" sx={{ verticalAlign: 'top', paddingTop: '16px' }}>
                <IconButton
                    size="small"
                    onClick={handleMenuClick}
                >
                    <MoreVertIcon />
                </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                >
                    <MenuItem onClick={handlePrint}>
                        <ListItemIcon>
                            <PrintIcon fontSize="small" />
                        </ListItemIcon>
                        Print Label
                    </MenuItem>
                </Menu>
            </TableCell>
        </TableRow>
    );
});

const Dashboard = () => {
    const [selectedTab, setSelectedTab] = useState('all');
    const [startDate, setStartDate] = useState(dayjs());
    const [endDate, setEndDate] = useState(dayjs());
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState({});
    const navigate = useNavigate();
    const { companyData, companyIdForAddress, loading: companyLoading } = useCompany();

    // Calculate date range for last 30 days
    const thirtyDaysAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return Timestamp.fromDate(date);
    }, []);

    // Fetch customers data
    useEffect(() => {
        if (!companyIdForAddress) return;

        const customersQuery = query(
            collection(db, 'customers'),
            where('companyID', '==', companyIdForAddress)
        );

        const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
            const customersData = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                customersData[data.customerID] = data;
            });
            setCustomers(customersData);
        }, (error) => {
            console.error('Error fetching customers:', error);
        });

        return () => unsubscribeCustomers();
    }, [companyIdForAddress]);

    // Fetch shipments from Firestore for the last 30 days and current company
    useEffect(() => {
        if (!companyIdForAddress || companyLoading) {
            return;
        }

        console.log('Dashboard: Fetching shipments for company:', companyIdForAddress);
        console.log('Dashboard: Date filter from:', thirtyDaysAgo.toDate());

        const shipmentsQuery = query(
            collection(db, 'shipments'),
            where('companyID', '==', companyIdForAddress),
            where('createdAt', '>=', thirtyDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(500) // Increased limit for 30 days of data
        );

        const unsubscribe = onSnapshot(shipmentsQuery, (snapshot) => {
            console.log('Dashboard: Received shipments snapshot with', snapshot.docs.length, 'documents');

            const shipmentsData = snapshot.docs.map(doc => {
                const data = doc.data();

                // Get customer data - check multiple possible customer ID fields
                const customerId = data.shipTo?.customerID || data.customerId || data.customerID;
                const customerData = customers[customerId] || {};

                // Helper function to safely get rate info
                const getRateInfo = () => {
                    // Check for selectedRateRef first (new structure)
                    if (data.selectedRateRef) {
                        return {
                            carrier: data.selectedRateRef.carrier || data.selectedRateRef.carrierName || '',
                            totalCharges: data.selectedRateRef.totalCharges || 0
                        };
                    }

                    // Check for selectedRate (legacy structure)
                    if (data.selectedRate) {
                        return {
                            carrier: data.selectedRate.carrier || data.selectedRate.carrierName || '',
                            totalCharges: data.selectedRate.totalCharges || data.selectedRate.price || 0
                        };
                    }

                    // Fallback to direct carrier field
                    return {
                        carrier: data.carrier || '',
                        totalCharges: 0
                    };
                };

                const rateInfo = getRateInfo();

                return {
                    id: doc.id,
                    shipmentId: data.shipmentID || data.shipmentId || doc.id, // Use shipmentID (capital ID) first
                    date: formatDate(data.createdAt),
                    createdAt: data.createdAt, // Keep original timestamp for calculations
                    customer: customerData.name || data.shipTo?.company || 'Unknown Customer',
                    origin: formatAddress(data.shipFrom),
                    destination: formatAddress(data.shipTo),
                    carrier: rateInfo.carrier,
                    shipmentType: data.shipmentInfo?.shipmentType || 'Standard',
                    status: data.status || 'pending',
                    value: rateInfo.totalCharges || data.packages?.[0]?.declaredValue || 0
                };
            }).filter(shipment => {
                // Exclude draft shipments from dashboard counts and displays
                return shipment.status?.toLowerCase() !== 'draft';
            });

            console.log('Dashboard: Processed shipments data:', shipmentsData.length, 'shipments (excluding drafts)');
            setShipments(shipmentsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching shipments:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyIdForAddress, companyLoading, customers, thirtyDaysAgo]); // Add customers and thirtyDaysAgo as dependencies

    // Calculate all shipment stats in a single pass for last 30 days
    const shipmentStats = useMemo(() => {
        const stats = {
            total: shipments.length,
            inTransit: 0,
            delivered: 0,
            onHold: 0,
            pending: 0,
            awaitingShipment: 0,
            cancelled: 0,
            totalValue: 0
        };

        shipments.forEach(shipment => {
            const status = shipment.status?.toLowerCase();

            // Updated status mapping based on requirements
            switch (status) {
                case 'pending':
                case 'created':
                case 'booked':
                case 'awaiting pickup':
                    stats.pending++;
                    stats.awaitingShipment++; // These count as both pending and awaiting
                    break;
                case 'awaiting shipment':
                case 'label_created':
                    stats.awaitingShipment++;
                    break;
                case 'in transit':
                case 'in_transit':
                    stats.inTransit++;
                    break;
                case 'on hold':
                case 'on_hold':
                    stats.onHold++;
                    break;
                case 'delivered':
                    stats.delivered++;
                    break;
                case 'cancelled':
                case 'canceled':
                    stats.cancelled++;
                    break;
            }

            if (shipment.value) stats.totalValue += shipment.value;
        });

        return stats;
    }, [shipments]);

    // Calculate metrics based on the stats
    const metrics = useMemo(() => {
        const { total, delivered, totalValue } = shipmentStats;
        const averageValue = total > 0 ? totalValue / total : 0;
        const onTimeDelivery = total > 0 ? (delivered / total) * 100 : 0;

        return {
            totalShipments: total,
            totalValue,
            averageValue,
            onTimeDelivery
        };
    }, [shipmentStats]);

    // Calculate top customers
    const topCustomers = useMemo(() => {
        const customerTotals = shipments.reduce((acc, shipment) => {
            if (shipment.value) {
                acc[shipment.customer] = (acc[shipment.customer] || 0) + shipment.value;
            }
            return acc;
        }, {});

        return Object.entries(customerTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);
    }, [shipments]);

    // Calculate daily shipment value
    const dailyShipmentValue = useMemo(() => {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        return shipments
            .filter(shipment => shipment.date && shipment.date.startsWith(today))
            .reduce((sum, shipment) => sum + (shipment.value || 0), 0);
    }, [shipments]);

    // Calculate daily shipment counts for the last 30 days
    const dailyShipmentCounts = useMemo(() => {
        const today = new Date();
        const dailyCounts = {};

        // Initialize all days in the last 30 days with 0
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            dailyCounts[dateKey] = 0;
        }

        // Count shipments by date
        shipments.forEach(shipment => {
            if (shipment.date) {
                if (dailyCounts.hasOwnProperty(shipment.date)) {
                    dailyCounts[shipment.date]++;
                }
            }
        });

        return dailyCounts;
    }, [shipments]);

    // Calculate carrier distribution
    const carrierDistribution = useMemo(() => {
        const distribution = shipments.reduce((acc, shipment) => {
            const carrier = shipment.carrier || 'Unknown';
            acc[carrier] = (acc[carrier] || 0) + 1;
            return acc;
        }, {});

        const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        return Object.entries(distribution).map(([carrier, count]) => ({
            carrier,
            percentage: total > 0 ? (count / total) * 100 : 0
        }));
    }, [shipments]);

    // Calculate delivery performance
    const deliveryPerformance = useMemo(() => {
        const { total, delivered, inTransit, onHold } = shipmentStats;

        return {
            delivered: total > 0 ? (delivered / total) * 100 : 0,
            inTransit: total > 0 ? (inTransit / total) * 100 : 0,
            onHold: total > 0 ? (onHold / total) * 100 : 0
        };
    }, [shipmentStats]);

    // Filter shipments based on selected tab
    const filteredShipments = useMemo(() => {
        return shipments.filter(shipment => {
            switch (selectedTab) {
                case 'in-transit':
                    return shipment.status?.toLowerCase() === 'in transit' ||
                        shipment.status?.toLowerCase() === 'in_transit';
                case 'delivered':
                    return shipment.status?.toLowerCase() === 'delivered';
                case 'awaiting':
                    return shipment.status?.toLowerCase() === 'awaiting shipment' ||
                        shipment.status?.toLowerCase() === 'label_created' ||
                        shipment.status?.toLowerCase() === 'booked' ||
                        shipment.status?.toLowerCase() === 'awaiting pickup';
                case 'pending':
                    return shipment.status?.toLowerCase() === 'pending' ||
                        shipment.status?.toLowerCase() === 'created';
                case 'on-hold':
                    return shipment.status?.toLowerCase() === 'on hold' ||
                        shipment.status?.toLowerCase() === 'on_hold';
                case 'cancelled':
                    return shipment.status?.toLowerCase() === 'cancelled' ||
                        shipment.status?.toLowerCase() === 'canceled';
                default:
                    return true;
            }
        });
    }, [shipments, selectedTab]);

    // Handle tab change
    const handleTabChange = useCallback((event, newValue) => {
        setSelectedTab(newValue);
    }, []);

    // Handle print label
    const handlePrintLabel = useCallback((shipmentId) => {
        console.log('Print label for shipment:', shipmentId);
    }, []);

    // Generate chart data for the last 30 days
    const chartData = useMemo(() => {
        const today = new Date();
        const chartPoints = [];

        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const count = dailyShipmentCounts[dateKey] || 0;

            chartPoints.push({
                value: count,
                day: date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                })
            });
        }

        return chartPoints;
    }, [dailyShipmentCounts]);

    // Calculate max value for chart Y-axis
    const maxChartValue = useMemo(() => {
        const maxValue = Math.max(...chartData.map(point => point.value));
        return Math.max(maxValue + 2, 10); // Ensure minimum of 10 for better visualization
    }, [chartData]);

    // Show loading state while company data is loading
    if (companyLoading || loading) {
        return (
            <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                <Box sx={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Breadcrumb Navigation */}
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                        component={Link}
                        to="/"
                        sx={{ p: 0.5 }}
                    >
                        <HomeIcon />
                    </IconButton>
                    <NavigateNextIcon />
                    <Typography variant="body2" sx={{ color: '#1e293b' }}>
                        Dashboard
                    </Typography>
                </Box>

                {/* Header Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            Dashboard
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                            Last 30 days • {companyData?.name || 'Loading...'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => window.location.reload()}
                            sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            component={Link}
                            to="/create-shipment"
                            sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
                        >
                            Create shipment
                        </Button>
                    </Box>
                </Box>

                {/* Main Content */}
                <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', p: 3, mb: 3 }}>
                    {/* Status Boxes */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatusBox
                                title="Total Shipments"
                                count={shipmentStats.total}
                                icon={ShippingIcon}
                                color="#000000"
                                bgColor="rgba(0, 0, 0, 0.1)"
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <StatusBox
                                title="Awaiting Shipment"
                                count={shipmentStats.awaitingShipment}
                                icon={ScheduleIcon}
                                color="#3B82F6"
                                bgColor="rgba(59, 130, 246, 0.1)"
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <StatusBox
                                title="In Transit"
                                count={shipmentStats.inTransit}
                                icon={LocalShipping}
                                color="#6366f1"
                                bgColor="rgba(99, 102, 241, 0.1)"
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <StatusBox
                                title="Delivered"
                                count={shipmentStats.delivered}
                                icon={CheckCircleIcon}
                                color="#10b981"
                                bgColor="rgba(16, 185, 129, 0.1)"
                            />
                        </Grid>
                    </Grid>

                    {/* Daily Shipment Volume Chart */}
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Paper sx={{
                                p: 3,
                                bgcolor: '#ffffff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                                borderRadius: 2,
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 3
                                }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                        Daily Shipments (Last 30 Days)
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2
                                    }}>
                                        <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 500 }}>
                                            {shipmentStats.total} Total Shipments
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ height: 300 }}>
                                    <LineChart
                                        dataset={chartData}
                                        series={[
                                            {
                                                dataKey: 'value',
                                                valueFormatter: (value) => `${value} shipments`,
                                                color: '#3b82f6',
                                                area: true,
                                                showMark: false,
                                                curve: "monotoneX"
                                            }
                                        ]}
                                        xAxis={[{
                                            dataKey: 'day',
                                            scaleType: 'point',
                                            tickLabelStyle: {
                                                angle: 0,
                                                textAnchor: 'middle',
                                                fontSize: 12,
                                                fill: '#64748b'
                                            },
                                            position: 'bottom',
                                            tickSize: 0,
                                            axisLine: { stroke: '#e2e8f0' }
                                        }]}
                                        yAxis={[{
                                            min: 0,
                                            max: maxChartValue,
                                            tickMinStep: 1,
                                            tickLabelStyle: {
                                                fontSize: 12,
                                                fill: '#64748b'
                                            },
                                            position: 'left',
                                            tickSize: 0,
                                            axisLine: { stroke: '#e2e8f0' }
                                        }]}
                                        sx={{
                                            '.MuiLineElement-root': {
                                                strokeWidth: 2,
                                                transition: 'all 0.2s ease-in-out',
                                            },
                                            '.MuiAreaElement-root': {
                                                fillOpacity: 0.15,
                                            },
                                            '.MuiChartsAxis-line': {
                                                stroke: '#e2e8f0'
                                            },
                                            '.MuiChartsAxis-tick': {
                                                stroke: '#e2e8f0'
                                            },
                                            '.MuiChartsAxis-grid': {
                                                stroke: '#f1f5f9'
                                            }
                                        }}
                                        height={300}
                                        margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
                                        tooltip={{
                                            trigger: 'axis'
                                        }}
                                    />
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Recent Shipments Table */}
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Recent Shipments</Typography>
                        </Box>
                        <TableContainer>
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="top">SHIPMENT ID</TableCell>
                                            <TableCell align="top">CUSTOMER</TableCell>
                                            <TableCell align="top">ORIGIN</TableCell>
                                            <TableCell align="top">DESTINATION</TableCell>
                                            <TableCell align="top" sx={{ minWidth: 120 }}>CARRIER</TableCell>
                                            <TableCell align="top">TYPE</TableCell>
                                            <TableCell align="top">STATUS</TableCell>
                                            <TableCell align="top">ACTIONS</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {shipments.slice(0, 20).map((shipment) => (
                                            <ShipmentRow
                                                key={shipment.id}
                                                shipment={shipment}
                                                onPrint={handlePrintLabel}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TableContainer>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button
                                variant="text"
                                endIcon={<ArrowForwardIcon />}
                                onClick={() => navigate('/shipments')}
                            >
                                View All
                            </Button>
                        </Box>
                    </Paper>
                </Paper>
            </Box>
        </Box>
    );
};

export default Dashboard;