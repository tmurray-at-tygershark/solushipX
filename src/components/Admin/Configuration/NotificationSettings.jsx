import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Switch,
    FormControlLabel,
    Alert,
    Button,
    TextField,
    Grid,
    Card,
    CardContent,
    Divider,
    Chip,
    CircularProgress,
    Snackbar
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    NotificationsOff as NotificationsOffIcon,
    Warning as WarningIcon,
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
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const result = await getSystemSettingsFunc();

            if (result.data.success) {
                setSettings(result.data.settings);
            } else {
                throw new Error(result.data.error || 'Failed to load settings');
            }
        } catch (error) {
            console.error('Error loading system settings:', error);
            showSnackbar('Failed to load system settings: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

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
        } finally {
            setSaving(false);
        }
    };

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
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
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
                    </Box>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.notificationsEnabled}
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
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default NotificationSettings; 