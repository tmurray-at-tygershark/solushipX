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
    Save as SaveIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import './Carriers.css';

const Carriers = ({ isModal = false, onClose = null }) => {
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

        // Always default to Soluship Connect for security
        // Never expose existing Soluship credentials
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

        setConfigDialogOpen(true);
    };

    const handleSaveCredentials = async () => {
        try {
            setSaving(true);
            setError(null);

            // Temporarily disable saving to database for security
            // This functionality will be implemented later
            setSuccessMessage('Configuration saved locally. Database updates are temporarily disabled for security.');
            setConfigDialogOpen(false);

            // TODO: Implement proper credential saving logic later
            // Do not save anything to database at this time

        } catch (error) {
            console.error('Error in save credentials (disabled):', error);
            setError('Configuration is temporarily disabled.');
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
        <Box sx={{ p: 3 }}>
            {/* Modal Header with Back Arrow */}
            {isModal && onClose && (
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 3
                }}>
                    <Button
                        onClick={onClose}
                        sx={{
                            minWidth: 0,
                            p: 0.5,
                            mr: 1,
                            color: '#6e6e73',
                            background: 'none',
                            borderRadius: '50%',
                            '&:hover': {
                                background: '#f2f2f7',
                                color: '#111',
                            },
                            boxShadow: 'none',
                        }}
                        aria-label="Close Carriers"
                    >
                        <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
                    </Button>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        Connected Carriers
                    </Typography>
                </Box>
            )}

            {/* Breadcrumb - only show when not in modal */}
            {!isModal && (
                <div className="breadcrumb-container">
                    <Link to="/" className="breadcrumb-link">
                        <HomeIcon />
                        <Typography variant="body2">Home</Typography>
                    </Link>
                    <NavigateNextIcon />
                    <Typography variant="body2">Carriers</Typography>
                </div>
            )}

            {!isModal && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                        Connected Carriers
                    </Typography>
                </Box>
            )}

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
                                disabled={true}
                                label={
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.disabled' }}>
                                            My Own Credentials (Coming Soon)
                                        </Typography>
                                        <Typography variant="caption" color="text.disabled">
                                            Custom credential configuration will be available in a future update.
                                        </Typography>
                                    </Box>
                                }
                            />
                        </RadioGroup>
                    </FormControl>

                    {credentials.type === 'soluship' && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                <strong>Soluship Connect</strong> uses SolushipX managed credentials.
                                Shipments will be processed through your SolushipX account with competitive rates.
                                No additional configuration required.
                            </Typography>
                        </Alert>
                    )}

                    {credentials.type === 'custom' && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                Custom credential configuration is temporarily unavailable.
                                Please use Soluship Connect for now.
                            </Typography>
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveCredentials}
                        disabled={saving || credentials.type === 'custom'}
                        startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                    >
                        {saving ? 'Processing...' : 'Confirm Soluship Connect'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!successMessage}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                message={successMessage}
            />
        </Box>
    );
};

export default Carriers; 