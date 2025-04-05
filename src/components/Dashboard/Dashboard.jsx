import React, { useState, useMemo, useCallback } from 'react';
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
    ListItemIcon
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
    Print as PrintIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart } from '@mui/x-charts/LineChart';
import './Dashboard.css';
import dayjs from 'dayjs';

// Move dummy data outside the component to prevent recreation on each render
const DUMMY_SHIPMENTS = [
    {
        id: 'SHIP001',
        date: '2024-03-20',
        customer: 'Acme Corporation',
        origin: '123 Main St, New York, NY 10001',
        destination: '456 Market St, San Francisco, CA 94105',
        carrier: 'FedEx',
        shipmentType: 'Courier',
        status: 'Delivered',
        value: 120.00
    },
    {
        id: 'SHIP002',
        date: '2024-03-19',
        customer: 'Tech Solutions Inc',
        origin: '789 Lake Ave, Chicago, IL 60601',
        destination: '321 Pine St, Boston, MA 02108',
        carrier: 'UPS',
        shipmentType: 'Freight',
        status: 'In Transit',
        value: 450.00
    },
    {
        id: 'SHIP003',
        date: '2024-03-18',
        customer: 'Global Industries',
        origin: '654 Oak Rd, Houston, TX 77001',
        destination: '987 Maple Dr, Seattle, WA 98101',
        carrier: 'DHL',
        shipmentType: 'Freight',
        status: 'Delayed',
        value: 780.00
    },
    {
        id: 'SHIP004',
        date: '2024-03-17',
        customer: 'Retail Plus',
        origin: '147 Cedar Ln, Miami, FL 33101',
        destination: '258 Birch St, Denver, CO 80201',
        carrier: 'FedEx',
        shipmentType: 'Courier',
        status: 'Delivered',
        value: 320.00
    },
    {
        id: 'SHIP005',
        date: '2024-03-16',
        customer: 'Manufacturing Co',
        origin: '369 Elm Ave, Atlanta, GA 30301',
        destination: '741 Spruce Rd, Portland, OR 97201',
        carrier: 'UPS',
        shipmentType: 'Freight',
        status: 'In Transit',
        value: 950.00
    },
    {
        id: 'SHIP006',
        date: '2024-03-15',
        customer: 'E-commerce Solutions',
        origin: 'Atlanta, GA',
        destination: 'Denver, CO',
        status: 'Delivered',
        carrier: 'USPS',
        items: 'Consumer Goods',
        value: 280.00,
        cost: '$280.00'
    },
    {
        id: 'SHIP007',
        date: '2024-03-14',
        customer: 'Healthcare Systems',
        origin: 'Philadelphia, PA',
        destination: 'San Diego, CA',
        status: 'In Transit',
        carrier: 'FedEx',
        items: 'Medical Supplies',
        value: 650.00,
        cost: '$650.00'
    },
    {
        id: 'SHIP008',
        date: '2024-03-13',
        customer: 'Construction Corp',
        origin: 'Dallas, TX',
        destination: 'Portland, OR',
        status: 'Delayed',
        carrier: 'DHL',
        items: 'Construction Materials',
        value: 950.00,
        cost: '$950.00'
    },
    {
        id: 'SHIP009',
        date: '2024-03-12',
        customer: 'Food Distribution',
        origin: 'New Orleans, LA',
        destination: 'Minneapolis, MN',
        status: 'Delivered',
        carrier: 'UPS',
        items: 'Food Products',
        value: 380.00,
        cost: '$380.00'
    },
    {
        id: 'SHIP010',
        date: '2024-03-11',
        customer: 'Fashion Retail',
        origin: 'Las Vegas, NV',
        destination: 'Cleveland, OH',
        status: 'In Transit',
        carrier: 'FedEx',
        items: 'Clothing',
        value: 220.00,
        cost: '$220.00'
    },
    {
        id: 'SHIP011',
        date: '2024-03-10',
        customer: 'Tech Gadgets',
        origin: 'San Jose, CA',
        destination: 'Miami, FL',
        status: 'Delivered',
        carrier: 'DHL',
        items: 'Electronics',
        value: 480.00,
        cost: '$480.00'
    },
    {
        id: 'SHIP012',
        date: '2024-03-09',
        customer: 'Home Goods',
        origin: 'Seattle, WA',
        destination: 'Boston, MA',
        status: 'In Transit',
        carrier: 'UPS',
        items: 'Furniture',
        value: 720.00,
        cost: '$720.00'
    },
    {
        id: 'SHIP013',
        date: '2024-03-08',
        customer: 'Sports Equipment',
        origin: 'Portland, OR',
        destination: 'Chicago, IL',
        status: 'Delivered',
        carrier: 'FedEx',
        items: 'Sports Gear',
        value: 310.00,
        cost: '$310.00'
    },
    {
        id: 'SHIP014',
        date: '2024-03-07',
        customer: 'Auto Parts',
        origin: 'Detroit, MI',
        destination: 'Houston, TX',
        status: 'Delayed',
        carrier: 'DHL',
        items: 'Auto Components',
        value: 920.00,
        cost: '$920.00'
    },
    {
        id: 'SHIP015',
        date: '2024-03-06',
        customer: 'Pharmaceuticals',
        origin: 'New York, NY',
        destination: 'San Francisco, CA',
        status: 'In Transit',
        carrier: 'FedEx',
        items: 'Medical Supplies',
        value: 880.00,
        cost: '$880.00'
    }
];

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

    return (
        <TableRow
            hover
            onClick={() => navigate(`/shipment/${shipment.id}`)}
            sx={{
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
            }}
        >
            <TableCell onClick={(e) => e.stopPropagation()}>
                <Link
                    to={`/shipment/${shipment.id}`}
                    style={{ textDecoration: 'none', color: '#3b82f6' }}
                >
                    {shipment.id}
                </Link>
            </TableCell>
            <TableCell>{shipment.customer}</TableCell>
            <TableCell>{shipment.origin}</TableCell>
            <TableCell>{shipment.destination}</TableCell>
            <TableCell>{shipment.carrier}</TableCell>
            <TableCell>{shipment.shipmentType}</TableCell>
            <TableCell>
                <Chip
                    label={shipment.status}
                    color={
                        shipment.status === 'Delivered'
                            ? 'success'
                            : shipment.status === 'In Transit'
                                ? 'primary'
                                : shipment.status === 'Delayed'
                                    ? 'error'
                                    : 'default'
                    }
                    size="small"
                />
            </TableCell>
            <TableCell>
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
    const navigate = useNavigate();

    // Use the dummy data
    const shipments = DUMMY_SHIPMENTS;

    // Calculate all shipment stats in a single pass
    const shipmentStats = useMemo(() => {
        const stats = {
            total: shipments.length,
            inTransit: 0,
            delivered: 0,
            delayed: 0,
            awaitingShipment: 0,
            totalValue: 0
        };

        shipments.forEach(shipment => {
            if (shipment.status === 'In Transit') stats.inTransit++;
            else if (shipment.status === 'Delivered') stats.delivered++;
            else if (shipment.status === 'Delayed') stats.delayed++;
            else if (shipment.status === 'Awaiting Shipment') stats.awaitingShipment++;

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

    // Calculate monthly data
    const monthlyData = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Initialize the data structure with all days of the current month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const monthData = Array(daysInMonth).fill(0);

        // Aggregate shipment values by date
        shipments.forEach(shipment => {
            if (shipment.date && shipment.value) {
                const shipmentDate = new Date(shipment.date);
                if (shipmentDate.getMonth() === currentMonth && shipmentDate.getFullYear() === currentYear) {
                    const day = shipmentDate.getDate() - 1;
                    monthData[day] = (monthData[day] || 0) + shipment.value;
                }
            }
        });

        return monthData;
    }, [shipments]);

    // Calculate carrier distribution
    const carrierDistribution = useMemo(() => {
        const distribution = shipments.reduce((acc, shipment) => {
            acc[shipment.carrier] = (acc[shipment.carrier] || 0) + 1;
            return acc;
        }, {});

        const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        return Object.entries(distribution).map(([carrier, count]) => ({
            carrier,
            percentage: (count / total) * 100
        }));
    }, [shipments]);

    // Calculate delivery performance
    const deliveryPerformance = useMemo(() => {
        const { total, delivered, inTransit, delayed } = shipmentStats;

        return {
            delivered: total > 0 ? (delivered / total) * 100 : 0,
            inTransit: total > 0 ? (inTransit / total) * 100 : 0,
            delayed: total > 0 ? (delayed / total) * 100 : 0
        };
    }, [shipmentStats]);

    // Filter shipments based on selected tab
    const filteredShipments = useMemo(() => {
        return shipments.filter(shipment => {
            switch (selectedTab) {
                case 'in-transit':
                    return shipment.status === 'In Transit';
                case 'delivered':
                    return shipment.status === 'Delivered';
                case 'awaiting':
                    return shipment.status === 'Awaiting Shipment';
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

    // Generate chart data
    const chartData = useMemo(() => {
        return monthlyData.map((_, index) => {
            const date = new Date();
            date.setDate(index + 1);
            return {
                value: monthlyData[index] || Math.floor(Math.random() * 91) + 10,
                day: date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                })
            };
        });
    }, [monthlyData]);

    return (
        <Box sx={{
            maxWidth: '1536px',
            margin: '0 auto',
            padding: '1.5rem',
            '@media (max-width: 1536px)': {
                maxWidth: '1280px'
            },
            '@media (max-width: 1280px)': {
                maxWidth: '1024px'
            },
            '@media (max-width: 1024px)': {
                maxWidth: '768px'
            },
            '@media (max-width: 768px)': {
                padding: '1rem'
            }
        }}>
            {/* Header Section */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                flexWrap: 'wrap',
                gap: 2
            }}>
                <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Dashboard
                </Typography>
                <Box sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    flexWrap: 'wrap'
                }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <DatePicker
                            label="Start Date"
                            value={startDate}
                            onChange={(newValue) => setStartDate(newValue)}
                            sx={{ width: '200px' }}
                        />
                        <DatePicker
                            label="End Date"
                            value={endDate}
                            onChange={(newValue) => setEndDate(newValue)}
                            minDate={startDate}
                            sx={{ width: '200px' }}
                        />
                    </Box>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => window.location.reload()}
                        sx={{
                            color: '#64748b',
                            borderColor: '#e2e8f0',
                            bgcolor: '#ffffff',
                            '&:hover': {
                                borderColor: '#cbd5e1',
                                bgcolor: '#f8fafc'
                            }
                        }}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            {/* Rest of the dashboard content */}
            <Box sx={{ width: '100%', bgcolor: '#f8fafc' }}>
                {/* Status Boxes */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatusBox
                            title="Active Shipments"
                            count={shipmentStats.inTransit + shipmentStats.awaitingShipment}
                            icon={ShippingIcon}
                            color="#000000"
                            bgColor="rgba(0, 0, 0, 0.1)"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <StatusBox
                            title="Waiting for Pickup"
                            count={shipmentStats.awaitingShipment}
                            icon={ScheduleIcon}
                            color="#f59e0b"
                            bgColor="rgba(245, 158, 11, 0.1)"
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

                {/* Monthly Shipment Volume Chart */}
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
                                    Total Shipments
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
                                            valueFormatter: (value) => value.toString(),
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
                                        max: 100,
                                        tickMinStep: 20,
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
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/create-shipment')}
                        >
                            New Shipment
                        </Button>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>CUSTOMER</TableCell>
                                    <TableCell>ORIGIN</TableCell>
                                    <TableCell>DESTINATION</TableCell>
                                    <TableCell sx={{ minWidth: 120 }}>CARRIER</TableCell>
                                    <TableCell>TYPE</TableCell>
                                    <TableCell>STATUS</TableCell>
                                    <TableCell>ACTIONS</TableCell>
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
            </Box>
        </Box>
    );
};

export default Dashboard;