import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Radio,
    RadioGroup,
    FormControl,
    FormLabel,
    IconButton,
    Tooltip,
    Chip,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import './Carriers.css';

// Default carrier templates for initialization
const defaultCarriers = [
    {
        id: 'fedex',
        name: 'FedEx',
        logo: '/images/carrier-badges/fedex.png',
        description: 'Global shipping and logistics services',
        enabled: false,
        connected: false,
        carrierKey: 'FEDEX'
    },
    {
        id: 'ups',
        name: 'UPS',
        logo: '/images/carrier-badges/ups.png',
        description: 'Connect your UPS account to enable shipping with UPS services.',
        enabled: false,
        connected: false,
        carrierKey: 'UPS'
    },
    {
        id: 'eshipplus',
        name: 'eShip Plus',
        logo: '/images/carrier-badges/eship.png',
        description: 'Canadian shipping and logistics solutions',
        enabled: false,
        connected: false,
        carrierKey: 'ESHIPPLUS'
    },
    {
        id: 'purolator',
        name: 'Purolator',
        logo: '/images/carrier-badges/purolator.png',
        description: 'Canadian courier and freight services',
        enabled: false,
        connected: false,
        carrierKey: 'PUROLATOR'
    },
    {
        id: 'dhl',
        name: 'DHL',
        logo: '/images/carrier-badges/dhl.png',
        description: 'International shipping and logistics',
        enabled: false,
        connected: false,
        carrierKey: 'DHL'
    },
    {
        id: 'canadapost',
        name: 'Canada Post',
        logo: '/images/carrier-badges/canadapost.png',
        description: 'Canadian postal service',
        enabled: false,
        connected: false,
        carrierKey: 'CANADAPOST'
    },
    {
        id: 'canpar',
        name: 'Canpar',
        logo: '/images/carrier-badges/canpar.png',
        description: 'Canadian parcel delivery service',
        enabled: false,
        connected: false,
        carrierKey: 'CANPAR'
    },
    {
        id: 'usps',
        name: 'USPS',
        logo: '/images/carrier-badges/usps.png',
        description: 'United States Postal Service',
        enabled: false,
        connected: false,
        carrierKey: 'USPS'
    }
];

const Carriers = () => {
    const [carrierList, setCarrierList] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [credentials, setCredentials] = useState({
        type: 'custom',
        username: '',
        password: '',
        accountNumber: '',
        apiKey: '',
        apiSecret: '',
        hostURL: '',
        shipperNumber: '',
        endpoints: {
            rate: '',
            booking: '',
            tracking: '',
            cancel: '',
            labels: ''
        }
    });

    const { companyData, companyIdForAddress } = useCompany();

    // Load carriers from Firebase
    useEffect(() => {
        const loadCarriers = async () => {
            try {
                setLoading(true);
                const carriersRef = collection(db, 'carriers');
                const snapshot = await getDocs(carriersRef);

                const firebaseCarriers = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    firebaseCarriers.push({
                        ...data,
                        id: doc.id,
                        firestoreId: doc.id
                    });
                });

                // Merge with default carriers, prioritizing Firebase data
                const mergedCarriers = defaultCarriers.map(defaultCarrier => {
                    const firebaseCarrier = firebaseCarriers.find(fc =>
                        fc.carrierKey === defaultCarrier.carrierKey ||
                        fc.name === defaultCarrier.name ||
                        fc.id === defaultCarrier.id
                    );

                    if (firebaseCarrier) {
                        return {
                            ...defaultCarrier,
                            ...firebaseCarrier,
                            connected: !!(firebaseCarrier.apiCredentials &&
                                (firebaseCarrier.apiCredentials.username || firebaseCarrier.apiCredentials.apiKey)),
                            enabled: firebaseCarrier.enabled || false
                        };
                    }

                    return defaultCarrier;
                });

                setCarrierList(mergedCarriers);
            } catch (error) {
                console.error('Error loading carriers:', error);
                setError('Failed to load carriers. Please try again.');
                // Fallback to default carriers
                setCarrierList(defaultCarriers);
            } finally {
                setLoading(false);
            }
        };

        loadCarriers();
    }, []);

    const handleToggleCarrier = async (carrierId) => {
        try {
            const carrier = carrierList.find(c => c.id === carrierId);
            if (!carrier || !carrier.firestoreId) {
                setError('Cannot update carrier: Carrier not found in database');
                return;
            }

            const newEnabledState = !carrier.enabled;

            // Update Firebase
            const carrierRef = doc(db, 'carriers', carrier.firestoreId);
            await updateDoc(carrierRef, {
                enabled: newEnabledState,
                updatedAt: serverTimestamp()
            });

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

    const handleEditCarrier = (carrier) => {
        console.log('=== DEBUGGING EDIT CARRIER ===');
        console.log('Editing carrier:', carrier);
        console.log('Carrier apiCredentials:', carrier.apiCredentials);

        setSelectedCarrier(carrier);

        // Load existing credentials
        const existingCredentials = carrier.apiCredentials || {};
        console.log('Existing credentials found:', existingCredentials);

        const newCredentials = {
            type: existingCredentials.type || 'custom',
            username: existingCredentials.username || '',
            password: existingCredentials.password || '',
            accountNumber: existingCredentials.accountNumber || '',
            apiKey: existingCredentials.apiKey || '',
            apiSecret: existingCredentials.apiSecret || '',
            hostURL: existingCredentials.hostURL || '',
            shipperNumber: existingCredentials.shipperNumber || '',
            endpoints: {
                rate: existingCredentials.endpoints?.rate || '',
                booking: existingCredentials.endpoints?.booking || '',
                tracking: existingCredentials.endpoints?.tracking || '',
                cancel: existingCredentials.endpoints?.cancel || '',
                labels: existingCredentials.endpoints?.labels || ''
            }
        };

        console.log('Setting credentials state to:', newCredentials);
        setCredentials(newCredentials);

        setIsDialogOpen(true);
    };

    const handleSaveCredentials = async () => {
        try {
            setSaving(true);
            setError(null);

            console.log('=== DEBUGGING SAVE CREDENTIALS ===');
            console.log('selectedCarrier:', selectedCarrier);
            console.log('selectedCarrier.firestoreId:', selectedCarrier?.firestoreId);
            console.log('credentials state:', credentials);

            if (!selectedCarrier) {
                throw new Error('No carrier selected');
            }

            if (!selectedCarrier.firestoreId) {
                console.error('No firestoreId found for carrier:', selectedCarrier);
                throw new Error('Cannot save credentials: Carrier not found in database. Please contact support.');
            }

            // Prepare the complete API credentials object
            const completeApiCredentials = {
                type: credentials.type,
                username: credentials.username,
                password: credentials.password || selectedCarrier.apiCredentials?.password || '',
                accountNumber: credentials.accountNumber,
                apiKey: credentials.apiKey,
                apiSecret: credentials.apiSecret,
                hostURL: credentials.hostURL,
                shipperNumber: credentials.shipperNumber,
                endpoints: {
                    rate: credentials.endpoints.rate,
                    booking: credentials.endpoints.booking,
                    tracking: credentials.endpoints.tracking,
                    cancel: credentials.endpoints.cancel,
                    labels: credentials.endpoints.labels
                }
            };

            console.log('completeApiCredentials to save:', completeApiCredentials);

            // Prepare the update data
            const updateData = {
                apiCredentials: completeApiCredentials,
                enabled: true,
                connected: true,
                updatedAt: serverTimestamp()
            };

            console.log('updateData to send to Firebase:', updateData);
            console.log('Updating Firebase document:', `carriers/${selectedCarrier.firestoreId}`);

            // Update existing carrier
            const carrierRef = doc(db, 'carriers', selectedCarrier.firestoreId);

            // Add more detailed error catching
            try {
                await updateDoc(carrierRef, updateData);
                console.log('✅ Firebase updateDoc completed successfully');
            } catch (firebaseError) {
                console.error('❌ Firebase updateDoc failed:', firebaseError);
                console.error('Firebase error code:', firebaseError.code);
                console.error('Firebase error message:', firebaseError.message);
                throw new Error(`Firebase update failed: ${firebaseError.message}`);
            }

            // Update local state with the complete updated carrier object
            setCarrierList(prevList => {
                const updatedList = prevList.map(carrier =>
                    carrier.id === selectedCarrier.id
                        ? {
                            ...carrier,
                            apiCredentials: completeApiCredentials,
                            connected: true,
                            enabled: true,
                            updatedAt: new Date()
                        }
                        : carrier
                );
                console.log('Updated carrierList:', updatedList);
                return updatedList;
            });

            setSuccessMessage(`${selectedCarrier.name} credentials saved successfully`);
            setIsDialogOpen(false);
            console.log('✅ Save operation completed successfully');

        } catch (error) {
            console.error('❌ Error in handleSaveCredentials:', error);
            console.error('Error stack:', error.stack);
            setError(error.message || 'Failed to save credentials. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCloseSnackbar = () => {
        setError(null);
        setSuccessMessage('');
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
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Typography variant="body2" className="breadcrumb-current">
                    Carriers
                </Typography>
            </div>

            <Paper className="carriers-paper">
                <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                    <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Header Section */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                Carriers
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Connect and manage your shipping carriers
                            </Typography>
                        </Box>

                        {/* Carriers Grid */}
                        <Grid container spacing={3}>
                            {carrierList.map((carrier) => (
                                <Grid item xs={12} sm={6} md={4} key={carrier.id}>
                                    <Card className="carrier-card">
                                        <CardMedia
                                            component="img"
                                            height="100"
                                            image={carrier.logo}
                                            alt={carrier.name}
                                            className="carrier-logo"
                                        />
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="h6" component="h2">
                                                    {carrier.name}
                                                </Typography>
                                                <Switch
                                                    checked={carrier.enabled}
                                                    onChange={() => handleToggleCarrier(carrier.id)}
                                                    color="primary"
                                                />
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {carrier.description}
                                            </Typography>
                                            <Box className="connection-status">
                                                <Chip
                                                    icon={carrier.connected ? <CheckCircleIcon /> : <CancelIcon />}
                                                    label={carrier.connected ? 'Connected' : 'Not Connected'}
                                                    color={carrier.connected ? 'success' : 'default'}
                                                    size="small"
                                                />
                                                {carrier.connected && carrier.apiCredentials && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                        {carrier.apiCredentials.username ?
                                                            `Username: ${carrier.apiCredentials.username}` :
                                                            'Custom credentials configured'
                                                        }
                                                    </Typography>
                                                )}
                                                {!carrier.connected && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                        Configure credentials to enable
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Box className="carrier-actions">
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => handleEditCarrier(carrier)}
                                                    disabled={!carrier.enabled}
                                                >
                                                    {carrier.connected ? 'Edit' : 'Connect'}
                                                </Button>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                </Box>
            </Paper>

            {/* Credentials Dialog */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {selectedCarrier?.name} Connection
                </DialogTitle>
                <DialogContent>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box className="credentials-form">
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            API Credentials
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Username"
                                    value={credentials.username}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                                    margin="normal"
                                    helperText="API username or user ID"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    value={credentials.password}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                                    margin="normal"
                                    helperText="API password"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Account Number"
                                    value={credentials.accountNumber}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, accountNumber: e.target.value }))}
                                    margin="normal"
                                    helperText="Carrier account number"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Shipper Number"
                                    value={credentials.shipperNumber}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, shipperNumber: e.target.value }))}
                                    margin="normal"
                                    helperText="Shipper number (if applicable)"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Host URL"
                                    value={credentials.hostURL}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, hostURL: e.target.value }))}
                                    margin="normal"
                                    helperText="Base API URL (e.g., https://api.carrier.com)"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="API Key"
                                    value={credentials.apiKey}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                                    margin="normal"
                                    helperText="API key (if applicable)"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="API Secret"
                                    type="password"
                                    value={credentials.apiSecret}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                                    margin="normal"
                                    helperText="API secret (if applicable)"
                                />
                            </Grid>
                        </Grid>

                        <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                            API Endpoints
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Rate Endpoint"
                                    value={credentials.endpoints.rate}
                                    onChange={(e) => {
                                        console.log('Rate endpoint changed to:', e.target.value);
                                        setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, rate: e.target.value }
                                        }));
                                    }}
                                    margin="normal"
                                    helperText="Endpoint for rate quotes"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Booking Endpoint"
                                    value={credentials.endpoints.booking}
                                    onChange={(e) => {
                                        console.log('Booking endpoint changed to:', e.target.value);
                                        setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, booking: e.target.value }
                                        }));
                                    }}
                                    margin="normal"
                                    helperText="Endpoint for booking shipments"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Tracking Endpoint"
                                    value={credentials.endpoints.tracking}
                                    onChange={(e) => {
                                        console.log('Tracking endpoint changed to:', e.target.value);
                                        setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, tracking: e.target.value }
                                        }));
                                    }}
                                    margin="normal"
                                    helperText="Endpoint for tracking shipments"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Cancel Endpoint"
                                    value={credentials.endpoints.cancel}
                                    onChange={(e) => {
                                        console.log('Cancel endpoint changed to:', e.target.value);
                                        setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, cancel: e.target.value }
                                        }));
                                    }}
                                    margin="normal"
                                    helperText="Endpoint for canceling shipments"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Labels Endpoint"
                                    value={credentials.endpoints.labels}
                                    onChange={(e) => {
                                        console.log('Labels endpoint changed to:', e.target.value);
                                        setCredentials(prev => ({
                                            ...prev,
                                            endpoints: { ...prev.endpoints, labels: e.target.value }
                                        }));
                                    }}
                                    margin="normal"
                                    helperText="Endpoint for retrieving labels"
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDialogOpen(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveCredentials}
                        variant="contained"
                        color="primary"
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={20} /> : null}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for error messages */}
            <Snackbar
                open={!!error}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
            >
                <Alert onClose={handleCloseSnackbar} severity="error">
                    {error}
                </Alert>
            </Snackbar>

            {/* Snackbar for success messages */}
            <Snackbar
                open={!!successMessage}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
            >
                <Alert onClose={handleCloseSnackbar} severity="success">
                    {successMessage}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default Carriers; 