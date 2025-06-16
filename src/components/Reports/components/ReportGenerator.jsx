import React, { useState, useEffect } from 'react';
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
    Chip,
    Stack,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Divider,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Assessment as AssessmentIcon,
    Save as SaveIcon,
    Schedule as ScheduleIcon,
    Email as EmailIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    GetApp as ExportIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useCompany } from '../../../contexts/CompanyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';

const ReportGenerator = ({ onReportGenerated, onSaveReport }) => {
    const { companyIdForAddress } = useCompany();
    const { currentUser } = useAuth();

    // Report Configuration State
    const [reportType, setReportType] = useState('shipment-summary');
    const [dateRange, setDateRange] = useState('last-30-days');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [selectedCarriers, setSelectedCarriers] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [exportFormat, setExportFormat] = useState('pdf');

    // Scheduling State
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduleFrequency, setScheduleFrequency] = useState('monthly');
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
    const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('monday');

    // Email Recipients State
    const [emailRecipients, setEmailRecipients] = useState([]);
    const [newRecipientEmail, setNewRecipientEmail] = useState('');
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);

    // UI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [reportName, setReportName] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Data State
    const [availableCarriers, setAvailableCarriers] = useState([]);
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [loadingData, setLoadingData] = useState(false);

    const reportTypes = [
        { value: 'shipment-summary', label: 'Shipment Summary', description: 'Overview of all shipments with key metrics' },
        { value: 'carrier-performance', label: 'Carrier Performance', description: 'Analysis of carrier delivery times and costs' },
        { value: 'cost-analysis', label: 'Cost Analysis', description: 'Detailed breakdown of shipping costs and trends' },
        { value: 'delivery-performance', label: 'Delivery Performance', description: 'On-time delivery rates and performance metrics' },
        { value: 'customer-activity', label: 'Customer Activity', description: 'Customer shipping patterns and volume analysis' },
        { value: 'route-analysis', label: 'Route Analysis', description: 'Geographic shipping patterns and route optimization' },
        { value: 'revenue-report', label: 'Revenue Report', description: 'Financial analysis of shipping revenue and margins' },
        { value: 'exception-report', label: 'Exception Report', description: 'Delayed, damaged, or problematic shipments' }
    ];

    const exportFormats = [
        { value: 'pdf', label: 'PDF Report', description: 'Professional formatted report' },
        { value: 'excel', label: 'Excel Spreadsheet', description: 'Data in Excel format for analysis' },
        { value: 'csv', label: 'CSV Data', description: 'Raw data in CSV format' },
        { value: 'dashboard', label: 'Interactive Dashboard', description: 'Live dashboard view' }
    ];

    const scheduleFrequencies = [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' }
    ];

    const statusOptions = [
        'pending', 'booked', 'scheduled', 'in_transit', 'delivered',
        'delayed', 'cancelled', 'exception', 'returned'
    ];

    // Load available carriers and customers
    useEffect(() => {
        if (companyIdForAddress) {
            loadAvailableData();
        }
    }, [companyIdForAddress]);

    const loadAvailableData = async () => {
        setLoadingData(true);
        try {
            // Load carriers from the carriers collection
            const carriersQuery = query(
                collection(db, 'carriers'),
                where('companyID', '==', companyIdForAddress),
                where('enabled', '==', true)
            );
            const carriersSnapshot = await getDocs(carriersQuery);
            const carriers = carriersSnapshot.docs.map(doc => doc.data().carrierID);
            setAvailableCarriers(carriers);

            // Load customers from the customers collection
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', companyIdForAddress)
            );
            const customersSnapshot = await getDocs(customersQuery);
            const customers = customersSnapshot.docs.map(doc => ({
                id: doc.data().customerID,
                name: doc.data().name || doc.data().companyName || 'Unknown Customer'
            }));
            setAvailableCustomers(customers);
        } catch (error) {
            console.error('Error loading data:', error);
            setError('Failed to load carriers and customers');
        } finally {
            setLoadingData(false);
        }
    };

    const handleGenerateReport = async () => {
        setIsGenerating(true);
        setError(null);
        setSuccess(null);

        try {
            const reportConfig = {
                type: reportType,
                dateRange: {
                    type: dateRange,
                    startDate: startDate?.toISOString(),
                    endDate: endDate?.toISOString()
                },
                filters: {
                    carriers: selectedCarriers,
                    statuses: selectedStatuses,
                    customers: selectedCustomers
                },
                exportFormat,
                companyId: companyIdForAddress,
                userId: currentUser?.uid,
                emailRecipients
            };

            // Call the cloud function
            const generateReportFunction = httpsCallable(functions, 'generateReport');
            const result = await generateReportFunction(reportConfig);

            if (result.data.success) {
                setSuccess(`Report generated successfully! ${result.data.downloadUrl ? 'Download link will be sent to your email.' : 'Dashboard data is ready.'}`);

                if (onReportGenerated) {
                    onReportGenerated({
                        ...reportConfig,
                        reportId: result.data.reportId,
                        downloadUrl: result.data.downloadUrl,
                        report: result.data.report
                    });
                }
            } else {
                throw new Error('Report generation failed');
            }
        } catch (error) {
            console.error('Error generating report:', error);
            setError(`Failed to generate report: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveReport = async () => {
        try {
            const reportConfig = {
                name: reportName,
                description: reportDescription,
                type: reportType,
                dateRange: {
                    type: dateRange,
                    startDate: startDate?.toISOString(),
                    endDate: endDate?.toISOString()
                },
                filters: {
                    carriers: selectedCarriers,
                    statuses: selectedStatuses,
                    customers: selectedCustomers
                },
                exportFormat,
                schedule: isScheduled ? {
                    frequency: scheduleFrequency,
                    time: scheduleTime,
                    dayOfMonth: scheduleDayOfMonth,
                    dayOfWeek: scheduleDayOfWeek
                } : null,
                emailRecipients,
                companyId: companyIdForAddress,
                createdBy: currentUser?.uid,
                createdAt: serverTimestamp(),
                status: 'active'
            };

            // Save to Firestore
            await addDoc(collection(db, 'savedReports'), reportConfig);

            setSuccess('Report configuration saved successfully!');

            if (onSaveReport) {
                onSaveReport(reportConfig);
            }

            setSaveDialogOpen(false);
            setReportName('');
            setReportDescription('');
        } catch (error) {
            console.error('Error saving report:', error);
            setError(`Failed to save report: ${error.message}`);
        }
    };

    const handleAddEmailRecipient = () => {
        if (newRecipientEmail && !emailRecipients.includes(newRecipientEmail)) {
            setEmailRecipients([...emailRecipients, newRecipientEmail]);
            setNewRecipientEmail('');
        }
    };

    const handleRemoveEmailRecipient = (email) => {
        setEmailRecipients(emailRecipients.filter(e => e !== email));
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

    const handleCustomerChange = (customerId) => {
        setSelectedCustomers(prev =>
            prev.includes(customerId)
                ? prev.filter(c => c !== customerId)
                : [...prev, customerId]
        );
    };

    const getSelectedReportType = () => {
        return reportTypes.find(type => type.value === reportType);
    };

    return (
        <Box>
            {/* Status Messages */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
                    {success}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Report Configuration */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Report Configuration
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>Report Type</InputLabel>
                                    <Select
                                        value={reportType}
                                        onChange={(e) => setReportType(e.target.value)}
                                        label="Report Type"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {reportTypes.map((type) => (
                                            <MenuItem key={type.value} value={type.value}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {type.label}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: 'text.secondary' }}>
                                                        {type.description}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>Date Range</InputLabel>
                                    <Select
                                        value={dateRange}
                                        onChange={(e) => setDateRange(e.target.value)}
                                        label="Date Range"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <MenuItem value="last-7-days">Last 7 Days</MenuItem>
                                        <MenuItem value="last-30-days">Last 30 Days</MenuItem>
                                        <MenuItem value="last-90-days">Last 90 Days</MenuItem>
                                        <MenuItem value="last-year">Last Year</MenuItem>
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
                                            renderInput={(params) => <TextField {...params} fullWidth sx={{ fontSize: '12px' }} />}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <DatePicker
                                            label="End Date"
                                            value={endDate}
                                            onChange={setEndDate}
                                            renderInput={(params) => <TextField {...params} fullWidth sx={{ fontSize: '12px' }} />}
                                        />
                                    </Grid>
                                </LocalizationProvider>
                            )}

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>Export Format</InputLabel>
                                    <Select
                                        value={exportFormat}
                                        onChange={(e) => setExportFormat(e.target.value)}
                                        label="Export Format"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {exportFormats.map((format) => (
                                            <MenuItem key={format.value} value={format.value}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {format.label}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: 'text.secondary' }}>
                                                        {format.description}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Filters */}
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Filters
                        </Typography>

                        {loadingData ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress size={24} />
                                <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading filters...</Typography>
                            </Box>
                        ) : (
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Carriers
                                    </Typography>
                                    <FormGroup>
                                        {availableCarriers.map((carrier) => (
                                            <FormControlLabel
                                                key={carrier}
                                                control={
                                                    <Checkbox
                                                        checked={selectedCarriers.includes(carrier)}
                                                        onChange={() => handleCarrierChange(carrier)}
                                                        size="small"
                                                    />
                                                }
                                                label={<Typography sx={{ fontSize: '12px' }}>{carrier}</Typography>}
                                            />
                                        ))}
                                    </FormGroup>
                                </Grid>

                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Shipment Status
                                    </Typography>
                                    <FormGroup>
                                        {statusOptions.map((status) => (
                                            <FormControlLabel
                                                key={status}
                                                control={
                                                    <Checkbox
                                                        checked={selectedStatuses.includes(status)}
                                                        onChange={() => handleStatusChange(status)}
                                                        size="small"
                                                    />
                                                }
                                                label={<Typography sx={{ fontSize: '12px', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</Typography>}
                                            />
                                        ))}
                                    </FormGroup>
                                </Grid>

                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Customers
                                    </Typography>
                                    <FormGroup sx={{ maxHeight: 200, overflow: 'auto' }}>
                                        {availableCustomers.map((customer) => (
                                            <FormControlLabel
                                                key={customer.id}
                                                control={
                                                    <Checkbox
                                                        checked={selectedCustomers.includes(customer.id)}
                                                        onChange={() => handleCustomerChange(customer.id)}
                                                        size="small"
                                                    />
                                                }
                                                label={<Typography sx={{ fontSize: '12px' }}>{customer.name}</Typography>}
                                            />
                                        ))}
                                    </FormGroup>
                                </Grid>
                            </Grid>
                        )}
                    </Paper>

                    {/* Scheduling */}
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Scheduling & Notifications
                        </Typography>

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isScheduled}
                                    onChange={(e) => setIsScheduled(e.target.checked)}
                                />
                            }
                            label={<Typography sx={{ fontSize: '12px' }}>Schedule this report to run automatically</Typography>}
                            sx={{ mb: 2 }}
                        />

                        {isScheduled && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel sx={{ fontSize: '12px' }}>Frequency</InputLabel>
                                        <Select
                                            value={scheduleFrequency}
                                            onChange={(e) => setScheduleFrequency(e.target.value)}
                                            label="Frequency"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            {scheduleFrequencies.map((freq) => (
                                                <MenuItem key={freq.value} value={freq.value}>
                                                    <Typography sx={{ fontSize: '12px' }}>{freq.label}</Typography>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Time"
                                        type="time"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                        inputProps={{ sx: { fontSize: '12px' } }}
                                    />
                                </Grid>

                                {scheduleFrequency === 'monthly' && (
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            fullWidth
                                            label="Day of Month"
                                            type="number"
                                            value={scheduleDayOfMonth}
                                            onChange={(e) => setScheduleDayOfMonth(parseInt(e.target.value))}
                                            inputProps={{ min: 1, max: 31, sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>
                                )}

                                {scheduleFrequency === 'weekly' && (
                                    <Grid item xs={12} md={4}>
                                        <FormControl fullWidth>
                                            <InputLabel sx={{ fontSize: '12px' }}>Day of Week</InputLabel>
                                            <Select
                                                value={scheduleDayOfWeek}
                                                onChange={(e) => setScheduleDayOfWeek(e.target.value)}
                                                label="Day of Week"
                                                sx={{ fontSize: '12px' }}
                                            >
                                                <MenuItem value="monday">Monday</MenuItem>
                                                <MenuItem value="tuesday">Tuesday</MenuItem>
                                                <MenuItem value="wednesday">Wednesday</MenuItem>
                                                <MenuItem value="thursday">Thursday</MenuItem>
                                                <MenuItem value="friday">Friday</MenuItem>
                                                <MenuItem value="saturday">Saturday</MenuItem>
                                                <MenuItem value="sunday">Sunday</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}
                            </Grid>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                Email Recipients ({emailRecipients.length})
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<EmailIcon />}
                                onClick={() => setEmailDialogOpen(true)}
                                sx={{ fontSize: '11px' }}
                            >
                                Manage Recipients
                            </Button>
                        </Box>

                        {emailRecipients.length > 0 && (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {emailRecipients.map((email) => (
                                    <Chip
                                        key={email}
                                        label={email}
                                        size="small"
                                        onDelete={() => handleRemoveEmailRecipient(email)}
                                        sx={{ fontSize: '10px', mb: 1 }}
                                    />
                                ))}
                            </Stack>
                        )}
                    </Paper>
                </Grid>

                {/* Report Preview & Actions */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Report Preview
                        </Typography>

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                {getSelectedReportType()?.label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary', mb: 2 }}>
                                {getSelectedReportType()?.description}
                            </Typography>

                            <Stack spacing={1}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>Date Range:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        {dateRange === 'custom' && startDate && endDate
                                            ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                                            : dateRange.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
                                        }
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>Format:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        {exportFormats.find(f => f.value === exportFormat)?.label}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>Carriers:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        {selectedCarriers.length === 0 ? 'All' : selectedCarriers.length}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>Recipients:</Typography>
                                    <Typography sx={{ fontSize: '11px' }}>{emailRecipients.length}</Typography>
                                </Box>
                                {isScheduled && (
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>Schedule:</Typography>
                                        <Typography sx={{ fontSize: '11px' }}>{scheduleFrequency}</Typography>
                                    </Box>
                                )}
                            </Stack>
                        </Box>

                        <Stack spacing={2}>
                            <Button
                                variant="contained"
                                fullWidth
                                startIcon={isGenerating ? <CircularProgress size={16} /> : <AssessmentIcon />}
                                onClick={handleGenerateReport}
                                disabled={isGenerating || !companyIdForAddress}
                                sx={{ fontSize: '12px' }}
                            >
                                {isGenerating ? 'Generating...' : 'Generate Report'}
                            </Button>

                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<SaveIcon />}
                                onClick={() => setSaveDialogOpen(true)}
                                disabled={!companyIdForAddress}
                                sx={{ fontSize: '12px' }}
                            >
                                Save Configuration
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>

            {/* Email Recipients Dialog */}
            <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '16px' }}>
                    Manage Email Recipients
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Email Address"
                            value={newRecipientEmail}
                            onChange={(e) => setNewRecipientEmail(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddEmailRecipient()}
                            sx={{ mb: 2 }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleAddEmailRecipient}
                            disabled={!newRecipientEmail}
                            sx={{ fontSize: '12px', mb: 2 }}
                        >
                            Add Email
                        </Button>

                        <List>
                            {emailRecipients.map((email) => (
                                <ListItem key={email}>
                                    <ListItemText
                                        primary={email}
                                        primaryTypographyProps={{ fontSize: '12px' }}
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            onClick={() => handleRemoveEmailRecipient(email)}
                                            size="small"
                                        >
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEmailDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Save Report Dialog */}
            <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '16px' }}>
                    Save Report Configuration
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Report Name"
                            value={reportName}
                            onChange={(e) => setReportName(e.target.value)}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />
                        <TextField
                            fullWidth
                            label="Description (Optional)"
                            value={reportDescription}
                            onChange={(e) => setReportDescription(e.target.value)}
                            multiline
                            rows={3}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveReport}
                        variant="contained"
                        disabled={!reportName}
                        sx={{ fontSize: '12px' }}
                    >
                        Save Report
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ReportGenerator; 