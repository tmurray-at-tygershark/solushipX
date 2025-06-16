import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    IconButton,
    Button,
    Chip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Tooltip,
    Alert,
    CircularProgress,
    Menu,
    MenuList,
    MenuItem as MenuItemComponent,
    Divider,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import {
    Assessment as AssessmentIcon,
    GetApp as ExportIcon,
    Share as ShareIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Schedule as ScheduleIcon,
    Email as EmailIcon,
    MoreVert as MoreVertIcon,
    PlayArrow as PlayArrowIcon,
    Pause as PauseIcon,
    Add as AddIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useCompany } from '../../../contexts/CompanyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    orderBy
} from 'firebase/firestore';
import { db } from '../../../firebase';

const SavedReports = ({ onEditReport, onRunReport }) => {
    const { companyIdForAddress } = useCompany();
    const { currentUser } = useAuth();

    // State
    const [savedReports, setSavedReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedReport, setSelectedReport] = useState(null);
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Dialog states
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    // Email management
    const [emailRecipients, setEmailRecipients] = useState([]);
    const [newRecipientEmail, setNewRecipientEmail] = useState('');

    // Schedule management
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleFrequency, setScheduleFrequency] = useState('monthly');
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
    const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('monday');

    // Share management
    const [shareEmails, setShareEmails] = useState([]);
    const [shareMessage, setShareMessage] = useState('');

    // Report schedules
    const [reportSchedules, setReportSchedules] = useState([]);

    const loadSavedReports = useCallback(async () => {
        if (!companyIdForAddress) return;

        setLoading(true);
        try {
            const reportsRef = collection(db, 'savedReports');
            const q = query(
                reportsRef,
                where('companyId', '==', companyIdForAddress),
                orderBy('createdAt', 'desc')
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const reports = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setSavedReports(reports);
                setLoading(false);
            }, (error) => {
                console.error('Error loading saved reports:', error);
                // If indexing error, show empty state with helpful message
                if (error.code === 'failed-precondition') {
                    console.log('Firebase indexes not ready, showing empty state...');
                    setSavedReports([]);
                } else {
                    setError('Failed to load saved reports. Please refresh the page.');
                }
                setLoading(false);
            });

            return unsubscribe;
        } catch (error) {
            console.error('Error loading saved reports:', error);
            setError('Failed to load saved reports. Please refresh the page.');
            setLoading(false);
        }
    }, [companyIdForAddress]);

    const loadReportSchedules = useCallback(async () => {
        if (!companyIdForAddress) return;

        try {
            const getSchedules = httpsCallable(functions, 'getCompanyReportSchedules');
            const result = await getSchedules({ companyId: companyIdForAddress });

            if (result.data.success) {
                setReportSchedules(result.data.schedules || []);
            } else {
                throw new Error(result.data.error || 'Failed to load schedules');
            }
        } catch (error) {
            console.error('Error loading report schedules:', error);
            // Don't show error for temporary cloud function issues
            if (error.code === 'not-found' || error.code === 'internal') {
                console.log('Cloud function not available, using empty schedules');
                setReportSchedules([]);
            } else {
                setError('Failed to load report schedules. Some features may be limited.');
            }
        }
    }, [companyIdForAddress]);

    useEffect(() => {
        if (companyIdForAddress) {
            loadSavedReports();
            loadReportSchedules();
        }
    }, [companyIdForAddress, loadSavedReports, loadReportSchedules]);

    const handleRunReport = async (report) => {
        try {
            setError(null);
            setSuccess(null);

            // Call the generateReport cloud function
            const generateReportFunction = httpsCallable(functions, 'generateReport');
            const result = await generateReportFunction({
                type: report.type,
                dateRange: report.dateRange,
                filters: report.filters,
                exportFormat: report.exportFormat,
                companyId: companyIdForAddress,
                userId: currentUser?.uid,
                emailRecipients: report.emailRecipients || []
            });

            if (result.data.success) {
                setSuccess(`Report "${report.name}" executed successfully!`);

                // Update last run time in Firestore
                await updateDoc(doc(db, 'savedReports', report.id), {
                    lastRun: new Date(),
                    runCount: (report.runCount || 0) + 1
                });

                if (onRunReport) {
                    await onRunReport(report);
                }
            } else {
                throw new Error('Report execution failed');
            }
        } catch (error) {
            console.error('Error running report:', error);
            setError(`Failed to run report: ${error.message}`);
        }
    };

    const handleToggleSchedule = async (report) => {
        try {
            const reportSchedule = reportSchedules.find(s => s.reportId === report.id);

            if (reportSchedule) {
                // Update existing schedule
                const updateScheduleFunction = httpsCallable(functions, 'updateReportSchedule');
                await updateScheduleFunction({
                    scheduleId: reportSchedule.id,
                    status: reportSchedule.status === 'active' ? 'paused' : 'active',
                    companyId: companyIdForAddress
                });
            } else if (report.schedule) {
                // Create new schedule
                const scheduleReportFunction = httpsCallable(functions, 'scheduleReport');
                await scheduleReportFunction({
                    reportId: report.id,
                    schedule: report.schedule,
                    companyId: companyIdForAddress,
                    userId: currentUser?.uid
                });
            }

            // Reload schedules
            await loadReportSchedules();
            setSuccess('Schedule updated successfully');
        } catch (error) {
            console.error('Error toggling schedule:', error);
            setError(`Failed to update schedule: ${error.message}`);
        }
    };

    const handleDeleteReport = async (reportId) => {
        try {
            // Delete any associated schedules first
            const reportSchedule = (reportSchedules || []).find(s => s.reportId === reportId);
            if (reportSchedule) {
                const deleteScheduleFunction = httpsCallable(functions, 'deleteReportSchedule');
                await deleteScheduleFunction({
                    scheduleId: reportSchedule.id,
                    companyId: companyIdForAddress
                });
            }

            // Delete the report
            await deleteDoc(doc(db, 'savedReports', reportId));

            setSuccess('Report deleted successfully');
            setDeleteDialogOpen(false);
            setSelectedReport(null);
        } catch (error) {
            console.error('Error deleting report:', error);
            setError(`Failed to delete report: ${error.message}`);
        }
    };

    const handleOpenEmailDialog = (report) => {
        setSelectedReport(report);
        setEmailRecipients(report.emailRecipients || []);
        setEmailDialogOpen(true);
    };

    const handleSaveEmailRecipients = async () => {
        try {
            await updateDoc(doc(db, 'savedReports', selectedReport.id), {
                emailRecipients,
                updatedAt: new Date()
            });

            setSuccess('Email recipients updated successfully');
            setEmailDialogOpen(false);
            setSelectedReport(null);
            setEmailRecipients([]);
        } catch (error) {
            console.error('Error saving email recipients:', error);
            setError(`Failed to update email recipients: ${error.message}`);
        }
    };

    const handleOpenScheduleDialog = (report) => {
        setSelectedReport(report);
        const reportSchedule = (reportSchedules || []).find(s => s.reportId === report.id);

        if (reportSchedule) {
            setScheduleEnabled(reportSchedule.status === 'active');
            setScheduleFrequency(reportSchedule.schedule?.frequency || 'monthly');
            setScheduleTime(reportSchedule.schedule?.time || '09:00');
            setScheduleDayOfMonth(reportSchedule.schedule?.dayOfMonth || 1);
            setScheduleDayOfWeek(reportSchedule.schedule?.dayOfWeek || 'monday');
        } else {
            setScheduleEnabled(report.schedule?.enabled || false);
            setScheduleFrequency(report.schedule?.frequency || 'monthly');
            setScheduleTime(report.schedule?.time || '09:00');
            setScheduleDayOfMonth(report.schedule?.dayOfMonth || 1);
            setScheduleDayOfWeek(report.schedule?.dayOfWeek || 'monday');
        }

        setScheduleDialogOpen(true);
    };

    const handleSaveSchedule = async () => {
        try {
            const scheduleConfig = {
                frequency: scheduleFrequency,
                time: scheduleTime,
                ...(scheduleFrequency === 'monthly' && { dayOfMonth: scheduleDayOfMonth }),
                ...(scheduleFrequency === 'weekly' && { dayOfWeek: scheduleDayOfWeek })
            };

            // Update the report with schedule configuration
            await updateDoc(doc(db, 'savedReports', selectedReport.id), {
                schedule: {
                    enabled: scheduleEnabled,
                    ...scheduleConfig
                },
                updatedAt: new Date()
            });

            const reportSchedule = (reportSchedules || []).find(s => s.reportId === selectedReport.id);

            if (scheduleEnabled) {
                if (reportSchedule) {
                    // Update existing schedule
                    const updateScheduleFunction = httpsCallable(functions, 'updateReportSchedule');
                    await updateScheduleFunction({
                        scheduleId: reportSchedule.id,
                        schedule: scheduleConfig,
                        status: 'active',
                        companyId: companyIdForAddress
                    });
                } else {
                    // Create new schedule
                    const scheduleReportFunction = httpsCallable(functions, 'scheduleReport');
                    await scheduleReportFunction({
                        reportId: selectedReport.id,
                        schedule: scheduleConfig,
                        companyId: companyIdForAddress,
                        userId: currentUser?.uid
                    });
                }
            } else if (reportSchedule) {
                // Disable existing schedule
                const updateScheduleFunction = httpsCallable(functions, 'updateReportSchedule');
                await updateScheduleFunction({
                    scheduleId: reportSchedule.id,
                    status: 'paused',
                    companyId: companyIdForAddress
                });
            }

            await loadReportSchedules();
            setSuccess('Schedule updated successfully');
            setScheduleDialogOpen(false);
            setSelectedReport(null);
        } catch (error) {
            console.error('Error saving schedule:', error);
            setError(`Failed to update schedule: ${error.message}`);
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

    const handleActionMenuOpen = (event, report) => {
        setActionMenuAnchor(event.currentTarget);
        setSelectedReport(report);
    };

    const handleActionMenuClose = () => {
        setActionMenuAnchor(null);
        setSelectedReport(null);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'success';
            case 'paused': return 'warning';
            case 'error': return 'error';
            default: return 'default';
        }
    };

    const getScheduleDisplay = (report) => {
        const reportSchedule = (reportSchedules || []).find(s => s.reportId === report.id);

        if (!reportSchedule || reportSchedule.status !== 'active') {
            return 'Not scheduled';
        }

        const { frequency, time, dayOfMonth, dayOfWeek } = reportSchedule.schedule || {};

        switch (frequency) {
            case 'daily':
                return `Daily at ${time}`;
            case 'weekly':
                return `Weekly on ${dayOfWeek}s at ${time}`;
            case 'monthly':
                return `Monthly on day ${dayOfMonth} at ${time}`;
            case 'quarterly':
                return `Quarterly at ${time}`;
            default:
                return 'Custom schedule';
        }
    };

    const getNextRunDisplay = (report) => {
        const reportSchedule = (reportSchedules || []).find(s => s.reportId === report.id);

        if (!reportSchedule || !reportSchedule.nextRun) {
            return 'N/A';
        }

        return new Date(reportSchedule.nextRun).toLocaleDateString();
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading saved reports...</Typography>
            </Box>
        );
    }

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

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Saved Reports ({savedReports.length})
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => window.location.hash = '#generate'}
                    sx={{ fontSize: '12px' }}
                >
                    New Report
                </Button>
            </Box>

            {savedReports.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '14px', color: 'text.secondary', mb: 2 }}>
                        No saved reports found
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                        Create your first report configuration to get started
                    </Typography>
                </Paper>
            ) : (
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
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '200px' }}>Report Name</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '120px' }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '100px' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '150px' }}>Schedule</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '100px' }}>Next Run</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '120px' }}>Recipients</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '100px' }}>Last Run</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '80px' }}>Runs</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: '#374151', width: '120px' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {savedReports
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((report) => (
                                    <TableRow key={report.id} hover>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '12px' }}>
                                                    {report.name}
                                                </Typography>
                                                {report.description && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '10px' }}>
                                                        {report.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px', textTransform: 'capitalize' }}>
                                                {report.type?.replace('-', ' ')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={report.status || 'active'}
                                                size="small"
                                                color={getStatusColor(report.status || 'active')}
                                                sx={{ fontSize: '10px', textTransform: 'capitalize' }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '11px' }}>
                                                    {getScheduleDisplay(report)}
                                                </Typography>
                                                {(reportSchedules || []).find(s => s.reportId === report.id && s.status === 'active') && (
                                                    <Chip
                                                        label="Active"
                                                        size="small"
                                                        color="success"
                                                        sx={{ fontSize: '9px' }}
                                                    />
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {getNextRunDisplay(report)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {report.emailRecipients?.length || 0}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {report.lastRun ? new Date(report.lastRun).toLocaleDateString() : 'Never'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>{report.runCount || 0}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title="Run Report">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleRunReport(report)}
                                                        color="primary"
                                                    >
                                                        <PlayArrowIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="More Actions">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleActionMenuOpen(e, report)}
                                                    >
                                                        <MoreVertIcon sx={{ fontSize: 16 }} />
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
                        count={savedReports.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(event, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(parseInt(event.target.value, 10));
                            setPage(0);
                        }}
                    />
                </TableContainer>
            )}

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
            >
                <MenuItemComponent onClick={() => { handleRunReport(selectedReport); handleActionMenuClose(); }}>
                    <PlayArrowIcon sx={{ mr: 1, fontSize: 16 }} />
                    Run Report
                </MenuItemComponent>
                <MenuItemComponent onClick={() => { handleOpenScheduleDialog(selectedReport); handleActionMenuClose(); }}>
                    <ScheduleIcon sx={{ mr: 1, fontSize: 16 }} />
                    Schedule
                </MenuItemComponent>
                <MenuItemComponent onClick={() => { handleOpenEmailDialog(selectedReport); handleActionMenuClose(); }}>
                    <EmailIcon sx={{ mr: 1, fontSize: 16 }} />
                    Email Settings
                </MenuItemComponent>
                <Divider />
                <MenuItemComponent onClick={() => { onEditReport && onEditReport(selectedReport); handleActionMenuClose(); }}>
                    <EditIcon sx={{ mr: 1, fontSize: 16 }} />
                    Edit
                </MenuItemComponent>
                <MenuItemComponent
                    onClick={() => { setDeleteDialogOpen(true); handleActionMenuClose(); }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteIcon sx={{ mr: 1, fontSize: 16 }} />
                    Delete
                </MenuItemComponent>
            </Menu>

            {/* Email Recipients Dialog */}
            <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '16px' }}>
                    Email Recipients - {selectedReport?.name}
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
                        Cancel
                    </Button>
                    <Button onClick={handleSaveEmailRecipients} variant="contained" sx={{ fontSize: '12px' }}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Schedule Dialog */}
            <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '16px' }}>
                    Schedule Report - {selectedReport?.name}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={scheduleEnabled}
                                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                                />
                            }
                            label={<Typography sx={{ fontSize: '12px' }}>Enable automatic scheduling</Typography>}
                            sx={{ mb: 2 }}
                        />

                        {scheduleEnabled && (
                            <Stack spacing={2}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>Frequency</InputLabel>
                                    <Select
                                        value={scheduleFrequency}
                                        onChange={(e) => setScheduleFrequency(e.target.value)}
                                        label="Frequency"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <MenuItem value="daily">Daily</MenuItem>
                                        <MenuItem value="weekly">Weekly</MenuItem>
                                        <MenuItem value="monthly">Monthly</MenuItem>
                                        <MenuItem value="quarterly">Quarterly</MenuItem>
                                    </Select>
                                </FormControl>

                                <TextField
                                    fullWidth
                                    label="Time"
                                    type="time"
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                    InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                    inputProps={{ sx: { fontSize: '12px' } }}
                                />

                                {scheduleFrequency === 'monthly' && (
                                    <TextField
                                        fullWidth
                                        label="Day of Month"
                                        type="number"
                                        value={scheduleDayOfMonth}
                                        onChange={(e) => setScheduleDayOfMonth(parseInt(e.target.value))}
                                        inputProps={{ min: 1, max: 31, sx: { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                )}

                                {scheduleFrequency === 'weekly' && (
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
                                )}
                            </Stack>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setScheduleDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveSchedule} variant="contained" sx={{ fontSize: '12px' }}>
                        Save Schedule
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle sx={{ fontSize: '16px' }}>
                    Delete Report
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete "{selectedReport?.name}"? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handleDeleteReport(selectedReport?.id)}
                        color="error"
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SavedReports; 