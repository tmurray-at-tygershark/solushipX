import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Button,
    Switch,
    Chip,
    CircularProgress,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Divider
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Settings as SettingsIcon,
    CloudDone as CloudDoneIcon,
    VpnKey as VpnKeyIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import './Carriers.css';

const Carriers = () => {
    const [carrierList, setCarrierList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [saving, setSaving] = useState(false);

    const { companyData, refreshCompanyData } = useCompany();
    const navigate = useNavigate();

    // Credential state for the configuration dialog
    const [credentials, setCredentials] = useState({
        type: 'soluship', // 'soluship' for default or 'custom' for user credentials
        username: '',
        password: '',
        accountNumber: '',
        hostURL: '',
        endpoints: {
            rate: '',
            booking: '',
            tracking: '',
            cancel: '',
            labels: '',
            status: ''
        }
    });

    // Load only the company's connected carriers
    useEffect(() => {
        const loadCarriers = async () => {
            try {
                setLoading(true);

                // Get company's connected carriers
                const companyConnectedCarriers = companyData?.connectedCarriers || [];
                console.log('Company Connected Carriers:', companyConnectedCarriers);

                if (!companyConnectedCarriers.length) {
                    console.log('No connected carriers found for company');
                    setCarrierList([]);
                    return;
                }

                // Get carrier IDs from connected carriers
                const carrierIds = companyConnectedCarriers.map(cc => cc.carrierID);
                console.log('Fetching carriers with IDs:', carrierIds);

                // Fetch only the connected carriers from Firestore
                const carriersRef = collection(db, 'carriers');
                const carriersQuery = query(carriersRef, where('carrierID', 'in', carrierIds));
                const snapshot = await getDocs(carriersQuery);

                const carriers = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    carriers.push({
                        ...data,
                        id: doc.id,
                        firestoreId: doc.id,
                        connected: !!data.apiCredentials,
                        enabled: data.enabled || false,
                        credentialType: data.apiCredentials?.type || 'none'
                    });
                });

                console.log('Loaded connected carriers:', carriers);
                setCarrierList(carriers);
            } catch (error) {
                console.error('Error loading carriers:', error);
                setError('Failed to load carriers. Please try again.');
                setCarrierList([]);
            } finally {
                setLoading(false);
            }
        };

        if (companyData) {
            loadCarriers();
        }
    }, [companyData]);

    // Refresh company data on mount to get latest connected carriers
    useEffect(() => {
        if (refreshCompanyData) {
            refreshCompanyData();
        }
    }, []);

    const handleToggleCarrier = async (carrierId) => {
        try {
            const carrier = carrierList.find(c => c.id === carrierId);
            if (!carrier || !carrier.firestoreId) {
                setError('Cannot update carrier: Carrier not found in database');
                return;
            }

            const newEnabledState = !carrier.enabled;

            // 1. Update the carrier document in the carriers collection
            const carrierRef = doc(db, 'carriers', carrier.firestoreId);
            await updateDoc(carrierRef, {
                enabled: newEnabledState,
                updatedAt: serverTimestamp()
            });

            // 2. Update the company's connectedCarriers array
            if (companyData?.id) {
                const companyRef = doc(db, 'companies', companyData.id);
                const updatedConnectedCarriers = companyData.connectedCarriers.map(cc =>
                    cc.carrierID === carrier.carrierID
                        ? { ...cc, enabled: newEnabledState, updatedAt: new Date() }
                        : cc
                );

                await updateDoc(companyRef, {
                    connectedCarriers: updatedConnectedCarriers,
                    updatedAt: serverTimestamp()
                });
            }

            // Update local state
            setCarrierList(prevList =>
                prevList.map(c =>
                    c.id === carrierId
                        ? { ...c, enabled: newEnabledState }
                        : c
                )
            );

            setSuccessMessage(`${carrier.name} ${newEnabledState ? 'enabled' : 'disabled'} successfully`);
        } catch (error) {
            console.error('Error toggling carrier:', error);
            setError('Failed to update carrier status. Please try again.');
        }
    };

    const handleConfigureCarrier = (carrier) => {
        setSelectedCarrier(carrier);

        // Load existing credentials if available
        if (carrier.apiCredentials) {
            setCredentials({
                type: carrier.apiCredentials.type || 'custom',
                username: carrier.apiCredentials.username || '',
                password: carrier.apiCredentials.password || '',
                accountNumber: carrier.apiCredentials.accountNumber || '',
                hostURL: carrier.apiCredentials.hostURL || '',
                endpoints: {
                    rate: carrier.apiCredentials.endpoints?.rate || '',
                    booking: carrier.apiCredentials.endpoints?.booking || '',
                    tracking: carrier.apiCredentials.endpoints?.tracking || '',
                    cancel: carrier.apiCredentials.endpoints?.cancel || '',
                    labels: carrier.apiCredentials.endpoints?.labels || '',
                    status: carrier.apiCredentials.endpoints?.status || ''
                }
            });
        } else {
            // Reset to default for new configuration
            setCredentials({
                type: 'soluship',
                username: '',
                password: '',
                accountNumber: '',
                hostURL: '',
                endpoints: {
                    rate: '',
                    booking: '',
                    tracking: '',
                    cancel: '',
                    labels: '',
                    status: ''
                }
            });
        }

        setConfigDialogOpen(true);
    };

    const handleSaveCredentials = async () => {
        try {
            setSaving(true);
            setError(null);

            if (!selectedCarrier) {
                throw new Error('No carrier selected');
            }

            let apiCredentials;

            if (credentials.type === 'soluship') {
                // Use Soluship Connect (default credentials)
                apiCredentials = {
                    type: 'soluship',
                    provider: 'SolushipX',
                    note: 'Using SolushipX default credentials'
                };
            } else {
                // Use custom credentials
                apiCredentials = {
                    type: 'custom',
                    username: credentials.username,
                    password: credentials.password,
                    accountNumber: credentials.accountNumber,
                    hostURL: credentials.hostURL,
                    endpoints: credentials.endpoints
                };
            }

            // Update carrier in Firestore
            const carrierRef = doc(db, 'carriers', selectedCarrier.firestoreId);
            await updateDoc(carrierRef, {
                apiCredentials,
                connected: true,
                enabled: true,
                updatedAt: serverTimestamp()
            });

            // Update local state
            setCarrierList(prevList =>
                prevList.map(c =>
                    c.id === selectedCarrier.id
                        ? {
                            ...c,
                            apiCredentials,
                            connected: true,
                            enabled: true,
                            credentialType: credentials.type
                        }
                        : c
                )
            );

            setSuccessMessage(`${selectedCarrier.name} configured successfully with ${credentials.type === 'soluship' ? 'Soluship Connect' : 'custom credentials'}`);
            setConfigDialogOpen(false);

        } catch (error) {
            console.error('Error saving credentials:', error);
            setError('Failed to save credentials. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCloseSnackbar = () => {
        setError(null);
        setSuccessMessage('');
    };

    const handleCloseDialog = () => {
        setConfigDialogOpen(false);
        setSelectedCarrier(null);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <div className="carriers-container">
            <div className="breadcrumb-container">
                <Link to="/" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Home</Typography>
                </Link>
                <NavigateNextIcon />
                <Typography variant="body2">Carriers</Typography>
            </div>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    Connected Carriers
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {carrierList.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No Carriers Connected
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Please contact your administrator to connect carriers to your account.
                    </Typography>
                </Paper>
            ) : (
                <Grid container spacing={3}>
                    {carrierList.map((carrier) => (
                        <Grid item xs={12} sm={6} md={4} key={carrier.id}>
                            <Card>
                                <CardMedia
                                    component="img"
                                    image={carrier.logoURL || '/images/carrier-badges/default.png'}
                                    alt={carrier.name}
                                    sx={{
                                        width: '100%',
                                        height: 'auto',
                                        aspectRatio: '16/9',
                                        objectFit: 'contain',
                                        p: 2,
                                        bgcolor: 'grey.100'
                                    }}
                                />
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="h6" component="div">
                                            {carrier.name}
                                        </Typography>
                                        <Switch
                                            checked={carrier.enabled}
                                            onChange={() => handleToggleCarrier(carrier.id)}
                                            color="primary"
                                        />
                                    </Box>

                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {carrier.description}
                                    </Typography>

                                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Chip
                                            label={carrier.enabled ? 'Enabled' : 'Disabled'}
                                            color={carrier.enabled ? 'success' : 'default'}
                                            size="small"
                                        />
                                        <Chip
                                            label={carrier.connected ? 'Connected' : 'Not Connected'}
                                            color={carrier.connected ? 'primary' : 'default'}
                                            size="small"
                                        />
                                        {carrier.credentialType !== 'none' && (
                                            <Chip
                                                label={carrier.credentialType === 'soluship' ? 'Soluship Connect' : 'Custom'}
                                                color={carrier.credentialType === 'soluship' ? 'info' : 'secondary'}
                                                size="small"
                                            />
                                        )}
                                    </Box>

                                    {/* Configuration Buttons */}
                                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexDirection: 'column' }}>
                                        {!carrier.connected ? (
                                            <>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<CloudDoneIcon />}
                                                    onClick={() => {
                                                        setCredentials(prev => ({ ...prev, type: 'soluship' }));
                                                        handleConfigureCarrier(carrier);
                                                    }}
                                                    sx={{ mb: 1 }}
                                                >
                                                    Use Soluship Connect
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<VpnKeyIcon />}
                                                    onClick={() => {
                                                        setCredentials(prev => ({ ...prev, type: 'custom' }));
                                                        handleConfigureCarrier(carrier);
                                                    }}
                                                >
                                                    Use My Credentials
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<SettingsIcon />}
                                                onClick={() => handleConfigureCarrier(carrier)}
                                            >
                                                Configure
                                            </Button>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Configuration Dialog */}
            <Dialog
                open={configDialogOpen}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Configure {selectedCarrier?.name}
                </DialogTitle>
                <DialogContent dividers>
                    <FormControl component="fieldset" sx={{ mb: 3 }}>
                        <FormLabel component="legend">Connection Type</FormLabel>
                        <RadioGroup
                            value={credentials.type}
                            onChange={(e) => setCredentials(prev => ({ ...prev, type: e.target.value }))}
                        >
                            <FormControlLabel
                                value="soluship"
                                control={<Radio />}
                                label={
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Soluship Connect (Recommended)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Use SolushipX default credentials. Quick setup with no configuration required.
                                        </Typography>
                                    </Box>
                                }
                            />
                            <FormControlLabel
                                value="custom"
                                control={<Radio />}
                                label={
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            My Own Credentials
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Use your own carrier account credentials for direct billing.
                                        </Typography>
                                    </Box>
                                }
                            />
                        </RadioGroup>
                    </FormControl>

                    {credentials.type === 'soluship' && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                <strong>Soluship Connect</strong> uses SolushipX default credentials.
                                Shipments will be billed through your SolushipX account with competitive rates.
                            </Typography>
                        </Alert>
                    )}

                    {credentials.type === 'custom' && (
                        <>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                <Typography variant="body2">
                                    Using your own credentials requires a direct account with {selectedCarrier?.name}.
                                    Shipments will be billed directly to your carrier account.
                                </Typography>
                            </Alert>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Username"
                                        value={credentials.username}
                                        onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                                        helperText="Your carrier account username"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Password"
                                        type="password"
                                        value={credentials.password}
                                        onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                                        helperText="Your carrier account password"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Account Number"
                                        value={credentials.accountNumber}
                                        onChange={(e) => setCredentials(prev => ({ ...prev, accountNumber: e.target.value }))}
                                        helperText="Your carrier account number"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Host URL"
                                        value={credentials.hostURL}
                                        onChange={(e) => setCredentials(prev => ({ ...prev, hostURL: e.target.value }))}
                                        helperText="API base URL (if different from default)"
                                    />
                                </Grid>
                            </Grid>

                            <Divider sx={{ my: 3 }} />

                            <Typography variant="h6" gutterBottom>
                                API Endpoints (Optional)
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Leave blank to use default endpoints for {selectedCarrier?.name}
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Rate Endpoint"
                                        value={credentials.endpoints.rate}
                                        onChange={(e) => setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, rate: e.target.value }
                                        }))}
                                        size="small"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Booking Endpoint"
                                        value={credentials.endpoints.booking}
                                        onChange={(e) => setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, booking: e.target.value }
                                        }))}
                                        size="small"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Tracking Endpoint"
                                        value={credentials.endpoints.tracking}
                                        onChange={(e) => setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, tracking: e.target.value }
                                        }))}
                                        size="small"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Cancel Endpoint"
                                        value={credentials.endpoints.cancel}
                                        onChange={(e) => setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, cancel: e.target.value }
                                        }))}
                                        size="small"
                                    />
                                </Grid>
                            </Grid>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveCredentials}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!successMessage}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                message={successMessage}
            />
        </div>
    );
};

export default Carriers; 