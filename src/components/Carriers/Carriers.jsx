import React, { useState } from 'react';
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
    Chip
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon
} from '@mui/icons-material';
import './Carriers.css';

const carriers = [
    {
        id: 'fedex',
        name: 'FedEx',
        logo: '/images/carrier-badges/fedex.png',
        description: 'Global shipping and logistics services',
        enabled: true,
        connected: true,
        credentials: {
            type: 'soluship',
            accountNumber: '****1234'
        }
    },
    {
        id: 'ups',
        name: 'UPS',
        logo: '/images/carrier-badges/ups.png',
        description: 'Connect your UPS account to enable shipping with UPS services.',
        enabled: true,
        connected: false,
        credentials: {
            accountNumber: '',
            apiKey: '',
            apiSecret: ''
        }
    },
    {
        id: 'eship',
        name: 'eShip Plus',
        logo: '/images/carrier-badges/eship.png',
        description: 'Canadian shipping and logistics solutions',
        enabled: false,
        connected: false,
        credentials: null
    },
    {
        id: 'purolator',
        name: 'Purolator',
        logo: '/images/carrier-badges/purolator.png',
        description: 'Canadian courier and freight services',
        enabled: false,
        connected: false,
        credentials: null
    },
    {
        id: 'dhl',
        name: 'DHL',
        logo: '/images/carrier-badges/dhl.png',
        description: 'International shipping and logistics',
        enabled: false,
        connected: false,
        credentials: null
    },
    {
        id: 'canadapost',
        name: 'Canada Post',
        logo: '/images/carrier-badges/canadapost.png',
        description: 'Canadian postal service',
        enabled: false,
        connected: false,
        credentials: null
    },
    {
        id: 'canpar',
        name: 'Canpar',
        logo: '/images/carrier-badges/canpar.png',
        description: 'Canadian parcel delivery service',
        enabled: false,
        connected: false,
        credentials: null
    },
    {
        id: 'usps',
        name: 'USPS',
        logo: '/images/carrier-badges/usps.png',
        description: 'United States Postal Service',
        enabled: false,
        connected: false,
        credentials: null
    }
];

const Carriers = () => {
    const [carrierList, setCarrierList] = useState(carriers);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [credentials, setCredentials] = useState({
        type: 'soluship',
        accountNumber: '',
        apiKey: '',
        apiSecret: ''
    });

    const handleToggleCarrier = (carrierId) => {
        setCarrierList(prevList =>
            prevList.map(carrier =>
                carrier.id === carrierId
                    ? { ...carrier, enabled: !carrier.enabled }
                    : carrier
            )
        );
    };

    const handleEditCarrier = (carrier) => {
        setSelectedCarrier(carrier);
        setCredentials({
            type: carrier.credentials?.type || 'soluship',
            accountNumber: carrier.credentials?.accountNumber || '',
            apiKey: carrier.credentials?.apiKey || '',
            apiSecret: carrier.credentials?.apiSecret || ''
        });
        setIsDialogOpen(true);
    };

    const handleSaveCredentials = () => {
        setCarrierList(prevList =>
            prevList.map(carrier =>
                carrier.id === selectedCarrier.id
                    ? {
                        ...carrier,
                        connected: true,
                        credentials: {
                            ...credentials,
                            accountNumber: credentials.type === 'soluship' ? '****1234' : credentials.accountNumber
                        }
                    }
                    : carrier
            )
        );
        setIsDialogOpen(false);
    };

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
                                                {carrier.connected && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {carrier.credentials?.type === 'soluship' ? 'Using Soluship Connect' : 'Using custom credentials'}
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
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedCarrier?.name} Connection
                </DialogTitle>
                <DialogContent>
                    <Box className="credentials-form">
                        <FormControl component="fieldset" sx={{ mb: 3 }}>
                            <FormLabel>Credentials Type</FormLabel>
                            <RadioGroup
                                value={credentials.type}
                                onChange={(e) => setCredentials(prev => ({ ...prev, type: e.target.value }))}
                            >
                                <FormControlLabel
                                    value="soluship"
                                    control={<Radio />}
                                    label="Auto-Connect with Soluship"
                                />
                                <FormControlLabel
                                    value="custom"
                                    control={<Radio />}
                                    label="Use Custom Credentials"
                                />
                            </RadioGroup>
                        </FormControl>

                        {credentials.type === 'custom' && (
                            <>
                                <TextField
                                    fullWidth
                                    label="Account Number"
                                    value={credentials.accountNumber}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, accountNumber: e.target.value }))}
                                    margin="normal"
                                />
                                <TextField
                                    fullWidth
                                    label="API Key"
                                    value={credentials.apiKey}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                                    margin="normal"
                                />
                                <TextField
                                    fullWidth
                                    label="API Secret"
                                    type="password"
                                    value={credentials.apiSecret}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                                    margin="normal"
                                />
                            </>
                        )}

                        {credentials.type === 'soluship' && (
                            <Box className="credentials-info">
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Auto-Connect with Soluship
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Using Soluship Connect
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveCredentials} variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Carriers; 