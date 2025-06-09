import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    Grid,
    Alert,
    Snackbar,
    Button,
    Chip,
    Paper,
    CircularProgress,
    useTheme
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    Email as EmailIcon,
    Info as InfoIcon,
    Save as SaveIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    LocalShipping as ShippingIcon,
    Visibility as VisibilityIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const NotificationPreferences = () => {
    const { currentUser: user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyLoading } = useCompany();
    const theme = useTheme();
    const functions = getFunctions();

    const [preferences, setPreferences] = useState({
        shipment_created: true,
        shipment_delivered: true,
        shipment_delayed: true,
        status_changed: true,
        hawkeye_mode: false
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // Notification types configuration
    const notificationTypes = [
        {
            key: 'shipment_created',
            title: 'Shipment Created',
            description: 'Notify when a shipment is successfully booked. Include tracking number and shipment details.',
            icon: <ShippingIcon />,
            color: '#1976d2',
            category: 'Booking'
        },
        {
            key: 'shipment_delivered',
            title: 'Shipment Delivered',
            description: 'Notify when a shipment is delivered. Include timestamp, carrier, and tracking.',
            icon: <CheckCircleIcon />,
            color: '#28a745',
            category: 'Delivery'
        },
        {
            key: 'shipment_delayed',
            title: 'Shipment Delayed',
            description: 'Notify when there\'s a delay. Include estimated delivery and reason if available.',
            icon: <WarningIcon />,
            color: '#ff9800',
            category: 'Issues'
        },
        {
            key: 'status_changed',
            title: 'Status Changes',
            description: 'Notify on any shipment status change (e.g., In Transit → Out for Delivery). Include new status + summary.',
            icon: <InfoIcon />,
            color: '#6f42c1',
            category: 'Updates'
        },
        {
            key: 'hawkeye_mode',
            title: 'Hawkeye Mode',
            description: 'Master toggle – receive all notifications regardless of other toggles.',
            icon: <VisibilityIcon />,
            color: '#dc3545',
            category: 'Master',
            isMaster: true
        }
    ];

    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    const loadPreferences = useCallback(async () => {
        if (!user?.uid) {
            console.log('No user or user.uid available, skipping preference load');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            console.log('Loading preferences for user:', user.uid);
            // Fetch user's notification preferences from Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            let storedPrefs = {
                shipment_created: true,
                shipment_delivered: true,
                shipment_delayed: true,
                status_changed: true,
                hawkeye_mode: false
            };

            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('User document found:', userData);
                if (userData.notifications) {
                    storedPrefs = { ...storedPrefs, ...userData.notifications };
                    console.log('Loaded preferences:', storedPrefs);
                }
            } else {
                console.log('User document does not exist, using defaults');
            }

            setPreferences(storedPrefs);
        } catch (error) {
            console.error('Error loading preferences:', error);
            showSnackbar('Error loading preferences', 'error');
        } finally {
            setLoading(false);
        }
    }, [user?.uid, showSnackbar]);

    useEffect(() => {
        console.log('Auth state:', { user: !!user, uid: user?.uid, authLoading });

        if (authLoading) {
            // Still checking auth, keep loading
            setLoading(true);
            return;
        }

        if (user?.uid) {
            loadPreferences();
        } else {
            // Auth is done but no user, stop loading
            setLoading(false);
        }
    }, [user?.uid, authLoading, loadPreferences]);

    const savePreferences = async () => {
        if (!user || !companyIdForAddress) {
            showSnackbar('Missing user or company information', 'error');
            return;
        }

        setSaving(true);
        try {
            const updatePreferences = httpsCallable(functions, 'updateNotificationPreferences');

            await updatePreferences({
                userId: user.uid,
                companyId: companyIdForAddress,
                preferences: preferences
            });

            showSnackbar('Notification preferences saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving preferences:', error);
            showSnackbar('Error saving preferences', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handlePreferenceChange = (key) => (event) => {
        const newValue = event.target.checked;

        setPreferences(prev => {
            const updated = { ...prev, [key]: newValue };

            // If hawkeye mode is enabled, enable all others
            if (key === 'hawkeye_mode' && newValue) {
                return {
                    ...updated,
                    shipment_created: true,
                    shipment_delivered: true,
                    shipment_delayed: true,
                    status_changed: true
                };
            }

            // If hawkeye mode is disabled and any individual setting is changed
            if (key !== 'hawkeye_mode' && updated.hawkeye_mode) {
                return {
                    ...updated,
                    hawkeye_mode: false
                };
            }

            return updated;
        });
    };



    const getEffectiveStatus = (key) => {
        if (preferences.hawkeye_mode) return true;
        return preferences[key];
    };

    // Show loading while auth is still checking, company is loading, or preferences are loading
    if (authLoading || companyLoading || loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    // If auth is done but no user, show login message
    if (!user) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px" flexDirection="column" gap={2}>
                <Typography variant="h6">Please log in to manage notification preferences</Typography>
                <Button variant="contained" href="/login">
                    Go to Login
                </Button>
            </Box>
        );
    }

    // If user is authenticated but no company information is available
    if (!companyIdForAddress) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px" flexDirection="column" gap={2}>
                <Typography variant="h6">Company information not available</Typography>
                <Typography variant="body2" color="text.secondary">
                    Please refresh the page or contact support if this issue persists.
                </Typography>
                <Button variant="contained" onClick={() => window.location.reload()}>
                    Refresh Page
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: 3 }}>
            {/* Breadcrumb */}
            <div className="breadcrumb-container" style={{
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'nowrap',
                width: '100%'
            }}>
                <Link to="/dashboard" className="breadcrumb-link" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                    color: '#64748b',
                    fontSize: '14px',
                    whiteSpace: 'nowrap'
                }}>
                    <HomeIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">Dashboard</Typography>
                </Link>
                <div className="breadcrumb-separator" style={{ margin: '0 8px', color: '#64748b' }}>
                    <NavigateNextIcon sx={{ fontSize: 16 }} />
                </div>
                <Typography variant="body2" className="breadcrumb-current" sx={{
                    color: '#1e293b',
                    fontSize: '14px',
                    whiteSpace: 'nowrap'
                }}>
                    Notifications
                </Typography>
            </div>

            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <NotificationsIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                        <Typography variant="h4" component="h1">
                            Email Notification Preferences
                        </Typography>
                    </Box>

                    <Box display="flex" gap={2} flexWrap="wrap">
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={savePreferences}
                            disabled={saving}
                            sx={{ minWidth: 120 }}
                        >
                            {saving ? <CircularProgress size={20} /> : 'Save Changes'}
                        </Button>
                    </Box>
                </Box>

                <Typography variant="body1" color="text.secondary" paragraph>
                    Manage when and how you receive email notifications about your shipments.
                    All notifications are sent to <strong>{user?.email}</strong>.
                </Typography>
            </Box>

            {/* Hawkeye Mode Alert */}
            {preferences.hawkeye_mode && (
                <Alert
                    severity="info"
                    sx={{ mb: 3 }}
                    icon={<VisibilityIcon />}
                >
                    <strong>Hawkeye Mode is active!</strong> You will receive all notification types regardless of individual settings below.
                </Alert>
            )}

            {/* Notification Categories */}
            <Grid container spacing={3}>
                {/* Master Controls */}
                <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                        <SettingsIcon /> Master Controls
                    </Typography>

                    {notificationTypes
                        .filter(type => type.isMaster)
                        .map((type) => (
                            <Card key={type.key} sx={{ mb: 2 }}>
                                <CardContent>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <Box display="flex" alignItems="center" gap={2}>
                                            <Box
                                                sx={{
                                                    color: type.color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    fontSize: 28
                                                }}
                                            >
                                                {type.icon}
                                            </Box>
                                            <Box>
                                                <Typography variant="h6" component="div">
                                                    {type.title}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {type.description}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={preferences[type.key]}
                                                    onChange={handlePreferenceChange(type.key)}
                                                    color="primary"
                                                    size="large"
                                                />
                                            }
                                            label=""
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                </Grid>

                {/* Individual Notification Types */}
                <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                        <EmailIcon /> Individual Notification Types
                    </Typography>

                    <Grid container spacing={2}>
                        {notificationTypes
                            .filter(type => !type.isMaster)
                            .map((type) => (
                                <Grid item xs={12} md={6} key={type.key}>
                                    <Card
                                        sx={{
                                            height: '100%',
                                            opacity: preferences.hawkeye_mode ? 0.7 : 1,
                                            transition: 'opacity 0.3s ease'
                                        }}
                                    >
                                        <CardContent>
                                            <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                                                <Box display="flex" alignItems="center" gap={2}>
                                                    <Box
                                                        sx={{
                                                            color: type.color,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            fontSize: 24
                                                        }}
                                                    >
                                                        {type.icon}
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="h6" component="div">
                                                            {type.title}
                                                        </Typography>
                                                        <Chip
                                                            label={type.category}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: `${type.color}20`,
                                                                color: type.color,
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    </Box>
                                                </Box>

                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={getEffectiveStatus(type.key)}
                                                            onChange={handlePreferenceChange(type.key)}
                                                            disabled={preferences.hawkeye_mode}
                                                            color="primary"
                                                        />
                                                    }
                                                    label=""
                                                />
                                            </Box>

                                            <Typography variant="body2" color="text.secondary">
                                                {type.description}
                                            </Typography>

                                            <Box mt={2}>
                                                <Chip
                                                    label={getEffectiveStatus(type.key) ? 'Enabled' : 'Disabled'}
                                                    color={getEffectiveStatus(type.key) ? 'success' : 'default'}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                    </Grid>
                </Grid>

                {/* Email Settings Info */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3, backgroundColor: '#f8f9fa' }}>
                        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                            <InfoIcon color="primary" /> Email Settings
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <Box>
                                    <Typography variant="subtitle2" color="primary">From Address</Typography>
                                    <Typography variant="body2">notifications@solushipx.com</Typography>
                                </Box>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Box>
                                    <Typography variant="subtitle2" color="primary">Your Email</Typography>
                                    <Typography variant="body2">{user?.email}</Typography>
                                </Box>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Box>
                                    <Typography variant="subtitle2" color="primary">Delivery Method</Typography>
                                    <Typography variant="body2">Real-time via SendGrid</Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>



            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default NotificationPreferences; 