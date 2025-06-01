import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    Grid,
    Card,
    CardContent,
    Chip,
    Button,
    Divider,
    IconButton
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    LocalShipping as ShippingIcon,
    CheckCircle as DeliveredIcon,
    Schedule as ScheduledIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Launch as LaunchIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { trackShipment } from '../../services/trackingService';
import { getStatusColor } from '../../utils/universalDataModel';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot
} from '@mui/lab';

const TrackingDetail = () => {
    const { trackingId } = useParams();
    const navigate = useNavigate();
    const [trackingData, setTrackingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTrackingData = async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        else setLoading(true);

        setError(null);

        try {
            const result = await trackShipment(trackingId);

            // Store the full result regardless of success
            setTrackingData(result);

            if (result.success) {
                // Success case - data is already set above
            } else {
                setError(result.error || 'Failed to track shipment');
            }
        } catch (err) {
            console.error('Error fetching tracking data:', err);
            setError(err.message || 'An unexpected error occurred');
            setTrackingData(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (trackingId) {
            fetchTrackingData();
        }
    }, [trackingId]);

    const handleRefresh = () => {
        fetchTrackingData(true);
    };

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered':
                return <DeliveredIcon color="success" />;
            case 'in_transit':
                return <ShippingIcon color="primary" />;
            case 'scheduled':
            case 'booked':
                return <ScheduledIcon color="info" />;
            case 'unknown':
            case 'error':
                return <ErrorIcon color="error" />;
            default:
                return <InfoIcon />;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not available';
        try {
            return new Date(dateString).toLocaleString();
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    bgcolor: '#f8f9fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={60} />
                    <Typography variant="h6" sx={{ mt: 2 }}>
                        Loading tracking information...
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    bgcolor: '#f8f9fa',
                    py: 8
                }}
            >
                <Container maxWidth="md">
                    <Paper sx={{ p: 4 }}>
                        <Alert severity="error" sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                                Tracking Error
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2 }}>
                                {error}
                            </Typography>

                            {/* Show debug information if available */}
                            {trackingData && !trackingData.success && (
                                <Box sx={{ mt: 2 }}>
                                    {trackingData.debugInfo && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                                Debug Information:
                                            </Typography>
                                            <Box component="ul" sx={{ pl: 2, mb: 1 }}>
                                                {trackingData.debugInfo.hasSelectedRate !== undefined && (
                                                    <Typography component="li" variant="body2">
                                                        Has Selected Rate: {trackingData.debugInfo.hasSelectedRate ? 'Yes' : 'No'}
                                                    </Typography>
                                                )}
                                                {trackingData.debugInfo.hasCarrierField !== undefined && (
                                                    <Typography component="li" variant="body2">
                                                        Has Carrier Field: {trackingData.debugInfo.hasCarrierField ? 'Yes' : 'No'}
                                                    </Typography>
                                                )}
                                                {trackingData.debugInfo.hasRates !== undefined && (
                                                    <Typography component="li" variant="body2">
                                                        Has Rates Array: {trackingData.debugInfo.hasRates ? 'Yes' : 'No'}
                                                    </Typography>
                                                )}
                                                {trackingData.debugInfo.availableFields && trackingData.debugInfo.availableFields.length > 0 && (
                                                    <Typography component="li" variant="body2">
                                                        Available Fields ({trackingData.debugInfo.availableFields.length}): {trackingData.debugInfo.availableFields.join(', ')}
                                                    </Typography>
                                                )}
                                                {trackingData.debugInfo.selectedRateKeys && trackingData.debugInfo.selectedRateKeys.length > 0 && (
                                                    <Typography component="li" variant="body2">
                                                        Available Rate Fields: {trackingData.debugInfo.selectedRateKeys.join(', ')}
                                                    </Typography>
                                                )}
                                                {trackingData.debugInfo.expectedFields && (
                                                    <Typography component="li" variant="body2">
                                                        Expected Fields for {trackingData.carrierInfo?.name}: {trackingData.debugInfo.expectedFields.join(', ')}
                                                    </Typography>
                                                )}
                                                {trackingData.debugInfo.actualFields && (
                                                    <Typography component="li" variant="body2">
                                                        Actual Fields: {trackingData.debugInfo.actualFields.join(', ')}
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* Show field types for debugging */}
                                            {trackingData.debugInfo.fieldTypes && (
                                                <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                                        Field Types:
                                                    </Typography>
                                                    <Box component="pre" sx={{ fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                                        {JSON.stringify(trackingData.debugInfo.fieldTypes, null, 2)}
                                                    </Box>
                                                </Box>
                                            )}

                                            {/* Show all fields preview if available */}
                                            {trackingData.shipmentData?.allFieldsPreview && (
                                                <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f7ff', borderRadius: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                                        All Shipment Fields Preview:
                                                    </Typography>
                                                    <Box component="pre" sx={{ fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                                                        {JSON.stringify(trackingData.shipmentData.allFieldsPreview, null, 2)}
                                                    </Box>
                                                </Box>
                                            )}

                                            {trackingData.debugInfo.suggestion && (
                                                <Alert severity="info" sx={{ mt: 1 }}>
                                                    <Typography variant="body2">
                                                        <strong>Suggestion:</strong> {trackingData.debugInfo.suggestion}
                                                    </Typography>
                                                </Alert>
                                            )}
                                        </Box>
                                    )}

                                    {/* Show shipment data if available */}
                                    {trackingData.shipmentData && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                                Shipment Information:
                                            </Typography>
                                            <Box component="ul" sx={{ pl: 2 }}>
                                                <Typography component="li" variant="body2">
                                                    ID: {trackingData.shipmentData.id}
                                                </Typography>
                                                {trackingData.shipmentData.shipmentID && (
                                                    <Typography component="li" variant="body2">
                                                        Shipment ID: {trackingData.shipmentData.shipmentID}
                                                    </Typography>
                                                )}
                                                {trackingData.shipmentData.status && (
                                                    <Typography component="li" variant="body2">
                                                        Status: {trackingData.shipmentData.status}
                                                    </Typography>
                                                )}
                                                {trackingData.shipmentData.createdAt && (
                                                    <Typography component="li" variant="body2">
                                                        Created: {new Date(trackingData.shipmentData.createdAt.seconds * 1000).toLocaleDateString()}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Alert>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                variant="contained"
                                onClick={() => navigate('/tracking')}
                            >
                                Try Another Search
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={handleRefresh}
                                startIcon={<RefreshIcon />}
                            >
                                Retry
                            </Button>
                        </Box>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#f8f9fa',
                py: 4
            }}
        >
            <Container maxWidth="lg">
                {/* Header */}
                <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                            Shipment Tracking
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {trackingData?.type === 'shipment_id' ? 'Shipment ID' : 'Tracking Number'}: {trackingId}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={handleRefresh}
                        disabled={refreshing}
                        sx={{ bgcolor: 'white', '&:hover': { bgcolor: '#f5f5f5' } }}
                    >
                        <RefreshIcon sx={{ transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 1s' }} />
                    </IconButton>
                </Box>

                <Grid container spacing={3}>
                    {/* Main Status Card */}
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                {getStatusIcon(trackingData?.status)}
                                <Box sx={{ ml: 2 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                        {trackingData?.statusDisplay || 'Unknown Status'}
                                    </Typography>
                                    <Chip
                                        label={trackingData?.status || 'unknown'}
                                        sx={{
                                            mt: 1,
                                            bgcolor: getStatusColor(trackingData?.status),
                                            color: 'white',
                                            fontWeight: 600
                                        }}
                                    />
                                </Box>
                            </Box>

                            {/* Shipment Information */}
                            {trackingData?.shipmentData && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                        Shipment Information
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="body2" color="text.secondary">
                                                Origin
                                            </Typography>
                                            <Typography variant="body1">
                                                {trackingData.shipmentData.shipFrom?.city}, {trackingData.shipmentData.shipFrom?.provinceCode}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="body2" color="text.secondary">
                                                Destination
                                            </Typography>
                                            <Typography variant="body1">
                                                {trackingData.shipmentData.shipTo?.city}, {trackingData.shipmentData.shipTo?.provinceCode}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {/* Tracking Timeline */}
                            {trackingData?.trackingEvents && trackingData.trackingEvents.length > 0 && (
                                <Box>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                        Tracking Events
                                    </Typography>
                                    <Timeline>
                                        {trackingData.trackingEvents.map((event, index) => (
                                            <TimelineItem key={index}>
                                                <TimelineSeparator>
                                                    <TimelineDot
                                                        sx={{
                                                            bgcolor: index === 0 ? 'primary.main' : 'grey.400'
                                                        }}
                                                    />
                                                    {index < trackingData.trackingEvents.length - 1 && (
                                                        <TimelineConnector />
                                                    )}
                                                </TimelineSeparator>
                                                <TimelineContent>
                                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                        {event.description}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {formatDate(event.date)}
                                                    </Typography>
                                                    {event.location && (
                                                        <Typography variant="body2" color="text.secondary">
                                                            {event.location}
                                                        </Typography>
                                                    )}
                                                </TimelineContent>
                                            </TimelineItem>
                                        ))}
                                    </Timeline>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* Sidebar Information */}
                    <Grid item xs={12} md={4}>
                        {/* Carrier Information */}
                        {trackingData?.carrierInfo && (
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                        Carrier Information
                                    </Typography>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Carrier
                                        </Typography>
                                        <Typography variant="body1">
                                            {trackingData.carrierInfo.carrierName}
                                        </Typography>
                                    </Box>
                                    {trackingData.carrierInfo.serviceType && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Service Type
                                            </Typography>
                                            <Typography variant="body1">
                                                {trackingData.carrierInfo.serviceType}
                                            </Typography>
                                        </Box>
                                    )}
                                    {trackingData.carrierInfo.trackingUrl && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<LaunchIcon />}
                                            href={trackingData.carrierInfo.trackingUrl}
                                            target="_blank"
                                            fullWidth
                                        >
                                            View on Carrier Site
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Shipment Dates */}
                        {trackingData?.shipmentDates && (
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                        Important Dates
                                    </Typography>
                                    {trackingData.shipmentDates.actualPickup && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Pickup Date
                                            </Typography>
                                            <Typography variant="body1">
                                                {formatDate(trackingData.shipmentDates.actualPickup)}
                                            </Typography>
                                        </Box>
                                    )}
                                    {trackingData.estimatedDelivery && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Estimated Delivery
                                            </Typography>
                                            <Typography variant="body1">
                                                {formatDate(trackingData.estimatedDelivery)}
                                            </Typography>
                                        </Box>
                                    )}
                                    {trackingData.actualDelivery && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Actual Delivery
                                            </Typography>
                                            <Typography variant="body1">
                                                {formatDate(trackingData.actualDelivery)}
                                            </Typography>
                                        </Box>
                                    )}
                                    {trackingData.lastUpdated && (
                                        <Box>
                                            <Typography variant="body2" color="text.secondary">
                                                Last Updated
                                            </Typography>
                                            <Typography variant="body1">
                                                {formatDate(trackingData.lastUpdated)}
                                            </Typography>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Delivery Information */}
                        {trackingData?.deliveryInfo && (
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                        Delivery Details
                                    </Typography>
                                    {trackingData.deliveryInfo.signedBy && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Signed By
                                            </Typography>
                                            <Typography variant="body1">
                                                {trackingData.deliveryInfo.signedBy}
                                            </Typography>
                                        </Box>
                                    )}
                                    {trackingData.deliveryInfo.deliveryAddress && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Delivery Address
                                            </Typography>
                                            <Typography variant="body1">
                                                {trackingData.deliveryInfo.deliveryAddress}
                                            </Typography>
                                        </Box>
                                    )}
                                    {trackingData.deliveryInfo.signatureUrl && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<LaunchIcon />}
                                            href={trackingData.deliveryInfo.signatureUrl}
                                            target="_blank"
                                            fullWidth
                                        >
                                            View Signature
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </Grid>
                </Grid>

                {/* Back to Search */}
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/tracking')}
                        size="large"
                    >
                        Track Another Shipment
                    </Button>
                </Box>
            </Container>
        </Box>
    );
};

export default TrackingDetail; 