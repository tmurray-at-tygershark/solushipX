import React, { useState, useEffect, useCallback } from 'react';
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
    Switch,
    FormControlLabel,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Chip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    Divider,
    Card,
    CardContent,
    CardActions,
    CircularProgress
} from '@mui/material';
import {
    Email as EmailIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Notifications as NotificationsIcon,
    Schedule as ScheduleIcon,
    Settings as SettingsIcon,
    Send as SendIcon,
    Group as GroupIcon
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
    addDoc,
    onSnapshot,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../firebase';

const ReportNotifications = ({ onUpdate }) => {
    const { companyIdForAddress } = useCompany();
    const { currentUser } = useAuth();

    // State
    const [notificationSettings, setNotificationSettings] = useState({
        emailEnabled: true,
        webhookEnabled: false
    });

    const [emailGroups, setEmailGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Form state for new/edit group
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [groupEmails, setGroupEmails] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [selectedReportTypes, setSelectedReportTypes] = useState([]);

    // Test email state
    const [testEmailRecipient, setTestEmailRecipient] = useState('');
    const [testEmailSubject, setTestEmailSubject] = useState('Test Report Notification');
    const [testEmailMessage, setTestEmailMessage] = useState('This is a test notification from SolushipX Reports system.');
    const [sendingTestEmail, setSendingTestEmail] = useState(false);

    // Notification preferences
    const [notificationPreferences, setNotificationPreferences] = useState({
        reportGenerated: true,
        reportFailed: true,
        scheduleReminder: true,
        weeklyDigest: false,
        monthlyDigest: true
    });

    const reportTypes = [
        'shipment-summary',
        'carrier-performance',
        'cost-analysis',
        'delivery-performance',
        'customer-activity',
        'route-analysis',
        'revenue-report',
        'exception-report'
    ];

    // Define loadEmailGroups first (before the useEffect that uses it)
    const loadEmailGroups = useCallback(async () => {
        if (!companyIdForAddress) return;

        setLoading(true);
        try {
            const groupsRef = collection(db, 'reportEmailGroups');
            const q = query(
                groupsRef,
                where('companyId', '==', companyIdForAddress),
                orderBy('createdAt', 'desc')
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const groups = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setEmailGroups(groups);
                setLoading(false);
            }, (error) => {
                console.error('Error loading email groups:', error);
                // If indexing error, create a basic default group
                if (error.code === 'failed-precondition') {
                    console.log('Creating default email group due to indexing...');
                    const defaultGroup = {
                        id: 'default-' + Date.now(),
                        name: 'Default Group',
                        emails: [currentUser?.email].filter(Boolean),
                        description: 'Default notification group',
                        isActive: true,
                        isDefault: true,
                        reportTypes: [],
                        createdAt: new Date().toISOString()
                    };
                    setEmailGroups([defaultGroup]);
                } else {
                    setError('Failed to load email groups');
                }
                setLoading(false);
            });

            return unsubscribe;
        } catch (error) {
            console.error('Error loading email groups:', error);
            setError('Failed to load email groups. Please refresh the page.');
            setLoading(false);
        }
    }, [companyIdForAddress, currentUser?.email]);

    useEffect(() => {
        if (companyIdForAddress) {
            loadNotificationSettings();
            loadEmailGroups();
        }
    }, [companyIdForAddress, loadEmailGroups]);

    const loadNotificationSettings = async () => {
        try {
            // Load notification settings from company document
            const companyQuery = query(
                collection(db, 'companies'),
                where('companyID', '==', companyIdForAddress)
            );
            const companySnapshot = await getDocs(companyQuery);

            if (!companySnapshot.empty) {
                const companyData = companySnapshot.docs[0].data();
                if (companyData.reportNotificationSettings) {
                    setNotificationSettings(companyData.reportNotificationSettings);
                }
                if (companyData.reportNotificationPreferences) {
                    setNotificationPreferences(companyData.reportNotificationPreferences);
                }
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
            setError('Failed to load notification settings');
        }
    };

    const handleSettingChange = (setting, value) => {
        setNotificationSettings(prev => ({
            ...prev,
            [setting]: value
        }));
    };

    const handlePreferenceChange = (preference, value) => {
        setNotificationPreferences(prev => ({
            ...prev,
            [preference]: value
        }));
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        setError(null);

        try {
            // Update company document with notification settings
            const companyQuery = query(
                collection(db, 'companies'),
                where('companyID', '==', companyIdForAddress)
            );
            const companySnapshot = await getDocs(companyQuery);

            if (!companySnapshot.empty) {
                const companyDocRef = doc(db, 'companies', companySnapshot.docs[0].id);
                await updateDoc(companyDocRef, {
                    reportNotificationSettings: notificationSettings,
                    reportNotificationPreferences: notificationPreferences,
                    updatedAt: serverTimestamp()
                });

                setSuccess('Notification settings saved successfully');

                if (onUpdate) {
                    onUpdate({ notificationSettings, notificationPreferences });
                }
            }
        } catch (error) {
            console.error('Error saving notification settings:', error);
            setError('Failed to save notification settings');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenGroupDialog = (group = null) => {
        if (group) {
            setSelectedGroup(group);
            setGroupName(group.name);
            setGroupDescription(group.description);
            setGroupEmails([...group.emails]);
            setSelectedReportTypes([...group.reportTypes]);
        } else {
            setSelectedGroup(null);
            setGroupName('');
            setGroupDescription('');
            setGroupEmails([]);
            setSelectedReportTypes([]);
        }
        setGroupDialogOpen(true);
    };

    const handleSaveGroup = async () => {
        try {
            setError(null);

            const groupData = {
                name: groupName,
                description: groupDescription,
                emails: groupEmails,
                reportTypes: selectedReportTypes,
                companyId: companyIdForAddress,
                updatedAt: serverTimestamp()
            };

            if (selectedGroup) {
                // Update existing group
                await updateDoc(doc(db, 'reportEmailGroups', selectedGroup.id), groupData);
                setSuccess('Email group updated successfully');
            } else {
                // Create new group
                await addDoc(collection(db, 'reportEmailGroups'), {
                    ...groupData,
                    createdBy: currentUser?.uid,
                    createdAt: serverTimestamp(),
                    isDefault: false
                });
                setSuccess('Email group created successfully');
            }

            setGroupDialogOpen(false);
            setSelectedGroup(null);
            setGroupName('');
            setGroupDescription('');
            setGroupEmails([]);
            setSelectedReportTypes([]);
        } catch (error) {
            console.error('Error saving email group:', error);
            setError('Failed to save email group');
        }
    };

    const handleDeleteGroup = async (groupId) => {
        try {
            await deleteDoc(doc(db, 'reportEmailGroups', groupId));
            setSuccess('Email group deleted successfully');
        } catch (error) {
            console.error('Error deleting email group:', error);
            setError('Failed to delete email group');
        }
    };

    const handleAddEmail = () => {
        if (newEmail && !groupEmails.includes(newEmail)) {
            setGroupEmails([...groupEmails, newEmail]);
            setNewEmail('');
        }
    };

    const handleRemoveEmail = (email) => {
        setGroupEmails(groupEmails.filter(e => e !== email));
    };

    const handleReportTypeChange = (reportType) => {
        setSelectedReportTypes(prev =>
            prev.includes(reportType)
                ? prev.filter(type => type !== reportType)
                : [...prev, reportType]
        );
    };

    const handleSendTestEmail = async () => {
        setSendingTestEmail(true);
        setError(null);

        try {
            // Call cloud function to send test email
            const sendTestEmailFunction = httpsCallable(functions, 'sendTestReportNotification');
            const result = await sendTestEmailFunction({
                recipient: testEmailRecipient,
                subject: testEmailSubject,
                message: testEmailMessage,
                companyId: companyIdForAddress
            });

            if (result.data.success) {
                setSuccess('Test email sent successfully');
                setTestEmailDialogOpen(false);
                setTestEmailRecipient('');
                setTestEmailSubject('Test Report Notification');
                setTestEmailMessage('This is a test notification from SolushipX Reports system.');
            } else {
                throw new Error('Failed to send test email');
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            setError('Failed to send test email');
        } finally {
            setSendingTestEmail(false);
        }
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
                {/* Notification Settings */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Notification Channels
                        </Typography>

                        <Stack spacing={2}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notificationSettings.emailEnabled}
                                        onChange={(e) => handleSettingChange('emailEnabled', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Email Notifications</Typography>}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notificationSettings.webhookEnabled}
                                        onChange={(e) => handleSettingChange('webhookEnabled', e.target.checked)}
                                        disabled
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>Webhook Integration (Coming Soon)</Typography>}
                            />
                        </Stack>
                    </Paper>

                    {/* Notification Preferences */}
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Notification Preferences
                        </Typography>

                        <Stack spacing={2}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notificationPreferences.reportGenerated}
                                        onChange={(e) => handlePreferenceChange('reportGenerated', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Report Generated Successfully</Typography>}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notificationPreferences.reportFailed}
                                        onChange={(e) => handlePreferenceChange('reportFailed', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Report Generation Failed</Typography>}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notificationPreferences.scheduleReminder}
                                        onChange={(e) => handlePreferenceChange('scheduleReminder', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Scheduled Report Reminders</Typography>}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notificationPreferences.weeklyDigest}
                                        onChange={(e) => handlePreferenceChange('weeklyDigest', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Weekly Report Digest</Typography>}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notificationPreferences.monthlyDigest}
                                        onChange={(e) => handlePreferenceChange('monthlyDigest', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Monthly Report Digest</Typography>}
                            />
                        </Stack>

                        <Divider sx={{ my: 2 }} />

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="contained"
                                onClick={handleSaveSettings}
                                disabled={loading}
                                sx={{ fontSize: '12px' }}
                            >
                                {loading ? <CircularProgress size={16} /> : 'Save Settings'}
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => setTestEmailDialogOpen(true)}
                                startIcon={<SendIcon />}
                                sx={{ fontSize: '12px' }}
                            >
                                Send Test Email
                            </Button>
                        </Stack>
                    </Paper>
                </Grid>

                {/* Email Groups */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                <GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Email Groups ({emailGroups.length})
                            </Typography>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenGroupDialog()}
                                sx={{ fontSize: '11px' }}
                            >
                                New Group
                            </Button>
                        </Box>

                        <Stack spacing={2} sx={{ maxHeight: 500, overflow: 'auto' }}>
                            {emailGroups.map((group) => (
                                <Card key={group.id} variant="outlined">
                                    <CardContent sx={{ pb: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    {group.name}
                                                    {group.isDefault && (
                                                        <Chip label="Default" size="small" color="primary" sx={{ ml: 1, fontSize: '9px' }} />
                                                    )}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '10px' }}>
                                                    {group.description}
                                                </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={0.5}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenGroupDialog(group)}
                                                >
                                                    <EditIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                                {!group.isDefault && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                        color="error"
                                                    >
                                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                )}
                                            </Stack>
                                        </Box>

                                        <Box sx={{ mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontSize: '10px', color: 'text.secondary' }}>
                                                Recipients ({group.emails?.length || 0}):
                                            </Typography>
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                                {(group.emails || []).slice(0, 2).map((email) => (
                                                    <Chip key={email} label={email} size="small" sx={{ fontSize: '9px' }} />
                                                ))}
                                                {(group.emails || []).length > 2 && (
                                                    <Chip label={`+${group.emails.length - 2} more`} size="small" sx={{ fontSize: '9px' }} />
                                                )}
                                            </Stack>
                                        </Box>

                                        {(group.reportTypes || []).length > 0 && (
                                            <Box>
                                                <Typography variant="body2" sx={{ fontSize: '10px', color: 'text.secondary' }}>
                                                    Report Types:
                                                </Typography>
                                                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                                    {group.reportTypes.slice(0, 3).map((type) => (
                                                        <Chip
                                                            key={type}
                                                            label={type.replace('-', ' ')}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontSize: '9px', textTransform: 'capitalize' }}
                                                        />
                                                    ))}
                                                    {group.reportTypes.length > 3 && (
                                                        <Chip label={`+${group.reportTypes.length - 3} more`} size="small" variant="outlined" sx={{ fontSize: '9px' }} />
                                                    )}
                                                </Stack>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>

                        {emailGroups.length === 0 && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    No email groups configured. Create your first group to organize report recipients.
                                </Typography>
                            </Alert>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Email Group Dialog */}
            <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontSize: '16px' }}>
                    {selectedGroup ? 'Edit Email Group' : 'Create Email Group'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Group Name"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />

                        <TextField
                            fullWidth
                            label="Description"
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            multiline
                            rows={2}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                Email Addresses
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Email Address"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    inputProps={{ sx: { fontSize: '12px' } }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleAddEmail}
                                    disabled={!newEmail}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Add
                                </Button>
                            </Box>

                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {groupEmails.map((email) => (
                                    <Chip
                                        key={email}
                                        label={email}
                                        size="small"
                                        onDelete={() => handleRemoveEmail(email)}
                                        sx={{ fontSize: '10px', mb: 1 }}
                                    />
                                ))}
                            </Stack>
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                Report Types (Optional)
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '10px', color: 'text.secondary', mb: 2 }}>
                                Select which report types this group should receive. Leave empty for all types.
                            </Typography>

                            <Grid container spacing={1}>
                                {reportTypes.map((type) => (
                                    <Grid item xs={6} key={type}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={selectedReportTypes.includes(type)}
                                                    onChange={() => handleReportTypeChange(type)}
                                                    size="small"
                                                />
                                            }
                                            label={
                                                <Typography sx={{ fontSize: '11px', textTransform: 'capitalize' }}>
                                                    {type.replace('-', ' ')}
                                                </Typography>
                                            }
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setGroupDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveGroup}
                        variant="contained"
                        disabled={!groupName || groupEmails.length === 0}
                        sx={{ fontSize: '12px' }}
                    >
                        {selectedGroup ? 'Update Group' : 'Create Group'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Test Email Dialog */}
            <Dialog open={testEmailDialogOpen} onClose={() => setTestEmailDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '16px' }}>
                    Send Test Email
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Recipient Email"
                            value={testEmailRecipient}
                            onChange={(e) => setTestEmailRecipient(e.target.value)}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />

                        <TextField
                            fullWidth
                            label="Subject"
                            value={testEmailSubject}
                            onChange={(e) => setTestEmailSubject(e.target.value)}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />

                        <TextField
                            fullWidth
                            label="Message"
                            value={testEmailMessage}
                            onChange={(e) => setTestEmailMessage(e.target.value)}
                            multiline
                            rows={4}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            inputProps={{ sx: { fontSize: '12px' } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTestEmailDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSendTestEmail}
                        variant="contained"
                        disabled={!testEmailRecipient || sendingTestEmail}
                        sx={{ fontSize: '12px' }}
                    >
                        {sendingTestEmail ? <CircularProgress size={16} /> : 'Send Test Email'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ReportNotifications; 