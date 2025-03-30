import React, { useState, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    IconButton,
    Chip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Divider,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Tooltip,
    Alert,
    Link
} from '@mui/material';
import {
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Save as SaveIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Share as ShareIcon,
    TrendingUp as TrendingUpIcon,
    BarChart as BarChartIcon,
    PieChart as PieChartIcon,
    TableChart as TableChartIcon,
    CalendarToday as CalendarIcon,
    LocationOn as LocationIcon,
    LocalShipping as ShippingIcon,
    AttachMoney as MoneyIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
    Category as CategoryIcon,
    Schedule as ScheduleIcon,
    CheckCircle as CheckCircleIcon,
    MoreVert as MoreVertIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { CSVLink } from 'react-csv';
import './Reports.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Link as RouterLink } from 'react-router-dom';

// Generate dummy data for the last 7 days
const generateDummyData = () => {
    const data = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    const customers = [
        'TechCorp Solutions',
        'Acme Corporation',
        'Quantum Enterprises',
        'Atlas Manufacturing'
    ];
    const origins = [
        '888 Robson Street, Calgary, AB T2P 1B8, Canada',
        '999 Peel Street, Montreal, QC H3A 1M5, Canada',
        '555 Fifth Avenue, Chicago, IL 60601, USA',
        '321 Queen Street, Vancouver, BC V6B 1B5, Canada',
        '777 Biscayne Blvd, Miami, FL 33131, USA'
    ];
    const destinations = [
        '777 Biscayne Blvd, Miami, FL 33131, USA',
        '888 Robson Street, Calgary, AB T2P 1B8, Canada',
        '123 Main Street, New York, NY 10001, USA',
        '456 Market Ave, Los Angeles, CA 90012, USA',
        '321 Queen Street, Vancouver, BC V6B 1B5, Canada'
    ];
    const carriers = ['USPS', 'Purolator', 'UPS', 'Canada Post'];
    const types = ['Courier', 'Freight'];
    const statuses = ['Awaiting Shipment', 'In Transit', 'Delivered'];

    // Generate dates for the visualization
    const visualizationDates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        return date;
    });

    // Generate shipment data
    for (let i = 0; i < 50; i++) {
        const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
        const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
        const randomOrigin = origins[Math.floor(Math.random() * origins.length)];
        const randomDestination = destinations[Math.floor(Math.random() * destinations.length)];
        const randomCarrier = carriers[Math.floor(Math.random() * carriers.length)];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        data.push({
            id: `SHP${String(287587 + i).padStart(6, '0')}`,
            customer: randomCustomer,
            origin: randomOrigin,
            destination: randomDestination,
            carrier: randomCarrier,
            type: randomType,
            status: randomStatus,
            date: randomDate.toISOString()
        });
    }

    // Format the dataset for the LineChart
    const formattedData = visualizationDates.map((date, index) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayData = data.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= dayStart && itemDate <= dayEnd;
        });

        return {
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: dayData.length
        };
    });

    return {
        rawData: data,
        visualizations: {
            shipmentTrends: {
                dataset: formattedData
            },
            carrierDistribution: carriers.map(carrier => ({
                name: carrier,
                value: Math.floor(Math.random() * 20) + 5
            }))
        }
    };
};

const Reports = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)),
        end: new Date()
    });
    const [reportConfig, setReportConfig] = useState({
        name: '',
        type: 'shipments',
        filters: {
            dateRange: {
                type: 'last7days',
                start: new Date(new Date().setDate(new Date().getDate() - 7)),
                end: new Date()
            },
            status: 'ANY',
            carriers: []
        }
    });
    const [reportData, setReportData] = useState(() => {
        const dummyData = generateDummyData();
        return {
            rawData: dummyData.rawData,
            metrics: {
                totalShipments: 50,
                totalValue: 25000
            },
            visualizations: {
                shipmentTrends: {
                    dataset: dummyData.visualizations.shipmentTrends.dataset
                },
                carrierDistribution: dummyData.visualizations.carrierDistribution
            }
        };
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // State for UI
    const [selectedTab, setSelectedTab] = useState('builder');
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);

    // Add this helper function at the top of the component
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

    // Add predefined date range options
    const dateRangeOptions = [
        { label: 'Today', value: 'today' },
        { label: 'Last 7 Days', value: 'last7days' },
        { label: 'Last 30 Days', value: 'last30days' },
        { label: 'Last 90 Days', value: 'last90days' },
        { label: 'Year to Date', value: 'yearToDate' },
        { label: 'Custom Range', value: 'custom' }
    ];

    // Add predefined report templates
    const reportTemplates = [
        {
            id: 'shipping_overview',
            name: 'Shipping Overview',
            description: 'Key metrics and trends for all shipments',
            type: 'shipments',
            metrics: {
                totalShipments: true,
                totalValue: true,
                totalShippingCost: true,
                onTimeDelivery: true
            }
        },
        {
            id: 'customer_analysis',
            name: 'Customer Analysis',
            description: 'Customer shipping patterns and value',
            type: 'customers',
            metrics: {
                uniqueCustomers: true,
                customerDistribution: true,
                customerValueDistribution: true
            }
        },
        {
            id: 'carrier_performance',
            name: 'Carrier Performance',
            description: 'Carrier metrics and service quality',
            type: 'carriers',
            metrics: {
                carrierDistribution: true,
                carrierPerformance: true,
                serviceTypeDistribution: true
            }
        },
        {
            id: 'cost_analysis',
            name: 'Cost Analysis',
            description: 'Detailed shipping cost breakdown',
            type: 'costs',
            metrics: {
                totalShippingCost: true,
                averageShippingCost: true,
                totalSurcharges: true,
                totalInsurance: true,
                totalTaxes: true
            }
        }
    ];

    // Handle report generation
    const handleGenerateReport = async () => {
        setLoading(true);
        setError(null);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Filter data based on report configuration
            let filteredData = [...reportData.rawData];

            // Apply date range filter
            const { start, end } = reportConfig.filters.dateRange;
            if (start && end) {
                filteredData = filteredData.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= start && itemDate <= end;
                });
            }

            // Apply other filters
            if (reportConfig.filters.status.length > 0) {
                filteredData = filteredData.filter(item =>
                    reportConfig.filters.status.includes(item.status)
                );
            }

            if (reportConfig.filters.carriers.length > 0) {
                filteredData = filteredData.filter(item =>
                    reportConfig.filters.carriers.includes(item.carrier)
                );
            }

            if (reportConfig.filters.customers.length > 0) {
                filteredData = filteredData.filter(item =>
                    reportConfig.filters.customers.includes(item.customer)
                );
            }

            // Calculate metrics
            const metrics = calculateMetrics(filteredData);
            setReportData({
                rawData: filteredData,
                metrics,
                visualizations: generateVisualizations(filteredData, metrics)
            });
        } catch (err) {
            setError('Failed to generate report. Please try again.');
            console.error('Report generation error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Add helper function to calculate metrics
    const calculateMetrics = (data) => {
        const metrics = {
            // Shipment Metrics
            totalShipments: data.length,
            totalPackages: data.reduce((sum, item) => sum + (item.packages || 1), 0),
            totalWeight: data.reduce((sum, item) => sum + (item.weight || 0), 0),
            totalValue: data.reduce((sum, item) => sum + item.value, 0),
            averageValue: data.length > 0 ? data.reduce((sum, item) => sum + item.value, 0) / data.length : 0,
            onTimeDelivery: data.length > 0 ? (data.filter(item => item.status === 'Delivered').length / data.length) * 100 : 0,
            customsDeclaredValue: data.reduce((sum, item) => sum + (item.customsValue || 0), 0),

            // Cost Metrics
            totalShippingCost: data.reduce((sum, item) => sum + (item.shippingCost || 0), 0),
            averageShippingCost: data.length > 0 ? data.reduce((sum, item) => sum + (item.shippingCost || 0), 0) / data.length : 0,
            totalSurcharges: data.reduce((sum, item) => sum + (item.surcharges || 0), 0),
            totalInsurance: data.reduce((sum, item) => sum + (item.insurance || 0), 0),
            totalTaxes: data.reduce((sum, item) => sum + (item.taxes || 0), 0),

            // Customer Metrics
            uniqueCustomers: new Set(data.map(item => item.customer)).size,
            customerDistribution: calculateDistribution(data, 'customer'),
            customerValueDistribution: calculateValueDistribution(data, 'customer'),

            // Carrier Metrics
            carrierDistribution: calculateDistribution(data, 'carrier'),
            carrierPerformance: calculateCarrierPerformance(data),
            serviceTypeDistribution: calculateDistribution(data, 'serviceType'),

            // Location Metrics
            originDistribution: calculateDistribution(data, 'origin'),
            destinationDistribution: calculateDistribution(data, 'destination'),
            internationalRatio: calculateInternationalRatio(data)
        };

        return metrics;
    };

    // Add helper function to calculate value distribution
    const calculateValueDistribution = (data, field) => {
        const distribution = data.reduce((acc, item) => {
            acc[item[field]] = (acc[item[field]] || 0) + item.value;
            return acc;
        }, {});

        return Object.entries(distribution).map(([key, value]) => ({
            name: key,
            value: value,
            percentage: (value / data.reduce((sum, item) => sum + item.value, 0)) * 100
        }));
    };

    // Add helper function to calculate carrier performance
    const calculateCarrierPerformance = (data) => {
        const carriers = [...new Set(data.map(item => item.carrier))];
        return carriers.map(carrier => {
            const carrierData = data.filter(item => item.carrier === carrier);
            return {
                name: carrier,
                totalShipments: carrierData.length,
                onTimeDelivery: carrierData.length > 0 ?
                    (carrierData.filter(item => item.status === 'Delivered').length / carrierData.length) * 100 : 0,
                averageCost: carrierData.length > 0 ?
                    carrierData.reduce((sum, item) => sum + (item.shippingCost || 0), 0) / carrierData.length : 0
            };
        });
    };

    // Add helper function to calculate international ratio
    const calculateInternationalRatio = (data) => {
        const total = data.length;
        const international = data.filter(item => item.isInternational).length;
        return total > 0 ? (international / total) * 100 : 0;
    };

    // Helper function to calculate distribution
    const calculateDistribution = (data, field) => {
        const distribution = data.reduce((acc, item) => {
            acc[item[field]] = (acc[item[field]] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(distribution).map(([key, value]) => ({
            name: key,
            value: value,
            percentage: (value / data.length) * 100
        }));
    };

    // Generate visualizations
    const generateVisualizations = (data, metrics) => {
        const visualizations = {
            shipmentTrends: {
                dates: [...new Set(data.map(item => new Date(item.date).toISOString().split('T')[0]))].sort(),
                counts: [],
                values: [],
                costs: [],
                weights: []
            },
            customerPerformance: metrics.customerDistribution || [],
            carrierDistribution: metrics.carrierDistribution || [],
            serviceTypeDistribution: metrics.serviceTypeDistribution || [],
            costBreakdown: calculateCostBreakdown(data, metrics) || [],
            locationDistribution: calculateLocationDistribution(data, metrics) || []
        };

        // Calculate daily trends
        visualizations.shipmentTrends.dates.forEach(date => {
            const dayData = data.filter(item => new Date(item.date).toISOString().split('T')[0] === date);
            visualizations.shipmentTrends.counts.push(dayData.length);
            visualizations.shipmentTrends.values.push(dayData.reduce((sum, item) => sum + (item.value || 0), 0));
            visualizations.shipmentTrends.costs.push(dayData.reduce((sum, item) => sum + (item.shippingCost || 0), 0));
            visualizations.shipmentTrends.weights.push(dayData.reduce((sum, item) => sum + (item.weight || 0), 0));
        });

        // Format the dataset for the LineChart
        visualizations.shipmentTrends.dataset = visualizations.shipmentTrends.dates.map((date, index) => ({
            day: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: visualizations.shipmentTrends.counts[index] || 0
        }));

        // Ensure we have at least one data point for each visualization
        if (visualizations.shipmentTrends.counts.length === 0) {
            visualizations.shipmentTrends.counts.push(0);
            visualizations.shipmentTrends.values.push(0);
            visualizations.shipmentTrends.costs.push(0);
            visualizations.shipmentTrends.weights.push(0);
            visualizations.shipmentTrends.dataset = [{
                day: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: 0
            }];
        }

        if (visualizations.customerPerformance.length === 0) {
            visualizations.customerPerformance.push({ name: 'No Data', value: 0, percentage: 0 });
        }

        if (visualizations.carrierDistribution.length === 0) {
            visualizations.carrierDistribution.push({ name: 'No Data', value: 0, percentage: 0 });
        }

        if (visualizations.serviceTypeDistribution.length === 0) {
            visualizations.serviceTypeDistribution.push({ name: 'No Data', value: 0, percentage: 0 });
        }

        return visualizations;
    };

    // Add helper function to calculate cost breakdown
    const calculateCostBreakdown = (data, metrics) => {
        const breakdown = [
            { name: 'Base Shipping', value: metrics.totalShippingCost - metrics.totalSurcharges - metrics.totalInsurance - metrics.totalTaxes },
            { name: 'Surcharges', value: metrics.totalSurcharges },
            { name: 'Insurance', value: metrics.totalInsurance },
            { name: 'Taxes', value: metrics.totalTaxes }
        ];

        // Calculate percentages
        const total = breakdown.reduce((sum, item) => sum + item.value, 0);
        return breakdown.map(item => ({
            ...item,
            percentage: total > 0 ? (item.value / total) * 100 : 0
        }));
    };

    // Add helper function to calculate location distribution
    const calculateLocationDistribution = (data, metrics) => {
        const locations = [...new Set(data.map(item => item.origin))];
        return locations.map(location => {
            const locationData = data.filter(item => item.origin === location);
            return {
                name: location,
                shipments: locationData.length,
                value: locationData.reduce((sum, item) => sum + item.value, 0),
                percentage: (locationData.length / data.length) * 100
            };
        });
    };

    // Handle export
    const handleExport = (format) => {
        if (!reportData?.rawData) return [];

        if (format === 'csv') {
            const csvData = reportData.rawData.map(item => ({
                ID: item.id,
                Date: new Date(item.date).toLocaleDateString(),
                Customer: item.customer,
                Carrier: item.carrier,
                Status: item.status,
                Value: formatCurrency(item.value),
                Origin: item.origin,
                Destination: item.destination
            }));
            return csvData;
        }
        // PDF export logic would go here
    };

    // Handle save report
    const handleSaveReport = () => {
        const newReport = {
            id: reportData.rawData.length + 1,
            name: reportConfig.name || 'Untitled Report',
            type: reportConfig.type,
            lastRun: new Date().toISOString().split('T')[0]
        };
        setReportData({
            ...reportData,
            rawData: [...reportData.rawData, newReport]
        });
        setSaveDialogOpen(false);
    };

    const [filters, setFilters] = useState({
        dateRange: '7d',
        status: 'all',
        carriers: [],
        customer: 'all',
        originCity: '',
        destinationCity: '',
        country: 'all',
        shipmentType: 'all'
    });

    return (
        <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1300px', margin: '0 auto' }}>
                {/* Breadcrumb */}
                <Box className="breadcrumb-container">
                    <Link to="/admin/dashboard" className="breadcrumb-link">
                        <HomeIcon className="breadcrumb-icon" />
                        <span>Home</span>
                    </Link>
                    <NavigateNextIcon className="breadcrumb-separator" />
                    <span className="breadcrumb-current">Reports</span>
                </Box>

                {/* Header Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        Reports Dashboard
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<ExportIcon />}
                            onClick={() => setExportDialogOpen(true)}
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
                            Export
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            onClick={() => setSaveDialogOpen(true)}
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
                            Save Report
                        </Button>
                    </Box>
                </Box>

                {/* Main Content */}
                <Paper sx={{ bgcolor: '#ffffff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                    {/* Tabs */}
                    <Tabs
                        value={selectedTab}
                        onChange={(e, newValue) => setSelectedTab(newValue)}
                        sx={{
                            borderBottom: 1,
                            borderColor: '#e2e8f0',
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                fontWeight: 500,
                                color: '#64748b',
                                minWidth: 120
                            },
                            '& .MuiTab-root.Mui-selected': {
                                color: '#3b82f6',
                                fontWeight: 600
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#3b82f6',
                                height: 3
                            }
                        }}
                    >
                        <Tab label="Report Builder" value="builder" />
                        <Tab label="Saved Reports" value="saved" />
                        <Tab label="Report History" value="history" />
                    </Tabs>

                    {/* Report Builder Tab */}
                    {selectedTab === 'builder' && (
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                                {/* Report Configuration */}
                                <Grid item xs={12} md={4}>
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
                                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                            Report Configuration
                                        </Typography>
                                        <Stack spacing={3}>
                                            <TextField
                                                label="Report Name"
                                                value={reportConfig.name}
                                                onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
                                                fullWidth
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2
                                                    }
                                                }}
                                            />
                                            <FormControl fullWidth>
                                                <InputLabel>Report Type</InputLabel>
                                                <Select
                                                    value={reportConfig.type}
                                                    onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value })}
                                                    label="Report Type"
                                                    sx={{
                                                        borderRadius: 2
                                                    }}
                                                >
                                                    <MenuItem value="shipments">Shipments Analysis</MenuItem>
                                                    <MenuItem value="customers">Customer Analysis</MenuItem>
                                                    <MenuItem value="performance">Performance Metrics</MenuItem>
                                                </Select>
                                            </FormControl>

                                            <Button
                                                variant="contained"
                                                onClick={handleGenerateReport}
                                                disabled={loading}
                                                sx={{
                                                    bgcolor: '#0f172a',
                                                    '&:hover': { bgcolor: '#1e293b' },
                                                    borderRadius: 2,
                                                    textTransform: 'none',
                                                    fontWeight: 500
                                                }}
                                            >
                                                {loading ? 'Generating...' : 'Generate Report'}
                                            </Button>
                                        </Stack>
                                    </Paper>
                                </Grid>

                                {/* Filters - Now spans 8 columns */}
                                <Grid item xs={12} md={8}>
                                    <Paper sx={{ p: 3, mb: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <FilterIcon sx={{ mr: 1, color: 'primary.main' }} />
                                            <Typography variant="h6">Filters</Typography>
                                        </Box>
                                        <Grid container spacing={2}>
                                            {/* Date Range */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth>
                                                    <InputLabel>Date Range</InputLabel>
                                                    <Select
                                                        value={filters.dateRange}
                                                        onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                                                        label="Date Range"
                                                    >
                                                        <MenuItem value="7d">Last 7 Days</MenuItem>
                                                        <MenuItem value="30d">Last 30 Days</MenuItem>
                                                        <MenuItem value="90d">Last 90 Days</MenuItem>
                                                        <MenuItem value="custom">Custom Range</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Status */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth>
                                                    <InputLabel>Status</InputLabel>
                                                    <Select
                                                        value={filters.status}
                                                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                                        label="Status"
                                                    >
                                                        <MenuItem value="all">All Statuses</MenuItem>
                                                        <MenuItem value="pending">Pending</MenuItem>
                                                        <MenuItem value="in_transit">In Transit</MenuItem>
                                                        <MenuItem value="delivered">Delivered</MenuItem>
                                                        <MenuItem value="cancelled">Cancelled</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Carriers */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth>
                                                    <InputLabel id="carriers-label">Carriers</InputLabel>
                                                    <Select
                                                        labelId="carriers-label"
                                                        multiple
                                                        value={filters.carriers}
                                                        onChange={(e) => setFilters({ ...filters, carriers: e.target.value })}
                                                        label="Carriers"
                                                        renderValue={(selected) => (
                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                {selected.map((value) => (
                                                                    <Chip key={value} label={value} />
                                                                ))}
                                                            </Box>
                                                        )}
                                                        sx={{
                                                            '& .MuiInputLabel-root': {
                                                                backgroundColor: '#ffffff',
                                                                px: 1,
                                                                color: '#64748b'
                                                            }
                                                        }}
                                                    >
                                                        <MenuItem value="fedex">FedEx</MenuItem>
                                                        <MenuItem value="ups">UPS</MenuItem>
                                                        <MenuItem value="usps">USPS</MenuItem>
                                                        <MenuItem value="dhl">DHL</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Customer */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth>
                                                    <InputLabel>Customer</InputLabel>
                                                    <Select
                                                        value={filters.customer}
                                                        onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
                                                        label="Customer"
                                                    >
                                                        <MenuItem value="all">All Customers</MenuItem>
                                                        <MenuItem value="customer1">Customer 1</MenuItem>
                                                        <MenuItem value="customer2">Customer 2</MenuItem>
                                                        <MenuItem value="customer3">Customer 3</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Origin City */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Origin City"
                                                    value={filters.originCity}
                                                    onChange={(e) => setFilters({ ...filters, originCity: e.target.value })}
                                                    placeholder="Enter origin city"
                                                />
                                            </Grid>

                                            {/* Destination City */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Destination City"
                                                    value={filters.destinationCity}
                                                    onChange={(e) => setFilters({ ...filters, destinationCity: e.target.value })}
                                                    placeholder="Enter destination city"
                                                />
                                            </Grid>

                                            {/* Country */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth>
                                                    <InputLabel>Country</InputLabel>
                                                    <Select
                                                        value={filters.country}
                                                        onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                                                        label="Country"
                                                    >
                                                        <MenuItem value="all">All Countries</MenuItem>
                                                        <MenuItem value="usa">USA</MenuItem>
                                                        <MenuItem value="canada">Canada</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Shipment Type */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth>
                                                    <InputLabel>Shipment Type</InputLabel>
                                                    <Select
                                                        value={filters.shipmentType}
                                                        onChange={(e) => setFilters({ ...filters, shipmentType: e.target.value })}
                                                        label="Shipment Type"
                                                    >
                                                        <MenuItem value="all">All Types</MenuItem>
                                                        <MenuItem value="courier">Courier</MenuItem>
                                                        <MenuItem value="freight">Freight</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Filter Actions */}
                                            <Grid item xs={12}>
                                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => setFilters({
                                                            dateRange: '7d',
                                                            status: 'all',
                                                            carriers: [],
                                                            customer: 'all',
                                                            originCity: '',
                                                            destinationCity: '',
                                                            country: 'all',
                                                            shipmentType: 'all'
                                                        })}
                                                    >
                                                        Reset Filters
                                                    </Button>
                                                    <Button
                                                        variant="contained"
                                                        onClick={() => {
                                                            // Apply filters logic here
                                                            console.log('Applying filters:', filters);
                                                        }}
                                                    >
                                                        Apply Filters
                                                    </Button>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                </Grid>
                            </Grid>

                            {/* Report Results */}
                            {reportData && (
                                <Box sx={{ mt: 4 }}>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                        Report Results
                                    </Typography>

                                    {/* Metrics Summary */}
                                    <Grid container spacing={3} sx={{ mb: 4 }}>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Paper sx={{
                                                p: 2,
                                                bgcolor: '#ffffff',
                                                boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
                                                borderRadius: 2
                                            }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Box>
                                                        <Typography variant="subtitle1" sx={{ color: '#64748b' }}>
                                                            Total Shipments
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                            {reportData.rawData.length}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ color: '#3b82f6' }}>
                                                        <ShippingIcon fontSize="medium" />
                                                    </Box>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Paper sx={{
                                                p: 2,
                                                bgcolor: '#ffffff',
                                                boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
                                                borderRadius: 2
                                            }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Box>
                                                        <Typography variant="subtitle1" sx={{ color: '#64748b' }}>
                                                            Waiting for Pickup
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                            {reportData.rawData.filter(item => item.status === 'AWAITING_SHIPMENT').length}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ color: '#3b82f6' }}>
                                                        <ScheduleIcon fontSize="medium" />
                                                    </Box>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Paper sx={{
                                                p: 2,
                                                bgcolor: '#ffffff',
                                                boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
                                                borderRadius: 2
                                            }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Box>
                                                        <Typography variant="subtitle1" sx={{ color: '#64748b' }}>
                                                            In Transit
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                            {reportData.rawData.filter(item => item.status === 'IN_TRANSIT').length}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ color: '#3b82f6' }}>
                                                        <ShippingIcon fontSize="medium" />
                                                    </Box>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Paper sx={{
                                                p: 2,
                                                bgcolor: '#ffffff',
                                                boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
                                                borderRadius: 2
                                            }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Box>
                                                        <Typography variant="subtitle1" sx={{ color: '#64748b' }}>
                                                            Delivered
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                            {reportData.rawData.filter(item => item.status === 'DELIVERED').length}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ color: '#3b82f6' }}>
                                                        <CheckCircleIcon fontSize="medium" />
                                                    </Box>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    </Grid>

                                    {/* Visualizations */}
                                    <Grid container spacing={3}>
                                        {/* Shipment Trends */}
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
                                                            {reportData.rawData.length} Total Shipments
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ height: 300 }}>
                                                    <LineChart
                                                        dataset={reportData.visualizations.shipmentTrends.dataset}
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
                                                            max: Math.max(...reportData.visualizations.shipmentTrends.dataset.map(item => item.value)) + 2,
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
                                                    />
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Carrier Distribution */}
                                        <Grid item xs={12} md={4}>
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
                                                        Carrier Shipments
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
                                                            {reportData.rawData.length} Total Shipments
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ height: 300 }}>
                                                    {reportData.visualizations.carrierDistribution && reportData.visualizations.carrierDistribution.length > 0 && (
                                                        <BarChart
                                                            xAxis={[{
                                                                scaleType: 'linear',
                                                                data: reportData.visualizations.carrierDistribution.map(item => item.value),
                                                                tickLabelStyle: {
                                                                    angle: 0,
                                                                    textAnchor: 'end',
                                                                    fontSize: 12,
                                                                    fill: '#64748b'
                                                                },
                                                                position: 'bottom',
                                                                tickSize: 0,
                                                                axisLine: { stroke: '#e2e8f0' }
                                                            }]}
                                                            yAxis={[{
                                                                scaleType: 'band',
                                                                data: reportData.visualizations.carrierDistribution.map(item => item.name),
                                                                tickLabelStyle: {
                                                                    angle: 0,
                                                                    textAnchor: 'end',
                                                                    fontSize: 12,
                                                                    fill: '#64748b'
                                                                },
                                                                position: 'left',
                                                                tickSize: 0,
                                                                axisLine: { stroke: '#e2e8f0' }
                                                            }]}
                                                            series={[{
                                                                data: reportData.visualizations.carrierDistribution.map(item => item.value),
                                                                color: '#3b82f6'
                                                            }]}
                                                            height={300}
                                                            layout="horizontal"
                                                            margin={{ left: 100, right: 20, top: 20, bottom: 40 }}
                                                            sx={{
                                                                '.MuiBarElement-root': {
                                                                    transition: 'all 0.2s ease-in-out',
                                                                    '&:hover': {
                                                                        fill: '#2563eb'
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
                                                        />
                                                    )}
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    </Grid>

                                    {/* Detailed Data Table */}
                                    <Paper sx={{ mt: 4, overflow: 'hidden' }}>
                                        <TableContainer>
                                            <Table>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>ID</TableCell>
                                                        <TableCell>CUSTOMER</TableCell>
                                                        <TableCell>ORIGIN</TableCell>
                                                        <TableCell>DESTINATION</TableCell>
                                                        <TableCell>CARRIER</TableCell>
                                                        <TableCell>TYPE</TableCell>
                                                        <TableCell>STATUS</TableCell>
                                                        <TableCell align="right">ACTIONS</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {reportData.rawData
                                                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                        .map((row) => (
                                                            <TableRow
                                                                hover
                                                                key={row.id}
                                                                onClick={() => navigate(`/shipment/${row.id}`)}
                                                                sx={{ cursor: 'pointer' }}
                                                            >
                                                                <TableCell>
                                                                    <Typography
                                                                        sx={{
                                                                            color: '#3b82f6',
                                                                            textDecoration: 'none',
                                                                            fontWeight: 500
                                                                        }}
                                                                    >
                                                                        {row.id}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell>{row.customer}</TableCell>
                                                                <TableCell>{row.origin}</TableCell>
                                                                <TableCell>{row.destination}</TableCell>
                                                                <TableCell>{row.carrier}</TableCell>
                                                                <TableCell>{row.type}</TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={row.status}
                                                                        color={
                                                                            row.status === 'Delivered' ? 'success' :
                                                                                row.status === 'In Transit' ? 'primary' :
                                                                                    'default'
                                                                        }
                                                                        size="small"
                                                                    />
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <IconButton
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            // Handle action menu open
                                                                        }}
                                                                        size="small"
                                                                    >
                                                                        <MoreVertIcon />
                                                                    </IconButton>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                        <TablePagination
                                            component="div"
                                            count={reportData.rawData.length}
                                            page={page}
                                            onPageChange={(e, newPage) => setPage(newPage)}
                                            rowsPerPage={rowsPerPage}
                                            onRowsPerPageChange={(e) => {
                                                setRowsPerPage(parseInt(e.target.value, 10));
                                                setPage(0);
                                            }}
                                            rowsPerPageOptions={[10, 25, 50, 100]}
                                        />
                                    </Paper>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Saved Reports Tab */}
                    {selectedTab === 'saved' && (
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                                {reportData.rawData.map((report) => (
                                    <Grid item xs={12} md={6} key={report.id}>
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
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                                    {report.name}
                                                </Typography>
                                                <Box>
                                                    <IconButton size="small" sx={{ color: '#64748b' }}>
                                                        <EditIcon />
                                                    </IconButton>
                                                    <IconButton size="small" sx={{ color: '#64748b' }}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                                                Type: {report.type}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                                Last Run: {new Date(report.date).toLocaleDateString()}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                startIcon={<RefreshIcon />}
                                                sx={{
                                                    mt: 2,
                                                    color: '#64748b',
                                                    borderColor: '#e2e8f0',
                                                    bgcolor: '#ffffff',
                                                    '&:hover': {
                                                        borderColor: '#cbd5e1',
                                                        bgcolor: '#f8fafc'
                                                    }
                                                }}
                                            >
                                                Run Report
                                            </Button>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}

                    {/* Report History Tab */}
                    {selectedTab === 'history' && (
                        <Box sx={{ p: 3 }}>
                            <Typography variant="body1" sx={{ color: '#64748b' }}>
                                Report history will be displayed here.
                            </Typography>
                        </Box>
                    )}
                </Paper>

                {/* Export Dialog */}
                <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
                    <DialogTitle>Export Report</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 2 }}>
                            <Button
                                variant="outlined"
                                component={CSVLink}
                                data={handleExport('csv')}
                                filename="report.csv"
                                sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                            >
                                Export as CSV
                            </Button>
                            <Button
                                variant="outlined"
                                component={PDFDownloadLink}
                                document={<div>PDF Report</div>}
                                fileName="report.pdf"
                                sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                            >
                                Export as PDF
                            </Button>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                    </DialogActions>
                </Dialog>

                {/* Save Report Dialog */}
                <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
                    <DialogTitle>Save Report</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Report Name"
                            fullWidth
                            value={reportConfig.name}
                            onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveReport}>Save</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default Reports; 