import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Switch,
    FormControlLabel,
    Alert,
    Button,
<<<<<<< HEAD
=======
    TextField,
    Grid,
    Card,
    CardContent,
    Divider,
    Chip,
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
    CircularProgress,
    Snackbar
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    NotificationsOff as NotificationsOffIcon,
    Warning as WarningIcon,
<<<<<<< HEAD
    Security as SecurityIcon
} from '@mui/icons-material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../../firebase/firebase';

const NotificationSettings = () => {
    const [settings, setSettings] = useState({
        notificationsEnabled: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const functions = getFunctions(app);

    // Load current settings
=======
    Info as InfoIcon,
    Security as SecurityIcon
} from '@mui/icons-material';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';

const NotificationSettings = () => {
    const [settings, setSettings] = useState({
        notificationsEnabled: true,
        maintenanceMode: false,
        systemMessage: '',
        lastUpdated: null,
        lastUpdatedBy: null
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // Cloud function references
    const getSystemSettingsFunc = httpsCallable(functions, 'getSystemSettings');
    const updateSystemSettingsFunc = httpsCallable(functions, 'updateSystemSettings');

    // Load settings on component mount
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
<<<<<<< HEAD
            setError('');

            const getSystemSettings = httpsCallable(functions, 'getSystemSettings');
            const result = await getSystemSettings();

            if (result.data && result.data.success) {
                setSettings({
                    notificationsEnabled: result.data.settings?.notificationsEnabled ?? true
                });
            } else {
                setSettings({
                    notificationsEnabled: true
                });
            }
        } catch (err) {
            console.error('Error loading notification settings:', err);
            setError('Failed to load notification settings. Defaulting to enabled.');
            setSettings({
                notificationsEnabled: true
            });
=======
            const result = await getSystemSettingsFunc();

            if (result.data.success) {
                setSettings(result.data.settings);
            } else {
                throw new Error(result.data.error || 'Failed to load settings');
            }
        } catch (error) {
            console.error('Error loading system settings:', error);
            showSnackbar('Failed to load system settings: ' + error.message, 'error');
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
        } finally {
            setLoading(false);
        }
    };

<<<<<<< HEAD
    const handleSave = async () => {
        try {
            setSaving(true);
            setError('');
            setSuccess('');

            const updateSystemSettings = httpsCallable(functions, 'updateSystemSettings');
            const result = await updateSystemSettings({
                settings: {
                    notificationsEnabled: settings.notificationsEnabled
                }
            });

            if (result.data && result.data.success) {
                setSuccess('Notification settings saved successfully!');
            } else {
                setError('Failed to save notification settings');
            }
        } catch (err) {
            console.error('Error saving notification settings:', err);
            setError('Failed to save notification settings: ' + (err.message || 'Unknown error'));
=======
    const saveSettings = async () => {
        try {
            setSaving(true);
            const result = await updateSystemSettingsFunc({ settings });

            if (result.data.success) {
                showSnackbar('System settings updated successfully', 'success');
                // Reload to get updated timestamps
                await loadSettings();
            } else {
                throw new Error(result.data.error || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving system settings:', error);
            showSnackbar('Failed to save system settings: ' + error.message, 'error');
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
        } finally {
            setSaving(false);
        }
    };

<<<<<<< HEAD
    const handleToggleNotifications = (enabled) => {
        setSettings({
            ...settings,
            notificationsEnabled: enabled
        });
=======
    const handleSettingChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const formatDate = (date) => {
        if (!date) return 'Never';
        try {
            const dateObj = date.toDate ? date.toDate() : new Date(date);
            return dateObj.toLocaleString();
        } catch {
            return 'Invalid date';
        }
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
    };

    if (loading) {
        return (
<<<<<<< HEAD
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress size={24} />
                <Typography sx={{ ml: 2, fontSize: '12px', color: '#6b7280' }}>
                    Loading notification settings...
                </Typography>
=======
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                    <CircularProgress />
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                </Box>
        );
    }

    return (
<<<<<<< HEAD
        <Box>
            {/* Master Notification Control */}
            <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: 1, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SecurityIcon sx={{ color: '#ef4444', mr: 1 }} />
                    <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Master Notification Control
                    </Typography>
                </Box>

                <Alert severity="warning" sx={{ mb: 3, fontSize: '12px' }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                        ⚠️ CRITICAL SYSTEM CONTROL
                    </Typography>
                    This master switch controls ALL email notifications system-wide. When disabled,
                    no shipment status updates, booking confirmations, or any other automated emails
                    will be sent to users.
                </Alert>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {settings.notificationsEnabled ? (
                            <NotificationsIcon sx={{ color: '#16a34a', mr: 2 }} />
                        ) : (
                            <NotificationsOffIcon sx={{ color: '#ef4444', mr: 2 }} />
                        )}
                        <Box>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                Email Notifications
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                {settings.notificationsEnabled
                                    ? 'All email notifications are ENABLED'
                                    : 'All email notifications are DISABLED'
                                }
                            </Typography>
                        </Box>
=======
        <Box sx={{ p: 3 }}>
                            {/* Header */}
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h5" sx={{ fontSize: '20px', fontWeight: 600, color: '#111827', mb: 1 }}>
                                    Notification Settings
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Control global notification settings and system-wide email delivery
                                </Typography>
                            </Box>

                            {/* Master Notification Switch */}
                            <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 3 }}>
                                <Box sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        {settings.notificationsEnabled ? (
                                            <NotificationsIcon sx={{ fontSize: 24, color: '#10b981', mr: 1 }} />
                                        ) : (
                                            <NotificationsOffIcon sx={{ fontSize: 24, color: '#ef4444', mr: 1 }} />
                                        )}
                                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                            Master Notification Switch
                                        </Typography>
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                                    </Box>

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.notificationsEnabled}
<<<<<<< HEAD
                                                onChange={(e) => handleToggleNotifications(e.target.checked)}
                                                color={settings.notificationsEnabled ? 'success' : 'error'}
                                            />
                                        }
                                        label=""
                                    />
                                </Box>

                                {error && (
                                    <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                                        {error}
                                    </Alert>
                                )}

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="contained"
                                        onClick={handleSave}
                                        disabled={saving}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {saving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                                        Save Settings
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={loadSettings}
                                        disabled={saving}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Refresh
                                    </Button>
                                </Box>
                            </Paper>

                            {/* Status Information */}
                            <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                    📊 Current Status
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box
                                        sx={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            backgroundColor: settings.notificationsEnabled ? '#16a34a' : '#ef4444'
                                        }}
                                    />
                                    <Typography sx={{ fontSize: '12px', color: '#374151' }}>
                                        Email notifications are currently{' '}
                                        <strong>{settings.notificationsEnabled ? 'ENABLED' : 'DISABLED'}</strong>
                                    </Typography>
                                </Box>

                                {!settings.notificationsEnabled && (
                                    <Alert severity="info" sx={{ mt: 2, fontSize: '12px' }}>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            🛡️ <strong>Protection Mode Active:</strong> No emails will be sent while
                                            notifications are disabled. This is perfect for system maintenance,
                                            testing, or bulk data operations.
                                        </Typography>
                                    </Alert>
                                )}
                            </Paper>

                            {/* Success Snackbar */}
                            <Snackbar
                                open={!!success}
                                autoHideDuration={3000}
                                onClose={() => setSuccess('')}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            >
                                <Alert severity="success" sx={{ fontSize: '12px' }}>
                                    {success}
=======
                                onChange={(e) => handleSettingChange('notificationsEnabled', e.target.checked)}
                                    color="primary"
                                    size="medium"
                            />
                        }
                                    label={
                                        <Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                {settings.notificationsEnabled ? 'Email Notifications Enabled' : 'Email Notifications Disabled'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {settings.notificationsEnabled
                                                    ? 'All shipment notifications are being sent normally'
                                                    : 'All email notifications are temporarily disabled'
                                                }
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{ alignItems: 'flex-start' }}
                    />

                                    {!settings.notificationsEnabled && (
                                        <Alert
                                            severity="warning"
                                            sx={{ mt: 2, fontSize: '12px' }}
                                            icon={<WarningIcon fontSize="small" />}
                                        >
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                All Email Notifications Are Disabled
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px' }}>
                                                • No shipment creation emails will be sent<br />
                                                • No status update emails will be sent<br />
                                                • No carrier notifications will be sent<br />
                                                • Customer confirmations will not be delivered<br />
                                                • Internal notifications are suspended
                                            </Typography>
                                        </Alert>
                                    )}
                                </Box>
                            </Paper>

                            {/* Maintenance Mode */}
                            <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 3 }}>
                                <Box sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <SecurityIcon sx={{ fontSize: 24, color: '#f59e0b', mr: 1 }} />
                                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                            Maintenance Mode
                                        </Typography>
                                    </Box>

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.maintenanceMode}
                                                onChange={(e) => handleSettingChange('maintenanceMode', e.target.checked)}
                                                color="warning"
                                                size="medium"
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                    {settings.maintenanceMode ? 'Maintenance Mode Active' : 'Normal Operation'}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    Display maintenance notice to users
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{ alignItems: 'flex-start', mb: 2 }}
                                    />

                                    <TextField
                                        label="System Message"
                                        value={settings.systemMessage}
                                        onChange={(e) => handleSettingChange('systemMessage', e.target.value)}
                                        placeholder="Enter a message to display to users during maintenance..."
                                        fullWidth
                                        multiline
                                        rows={3}
                                        size="small"
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{ sx: { fontSize: '12px' } }}
                                        FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                        helperText="This message will be displayed to users when maintenance mode is active"
                                    />
                                </Box>
                            </Paper>

                            {/* Quick Actions */}
                            <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 3 }}>
                                <Box sx={{ p: 3 }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                        Quick Actions
                                    </Typography>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
                                            <Card sx={{ border: '1px solid #fbbf24', backgroundColor: '#fffbeb' }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#92400e', mb: 1 }}>
                                                        Deployment Mode
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', color: '#92400e', mb: 2 }}>
                                                        Disable notifications during system deployments
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => {
                                                            handleSettingChange('notificationsEnabled', false);
                                                            handleSettingChange('systemMessage', 'System deployment in progress. Email notifications temporarily disabled.');
                                                        }}
                                                        sx={{
                                                            fontSize: '11px',
                                                            backgroundColor: '#f59e0b',
                                                            '&:hover': { backgroundColor: '#d97706' }
                                                        }}
                                                    >
                                                        Enable Deployment Mode
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <Card sx={{ border: '1px solid #10b981', backgroundColor: '#ecfdf5' }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#065f46', mb: 1 }}>
                                                        Normal Operation
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', color: '#065f46', mb: 2 }}>
                                                        Restore normal notification delivery
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => {
                                                            handleSettingChange('notificationsEnabled', true);
                                                            handleSettingChange('maintenanceMode', false);
                                                            handleSettingChange('systemMessage', '');
                                                        }}
                                                        sx={{
                                                            fontSize: '11px',
                                                            backgroundColor: '#10b981',
                                                            '&:hover': { backgroundColor: '#059669' }
                                                        }}
                                                    >
                                                        Restore Normal Operation
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Paper>

                            {/* System Information */}
                            <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 3 }}>
                                <Box sx={{ p: 3 }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                        System Information
                                    </Typography>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Last Updated
                                            </Typography>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                {formatDate(settings.lastUpdated)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Current Status
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                <Chip
                                                    label={settings.notificationsEnabled ? 'Notifications Active' : 'Notifications Disabled'}
                                                    color={settings.notificationsEnabled ? 'success' : 'error'}
                                                    size="small"
                                                    sx={{ fontSize: '11px' }}
                                                />
                                                {settings.maintenanceMode && (
                                                    <Chip
                                                        label="Maintenance Mode"
                                                        color="warning"
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                )}
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Paper>

                            {/* Action Buttons */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                                <Button
                                    variant="outlined"
                                    onClick={loadSettings}
                                    disabled={saving}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Refresh
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={saveSettings}
                                    disabled={saving}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {saving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                                    Save Settings
                                </Button>
                            </Box>

                            {/* Information Panel */}
                            <Alert severity="info" sx={{ mt: 3, fontSize: '12px' }} icon={<InfoIcon fontSize="small" />}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                    How This Works
                                </Typography>
                                <Typography sx={{ fontSize: '11px' }}>
                                    • The master notification switch controls ALL email notifications system-wide<br />
                                    • When disabled, no shipment creation, status update, or carrier emails will be sent<br />
                                    • This is perfect for system deployments, maintenance, or testing<br />
                                    • Changes take effect immediately across all notification functions<br />
                                    • Users will not receive any notification emails until re-enabled
                                </Typography>
                            </Alert>

                            {/* Snackbar */}
                            <Snackbar
                                open={snackbar.open}
                                autoHideDuration={6000}
                                onClose={() => setSnackbar({ ...snackbar, open: false })}
                            >
                                <Alert
                                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                                    severity={snackbar.severity}
                                    sx={{ width: '100%' }}
                                >
                                    {snackbar.message}
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                                </Alert>
                            </Snackbar>
                        </Box>
                        );
};

                        export default NotificationSettings; 