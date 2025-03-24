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
    Alert
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
    Category as CategoryIcon
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

const Reports = () => {
    // State for report configuration
    const [reportConfig, setReportConfig] = useState({
        name: '',
        type: 'shipments',
        dateRange: [null, null],
        filters: {
            status: [],
            carriers: [],
            customers: [],
            locations: [],
            valueRange: [0, 100000],
            categories: []
        },
        metrics: {
            totalShipments: true,
            totalValue: true,
            averageValue: true,
            onTimeDelivery: true,
            customerDistribution: true,
            carrierDistribution: true,
            locationDistribution: true,
            categoryDistribution: true
        },
        visualization: {
            type: 'table',
            chartType: 'bar'
        }
    });

    // State for saved reports
    const [savedReports, setSavedReports] = useState([
        {
            id: 1,
            name: 'Monthly Shipment Analysis',
            type: 'shipments',
            lastRun: '2024-03-20'
        },
        {
            id: 2,
            name: 'Customer Performance Report',
            type: 'customers',
            lastRun: '2024-03-19'
        }
    ]);

    // State for report data
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // State for UI
    const [selectedTab, setSelectedTab] = useState('builder');
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Dummy data for demonstration
    const dummyData = useMemo(() => {
        const generateData = (count) => {
            const data = [];
            const customers = [
                'Acme Corp',
                'Tech Solutions',
                'Global Industries',
                'Retail Plus',
                'Manufacturing Co',
                'Healthcare Systems',
                'Food Distribution',
                'Electronics Retail',
                'Fashion Outlet',
                'Construction Supply'
            ];
            const carriers = ['FedEx', 'UPS', 'DHL', 'USPS'];
            const statuses = ['Delivered', 'In Transit', 'Delayed'];
            const categories = ['Electronics', 'Furniture', 'Clothing', 'Food', 'Medical Supplies', 'Construction Materials', 'Automotive Parts'];
            const origins = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Miami, FL'];
            const destinations = ['San Francisco, CA', 'Seattle, WA', 'Boston, MA', 'Dallas, TX', 'Atlanta, GA'];

            // Generate dates for the last 30 days
            const today = new Date();
            const dates = Array.from({ length: 30 }, (_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                return date;
            }).reverse();

            // Generate shipments with realistic patterns
            for (let i = 0; i < count; i++) {
                const date = dates[Math.floor(Math.random() * dates.length)];
                const customer = customers[Math.floor(Math.random() * customers.length)];
                const carrier = carriers[Math.floor(Math.random() * carriers.length)];
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                const category = categories[Math.floor(Math.random() * categories.length)];

                // Generate realistic value based on category
                let value;
                switch (category) {
                    case 'Electronics':
                        value = Math.floor(Math.random() * 5000) + 1000;
                        break;
                    case 'Furniture':
                        value = Math.floor(Math.random() * 3000) + 500;
                        break;
                    case 'Clothing':
                        value = Math.floor(Math.random() * 2000) + 200;
                        break;
                    case 'Food':
                        value = Math.floor(Math.random() * 1500) + 300;
                        break;
                    case 'Medical Supplies':
                        value = Math.floor(Math.random() * 8000) + 2000;
                        break;
                    case 'Construction Materials':
                        value = Math.floor(Math.random() * 4000) + 800;
                        break;
                    case 'Automotive Parts':
                        value = Math.floor(Math.random() * 3500) + 600;
                        break;
                    default:
                        value = Math.floor(Math.random() * 3000) + 500;
                }

                const origin = origins[Math.floor(Math.random() * origins.length)];
                const destination = destinations[Math.floor(Math.random() * destinations.length)];

                data.push({
                    id: `SHIP${String(i + 1).padStart(6, '0')}`,
                    date: date,
                    customer: customer,
                    carrier: carrier,
                    status: status,
                    category: category,
                    value: value,
                    origin: origin,
                    destination: destination
                });
            }

            // Sort data by date
            return data.sort((a, b) => a.date - b.date);
        };

        return generateData(150); // Increased number of records for better visualization
    }, []);

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

    // Handle report generation
    const handleGenerateReport = async () => {
        setLoading(true);
        setError(null);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Filter data based on report configuration
            let filteredData = [...dummyData];

            // Apply date range filter
            if (reportConfig.dateRange[0] && reportConfig.dateRange[1]) {
                filteredData = filteredData.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= reportConfig.dateRange[0] && itemDate <= reportConfig.dateRange[1];
                });
            }

            // Apply status filter
            if (reportConfig.filters.status.length > 0) {
                filteredData = filteredData.filter(item =>
                    reportConfig.filters.status.includes(item.status)
                );
            }

            // Apply carrier filter
            if (reportConfig.filters.carriers.length > 0) {
                filteredData = filteredData.filter(item =>
                    reportConfig.filters.carriers.includes(item.carrier)
                );
            }

            // Apply value range filter
            filteredData = filteredData.filter(item =>
                item.value >= reportConfig.filters.valueRange[0] &&
                item.value <= reportConfig.filters.valueRange[1]
            );

            // Calculate metrics
            const metrics = {
                totalShipments: filteredData.length,
                totalValue: filteredData.reduce((sum, item) => sum + item.value, 0),
                averageValue: filteredData.reduce((sum, item) => sum + item.value, 0) / filteredData.length,
                onTimeDelivery: (filteredData.filter(item => item.status === 'Delivered').length / filteredData.length) * 100,
                customerDistribution: calculateDistribution(filteredData, 'customer'),
                carrierDistribution: calculateDistribution(filteredData, 'carrier'),
                categoryDistribution: calculateDistribution(filteredData, 'category')
            };

            setReportData({
                rawData: filteredData,
                metrics,
                visualizations: generateVisualizations(filteredData, metrics)
            });
        } catch (err) {
            setError('Failed to generate report. Please try again.');
        } finally {
            setLoading(false);
        }
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
                dates: [...new Set(data.map(item => item.date.toISOString().split('T')[0]))].sort(),
                counts: [],
                values: []
            },
            customerPerformance: metrics.customerDistribution,
            carrierDistribution: metrics.carrierDistribution,
            categoryDistribution: metrics.categoryDistribution
        };

        // Calculate daily trends
        visualizations.shipmentTrends.dates.forEach(date => {
            const dayData = data.filter(item => item.date.toISOString().split('T')[0] === date);
            visualizations.shipmentTrends.counts.push(dayData.length);
            visualizations.shipmentTrends.values.push(dayData.reduce((sum, item) => sum + item.value, 0));
        });

        return visualizations;
    };

    // Handle export
    const handleExport = (format) => {
        if (format === 'csv') {
            const csvData = reportData.rawData.map(item => ({
                ID: item.id,
                Date: item.date.toLocaleDateString(),
                Customer: item.customer,
                Carrier: item.carrier,
                Status: item.status,
                Category: item.category,
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
            id: savedReports.length + 1,
            name: reportConfig.name || 'Untitled Report',
            type: reportConfig.type,
            lastRun: new Date().toISOString().split('T')[0]
        };
        setSavedReports([...savedReports, newReport]);
        setSaveDialogOpen(false);
    };

    return (
        <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
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
                            sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                        >
                            Export
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            onClick={() => setSaveDialogOpen(true)}
                            sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                        >
                            Save Report
                        </Button>
                    </Box>
                </Box>

                {/* Main Content */}
                <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                    <Tabs
                        value={selectedTab}
                        onChange={(e, newValue) => setSelectedTab(newValue)}
                        sx={{ borderBottom: 1, borderColor: '#e2e8f0' }}
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
                                    <Paper sx={{ p: 3, bgcolor: '#f8fafc' }}>
                                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                            Report Configuration
                                        </Typography>
                                        <Stack spacing={3}>
                                            <TextField
                                                label="Report Name"
                                                value={reportConfig.name}
                                                onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
                                                fullWidth
                                            />
                                            <FormControl fullWidth>
                                                <InputLabel>Report Type</InputLabel>
                                                <Select
                                                    value={reportConfig.type}
                                                    onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value })}
                                                    label="Report Type"
                                                >
                                                    <MenuItem value="shipments">Shipments Analysis</MenuItem>
                                                    <MenuItem value="customers">Customer Analysis</MenuItem>
                                                    <MenuItem value="performance">Performance Metrics</MenuItem>
                                                </Select>
                                            </FormControl>

                                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                                <DatePicker
                                                    label="Date Range"
                                                    value={reportConfig.dateRange}
                                                    onChange={(newValue) => setReportConfig({ ...reportConfig, dateRange: newValue })}
                                                    renderInput={(startProps, endProps) => (
                                                        <Stack direction="row" spacing={2}>
                                                            <TextField {...startProps} />
                                                            <TextField {...endProps} />
                                                        </Stack>
                                                    )}
                                                />
                                            </LocalizationProvider>

                                            <FormControl fullWidth>
                                                <InputLabel>Visualization Type</InputLabel>
                                                <Select
                                                    value={reportConfig.visualization.type}
                                                    onChange={(e) => setReportConfig({ ...reportConfig, visualization: { ...reportConfig.visualization, type: e.target.value } })}
                                                    label="Visualization Type"
                                                >
                                                    <MenuItem value="table">Table</MenuItem>
                                                    <MenuItem value="chart">Chart</MenuItem>
                                                    <MenuItem value="both">Both</MenuItem>
                                                </Select>
                                            </FormControl>

                                            <Button
                                                variant="contained"
                                                onClick={handleGenerateReport}
                                                disabled={loading}
                                                sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
                                            >
                                                {loading ? 'Generating...' : 'Generate Report'}
                                            </Button>
                                        </Stack>
                                    </Paper>
                                </Grid>

                                {/* Filters */}
                                <Grid item xs={12} md={4}>
                                    <Paper sx={{ p: 3, bgcolor: '#f8fafc' }}>
                                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                            Filters
                                        </Typography>
                                        <Stack spacing={3}>
                                            <FormControl fullWidth>
                                                <InputLabel>Status</InputLabel>
                                                <Select
                                                    multiple
                                                    value={reportConfig.filters.status}
                                                    onChange={(e) => setReportConfig({
                                                        ...reportConfig,
                                                        filters: { ...reportConfig.filters, status: e.target.value }
                                                    })}
                                                    label="Status"
                                                >
                                                    <MenuItem value="Delivered">Delivered</MenuItem>
                                                    <MenuItem value="In Transit">In Transit</MenuItem>
                                                    <MenuItem value="Delayed">Delayed</MenuItem>
                                                </Select>
                                            </FormControl>

                                            <FormControl fullWidth>
                                                <InputLabel>Carriers</InputLabel>
                                                <Select
                                                    multiple
                                                    value={reportConfig.filters.carriers}
                                                    onChange={(e) => setReportConfig({
                                                        ...reportConfig,
                                                        filters: { ...reportConfig.filters, carriers: e.target.value }
                                                    })}
                                                    label="Carriers"
                                                >
                                                    <MenuItem value="FedEx">FedEx</MenuItem>
                                                    <MenuItem value="UPS">UPS</MenuItem>
                                                    <MenuItem value="DHL">DHL</MenuItem>
                                                    <MenuItem value="USPS">USPS</MenuItem>
                                                </Select>
                                            </FormControl>

                                            <FormControl fullWidth>
                                                <InputLabel>Categories</InputLabel>
                                                <Select
                                                    multiple
                                                    value={reportConfig.filters.categories}
                                                    onChange={(e) => setReportConfig({
                                                        ...reportConfig,
                                                        filters: { ...reportConfig.filters, categories: e.target.value }
                                                    })}
                                                    label="Categories"
                                                >
                                                    <MenuItem value="Electronics">Electronics</MenuItem>
                                                    <MenuItem value="Furniture">Furniture</MenuItem>
                                                    <MenuItem value="Clothing">Clothing</MenuItem>
                                                    <MenuItem value="Food">Food</MenuItem>
                                                    <MenuItem value="Medical Supplies">Medical Supplies</MenuItem>
                                                </Select>
                                            </FormControl>

                                            <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                                                Value Range
                                            </Typography>
                                            <Stack direction="row" spacing={2}>
                                                <TextField
                                                    type="number"
                                                    label="Min"
                                                    value={reportConfig.filters.valueRange[0]}
                                                    onChange={(e) => setReportConfig({
                                                        ...reportConfig,
                                                        filters: {
                                                            ...reportConfig.filters,
                                                            valueRange: [parseInt(e.target.value), reportConfig.filters.valueRange[1]]
                                                        }
                                                    })}
                                                />
                                                <TextField
                                                    type="number"
                                                    label="Max"
                                                    value={reportConfig.filters.valueRange[1]}
                                                    onChange={(e) => setReportConfig({
                                                        ...reportConfig,
                                                        filters: {
                                                            ...reportConfig.filters,
                                                            valueRange: [reportConfig.filters.valueRange[0], parseInt(e.target.value)]
                                                        }
                                                    })}
                                                />
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                </Grid>

                                {/* Metrics Selection */}
                                <Grid item xs={12} md={4}>
                                    <Paper sx={{ p: 3, bgcolor: '#f8fafc' }}>
                                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                            Metrics
                                        </Typography>
                                        <FormGroup>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={reportConfig.metrics.totalShipments}
                                                        onChange={(e) => setReportConfig({
                                                            ...reportConfig,
                                                            metrics: { ...reportConfig.metrics, totalShipments: e.target.checked }
                                                        })}
                                                    />
                                                }
                                                label="Total Shipments"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={reportConfig.metrics.totalValue}
                                                        onChange={(e) => setReportConfig({
                                                            ...reportConfig,
                                                            metrics: { ...reportConfig.metrics, totalValue: e.target.checked }
                                                        })}
                                                    />
                                                }
                                                label="Total Value"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={reportConfig.metrics.averageValue}
                                                        onChange={(e) => setReportConfig({
                                                            ...reportConfig,
                                                            metrics: { ...reportConfig.metrics, averageValue: e.target.checked }
                                                        })}
                                                    />
                                                }
                                                label="Average Value"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={reportConfig.metrics.onTimeDelivery}
                                                        onChange={(e) => setReportConfig({
                                                            ...reportConfig,
                                                            metrics: { ...reportConfig.metrics, onTimeDelivery: e.target.checked }
                                                        })}
                                                    />
                                                }
                                                label="On-Time Delivery Rate"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={reportConfig.metrics.customerDistribution}
                                                        onChange={(e) => setReportConfig({
                                                            ...reportConfig,
                                                            metrics: { ...reportConfig.metrics, customerDistribution: e.target.checked }
                                                        })}
                                                    />
                                                }
                                                label="Customer Distribution"
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={reportConfig.metrics.carrierDistribution}
                                                        onChange={(e) => setReportConfig({
                                                            ...reportConfig,
                                                            metrics: { ...reportConfig.metrics, carrierDistribution: e.target.checked }
                                                        })}
                                                    />
                                                }
                                                label="Carrier Distribution"
                                            />
                                        </FormGroup>
                                    </Paper>
                                </Grid>
                            </Grid>

                            {/* Report Results */}
                            {reportData ? (
                                <Box sx={{ mt: 4 }}>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                        Report Results
                                    </Typography>

                                    {/* Metrics Summary */}
                                    <Grid container spacing={3} sx={{ mb: 4 }}>
                                        <Grid item xs={12} md={3}>
                                            <Paper sx={{ p: 2, bgcolor: '#f8fafc' }}>
                                                <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                                                    Total Shipments
                                                </Typography>
                                                <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                    {formatNumber(reportData.metrics.totalShipments)}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Paper sx={{ p: 2, bgcolor: '#f8fafc' }}>
                                                <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                                                    Total Value
                                                </Typography>
                                                <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                    {formatCurrency(reportData.metrics.totalValue)}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Paper sx={{ p: 2, bgcolor: '#f8fafc' }}>
                                                <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                                                    Average Value
                                                </Typography>
                                                <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                    {formatCurrency(reportData.metrics.averageValue)}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Paper sx={{ p: 2, bgcolor: '#f8fafc' }}>
                                                <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                                                    On-Time Delivery
                                                </Typography>
                                                <Typography variant="h4" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                    {formatNumber(reportData.metrics.onTimeDelivery)}%
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                    </Grid>

                                    {/* Visualizations */}
                                    <Grid container spacing={3}>
                                        {/* Shipment Trends */}
                                        <Grid item xs={12} md={8}>
                                            <Paper sx={{ p: 3, bgcolor: '#ffffff' }}>
                                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                                    Shipment Trends
                                                </Typography>
                                                <Box sx={{ height: 300 }}>
                                                    <LineChart
                                                        xAxis={[{ data: reportData.visualizations.shipmentTrends.dates.map((_, i) => i), scaleType: 'linear' }]}
                                                        series={[
                                                            {
                                                                data: reportData.visualizations.shipmentTrends.counts,
                                                                label: 'Shipments',
                                                                color: '#3b82f6'
                                                            },
                                                            {
                                                                data: reportData.visualizations.shipmentTrends.values.map(v => v / 100),
                                                                label: 'Value (hundreds)',
                                                                color: '#10b981'
                                                            }
                                                        ]}
                                                        height={300}
                                                    />
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Carrier Distribution */}
                                        <Grid item xs={12} md={4}>
                                            <Paper sx={{ p: 3, bgcolor: '#ffffff' }}>
                                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                                    Carrier Distribution
                                                </Typography>
                                                <Box sx={{ height: 300 }}>
                                                    <PieChart
                                                        series={[
                                                            {
                                                                data: reportData.visualizations.carrierDistribution.map(item => ({
                                                                    id: item.name,
                                                                    value: item.value,
                                                                    label: `${item.name} (${item.percentage.toFixed(1)}%)`
                                                                })),
                                                                highlightScope: { faded: 'global', highlighted: 'item' },
                                                                faded: { innerRadius: 30, additionalRadius: -30 }
                                                            }
                                                        ]}
                                                        height={300}
                                                    />
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Category Distribution */}
                                        <Grid item xs={12} md={6}>
                                            <Paper sx={{ p: 3, bgcolor: '#ffffff' }}>
                                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                                    Category Distribution
                                                </Typography>
                                                <Box sx={{ height: 300 }}>
                                                    <BarChart
                                                        xAxis={[{
                                                            scaleType: 'band',
                                                            data: reportData.visualizations.categoryDistribution.map(item => item.name)
                                                        }]}
                                                        series={[{
                                                            data: reportData.visualizations.categoryDistribution.map(item => item.value),
                                                            color: '#3b82f6'
                                                        }]}
                                                        height={300}
                                                    />
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Customer Performance */}
                                        <Grid item xs={12} md={6}>
                                            <Paper sx={{ p: 3, bgcolor: '#ffffff' }}>
                                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1e293b' }}>
                                                    Customer Performance
                                                </Typography>
                                                <Box sx={{ height: 300 }}>
                                                    <BarChart
                                                        xAxis={[{
                                                            scaleType: 'band',
                                                            data: reportData.visualizations.customerPerformance.map(item => item.name)
                                                        }]}
                                                        series={[{
                                                            data: reportData.visualizations.customerPerformance.map(item => item.value),
                                                            color: '#10b981'
                                                        }]}
                                                        height={300}
                                                    />
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    </Grid>

                                    {/* Detailed Data Table */}
                                    <Paper sx={{ mt: 4, bgcolor: '#ffffff' }}>
                                        <TableContainer>
                                            <Table>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>ID</TableCell>
                                                        <TableCell>Date</TableCell>
                                                        <TableCell>Customer</TableCell>
                                                        <TableCell>Carrier</TableCell>
                                                        <TableCell>Status</TableCell>
                                                        <TableCell>Category</TableCell>
                                                        <TableCell>Value</TableCell>
                                                        <TableCell>Origin</TableCell>
                                                        <TableCell>Destination</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {reportData?.rawData ? (
                                                        reportData.rawData
                                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                            .map((row) => (
                                                                <TableRow key={row.id}>
                                                                    <TableCell>{row.id}</TableCell>
                                                                    <TableCell>{row.date.toLocaleDateString()}</TableCell>
                                                                    <TableCell>{row.customer}</TableCell>
                                                                    <TableCell>{row.carrier}</TableCell>
                                                                    <TableCell>
                                                                        <Chip
                                                                            label={row.status}
                                                                            color={
                                                                                row.status === 'Delivered' ? 'success' :
                                                                                    row.status === 'In Transit' ? 'primary' :
                                                                                        'default'
                                                                            }
                                                                            size="small"
                                                                            sx={{
                                                                                bgcolor: row.status === 'Delivered' ? '#f0fdf4' :
                                                                                    row.status === 'In Transit' ? '#eff6ff' :
                                                                                        '#f1f5f9',
                                                                                color: row.status === 'Delivered' ? '#10b981' :
                                                                                    row.status === 'In Transit' ? '#3b82f6' :
                                                                                        '#64748b',
                                                                                fontWeight: 500
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>{row.category}</TableCell>
                                                                    <TableCell>{formatCurrency(row.value)}</TableCell>
                                                                    <TableCell>{row.origin}</TableCell>
                                                                    <TableCell>{row.destination}</TableCell>
                                                                </TableRow>
                                                            ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={9} align="center">
                                                                <Typography variant="body2" sx={{ color: '#64748b', py: 2 }}>
                                                                    No data available
                                                                </Typography>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                        {reportData?.rawData && (
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
                                        )}
                                    </Paper>
                                </Box>
                            ) : (
                                <Box sx={{ mt: 4, textAlign: 'center', py: 8 }}>
                                    <Typography variant="h6" sx={{ color: '#64748b', mb: 2 }}>
                                        No Report Data Available
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                                        Configure your report settings and click "Generate Report" to view the data.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Saved Reports Tab */}
                    {selectedTab === 'saved' && (
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                                {savedReports.map((report) => (
                                    <Grid item xs={12} md={6} key={report.id}>
                                        <Paper sx={{ p: 3, bgcolor: '#ffffff' }}>
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
                                                Last Run: {report.lastRun}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                startIcon={<RefreshIcon />}
                                                sx={{ mt: 2, color: '#64748b', borderColor: '#e2e8f0' }}
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