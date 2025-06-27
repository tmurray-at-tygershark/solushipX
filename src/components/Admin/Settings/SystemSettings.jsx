import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    Switch,
    FormControlLabel,
    TextField,
    Button,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    IconButton,
    Tooltip,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Settings as SettingsIcon,
    Save as SaveIcon,
    Refresh as RefreshIcon,
    Security as SecurityIcon,
    Speed as PerformanceIcon,
    AttachMoney as CurrencyIcon,
    AccessTime as TimezoneIcon,
    Sync as SyncIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { doc, getDoc, updateDoc, serverTimestamp, getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { app } from '../../../firebase/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const SystemSettings = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncingRates, setSyncingRates] = useState(false);
    const [currentRates, setCurrentRates] = useState(null);
    const [lastRateUpdate, setLastRateUpdate] = useState(null);
    const db = getFirestore(app);
    const functions = getFunctions(app);
    const [settings, setSettings] = useState({
        // General Settings
        systemName: 'SolushipX',
        systemVersion: '1.0.0',
        maintenanceMode: false,
        debugMode: false,

        // Currency Settings
        defaultCurrency: 'CAD',
        currencyApiKey: '',
        currencyProvider: 'exchangerate-api', // exchangerate-api, fixer, currencylayer
        autoSyncRates: true,
        syncHour: 9, // Hour of day to sync (0-23)

        // Timezone Settings
        defaultTimezone: 'America/Toronto',

        // Performance Settings
        cacheEnabled: true,
        cacheTimeout: 300,
        maxConcurrentRequests: 10,
        requestTimeout: 30,

        // Security Settings
        sessionTimeout: 3600,
        passwordMinLength: 8,
        requireTwoFactor: false,
        maxLoginAttempts: 5,
        lockoutDuration: 900
    });

    useEffect(() => {
        loadSettings();
        loadCurrentRates();
    }, []);

    // Timezone options (major North American timezones)
    const timezoneOptions = [
        { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
        { value: 'America/Montreal', label: 'Eastern Time (Montreal)' },
        { value: 'America/New_York', label: 'Eastern Time (New York)' },
        { value: 'America/Chicago', label: 'Central Time (Chicago)' },
        { value: 'America/Denver', label: 'Mountain Time (Denver)' },
        { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
        { value: 'America/Edmonton', label: 'Mountain Time (Edmonton)' },
        { value: 'America/Winnipeg', label: 'Central Time (Winnipeg)' },
        { value: 'America/Halifax', label: 'Atlantic Time (Halifax)' }
    ];

    // Currency options
    const currencyOptions = [
        { value: 'CAD', label: 'Canadian Dollar (CAD)' },
        { value: 'USD', label: 'US Dollar (USD)' },
        { value: 'EUR', label: 'Euro (EUR)' },
        { value: 'GBP', label: 'British Pound (GBP)' }
    ];

    // Currency provider options
    const currencyProviderOptions = [
        { value: 'exchangerate-api', label: 'ExchangeRate-API (Free)' },
        { value: 'fixer', label: 'Fixer.io' },
        { value: 'currencylayer', label: 'CurrencyLayer' }
    ];

    const loadSettings = async () => {
        try {
            setLoading(true);
            const settingsDoc = await getDoc(doc(db, 'systemSettings', 'global'));

            if (settingsDoc.exists()) {
                setSettings(prev => ({
                    ...prev,
                    ...settingsDoc.data()
                }));
            }
        } catch (error) {
            console.error('Error loading system settings:', error);
            enqueueSnackbar('Failed to load system settings', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadCurrentRates = async () => {
        try {
            // Get the most recent currency rates
            const ratesQuery = query(
                collection(db, 'currencyRates'),
                orderBy('timestamp', 'desc'),
                limit(1)
            );
            const snapshot = await getDocs(ratesQuery);

            if (!snapshot.empty) {
                const rateData = snapshot.docs[0].data();
                setCurrentRates(rateData.rates);
                setLastRateUpdate(rateData.timestamp?.toDate());
            }
        } catch (error) {
            console.error('Error loading current rates:', error);
        }
    };

    const handleSyncCurrencyRates = async () => {
        if (!settings.currencyApiKey && settings.currencyProvider !== 'exchangerate-api') {
            enqueueSnackbar('Please configure currency API key first', { variant: 'warning' });
            return;
        }

        try {
            setSyncingRates(true);
            enqueueSnackbar('Syncing currency rates...', { variant: 'info' });

            const syncCurrencyRates = httpsCallable(functions, 'syncCurrencyRates');
            const result = await syncCurrencyRates({
                provider: settings.currencyProvider,
                apiKey: settings.currencyApiKey,
                baseCurrency: settings.defaultCurrency
            });

            if (result.data.success) {
                setCurrentRates(result.data.rates);
                setLastRateUpdate(new Date());
                enqueueSnackbar('Currency rates synced successfully', { variant: 'success' });
            } else {
                throw new Error(result.data.error || 'Failed to sync rates');
            }
        } catch (error) {
            console.error('Error syncing currency rates:', error);
            enqueueSnackbar(`Failed to sync currency rates: ${error.message}`, { variant: 'error' });
        } finally {
            setSyncingRates(false);
        }
    };

    const handleSettingChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            await updateDoc(doc(db, 'systemSettings', 'global'), {
                ...settings,
                lastUpdated: serverTimestamp(),
                updatedBy: 'admin'
            });

            enqueueSnackbar('System settings saved successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error saving system settings:', error);
            enqueueSnackbar('Failed to save system settings', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        loadSettings();
        enqueueSnackbar('Settings refreshed', { variant: 'info' });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                borderBottom: '1px solid #e5e7eb',
                pb: 2
            }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', fontSize: '20px' }}>
                        System Settings
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mt: 0.5 }}>
                        Configure global system settings and preferences
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh Settings">
                        <IconButton onClick={handleRefresh} size="small">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                        onClick={handleSave}
                        disabled={saving}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Box>
            </Box>

            {/* Settings Sections */}
            <Grid container spacing={3}>
                {/* General Settings */}
                <Grid item xs={12}>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SettingsIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    General Settings
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="System Name"
                                        value={settings.systemName}
                                        onChange={(e) => handleSettingChange('systemName', e.target.value)}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="System Version"
                                        value={settings.systemVersion}
                                        onChange={(e) => handleSettingChange('systemVersion', e.target.value)}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.maintenanceMode}
                                                onChange={(e) => handleSettingChange('maintenanceMode', e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Maintenance Mode</Typography>}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.debugMode}
                                                onChange={(e) => handleSettingChange('debugMode', e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Debug Mode</Typography>}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Security Settings */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SecurityIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Security Settings
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Session Timeout (seconds)"
                                        type="number"
                                        value={settings.sessionTimeout}
                                        onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Password Minimum Length"
                                        type="number"
                                        value={settings.passwordMinLength}
                                        onChange={(e) => handleSettingChange('passwordMinLength', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Max Login Attempts"
                                        type="number"
                                        value={settings.maxLoginAttempts}
                                        onChange={(e) => handleSettingChange('maxLoginAttempts', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Lockout Duration (seconds)"
                                        type="number"
                                        value={settings.lockoutDuration}
                                        onChange={(e) => handleSettingChange('lockoutDuration', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.requireTwoFactor}
                                                onChange={(e) => handleSettingChange('requireTwoFactor', e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Require Two-Factor Authentication</Typography>}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Currency Settings */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CurrencyIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Currency & Exchange Rates
                                </Typography>
                                {currentRates && (
                                    <Chip
                                        label={`Last updated: ${lastRateUpdate?.toLocaleDateString()}`}
                                        size="small"
                                        sx={{ fontSize: '10px', ml: 1 }}
                                        color="success"
                                    />
                                )}
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        select
                                        label="Default System Currency"
                                        value={settings.defaultCurrency}
                                        onChange={(e) => handleSettingChange('defaultCurrency', e.target.value)}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        SelectProps={{
                                            native: true,
                                        }}
                                    >
                                        {currencyOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        select
                                        label="Currency Data Provider"
                                        value={settings.currencyProvider}
                                        onChange={(e) => handleSettingChange('currencyProvider', e.target.value)}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        SelectProps={{
                                            native: true,
                                        }}
                                    >
                                        {currencyProviderOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </TextField>
                                </Grid>
                                {settings.currencyProvider !== 'exchangerate-api' && (
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            label="Currency API Key"
                                            type="password"
                                            value={settings.currencyApiKey}
                                            onChange={(e) => handleSettingChange('currencyApiKey', e.target.value)}
                                            size="small"
                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                            helperText="Required for paid providers"
                                        />
                                    </Grid>
                                )}
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Daily Sync Hour (24h format)"
                                        type="number"
                                        inputProps={{ min: 0, max: 23 }}
                                        value={settings.syncHour}
                                        onChange={(e) => handleSettingChange('syncHour', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        helperText="Hour of day to auto-sync rates"
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.autoSyncRates}
                                                onChange={(e) => handleSettingChange('autoSyncRates', e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Auto-sync exchange rates daily</Typography>}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={syncingRates ? <CircularProgress size={16} /> : <SyncIcon />}
                                            onClick={handleSyncCurrencyRates}
                                            disabled={syncingRates}
                                            size="small"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            {syncingRates ? 'Syncing...' : 'Sync Rates Now'}
                                        </Button>
                                        {lastRateUpdate && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                Last sync: {lastRateUpdate.toLocaleString()}
                                            </Typography>
                                        )}
                                    </Box>
                                </Grid>
                                {currentRates && (
                                    <Grid item xs={12}>
                                        <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                            <Typography sx={{ fontWeight: 600, fontSize: '12px', color: '#374151', mb: 1 }}>
                                                Current Exchange Rates (Base: {settings.defaultCurrency})
                                            </Typography>
                                            <Grid container spacing={1}>
                                                {Object.entries(currentRates).slice(0, 8).map(([currency, rate]) => (
                                                    <Grid item xs={6} md={3} key={currency}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                            <Typography sx={{ fontWeight: 600 }}>{currency}:</Typography>
                                                            <Typography>{parseFloat(rate).toFixed(4)}</Typography>
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </Paper>
                                    </Grid>
                                )}
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Timezone Settings */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TimezoneIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Timezone Settings
                                </Typography>
                                <Chip
                                    label={new Date().toLocaleString('en-US', { timeZone: settings.defaultTimezone })}
                                    size="small"
                                    sx={{ fontSize: '10px', ml: 1 }}
                                    color="primary"
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={8}>
                                    <TextField
                                        fullWidth
                                        select
                                        label="Default System Timezone"
                                        value={settings.defaultTimezone}
                                        onChange={(e) => handleSettingChange('defaultTimezone', e.target.value)}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        SelectProps={{
                                            native: true,
                                        }}
                                        helperText="Used for system timestamps, reports, and scheduling"
                                    >
                                        {timezoneOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Paper sx={{ p: 2, backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
                                        <Typography sx={{ fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>
                                            Current Time
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#0c4a6e' }}>
                                            {new Date().toLocaleString('en-US', {
                                                timeZone: settings.defaultTimezone,
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                timeZoneName: 'short'
                                            })}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Performance Settings */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PerformanceIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Performance Settings
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Cache Timeout (seconds)"
                                        type="number"
                                        value={settings.cacheTimeout}
                                        onChange={(e) => handleSettingChange('cacheTimeout', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Max Concurrent Requests"
                                        type="number"
                                        value={settings.maxConcurrentRequests}
                                        onChange={(e) => handleSettingChange('maxConcurrentRequests', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Request Timeout (seconds)"
                                        type="number"
                                        value={settings.requestTimeout}
                                        onChange={(e) => handleSettingChange('requestTimeout', parseInt(e.target.value))}
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.cacheEnabled}
                                                onChange={(e) => handleSettingChange('cacheEnabled', e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Enable Caching</Typography>}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Status Information */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2, border: '1px solid #e5e7eb' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151', mb: 2 }}>
                            System Status
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={3}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Status
                                        </Typography>
                                        <Chip
                                            label={settings.maintenanceMode ? 'Maintenance' : 'Active'}
                                            color={settings.maintenanceMode ? 'warning' : 'success'}
                                            size="small"
                                            sx={{ mt: 1, fontSize: '11px' }}
                                        />
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Debug Mode
                                        </Typography>
                                        <Chip
                                            label={settings.debugMode ? 'Enabled' : 'Disabled'}
                                            color={settings.debugMode ? 'warning' : 'default'}
                                            size="small"
                                            sx={{ mt: 1, fontSize: '11px' }}
                                        />
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Cache
                                        </Typography>
                                        <Chip
                                            label={settings.cacheEnabled ? 'Enabled' : 'Disabled'}
                                            color={settings.cacheEnabled ? 'success' : 'default'}
                                            size="small"
                                            sx={{ mt: 1, fontSize: '11px' }}
                                        />
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Version
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600, mt: 1 }}>
                                            {settings.systemVersion}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default SystemSettings;
