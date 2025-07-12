import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Switch,
    FormControlLabel,
    Alert,
    Button,
    CircularProgress,
    Snackbar
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    NotificationsOff as NotificationsOffIcon,
    Warning as WarningIcon,
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
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

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
        } finally {
            setSaving(false);
        }
    };

    const handleToggleNotifications = (enabled) => {
        setSettings({
            ...settings,
            notificationsEnabled: enabled
        });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress size={24} />
                <Typography sx={{ ml: 2, fontSize: '12px', color: '#6b7280' }}>
                    Loading notification settings...
                </Typography>
            </Box>
        );
    }

    return (
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
                    </Box>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.notificationsEnabled}
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
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default NotificationSettings; 