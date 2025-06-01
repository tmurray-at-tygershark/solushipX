import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Breadcrumbs,
    Card,
    CardContent,
    Chip,
    Divider
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Save as SaveIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const CarrierConfig = () => {
    const { carrierId } = useParams();
    const navigate = useNavigate();

    const [carrier, setCarrier] = useState(null);
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
            labels: '',
            status: ''
        }
    });

    // Load carrier data
    useEffect(() => {
        const loadCarrier = async () => {
            try {
                setLoading(true);

                // First try to find by carrierKey
                const carriersRef = collection(db, 'carriers');
                const q = query(carriersRef, where('carrierKey', '==', carrierId.toUpperCase()));
                const snapshot = await getDocs(q);

                let carrierData = null;

                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    carrierData = {
                        id: doc.id,
                        firestoreId: doc.id,
                        ...doc.data()
                    };
                } else {
                    // Fallback to default carriers if not found in database
                    const defaultCarriers = {
                        'eshipplus': {
                            id: 'eshipplus',
                            name: 'eShip Plus',
                            carrierKey: 'ESHIPPLUS',
                            logo: '/images/carrier-badges/eship.png',
                            description: 'Canadian shipping and logistics solutions',
                            enabled: false,
                            connected: false
                        },
                        'canpar': {
                            id: 'canpar',
                            name: 'Canpar',
                            carrierKey: 'CANPAR',
                            logo: '/images/carrier-badges/canpar.png',
                            description: 'Canadian parcel delivery service',
                            enabled: false,
                            connected: false
                        },
                        'fedex': {
                            id: 'fedex',
                            name: 'FedEx',
                            carrierKey: 'FEDEX',
                            logo: '/images/carrier-badges/fedex.png',
                            description: 'Global shipping and logistics services',
                            enabled: false,
                            connected: false
                        },
                        'ups': {
                            id: 'ups',
                            name: 'UPS',
                            carrierKey: 'UPS',
                            logo: '/images/carrier-badges/ups.png',
                            description: 'Global shipping and logistics services',
                            enabled: false,
                            connected: false
                        }
                    };

                    carrierData = defaultCarriers[carrierId.toLowerCase()];
                }

                if (!carrierData) {
                    setError('Carrier not found');
                    return;
                }

                setCarrier(carrierData);

                // Load existing credentials if available
                if (carrierData.apiCredentials) {
                    const existingCredentials = carrierData.apiCredentials;
                    setCredentials({
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
                            labels: existingCredentials.endpoints?.labels || '',
                            status: existingCredentials.endpoints?.status || ''
                        }
                    });
                }

            } catch (error) {
                console.error('Error loading carrier:', error);
                setError('Failed to load carrier configuration');
            } finally {
                setLoading(false);
            }
        };

        if (carrierId) {
            loadCarrier();
        }
    }, [carrierId]);

    const handleSaveCredentials = async () => {
        try {
            setSaving(true);
            setError(null);

            if (!carrier) {
                throw new Error('No carrier loaded');
            }

            // Prepare the complete API credentials object
            const completeApiCredentials = {
                type: credentials.type,
                username: credentials.username,
                password: credentials.password,
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
                    labels: credentials.endpoints.labels,
                    status: credentials.endpoints.status
                }
            };

            // Prepare the update data
            const updateData = {
                apiCredentials: completeApiCredentials,
                enabled: true,
                connected: true,
                updatedAt: serverTimestamp(),
                carrierKey: carrier.carrierKey || carrierId.toUpperCase(),
                name: carrier.name
            };

            let carrierRef;
            if (carrier.firestoreId) {
                // Update existing carrier
                carrierRef = doc(db, 'carriers', carrier.firestoreId);
                await updateDoc(carrierRef, updateData);
            } else {
                // Create new carrier document
                const carriersRef = collection(db, 'carriers');
                const newDoc = doc(carriersRef);
                await setDoc(newDoc, {
                    ...updateData,
                    id: carrier.id,
                    name: carrier.name,
                    carrierKey: carrier.carrierKey || carrierId.toUpperCase(),
                    logo: carrier.logo,
                    description: carrier.description,
                    createdAt: serverTimestamp()
                });

                // Update local carrier data
                setCarrier(prev => ({ ...prev, firestoreId: newDoc.id }));
            }

            setSuccessMessage(`${carrier.name} credentials saved successfully`);

            // Update local carrier data
            setCarrier(prev => ({
                ...prev,
                apiCredentials: completeApiCredentials,
                connected: true,
                enabled: true
            }));

        } catch (error) {
            console.error('Error saving credentials:', error);
            setError(error.message || 'Failed to save credentials. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!carrier) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    Carrier not found. Please check the URL and try again.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Breadcrumbs */}
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: '#64748b' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Home
                    </Link>
                    <Link to="/carriers" style={{ textDecoration: 'none', color: '#64748b' }}>
                        Carriers
                    </Link>
                    <Typography color="text.primary">{carrier.name}</Typography>
                </Breadcrumbs>

                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate('/carriers')}
                        sx={{ mr: 2 }}
                    >
                        Back to Carriers
                    </Button>
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <img
                            src={carrier.logo}
                            alt={carrier.name}
                            style={{ width: 60, height: 40, marginRight: 16, objectFit: 'contain' }}
                        />
                        <Box>
                            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                {carrier.name} Configuration
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {carrier.description}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        icon={carrier.connected ? <CheckCircleIcon /> : <CancelIcon />}
                        label={carrier.connected ? 'Connected' : 'Not Connected'}
                        color={carrier.connected ? 'success' : 'default'}
                        size="medium"
                    />
                </Box>

                {/* Success/Error Messages */}
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {successMessage && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                        {successMessage}
                    </Alert>
                )}

                {/* Configuration Form */}
                <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                    <Box sx={{ p: 4 }}>
                        {/* API Credentials Section */}
                        <Typography variant="h6" sx={{ mb: 3, color: '#1e293b', fontWeight: 600 }}>
                            API Credentials
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Username"
                                    value={credentials.username}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
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
                                    helperText="API password"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Account Number"
                                    value={credentials.accountNumber}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, accountNumber: e.target.value }))}
                                    helperText="Carrier account number"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Shipper Number"
                                    value={credentials.shipperNumber}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, shipperNumber: e.target.value }))}
                                    helperText="Shipper number (if applicable)"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Host URL"
                                    value={credentials.hostURL}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, hostURL: e.target.value }))}
                                    helperText="Base API URL (e.g., https://api.carrier.com)"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="API Key"
                                    value={credentials.apiKey}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
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
                                    helperText="API secret (if applicable)"
                                />
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 4 }} />

                        {/* API Endpoints Section */}
                        <Typography variant="h6" sx={{ mb: 3, color: '#1e293b', fontWeight: 600 }}>
                            API Endpoints
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Configure the API endpoints for this carrier. These will be appended to the Host URL.
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Rate Endpoint"
                                    value={credentials.endpoints.rate}
                                    onChange={(e) => setCredentials(prev => ({
                                        ...prev,
                                        endpoints: { ...prev.endpoints, rate: e.target.value }
                                    }))}
                                    helperText="Endpoint for rate quotes"
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
                                    helperText="Endpoint for booking shipments"
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
                                    helperText="Endpoint for tracking shipments"
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
                                    helperText="Endpoint for canceling shipments"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Labels Endpoint"
                                    value={credentials.endpoints.labels}
                                    onChange={(e) => setCredentials(prev => ({
                                        ...prev,
                                        endpoints: { ...prev.endpoints, labels: e.target.value }
                                    }))}
                                    helperText="Endpoint for retrieving shipping labels"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Status Endpoint"
                                    value={credentials.endpoints.status}
                                    onChange={(e) => setCredentials(prev => ({
                                        ...prev,
                                        endpoints: { ...prev.endpoints, status: e.target.value }
                                    }))}
                                    helperText="Endpoint for checking shipment status"
                                />
                            </Grid>
                        </Grid>

                        {/* Save Button */}
                        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                onClick={handleSaveCredentials}
                                disabled={saving}
                                sx={{ minWidth: 150 }}
                            >
                                {saving ? 'Saving...' : 'Save Configuration'}
                            </Button>
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
};

export default CarrierConfig; 