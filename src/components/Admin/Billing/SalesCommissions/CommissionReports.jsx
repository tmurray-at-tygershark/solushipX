import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    Alert,
    TextField,
    Tabs,
    Tab,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Card,
    CardContent,
    Divider,
    CircularProgress,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Switch,
    FormControlLabel,
    Autocomplete,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tooltip,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction
} from '@mui/material';
import {
    Assessment as ReportIcon,
    Schedule as ScheduleIcon,
    Download as DownloadIcon,
    Email as EmailIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    CalendarMonth as CalendarIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
    Close as CloseIcon,
    Send as SendIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase/firebase';

const CommissionReports = ({ salesPersons: propSalesPersons, salesTeams: propSalesTeams }) => {
    // State management
    const [activeTab, setActiveTab] = useState(0);
    const [salesPersons, setSalesPersons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [reportHistory, setReportHistory] = useState([]);
    const [scheduledReports, setScheduledReports] = useState([]);

    // Report form data
    const [reportForm, setReportForm] = useState({
        reportName: '',
        startDate: '',
        endDate: '',
        salesPersonIds: [],
        companyIds: [],
        emailRecipients: ['tyler@tygershark.com'],
        includeUnpaidInvoices: false,
        saveReport: true
    });

    // Schedule form data
    const [scheduleForm, setScheduleForm] = useState({
        reportName: '',
        frequency: 'monthly', // weekly, monthly, quarterly
        startDate: '',
        salesPersonIds: [],
        companyIds: [],
        emailRecipients: ['tyler@tygershark.com'],
        includeUnpaidInvoices: false,
        isActive: true
    });

    // Cloud function references
    const getSalesPersons = httpsCallable(functions, 'getSalesPersons');
    const generateCommissionReport = httpsCallable(functions, 'generateCommissionReport');
    const scheduleCommissionReport = httpsCallable(functions, 'scheduleCommissionReport');

    // Load data on component mount
    useEffect(() => {
        // Use props if provided, otherwise load data
        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
            loadMockData();
        } else {
            loadData();
        }
    }, [propSalesPersons]);

    // Update local state when prop changes
    useEffect(() => {
        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
        }
    }, [propSalesPersons]);

    const loadMockData = () => {
        // Mock data for demonstration - replace with actual data loading
        setReportHistory([
            {
                id: 'report_001',
                reportName: 'Monthly Commission Report - November 2024',
                generatedAt: new Date('2024-11-01'),
                totalCommissions: 15420.50,
                payableCommissions: 12340.25,
                pendingCommissions: 3080.25,
                shipmentCount: 156,
                recipients: ['tyler@tygershark.com'],
                status: 'completed'
            },
            {
                id: 'report_002',
                reportName: 'Weekly Commission Report - Week 44',
                generatedAt: new Date('2024-10-28'),
                totalCommissions: 3850.75,
                payableCommissions: 3100.00,
                pendingCommissions: 750.75,
                shipmentCount: 42,
                recipients: ['tyler@tygershark.com'],
                status: 'completed'
            }
        ]);

        setScheduledReports([
            {
                id: 'schedule_001',
                reportName: 'Monthly Sales Commission Report',
                frequency: 'monthly',
                nextRun: new Date('2024-12-01'),
                recipients: ['tyler@tygershark.com'],
                isActive: true,
                createdAt: new Date('2024-10-01')
            }
        ]);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setError('');

            const result = await getSalesPersons({ filters: { active: true }, limit: 100 });

            // Handle response format
            if (result.data && result.data.success) {
                setSalesPersons(result.data.data.salesPersons || []);
            } else if (result.data && result.data.data) {
                setSalesPersons(result.data.data.salesPersons || []);
            } else {
                setSalesPersons([]);
            }

            loadMockData();

        } catch (error) {
            console.error('Error loading data:', error);

            // Set empty arrays for graceful degradation
            setSalesPersons([]);

            // Only show error if it's not just empty collections
            if (!error.message.includes('empty') &&
                !error.message.includes('No') &&
                error.code !== 'not-found') {
                setError('Failed to load reports data');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        try {
            setLoading(true);
            setError('');

            if (!reportForm.reportName || !reportForm.startDate || !reportForm.endDate) {
                setError('Please fill in all required fields');
                return;
            }

            const result = await generateCommissionReport({
                reportName: reportForm.reportName,
                startDate: reportForm.startDate,
                endDate: reportForm.endDate,
                filters: {
                    salesPersonIds: reportForm.salesPersonIds,
                    companyIds: reportForm.companyIds
                },
                emailRecipients: reportForm.emailRecipients,
                saveReport: reportForm.saveReport,
                includeUnpaidInvoices: reportForm.includeUnpaidInvoices
            });

            if (result.data && result.data.success) {
                setSuccess(`Report "${reportForm.reportName}" generated successfully and sent to ${reportForm.emailRecipients.length} recipient(s)`);
                loadData(); // Refresh report history
                resetForm();
            } else {
                setError('Failed to generate report');
            }

        } catch (error) {
            console.error('Error generating report:', error);
            setError(error.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleScheduleReport = async () => {
        try {
            setLoading(true);
            setError('');

            if (!scheduleForm.reportName || !scheduleForm.startDate) {
                setError('Please fill in all required fields');
                return;
            }

            const result = await scheduleCommissionReport({
                reportName: scheduleForm.reportName,
                frequency: scheduleForm.frequency,
                startDate: scheduleForm.startDate,
                filters: {
                    salesPersonIds: scheduleForm.salesPersonIds,
                    companyIds: scheduleForm.companyIds
                },
                emailRecipients: scheduleForm.emailRecipients,
                includeUnpaidInvoices: scheduleForm.includeUnpaidInvoices,
                isActive: scheduleForm.isActive
            });

            if (result.data && result.data.success) {
                setSuccess(`Report "${scheduleForm.reportName}" scheduled successfully`);
                loadData(); // Refresh scheduled reports
                setOpenDialog(false);
                resetScheduleForm();
            } else {
                setError('Failed to schedule report');
            }

        } catch (error) {
            console.error('Error scheduling report:', error);
            setError(error.message || 'Failed to schedule report');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setReportForm({
            reportName: '',
            startDate: '',
            endDate: '',
            salesPersonIds: [],
            companyIds: [],
            emailRecipients: ['tyler@tygershark.com'],
            includeUnpaidInvoices: false,
            saveReport: true
        });
    };

    const resetScheduleForm = () => {
        setScheduleForm({
            reportName: '',
            frequency: 'monthly',
            startDate: '',
            salesPersonIds: [],
            companyIds: [],
            emailRecipients: ['tyler@tygershark.com'],
            includeUnpaidInvoices: false,
            isActive: true
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const getFrequencyColor = (frequency) => {
        switch (frequency) {
            case 'weekly': return 'primary';
            case 'monthly': return 'secondary';
            case 'quarterly': return 'success';
            default: return 'default';
        }
    };

    if (loading && activeTab === 0) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
                <CircularProgress size={40} />
                <Typography variant="body2" sx={{ ml: 2, fontSize: '12px' }}>
                    Loading reports...
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Commission Reports & Scheduling
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Generate on-demand reports and schedule automated commission reports
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<ScheduleIcon />}
                    onClick={() => setOpenDialog(true)}
                    sx={{ fontSize: '12px' }}
                >
                    Schedule Report
                </Button>
            </Box>

            {/* Success/Error Messages */}
            {success && (
                <Alert severity="success" sx={{ mb: 2, fontSize: '12px' }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    sx={{ borderBottom: '1px solid #e5e7eb' }}
                >
                    <Tab
                        label="Generate Report"
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    />
                    <Tab
                        label="Report History"
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    />
                    <Tab
                        label="Scheduled Reports"
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    />
                </Tabs>
            </Paper>

            {/* Tab Content */}
            {activeTab === 0 && (
                // Generate Report Tab
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Card sx={{ border: '1px solid #e5e7eb' }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" mb={3}>
                                    <ReportIcon sx={{ fontSize: 20, color: '#2563eb', mr: 1 }} />
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Generate Commission Report
                                    </Typography>
                                </Box>

                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Report Name"
                                            value={reportForm.reportName}
                                            onChange={(e) => setReportForm({ ...reportForm, reportName: e.target.value })}
                                            size="small"
                                            required
                                            placeholder="e.g., Monthly Commission Report - December 2024"
                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            label="Start Date"
                                            type="date"
                                            value={reportForm.startDate}
                                            onChange={(e) => setReportForm({ ...reportForm, startDate: e.target.value })}
                                            size="small"
                                            required
                                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            label="End Date"
                                            type="date"
                                            value={reportForm.endDate}
                                            onChange={(e) => setReportForm({ ...reportForm, endDate: e.target.value })}
                                            size="small"
                                            required
                                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Autocomplete
                                            multiple
                                            options={salesPersons}
                                            getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
                                            value={salesPersons.filter(p => reportForm.salesPersonIds.includes(p.id))}
                                            onChange={(event, newValue) => {
                                                setReportForm({
                                                    ...reportForm,
                                                    salesPersonIds: newValue.map(person => person.id)
                                                });
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Sales Persons (optional - leave empty for all)"
                                                    size="small"
                                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                                />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        variant="outlined"
                                                        label={`${option.firstName} ${option.lastName}`}
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                        {...getTagProps({ index })}
                                                    />
                                                ))
                                            }
                                            size="small"
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Autocomplete
                                            multiple
                                            freeSolo
                                            options={reportForm.emailRecipients}
                                            value={reportForm.emailRecipients}
                                            onChange={(event, newValue) => {
                                                setReportForm({
                                                    ...reportForm,
                                                    emailRecipients: newValue
                                                });
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Email Recipients"
                                                    size="small"
                                                    required
                                                    placeholder="Enter email addresses"
                                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                                />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        variant="outlined"
                                                        label={option}
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                        {...getTagProps({ index })}
                                                    />
                                                ))
                                            }
                                            size="small"
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Box display="flex" gap={3}>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={reportForm.includeUnpaidInvoices}
                                                        onChange={(e) => setReportForm({
                                                            ...reportForm,
                                                            includeUnpaidInvoices: e.target.checked
                                                        })}
                                                        size="small"
                                                    />
                                                }
                                                label={<Typography sx={{ fontSize: '12px' }}>Include Unpaid Invoices</Typography>}
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={reportForm.saveReport}
                                                        onChange={(e) => setReportForm({
                                                            ...reportForm,
                                                            saveReport: e.target.checked
                                                        })}
                                                        size="small"
                                                    />
                                                }
                                                label={<Typography sx={{ fontSize: '12px' }}>Save Report to History</Typography>}
                                            />
                                        </Box>
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            onClick={handleGenerateReport}
                                            size="small"
                                            startIcon={loading ? <CircularProgress size={16} /> : <EmailIcon />}
                                            disabled={loading}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            {loading ? 'Generating Report...' : 'Generate & Email Report'}
                                        </Button>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{ border: '1px solid #e5e7eb' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                    Quick Actions
                                </Typography>

                                <Button
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                        const today = new Date();
                                        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                                        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

                                        setReportForm({
                                            ...reportForm,
                                            reportName: `Monthly Commission Report - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                                            startDate: firstDay.toISOString().split('T')[0],
                                            endDate: lastDay.toISOString().split('T')[0]
                                        });
                                    }}
                                    sx={{ fontSize: '12px', mb: 1 }}
                                >
                                    Current Month
                                </Button>

                                <Button
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                        const today = new Date();
                                        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

                                        setReportForm({
                                            ...reportForm,
                                            reportName: `Weekly Commission Report - Week ${getWeekNumber(today)}`,
                                            startDate: lastWeek.toISOString().split('T')[0],
                                            endDate: today.toISOString().split('T')[0]
                                        });
                                    }}
                                    sx={{ fontSize: '12px', mb: 1 }}
                                >
                                    Last 7 Days
                                </Button>

                                <Button
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    onClick={resetForm}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Reset Form
                                </Button>

                                <Divider sx={{ my: 2 }} />

                                <Alert severity="info" sx={{ fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                        Business Rule Reminder
                                    </Typography>
                                    Commissions are only payable on invoices that have been paid.
                                    Use "Include Unpaid Invoices" to see pending commissions.
                                </Alert>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {activeTab === 1 && (
                // Report History Tab
                <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Report Name
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Generated
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Payable Commission
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Pending Commission
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Shipments
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Status
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportHistory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                        <Box display="flex" flexDirection="column" alignItems="center">
                                            <ReportIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                No reports generated yet
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                                Generate your first commission report to get started
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportHistory.map((report) => (
                                    <TableRow key={report.id} hover>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {report.reportName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {report.generatedAt.toLocaleDateString()}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', color: '#059669', fontWeight: 500 }}>
                                            {formatCurrency(report.payableCommissions)}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', color: '#d97706', fontWeight: 500 }}>
                                            {formatCurrency(report.pendingCommissions)}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {report.shipmentCount}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={report.status}
                                                size="small"
                                                color={report.status === 'completed' ? 'success' : 'default'}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Tooltip title="Download Report">
                                                <IconButton size="small">
                                                    <DownloadIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {activeTab === 2 && (
                // Scheduled Reports Tab
                <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Report Name
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Frequency
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Next Run
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Recipients
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Status
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {scheduledReports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                        <Box display="flex" flexDirection="column" alignItems="center">
                                            <ScheduleIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                No scheduled reports
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                                Schedule automated commission reports
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                scheduledReports.map((schedule) => (
                                    <TableRow key={schedule.id} hover>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {schedule.reportName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={schedule.frequency}
                                                size="small"
                                                color={getFrequencyColor(schedule.frequency)}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {schedule.nextRun.toLocaleDateString()}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {schedule.recipients.length} recipient(s)
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={schedule.isActive ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={schedule.isActive ? 'success' : 'default'}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box display="flex" gap={0.5}>
                                                <Tooltip title="Edit Schedule">
                                                    <IconButton size="small">
                                                        <EditIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Schedule">
                                                    <IconButton size="small" color="error">
                                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Schedule Report Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Schedule Commission Report
                    </Typography>
                    <IconButton onClick={() => setOpenDialog(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Report Name"
                                value={scheduleForm.reportName}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, reportName: e.target.value })}
                                size="small"
                                required
                                placeholder="e.g., Monthly Sales Commission Report"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Frequency</InputLabel>
                                <Select
                                    value={scheduleForm.frequency}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="weekly" sx={{ fontSize: '12px' }}>Weekly</MenuItem>
                                    <MenuItem value="monthly" sx={{ fontSize: '12px' }}>Monthly</MenuItem>
                                    <MenuItem value="quarterly" sx={{ fontSize: '12px' }}>Quarterly</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Start Date"
                                type="date"
                                value={scheduleForm.startDate}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })}
                                size="small"
                                required
                                InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Autocomplete
                                multiple
                                freeSolo
                                options={scheduleForm.emailRecipients}
                                value={scheduleForm.emailRecipients}
                                onChange={(event, newValue) => {
                                    setScheduleForm({
                                        ...scheduleForm,
                                        emailRecipients: newValue
                                    });
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Email Recipients"
                                        size="small"
                                        required
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                )}
                                size="small"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={scheduleForm.includeUnpaidInvoices}
                                        onChange={(e) => setScheduleForm({
                                            ...scheduleForm,
                                            includeUnpaidInvoices: e.target.checked
                                        })}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Include Unpaid Invoices</Typography>}
                            />
                        </Grid>
                    </Grid>

                    {error && (
                        <Alert severity="error" sx={{ mt: 2, fontSize: '12px' }}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenDialog(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleScheduleReport}
                        size="small"
                        startIcon={loading ? <CircularProgress size={16} /> : <ScheduleIcon />}
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                    >
                        {loading ? 'Scheduling...' : 'Schedule Report'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// Helper function to get week number
const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

export default CommissionReports; 