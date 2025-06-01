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
    Snackbar
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Settings as SettingsIcon
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    const { companyData, companyIdForAddress } = useCompany();
    const navigate = useNavigate();

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

        navigate(`/carriers/${carrier.id}`);
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
                                                    startIcon={<SettingsIcon />}
                                                    onClick={() => handleEditCarrier(carrier)}
                                                    disabled={!carrier.enabled}
                                                >
                                                    {carrier.connected ? 'Configure' : 'Connect'}
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