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
    CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Link } from 'react-router-dom';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import './Dashboard.css';

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
    const [dateRange, setDateRange] = useState([
        new Date(new Date().setDate(new Date().getDate() - 30)),
        new Date()
    ]);

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
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateRangePicker
                            value={dateRange}
                            onChange={(newValue) => setDateRange(newValue)}
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: '#ffffff',
                                    '& fieldset': {
                                        borderColor: '#e2e8f0',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: '#cbd5e1',
                                    },
                                }
                            }}
                        />
                    </LocalizationProvider>
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
                {/* Metrics Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            borderRadius: 2,
                            position: 'relative',
                            overflow: 'hidden',
                            height: '100%'
                        }}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                mb: 3
                            }}>
                                <Box>
                                    <Typography variant="subtitle1" sx={{ color: '#64748b', mb: 0.5, fontWeight: 500 }}>
                                        Total Shipments Value
                                    </Typography>
                                    <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                        {formatCurrency(metrics.totalValue)}
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    gap: 1
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1
                                    }}>
                                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 500 }}>
                                            +{((metrics.totalValue / (metrics.totalValue * 0.9) - 1) * 100).toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#10b981' }}>
                                            vs Last Month
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                            <Stack spacing={2}>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 2,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        bgcolor: '#f1f5f9',
                                        transform: 'translateX(4px)'
                                    }
                                }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            Average Value
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                                            {formatCurrency(metrics.averageValue)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <MoneyIcon sx={{ color: '#3b82f6' }} />
                                    </Box>
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 2,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        bgcolor: '#f1f5f9',
                                        transform: 'translateX(4px)'
                                    }
                                }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            Total Shipments
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#6366f1', fontWeight: 600 }}>
                                            {metrics.totalShipments}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(99, 102, 241, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <ShippingIcon sx={{ color: '#6366f1' }} />
                                    </Box>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            borderRadius: 2,
                            position: 'relative',
                            overflow: 'hidden',
                            height: '100%'
                        }}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                mb: 3
                            }}>
                                <Box>
                                    <Typography variant="subtitle1" sx={{ color: '#64748b', mb: 0.5, fontWeight: 500 }}>
                                        Delivery Success Rate
                                    </Typography>
                                    <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                        {((shipments.filter(s => s.status === 'Delivered').length / shipments.length) * 100).toFixed(1)}%
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    gap: 1
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1
                                    }}>
                                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 500 }}>
                                            On Target
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                            <Stack spacing={2}>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 2,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        bgcolor: '#f1f5f9',
                                        transform: 'translateX(4px)'
                                    }
                                }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            Delivered
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 600 }}>
                                            {shipments.filter(s => s.status === 'Delivered').length}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <CheckCircleIcon sx={{ color: '#10b981' }} />
                                    </Box>
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 2,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        bgcolor: '#f1f5f9',
                                        transform: 'translateX(4px)'
                                    }
                                }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            Delayed
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 600 }}>
                                            {shipments.filter(s => s.status === 'Delayed').length}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <WarningIcon sx={{ color: '#ef4444' }} />
                                    </Box>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            borderRadius: 2
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Box>
                                    <Typography variant="subtitle1" sx={{ color: '#64748b', mb: 0.5, fontWeight: 500 }}>
                                        Active Shipments
                                    </Typography>
                                    <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                        {shipments.filter(s => s.status === 'In Transit').length}
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    gap: 1
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1
                                    }}>
                                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 500 }}>
                                            {((shipments.filter(s => s.status === 'Delivered').length / shipments.length) * 100).toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#10b981' }}>
                                            Delivered
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                            <Stack spacing={2}>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 2,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        bgcolor: '#f1f5f9',
                                        transform: 'translateX(4px)'
                                    }
                                }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            Waiting for Pickup
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                                            {shipments.filter(s => s.status === 'Awaiting Shipment').length}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <ScheduleIcon sx={{ color: '#f59e0b' }} />
                                    </Box>
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 2,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        bgcolor: '#f1f5f9',
                                        transform: 'translateX(4px)'
                                    }
                                }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            In Transit
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                                            {shipments.filter(s => s.status === 'In Transit').length}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <ShippingIcon sx={{ color: '#3b82f6' }} />
                                    </Box>
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 2,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        bgcolor: '#f1f5f9',
                                        transform: 'translateX(4px)'
                                    }
                                }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            Delivered
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 600 }}>
                                            {shipments.filter(s => s.status === 'Delivered').length}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <CheckCircleIcon sx={{ color: '#10b981' }} />
                                    </Box>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Charts Section */}
                <Grid container spacing={3}>
                    {/* Monthly Shipment Trends */}
                    <Grid item xs={12} md={8}>
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
                                <BarChart
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
                                            label: 'Number of Shipments',
                                            valueFormatter: (value) => value.toString(),
                                            color: '#3b82f6',
                                            highlightScope: {
                                                highlighted: 'item',
                                                faded: 'global'
                                            },
                                            borderRadius: 4,
                                            barSize: 12
                                        }
                                    ]}
                                    xAxis={[{
                                        dataKey: 'day',
                                        scaleType: 'band',
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
                                        '.MuiBarElement-root': {
                                            transition: 'all 0.2s ease-in-out',
                                            '&:hover': {
                                                filter: 'brightness(0.9)',
                                                transform: 'translateY(-2px)'
                                            }
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
                                        trigger: 'item',
                                        formatter: (params) => [
                                            `${params.value} shipments`,
                                            params.name
                                        ]
                                    }}
                                />
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Shipment Status Distribution */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            borderRadius: 2
                        }}>
                            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#1e293b' }}>
                                Shipment Status
                            </Typography>
                            <Box sx={{ height: 300 }}>
                                <PieChart
                                    series={[
                                        {
                                            data: [
                                                {
                                                    id: 'In Transit',
                                                    value: shipments.filter(s => s.status === 'In Transit').length,
                                                    label: 'In Transit',
                                                    color: '#3b82f6'
                                                },
                                                {
                                                    id: 'Delivered',
                                                    value: shipments.filter(s => s.status === 'Delivered').length,
                                                    label: 'Delivered',
                                                    color: '#10b981'
                                                },
                                                {
                                                    id: 'Waiting for Pickup',
                                                    value: shipments.filter(s => s.status === 'Awaiting Shipment').length,
                                                    label: 'Waiting for Pickup',
                                                    color: '#f59e0b'
                                                }
                                            ],
                                            innerRadius: 60,
                                            paddingAngle: 2,
                                            cornerRadius: 4,
                                            valueFormatter: (value) => `${((value / shipments.length) * 100).toFixed(1)}%`
                                        }
                                    ]}
                                    height={300}
                                    slotProps={{
                                        legend: {
                                            direction: 'row',
                                            position: { vertical: 'bottom', horizontal: 'middle' },
                                            padding: 0
                                        }
                                    }}
                                />
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Top Customers */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            borderRadius: 2,
                            height: '100%'
                        }}>
                            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#1e293b' }}>
                                Top Customers
                            </Typography>
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                height: 'calc(100% - 48px)' // Subtract header height
                            }}>
                                {topCustomers.map((customer, index) => (
                                    <Paper
                                        key={customer.name}
                                        sx={{
                                            p: 2,
                                            bgcolor: '#f8fafc',
                                            borderRadius: 2,
                                            transition: 'all 0.2s ease-in-out',
                                            '&:hover': {
                                                bgcolor: '#f1f5f9',
                                                transform: 'translateY(-1px)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar
                                                sx={{
                                                    bgcolor: ['#3b82f6', '#10b981', '#6366f1'][index % 3],
                                                    width: 56,
                                                    height: 56,
                                                    fontSize: '1.25rem',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {customer.name.split(' ').map(word => word[0]).join('')}
                                            </Avatar>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b', mb: 0.5 }}>
                                                    {customer.name}
                                                </Typography>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                            Shipments
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ color: '#1e293b', fontWeight: 500 }}>
                                                            {shipments.filter(s => s.customer === customer.name).length}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                            Total Value
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ color: '#1e293b', fontWeight: 500 }}>
                                                            {formatCurrency(customer.value)}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Delivery Performance */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                            borderRadius: 2
                        }}>
                            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#1e293b' }}>
                                Shipment Status by Carrier
                            </Typography>
                            <Box sx={{ height: 300 }}>
                                <BarChart
                                    xAxis={[{
                                        scaleType: 'band',
                                        data: ['FedEx', 'UPS', 'DHL', 'USPS']
                                    }]}
                                    series={[
                                        {
                                            label: 'In Transit',
                                            data: ['FedEx', 'UPS', 'DHL', 'USPS'].map(carrier =>
                                                shipments.filter(s => s.carrier === carrier && s.status === 'In Transit').length
                                            ),
                                            color: '#3b82f6'
                                        },
                                        {
                                            label: 'Delivered',
                                            data: ['FedEx', 'UPS', 'DHL', 'USPS'].map(carrier =>
                                                shipments.filter(s => s.carrier === carrier && s.status === 'Delivered').length
                                            ),
                                            color: '#10b981'
                                        },
                                        {
                                            label: 'Waiting for Pickup',
                                            data: ['FedEx', 'UPS', 'DHL', 'USPS'].map(carrier =>
                                                shipments.filter(s => s.carrier === carrier && s.status === 'Awaiting Shipment').length
                                            ),
                                            color: '#f59e0b'
                                        }
                                    ]}
                                    height={300}
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