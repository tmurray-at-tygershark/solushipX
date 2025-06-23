import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    Chip,
    CircularProgress,
    Alert,
    Avatar,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Edit as EditIcon,
    ArrowBack as ArrowBackIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Api as ApiIcon,
    Email as EmailIcon,
    Business as BusinessIcon,
    AttachMoney as AttachMoneyIcon,
    ExpandMore as ExpandMoreIcon,
    Security as SecurityIcon,
    Assessment as AssessmentIcon,
    ContentCopy as ContentCopyIcon,
    LocalShipping as LocalShippingIcon,
    Map as MapIcon,
    Scale as ScaleIcon,
    Straighten as StraightenIcon,
    Public as PublicIcon,
    LocationOn as LocationOnIcon,
    Speed as SpeedIcon,
    GroupWork as GroupWorkIcon
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import AdminBreadcrumb from '../AdminBreadcrumb';

const CarrierDetail = () => {
    const { carrierId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [carrier, setCarrier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadCarrier = async () => {
            if (!carrierId) {
                setError('No carrier ID provided');
                setLoading(false);
                return;
            }

            try {
                const carrierDoc = await getDoc(doc(db, 'carriers', carrierId));

                if (!carrierDoc.exists()) {
                    setError('Carrier not found');
                    setLoading(false);
                    return;
                }

                setCarrier({ id: carrierDoc.id, ...carrierDoc.data() });
            } catch (error) {
                console.error('Error loading carrier:', error);
                setError('Failed to load carrier details');
            } finally {
                setLoading(false);
            }
        };

        loadCarrier();
    }, [carrierId]);

    const handleEditCarrier = () => {
        navigate(`/admin/carriers/${carrierId}/edit`);
    };

    const handleCopyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text).then(() => {
            enqueueSnackbar(`${label} copied to clipboard`, { variant: 'success' });
        });
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        try {
            return date.toDate ? date.toDate().toLocaleDateString() : new Date(date).toLocaleDateString();
        } catch {
            return 'Invalid Date';
        }
    };

    const getConnectionTypeDisplay = (connectionType) => {
        return connectionType === 'api' ? 'API Integration' : 'Manual Connection';
    };

    const getServiceTypeDisplay = (services) => {
        if (!services) return [];
        const courierServices = services.courier || [];
        const freightServices = services.freight || [];

        const result = [];
        if (courierServices.length > 0) result.push('Courier');
        if (freightServices.length > 0) result.push('Freight');
        return result;
    };

    if (loading) {
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                    <Alert severity="error">{error}</Alert>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Breadcrumb */}
                <AdminBreadcrumb currentPage="Carrier Details" />

                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton
                            onClick={() => navigate('/admin/carriers')}
                            sx={{ mr: 1 }}
                        >
                            <ArrowBackIcon />
                        </IconButton>

                        {/* Carrier Logo */}
                        {carrier.logoURL ? (
                            <Avatar
                                src={carrier.logoURL}
                                alt={carrier.name}
                                sx={{ width: 64, height: 64, border: '2px solid #e5e7eb' }}
                                variant="rounded"
                            />
                        ) : (
                            <Avatar
                                sx={{
                                    width: 64,
                                    height: 64,
                                    bgcolor: '#e5e7eb',
                                    border: '2px solid #e5e7eb'
                                }}
                                variant="rounded"
                            >
                                <BusinessIcon sx={{ fontSize: '32px', color: '#6b7280' }} />
                            </Avatar>
                        )}

                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                                {carrier.name}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Chip
                                    icon={carrier.enabled ? <CheckCircleIcon /> : <CancelIcon />}
                                    label={carrier.enabled ? 'Enabled' : 'Disabled'}
                                    color={carrier.enabled ? 'success' : 'default'}
                                    size="small"
                                />
                                <Chip
                                    label={getConnectionTypeDisplay(carrier.connectionType)}
                                    color={carrier.connectionType === 'api' ? 'primary' : 'secondary'}
                                    size="small"
                                />
                                <Chip
                                    label={carrier.type || 'Unknown'}
                                    variant="outlined"
                                    size="small"
                                />
                            </Box>
                        </Box>
                    </Box>

                    <Button
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={handleEditCarrier}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Edit Carrier
                    </Button>
                </Box>
            </Box>

            {/* Content Area */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 4, bgcolor: '#fafafa' }}>
                <Grid container spacing={4}>
                    {/* Summary Cards Row */}
                    <Grid item xs={12}>
                        <Grid container spacing={2}>
                            {/* Basic Info Card */}
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                                        <Avatar
                                            sx={{
                                                width: 56,
                                                height: 56,
                                                mx: 'auto',
                                                mb: 1,
                                                bgcolor: '#1976d2'
                                            }}
                                        >
                                            <BusinessIcon />
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                            Carrier Type
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                            {carrier.type || 'Unknown'}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Connection Type Card */}
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                                        <Avatar
                                            sx={{
                                                width: 56,
                                                height: 56,
                                                mx: 'auto',
                                                mb: 1,
                                                bgcolor: carrier.connectionType === 'api' ? '#16a34a' : '#ea580c'
                                            }}
                                        >
                                            {carrier.connectionType === 'api' ? <ApiIcon /> : <EmailIcon />}
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                            Connection
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                            {getConnectionTypeDisplay(carrier.connectionType)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Services Count Card */}
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                                        <Avatar
                                            sx={{
                                                width: 56,
                                                height: 56,
                                                mx: 'auto',
                                                mb: 1,
                                                bgcolor: '#7c3aed'
                                            }}
                                        >
                                            <LocalShippingIcon />
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                            Services
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                            {((carrier.supportedServices?.courier || []).length +
                                                (carrier.supportedServices?.freight || []).length)} Available
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Status Card */}
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                                        <Avatar
                                            sx={{
                                                width: 56,
                                                height: 56,
                                                mx: 'auto',
                                                mb: 1,
                                                bgcolor: carrier.enabled ? '#16a34a' : '#dc2626'
                                            }}
                                        >
                                            {carrier.enabled ? <CheckCircleIcon /> : <CancelIcon />}
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                            Status
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                            {carrier.enabled ? 'Active' : 'Inactive'}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Main Content Row */}
                    <Grid item xs={12}>
                        <Grid container spacing={4}>
                            {/* Left Column */}
                            <Grid item xs={12} lg={8}>
                                {/* Comprehensive Services & Availability Section */}
                                <Card sx={{ mb: 4 }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h6" sx={{ mb: 3, fontSize: '18px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center' }}>
                                            <LocalShippingIcon sx={{ mr: 1, color: '#1976d2' }} />
                                            Services & Availability
                                        </Typography>

                                        {/* Service Types */}
                                        <Box sx={{ mb: 4 }}>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                Service Categories
                                            </Typography>
                                            <Grid container spacing={2}>
                                                {['courier', 'freight'].map((serviceType) => {
                                                    const services = carrier.supportedServices?.[serviceType] || [];
                                                    const hasServices = services.length > 0;

                                                    return (
                                                        <Grid item xs={12} sm={6} key={serviceType}>
                                                            <Paper sx={{
                                                                p: 2,
                                                                border: `2px solid ${hasServices ? '#16a34a' : '#e5e7eb'}`,
                                                                bgcolor: hasServices ? '#f0f9ff' : '#f9fafb'
                                                            }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                                    <GroupWorkIcon sx={{
                                                                        mr: 1,
                                                                        color: hasServices ? '#16a34a' : '#6b7280',
                                                                        fontSize: '20px'
                                                                    }} />
                                                                    <Typography sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: hasServices ? '#16a34a' : '#6b7280',
                                                                        textTransform: 'capitalize'
                                                                    }}>
                                                                        {serviceType} Services
                                                                    </Typography>
                                                                    <Chip
                                                                        label={services.length}
                                                                        size="small"
                                                                        color={hasServices ? 'success' : 'default'}
                                                                        sx={{ ml: 'auto' }}
                                                                    />
                                                                </Box>

                                                                {hasServices ? (
                                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                        {services.map((service, index) => (
                                                                            <Chip
                                                                                key={index}
                                                                                label={service}
                                                                                size="small"
                                                                                sx={{ fontSize: '10px' }}
                                                                                color="primary"
                                                                                variant="outlined"
                                                                            />
                                                                        ))}
                                                                    </Box>
                                                                ) : (
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                        No {serviceType} services configured
                                                                    </Typography>
                                                                )}
                                                            </Paper>
                                                        </Grid>
                                                    );
                                                })}
                                            </Grid>
                                        </Box>

                                        {/* Geographic Routing */}
                                        {carrier.eligibilityRules?.geographicRouting && (
                                            <Box sx={{ mb: 4 }}>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2, display: 'flex', alignItems: 'center' }}>
                                                    <MapIcon sx={{ mr: 1, color: '#7c3aed', fontSize: '18px' }} />
                                                    Geographic Routing Capabilities
                                                </Typography>

                                                <Grid container spacing={2}>
                                                    {[
                                                        { key: 'domesticCanada', label: 'Domestic Canada (All CA)', desc: 'Entire Canada domestic' },
                                                        { key: 'domesticUS', label: 'Domestic US (All US)', desc: 'Entire United States domestic' },
                                                        { key: 'provinceToProvince', label: 'Province-to-Province (CA)', desc: 'Canadian interprovincial routes' },
                                                        { key: 'stateToState', label: 'State-to-State (US)', desc: 'US interstate routes' },
                                                        { key: 'provinceToState', label: 'Province-to-State (CA ↔ US)', desc: 'Cross-border Canada/US' },
                                                        { key: 'countryToCountry', label: 'Country-to-Country', desc: 'International shipping' },
                                                        { key: 'cityToCity', label: 'City-to-City', desc: 'Local metropolitan' }
                                                    ].map((route) => {
                                                        const isSupported = carrier.eligibilityRules.geographicRouting[route.key];
                                                        return (
                                                            <Grid item xs={12} sm={6} key={route.key}>
                                                                <Paper sx={{
                                                                    p: 2,
                                                                    border: `1px solid ${isSupported ? '#16a34a' : '#e5e7eb'}`,
                                                                    bgcolor: isSupported ? '#f0f9ff' : '#fafafa'
                                                                }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                        <Box>
                                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                                                {route.label}
                                                                            </Typography>
                                                                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                                {route.desc}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Chip
                                                                            icon={isSupported ? <CheckCircleIcon /> : <CancelIcon />}
                                                                            label={isSupported ? 'Supported' : 'Not Supported'}
                                                                            size="small"
                                                                            color={isSupported ? 'success' : 'default'}
                                                                            sx={{ fontSize: '10px' }}
                                                                        />
                                                                    </Box>
                                                                </Paper>
                                                            </Grid>
                                                        );
                                                    })}
                                                </Grid>

                                                {/* Route Details */}
                                                {Object.entries(carrier.eligibilityRules.geographicRouting).some(([key, value]) =>
                                                    Array.isArray(value) && value.length > 0
                                                ) && (
                                                        <Box sx={{ mt: 3 }}>
                                                            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                                Configured Routes
                                                            </Typography>
                                                            <Accordion>
                                                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                                    <Typography sx={{ fontSize: '12px' }}>
                                                                        View Detailed Route Configurations
                                                                    </Typography>
                                                                </AccordionSummary>
                                                                <AccordionDetails>
                                                                    <Grid container spacing={2}>
                                                                        {Object.entries(carrier.eligibilityRules.geographicRouting).map(([key, routes]) => {
                                                                            if (!Array.isArray(routes) || routes.length === 0) return null;

                                                                            const routeLabels = {
                                                                                provinceProvinceRouting: 'Province-to-Province Routes',
                                                                                stateStateRouting: 'State-to-State Routes',
                                                                                provinceStateRouting: 'Province-to-State Routes',
                                                                                countryCountryRouting: 'Country-to-Country Routes',
                                                                                cityPairRouting: 'City Pair Routes'
                                                                            };

                                                                            return (
                                                                                <Grid item xs={12} sm={6} key={key}>
                                                                                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', mb: 1 }}>
                                                                                        {routeLabels[key]}
                                                                                    </Typography>
                                                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                                                        {routes.slice(0, 3).map((route, index) => (
                                                                                            <Typography key={index} sx={{ fontSize: '10px', color: '#374151' }}>
                                                                                                {route.from} → {route.to}
                                                                                            </Typography>
                                                                                        ))}
                                                                                        {routes.length > 3 && (
                                                                                            <Typography sx={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                                                +{routes.length - 3} more routes
                                                                                            </Typography>
                                                                                        )}
                                                                                    </Box>
                                                                                </Grid>
                                                                            );
                                                                        })}
                                                                    </Grid>
                                                                </AccordionDetails>
                                                            </Accordion>
                                                        </Box>
                                                    )}
                                            </Box>
                                        )}

                                        {/* Weight & Dimension Restrictions */}
                                        {(carrier.eligibilityRules?.weightRanges?.length > 0 ||
                                            carrier.eligibilityRules?.dimensionRestrictions?.length > 0) && (
                                                <Box sx={{ mb: 4 }}>
                                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2, display: 'flex', alignItems: 'center' }}>
                                                        <ScaleIcon sx={{ mr: 1, color: '#ea580c', fontSize: '18px' }} />
                                                        Weight & Dimension Restrictions
                                                    </Typography>

                                                    <Grid container spacing={2}>
                                                        {/* Weight Ranges */}
                                                        {carrier.eligibilityRules?.weightRanges?.length > 0 && (
                                                            <Grid item xs={12} sm={6}>
                                                                <Paper sx={{ p: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#c2410c', mb: 1, display: 'flex', alignItems: 'center' }}>
                                                                        <ScaleIcon sx={{ mr: 1, fontSize: '16px' }} />
                                                                        Weight Restrictions
                                                                    </Typography>
                                                                    {carrier.eligibilityRules.weightRanges.map((range, index) => (
                                                                        <Typography key={index} sx={{ fontSize: '11px', color: '#9a3412' }}>
                                                                            {range.min || 0} - {range.max || '∞'} {range.unit || 'lbs'}
                                                                        </Typography>
                                                                    ))}
                                                                </Paper>
                                                            </Grid>
                                                        )}

                                                        {/* Dimension Restrictions */}
                                                        {carrier.eligibilityRules?.dimensionRestrictions?.length > 0 && (
                                                            <Grid item xs={12} sm={6}>
                                                                <Paper sx={{ p: 2, bgcolor: '#fef3c7', border: '1px solid #fde68a' }}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#92400e', mb: 1, display: 'flex', alignItems: 'center' }}>
                                                                        <StraightenIcon sx={{ mr: 1, fontSize: '16px' }} />
                                                                        Dimension Restrictions
                                                                    </Typography>
                                                                    {carrier.eligibilityRules.dimensionRestrictions.map((restriction, index) => (
                                                                        <Typography key={index} sx={{ fontSize: '11px', color: '#78350f' }}>
                                                                            {restriction.maxLength} × {restriction.maxWidth} × {restriction.maxHeight} {restriction.unit}
                                                                        </Typography>
                                                                    ))}
                                                                </Paper>
                                                            </Grid>
                                                        )}
                                                    </Grid>
                                                </Box>
                                            )}

                                        {/* Rate Configuration */}
                                        {carrier.rateConfiguration?.enabled && (
                                            <Box>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2, display: 'flex', alignItems: 'center' }}>
                                                    <AttachMoneyIcon sx={{ mr: 1, color: '#16a34a', fontSize: '18px' }} />
                                                    Rate Configuration
                                                </Typography>
                                                <Paper sx={{ p: 2, bgcolor: '#f0f9ff', border: '1px solid #bfdbfe' }}>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={6}>
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Currency</Typography>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{carrier.rateConfiguration.currency}</Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Rate Type</Typography>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{carrier.rateConfiguration.rateType}</Typography>
                                                        </Grid>
                                                        {carrier.rateConfiguration.rmpBase && (
                                                            <Grid item xs={12}>
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Rate Per Mile (RPM)</Typography>
                                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>${carrier.rateConfiguration.rmpBase}</Typography>
                                                            </Grid>
                                                        )}
                                                    </Grid>
                                                </Paper>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Right Column */}
                            <Grid item xs={12} lg={4}>
                                {/* Basic Information */}
                                <Card sx={{ mb: 4 }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                            <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                            Basic Information
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                    Carrier ID
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {carrier.carrierID || 'N/A'}
                                                    </Typography>
                                                    {carrier.carrierID && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleCopyToClipboard(carrier.carrierID, 'Carrier ID')}
                                                        >
                                                            <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                    Account Number
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {carrier.accountNumber || 'N/A'}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                    Created
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {formatDate(carrier.createdAt)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                    Last Updated
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {formatDate(carrier.updatedAt)}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>

                                {/* Email Configuration */}
                                {carrier.emailConfiguration && Object.keys(carrier.emailConfiguration).some(key =>
                                    carrier.emailConfiguration[key] && carrier.emailConfiguration[key].length > 0 &&
                                    carrier.emailConfiguration[key].some(email => email.trim())
                                ) && (
                                        <Card sx={{ mb: 4 }}>
                                            <CardContent sx={{ p: 3 }}>
                                                <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                                    <EmailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                    Email Configuration
                                                </Typography>
                                                {Object.entries(carrier.emailConfiguration).map(([key, emails]) => {
                                                    if (!emails || !emails.length || !emails.some(email => email.trim())) return null;

                                                    const emailLabels = {
                                                        carrierConfirmationEmails: 'Dispatch Emails',
                                                        carrierNotificationEmails: 'Notifications',
                                                        preArrivalNotificationEmails: 'Pre-Arrival',
                                                        rateRequestEmails: 'Rate Requests',
                                                        billingEmails: 'Billing'
                                                    };

                                                    return (
                                                        <Box key={key} sx={{ mb: 2 }}>
                                                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px', mb: 1 }}>
                                                                {emailLabels[key] || key}
                                                                {key === 'carrierConfirmationEmails' && (
                                                                    <Chip label="Required" size="small" color="error" sx={{ ml: 1, fontSize: '9px', height: '16px' }} />
                                                                )}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                                {emails.filter(email => email.trim()).map((email, index) => (
                                                                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#f9fafb', borderRadius: 1 }}>
                                                                        <Typography sx={{ fontSize: '11px', flex: 1 }}>
                                                                            {email}
                                                                        </Typography>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => handleCopyToClipboard(email, 'Email')}
                                                                        >
                                                                            <ContentCopyIcon sx={{ fontSize: '12px' }} />
                                                                        </IconButton>
                                                                    </Box>
                                                                ))}
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}
                                            </CardContent>
                                        </Card>
                                    )}

                                {/* API Configuration - for API carriers */}
                                {carrier.connectionType === 'api' && carrier.apiCredentials && (
                                    <Card>
                                        <CardContent sx={{ p: 3 }}>
                                            <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                                <ApiIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                API Configuration
                                            </Typography>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                        Host URL
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500, wordBreak: 'break-all' }}>
                                                        {carrier.apiCredentials.hostURL || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                        Username
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {carrier.apiCredentials.username ? '••••••••' : 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                {carrier.apiCredentials.endpoints && Object.keys(carrier.apiCredentials.endpoints).length > 0 && (
                                                    <Grid item xs={12}>
                                                        <Accordion>
                                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    API Endpoints ({Object.keys(carrier.apiCredentials.endpoints).length})
                                                                </Typography>
                                                            </AccordionSummary>
                                                            <AccordionDetails>
                                                                <Grid container spacing={1}>
                                                                    {Object.entries(carrier.apiCredentials.endpoints).map(([key, value]) => {
                                                                        if (!value) return null;
                                                                        return (
                                                                            <Grid item xs={12} key={key}>
                                                                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '10px' }}>
                                                                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                                                                </Typography>
                                                                                <Typography sx={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                                                    {value}
                                                                                </Typography>
                                                                            </Grid>
                                                                        );
                                                                    })}
                                                                </Grid>
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    </Grid>
                                                )}
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                )}
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
};

export default CarrierDetail;
