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
    Schedule as ScheduleIcon,
    Assessment as AssessmentIcon,
    ArrowBack as ArrowBackIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './Reports.css';

// Import common components
import ModalHeader from '../common/ModalHeader';

const Reports = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const [selectedTab, setSelectedTab] = useState('generate');
    const [reportType, setReportType] = useState('shipment-summary');
    const [dateRange, setDateRange] = useState('last-30-days');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [selectedCarriers, setSelectedCarriers] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedReports, setSavedReports] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Mock data for demonstration
    const reportTypes = [
        { value: 'shipment-summary', label: 'Shipment Summary' },
        { value: 'carrier-performance', label: 'Carrier Performance' },
        { value: 'cost-analysis', label: 'Cost Analysis' },
        { value: 'delivery-performance', label: 'Delivery Performance' },
        { value: 'customer-activity', label: 'Customer Activity' }
    ];

    const carriers = ['FedEx', 'UPS', 'DHL', 'eShipPlus', 'Canpar'];
    const statuses = ['Delivered', 'In Transit', 'Pending', 'Cancelled'];

    const mockSavedReports = [
        {
            id: 1,
            name: 'Monthly Shipment Summary',
            type: 'Shipment Summary',
            dateCreated: '2024-01-15',
            lastRun: '2024-01-20',
            schedule: 'Monthly'
        },
        {
            id: 2,
            name: 'Carrier Performance Q1',
            type: 'Carrier Performance',
            dateCreated: '2024-01-10',
            lastRun: '2024-01-18',
            schedule: 'One-time'
        }
    ];

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleGenerateReport = () => {
        setIsGenerating(true);
        // Simulate report generation
        setTimeout(() => {
            setIsGenerating(false);
            // Add logic to generate and download report
        }, 2000);
    };

    const handleCarrierChange = (carrier) => {
        setSelectedCarriers(prev =>
            prev.includes(carrier)
                ? prev.filter(c => c !== carrier)
                : [...prev, carrier]
        );
    };

    const handleStatusChange = (status) => {
        setSelectedStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    return (
        <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Modal Header */}
                {isModal && (
                    <ModalHeader
                        title="Reports"
                        onClose={showCloseButton ? onClose : null}
                        showCloseButton={showCloseButton}
                    />
                )}

                <Box sx={{
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                    p: 3
                }}>
                    {/* Regular Header (when not in modal) */}
                    {!isModal && (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h4" component="h1" gutterBottom>
                                Reports
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Generate and manage your shipping reports
                            </Typography>
                        </Box>
                    )}

                    {/* Tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                        <Tabs value={selectedTab} onChange={handleTabChange}>
                            <Tab label="Generate Reports" value="generate" />
                            <Tab label="Saved Reports" value="saved" />
                        </Tabs>
                    </Box>

                    {/* Generate Reports Tab */}
                    {selectedTab === 'generate' && (
                        <Box>
                            <Grid container spacing={3}>
                                {/* Report Configuration */}
                                <Grid item xs={12} md={8}>
                                    <Paper sx={{ p: 3, mb: 3 }}>
                                        <Typography variant="h6" gutterBottom>
                                            Report Configuration
                                        </Typography>

                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth>
                                                    <InputLabel>Report Type</InputLabel>
                                                    <Select
                                                        value={reportType}
                                                        onChange={(e) => setReportType(e.target.value)}
                                                        label="Report Type"
                                                    >
                                                        {reportTypes.map((type) => (
                                                            <MenuItem key={type.value} value={type.value}>
                                                                {type.label}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth>
                                                    <InputLabel>Date Range</InputLabel>
                                                    <Select
                                                        value={dateRange}
                                                        onChange={(e) => setDateRange(e.target.value)}
                                                        label="Date Range"
                                                    >
                                                        <MenuItem value="last-7-days">Last 7 Days</MenuItem>
                                                        <MenuItem value="last-30-days">Last 30 Days</MenuItem>
                                                        <MenuItem value="last-90-days">Last 90 Days</MenuItem>
                                                        <MenuItem value="custom">Custom Range</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {dateRange === 'custom' && (
                                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                                    <Grid item xs={12} md={6}>
                                                        <DatePicker
                                                            label="Start Date"
                                                            value={startDate}
                                                            onChange={setStartDate}
                                                            renderInput={(params) => <TextField {...params} fullWidth />}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={6}>
                                                        <DatePicker
                                                            label="End Date"
                                                            value={endDate}
                                                            onChange={setEndDate}
                                                            renderInput={(params) => <TextField {...params} fullWidth />}
                                                        />
                                                    </Grid>
                                                </LocalizationProvider>
                                            )}
                                        </Grid>
                                    </Paper>

                                    {/* Filters */}
                                    <Paper sx={{ p: 3 }}>
                                        <Typography variant="h6" gutterBottom>
                                            Filters
                                        </Typography>

                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="subtitle2" gutterBottom>
                                                    Carriers
                                                </Typography>
                                                <FormGroup>
                                                    {carriers.map((carrier) => (
                                                        <FormControlLabel
                                                            key={carrier}
                                                            control={
                                                                <Checkbox
                                                                    checked={selectedCarriers.includes(carrier)}
                                                                    onChange={() => handleCarrierChange(carrier)}
                                                                />
                                                            }
                                                            label={carrier}
                                                        />
                                                    ))}
                                                </FormGroup>
                                            </Grid>

                                            <Grid item xs={12} md={6}>
                                                <Typography variant="subtitle2" gutterBottom>
                                                    Shipment Status
                                                </Typography>
                                                <FormGroup>
                                                    {statuses.map((status) => (
                                                        <FormControlLabel
                                                            key={status}
                                                            control={
                                                                <Checkbox
                                                                    checked={selectedStatuses.includes(status)}
                                                                    onChange={() => handleStatusChange(status)}
                                                                />
                                                            }
                                                            label={status}
                                                        />
                                                    ))}
                                                </FormGroup>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                </Grid>

                                {/* Report Preview */}
                                <Grid item xs={12} md={4}>
                                    <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
                                        <Typography variant="h6" gutterBottom>
                                            Report Preview
                                        </Typography>

                                        <Stack spacing={2}>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    Report Type
                                                </Typography>
                                                <Typography variant="body1">
                                                    {reportTypes.find(t => t.value === reportType)?.label}
                                                </Typography>
                                            </Box>

                                            <Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    Date Range
                                                </Typography>
                                                <Typography variant="body1">
                                                    {dateRange === 'custom'
                                                        ? `${startDate?.toLocaleDateString()} - ${endDate?.toLocaleDateString()}`
                                                        : dateRange.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
                                                    }
                                                </Typography>
                                            </Box>

                                            {selectedCarriers.length > 0 && (
                                                <Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Carriers
                                                    </Typography>
                                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                                        {selectedCarriers.map((carrier) => (
                                                            <Chip key={carrier} label={carrier} size="small" />
                                                        ))}
                                                    </Stack>
                                                </Box>
                                            )}

                                            {selectedStatuses.length > 0 && (
                                                <Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Statuses
                                                    </Typography>
                                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                                        {selectedStatuses.map((status) => (
                                                            <Chip key={status} label={status} size="small" />
                                                        ))}
                                                    </Stack>
                                                </Box>
                                            )}
                                        </Stack>

                                        <Divider sx={{ my: 2 }} />

                                        <Stack spacing={2}>
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                startIcon={<AssessmentIcon />}
                                                onClick={handleGenerateReport}
                                                disabled={isGenerating}
                                            >
                                                {isGenerating ? 'Generating...' : 'Generate Report'}
                                            </Button>

                                            <Button
                                                variant="outlined"
                                                fullWidth
                                                startIcon={<SaveIcon />}
                                                disabled={isGenerating}
                                            >
                                                Save Configuration
                                            </Button>
                                        </Stack>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {/* Saved Reports Tab */}
                    {selectedTab === 'saved' && (
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6">
                                    Saved Reports
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => setSelectedTab('generate')}
                                >
                                    New Report
                                </Button>
                            </Box>

                            <TableContainer component={Paper} sx={{
                                width: '100%',
                                maxWidth: '100%',
                                overflow: 'auto'
                            }}>
                                <Table sx={{
                                    width: '100%',
                                    tableLayout: 'fixed',
                                    '& .MuiTableCell-root': {
                                        fontSize: '12px',
                                        padding: '8px 12px',
                                        borderBottom: '1px solid #e2e8f0'
                                    }
                                }}>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Report Name</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Type</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Created</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Last Run</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Schedule</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {mockSavedReports
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((report) => (
                                                <TableRow key={report.id} hover>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight="medium">
                                                            {report.name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{report.type}</TableCell>
                                                    <TableCell>{report.dateCreated}</TableCell>
                                                    <TableCell>{report.lastRun}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={report.schedule}
                                                            size="small"
                                                            color={report.schedule === 'Monthly' ? 'primary' : 'default'}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={1}>
                                                            <Tooltip title="Run Report">
                                                                <IconButton size="small">
                                                                    <AssessmentIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Download">
                                                                <IconButton size="small">
                                                                    <ExportIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Share">
                                                                <IconButton size="small">
                                                                    <ShareIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete">
                                                                <IconButton size="small" color="error">
                                                                    <DeleteIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                                <TablePagination
                                    rowsPerPageOptions={[5, 10, 25]}
                                    component="div"
                                    count={mockSavedReports.length}
                                    rowsPerPage={rowsPerPage}
                                    page={page}
                                    onPageChange={(event, newPage) => setPage(newPage)}
                                    onRowsPerPageChange={(event) => {
                                        setRowsPerPage(parseInt(event.target.value, 10));
                                        setPage(0);
                                    }}
                                />
                            </TableContainer>
                        </Box>
                    )}
                </Box>
            </Box>
        </div>
    );
};

export default Reports; 