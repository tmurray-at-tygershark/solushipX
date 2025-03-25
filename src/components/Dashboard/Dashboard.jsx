import React, { useState, useMemo } from 'react';
import {
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
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
    Checkbox,
    Toolbar,
    InputBase,
    Grid,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider,
    Stack,
    TextField
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    GetApp as ExportIcon,
    Add as AddIcon,
    Person as PersonIcon,
    LocalShipping as ShippingIcon,
    AttachMoney as MoneyIcon,
    LocationOn as LocationIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    Refresh as RefreshIcon,
    CalendarToday as CalendarIcon,
    LocalShipping as LocalShipping
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Link } from 'react-router-dom';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import './Dashboard.css';
import dayjs from 'dayjs';

// Helper function to generate random shipment data
const generateRandomShipments = (count) => {
    const carriers = ['FedEx', 'UPS', 'DHL', 'USPS', 'Canada Post', 'Purolator'];
    const statuses = ['In Transit', 'Delivered', 'Pending', 'Awaiting Shipment'];
    const usStates = [
        { city: 'New York', state: 'NY' },
        { city: 'Los Angeles', state: 'CA' },
        { city: 'Chicago', state: 'IL' },
        { city: 'Houston', state: 'TX' },
        { city: 'Miami', state: 'FL' },
        { city: 'Seattle', state: 'WA' },
        { city: 'Boston', state: 'MA' },
        { city: 'Denver', state: 'CO' }
    ];
    const canadianProvinces = [
        { city: 'Toronto', province: 'ON' },
        { city: 'Vancouver', province: 'BC' },
        { city: 'Montreal', province: 'QC' },
        { city: 'Calgary', province: 'AB' },
        { city: 'Ottawa', province: 'ON' },
        { city: 'Edmonton', province: 'AB' },
        { city: 'Winnipeg', province: 'MB' },
        { city: 'Halifax', province: 'NS' }
    ];
    const customers = [
        'John Smith', 'Emma Wilson', 'Michael Brown', 'Sarah Davis',
        'David Miller', 'Lisa Anderson', 'James Taylor', 'Jennifer White',
        'Robert Martin', 'Maria Garcia', 'William Lee', 'Patricia Moore',
        'Christopher Clark', 'Elizabeth Hall', 'Daniel Young', 'Margaret King'
    ];

    const getRandomLocation = () => {
        const isUS = Math.random() < 0.5;
        return isUS ? usStates[Math.floor(Math.random() * usStates.length)] :
            canadianProvinces[Math.floor(Math.random() * canadianProvinces.length)];
    };

    const getRandomDate = () => {
        const start = new Date(2024, 0, 1);
        const end = new Date();
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    };

    const getRandomCost = () => (50 + Math.random() * 450).toFixed(2);
    const getRandomItems = () => Math.floor(1 + Math.random() * 5);

    return Array.from({ length: count }, (_, i) => {
        const origin = getRandomLocation();
        let destination;
        do {
            destination = getRandomLocation();
        } while (destination === origin);

        const items = getRandomItems();
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const carrier = carriers[Math.floor(Math.random() * carriers.length)];
        const date = getRandomDate();

        return {
            id: `SHP${String(287683 - i).padStart(6, '0')}`,
            date: date.toLocaleString(),
            customer: customers[Math.floor(Math.random() * customers.length)],
            origin: `${origin.city}, ${origin.state || origin.province}`,
            destination: `${destination.city}, ${destination.state || destination.province}`,
            status: status,
            carrier: carrier,
            trackingNumber: Math.random().toString(36).substring(2, 12).toUpperCase(),
            items: `${items} ${items === 1 ? 'item' : 'items'}`,
            deliveryStatus: status === 'Delivered' ? 'Delivered' : status === 'Awaiting Shipment' ? 'Not Started' : 'On Schedule',
            cost: `$${getRandomCost()}`
        };
    });
};

const Dashboard = () => {
    const [selectedTab, setSelectedTab] = useState('all');
    const [anchorEl, setAnchorEl] = useState(null);
    const [startDate, setStartDate] = useState(dayjs());
    const [endDate, setEndDate] = useState(dayjs());

    // Dummy data for shipments
    const shipments = [
        {
            id: 'SHIP001',
            date: '2024-03-20',
            customer: 'Acme Corporation',
            origin: 'New York, NY',
            destination: 'Los Angeles, CA',
            status: 'Delivered',
            carrier: 'FedEx',
            items: 'Electronics',
            value: 250.00,
            cost: '$250.00'
        },
        {
            id: 'SHIP002',
            date: '2024-03-19',
            customer: 'Tech Solutions Inc',
            origin: 'San Francisco, CA',
            destination: 'Chicago, IL',
            status: 'In Transit',
            carrier: 'UPS',
            items: 'Office Equipment',
            value: 350.00,
            cost: '$350.00'
        },
        {
            id: 'SHIP003',
            date: '2024-03-18',
            customer: 'Global Industries',
            origin: 'Miami, FL',
            destination: 'Seattle, WA',
            status: 'Delayed',
            carrier: 'DHL',
            items: 'Machinery Parts',
            value: 850.00,
            cost: '$850.00'
        },
        {
            id: 'SHIP004',
            date: new Date().toISOString().split('T')[0], // Today's date
            customer: 'Retail Plus',
            origin: 'Boston, MA',
            destination: 'Houston, TX',
            status: 'Delivered',
            carrier: 'FedEx',
            items: 'Retail Goods',
            value: 420.00,
            cost: '$420.00'
        },
        {
            id: 'SHIP005',
            date: new Date().toISOString().split('T')[0], // Today's date
            customer: 'Manufacturing Co',
            origin: 'Detroit, MI',
            destination: 'Phoenix, AZ',
            status: 'In Transit',
            carrier: 'UPS',
            items: 'Industrial Equipment',
            value: 920.00,
            cost: '$920.00'
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

    // Calculate stats
    const stats = {
        total: shipments.length,
        inTransit: shipments.filter(s => s.status === 'In Transit').length,
        delivered: shipments.filter(s => s.status === 'Delivered').length,
        awaitingShipment: shipments.filter(s => s.status === 'Awaiting Shipment').length,
        totalItems: shipments.reduce((acc, s) => acc + parseInt(s.items), 0)
    };

    // Add these helper functions at the top of the component
    const formatNumber = (number) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(number);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Update the metrics calculations
    const metrics = useMemo(() => {
        const totalShipments = shipments.length;
        const totalValue = shipments.reduce((sum, shipment) => sum + shipment.value, 0);
        const averageValue = totalShipments > 0 ? totalValue / totalShipments : 0;
        const onTimeDelivery = totalShipments > 0
            ? (shipments.filter(s => s.status === 'Delivered').length / totalShipments) * 100
            : 0;

        return {
            totalShipments,
            totalValue,
            averageValue,
            onTimeDelivery
        };
    }, [shipments]);

    // Update the top customers calculation
    const topCustomers = useMemo(() => {
        const customerTotals = shipments.reduce((acc, shipment) => {
            acc[shipment.customer] = (acc[shipment.customer] || 0) + shipment.value;
            return acc;
        }, {});

        return Object.entries(customerTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);
    }, [shipments]);

    // Update the daily shipment value calculation
    const dailyShipmentValue = useMemo(() => {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        return shipments
            .filter(shipment => shipment.date.startsWith(today))
            .reduce((sum, shipment) => sum + shipment.value, 0);
    }, [shipments]);

    // Update the monthly data calculation
    const monthlyData = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Initialize the data structure with all days of the current month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const monthData = Array(daysInMonth).fill(0);

        // Aggregate shipment values by date
        shipments.forEach(shipment => {
            const shipmentDate = new Date(shipment.date);
            if (shipmentDate.getMonth() === currentMonth && shipmentDate.getFullYear() === currentYear) {
                const day = shipmentDate.getDate() - 1;
                monthData[day] = (monthData[day] || 0) + (shipment.value || 0);
            }
        });

        return monthData;
    }, [shipments]);

    // Update the carrier distribution calculation
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

    // Update the delivery performance calculation
    const deliveryPerformance = useMemo(() => {
        const total = shipments.length;
        const delivered = shipments.filter(s => s.status === 'Delivered').length;
        const inTransit = shipments.filter(s => s.status === 'In Transit').length;
        const delayed = shipments.filter(s => s.status === 'Delayed').length;

        return {
            delivered: (delivered / total) * 100,
            inTransit: (inTransit / total) * 100,
            delayed: (delayed / total) * 100
        };
    }, [shipments]);

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // Filter shipments based on selected tab
    const filteredShipments = shipments.filter(shipment => {
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
                                        Active Shipments
                                    </Typography>
                                    <Typography variant="h4" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                                        {shipments.filter(s => s.status === 'In Transit' || s.status === 'Awaiting Shipment').length}
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(59, 130, 246, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <ShippingIcon sx={{ color: '#3b82f6', fontSize: 24 }} />
                                </Box>
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
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
                                        Waiting for Pickup
                                    </Typography>
                                    <Typography variant="h4" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                                        {shipments.filter(s => s.status === 'Awaiting Shipment').length}
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(245, 158, 11, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <ScheduleIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
                                </Box>
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
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
                                        In Transit
                                    </Typography>
                                    <Typography variant="h4" sx={{ color: '#6366f1', fontWeight: 600 }}>
                                        {shipments.filter(s => s.status === 'In Transit').length}
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(99, 102, 241, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <LocalShipping sx={{ color: '#6366f1', fontSize: 24 }} />
                                </Box>
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
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
                                        Delivered
                                    </Typography>
                                    <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 600 }}>
                                        {shipments.filter(s => s.status === 'Delivered').length}
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CheckCircleIcon sx={{ color: '#10b981', fontSize: 24 }} />
                                </Box>
                            </Box>
                        </Paper>
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
                                    Monthly Shipment Volume
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
                                        {shipments.length} Total Shipments
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ height: 300 }}>
                                <LineChart
                                    dataset={monthlyData.map((_, index) => {
                                        const date = new Date();
                                        date.setDate(index + 1);
                                        // Generate random number between 10 and 100
                                        const randomShipments = Math.floor(Math.random() * 91) + 10;
                                        return {
                                            value: randomShipments,
                                            day: date.toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                            })
                                        };
                                    })}
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
                <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                    <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0' }}>
                        <Tabs value={selectedTab} onChange={handleTabChange}>
                            <Tab label={`All (${stats.total})`} value="all" />
                            <Tab label={`In Transit (${stats.inTransit})`} value="in-transit" />
                            <Tab label={`Delivered (${stats.delivered})`} value="delivered" />
                            <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="awaiting" />
                        </Tabs>
                        <Box sx={{ flexGrow: 1 }} />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Paper sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400, bgcolor: '#f8fafc' }}>
                                <SearchIcon sx={{ p: 1, color: '#64748b' }} />
                                <InputBase
                                    sx={{ ml: 1, flex: 1 }}
                                    placeholder="Search shipments"
                                />
                            </Paper>
                            <IconButton sx={{ color: '#64748b' }}>
                                <FilterListIcon />
                            </IconButton>
                        </Box>
                    </Toolbar>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell>Shipment</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Origin</TableCell>
                                    <TableCell>Destination</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Carrier</TableCell>
                                    <TableCell>Items</TableCell>
                                    <TableCell>Cost</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredShipments.map((shipment) => (
                                    <TableRow key={shipment.id} hover>
                                        <TableCell padding="checkbox">
                                            <Checkbox />
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                to={`/shipment/${shipment.id}`}
                                            >
                                                {shipment.id}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{shipment.date}</TableCell>
                                        <TableCell>{shipment.customer}</TableCell>
                                        <TableCell>{shipment.origin}</TableCell>
                                        <TableCell>{shipment.destination}</TableCell>
                                        <TableCell>{shipment.status}</TableCell>
                                        <TableCell>{shipment.carrier}</TableCell>
                                        <TableCell>{shipment.items}</TableCell>
                                        <TableCell>{shipment.cost}</TableCell>
                                        <TableCell>
                                            <IconButton onClick={handleMenuClick}>
                                                <MoreVertIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Box>
        </Box>
    );
};

export default Dashboard;