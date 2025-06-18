import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Typography,
    Paper,
    Divider,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    CircularProgress,
    Alert,
    Chip
} from '@mui/material';
import {
    LocalShipping as ShippingIcon,
    LocationOn as LocationIcon,
    AccessTime as TimeIcon,
    Info as InfoIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

const ShipmentDetails = ({ shipment }) => {
    const [shipmentData, setShipmentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!shipment?.id) return;

        const unsubscribe = onSnapshot(
            doc(db, 'shipments', shipment.id),
            (doc) => {
                if (doc.exists()) {
                    setShipmentData({ id: doc.id, ...doc.data() });
                }
                setLoading(false);
            },
            (err) => {
                setError('Error fetching shipment details: ' + err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [shipment?.id]);

    const getStatusStep = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
            case 'booked':
            case 'scheduled':
                return 0;
            case 'in_transit':
            case 'in transit':
            case 'picked_up':
            case 'on_route':
                return 1;
            case 'delivered':
            case 'completed':
                return 2;
            case 'cancelled':
            case 'canceled':
                return -1;
            default:
                return 0;
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            if (timestamp.toDate) {
                return timestamp.toDate().toLocaleString();
            }
            return new Date(timestamp).toLocaleString();
        } catch (error) {
            return 'Invalid Date';
        }
    };

    const formatAddress = (address) => {
        if (!address || typeof address !== 'object') {
            return 'N/A';
        }

        const parts = [];
        if (address.company) parts.push(address.company);
        if (address.contactName || address.attentionName) parts.push(address.contactName || address.attentionName);
        if (address.street) parts.push(address.street);
        if (address.street2) parts.push(address.street2);

        const cityStateZip = [address.city, address.state, address.postalCode || address.zipCode].filter(Boolean).join(', ');
        if (cityStateZip) parts.push(cityStateZip);

        if (address.country && address.country !== 'US') parts.push(address.country);

        return parts.join('\n') || 'N/A';
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered':
            case 'completed':
                return 'success';
            case 'in_transit':
            case 'in transit':
            case 'picked_up':
            case 'on_route':
                return 'primary';
            case 'cancelled':
            case 'canceled':
                return 'error';
            case 'delayed':
            case 'on_hold':
                return 'warning';
            default:
                return 'default';
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error" sx={{ fontSize: '12px' }}>
                    {error}
                </Alert>
            </Box>
        );
    }

    if (!shipmentData) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning" sx={{ fontSize: '12px' }}>
                    No shipment data available
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ShippingIcon sx={{ color: '#374151', fontSize: 28 }} />
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                                Shipment Detail
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                {shipmentData.shipmentID || shipmentData.id}
                            </Typography>
                        </Box>
                    </Box>

                    <Chip
                        label={shipmentData.status || 'Unknown'}
                        color={getStatusColor(shipmentData.status)}
                        sx={{ fontSize: '12px', fontWeight: 500 }}
                    />
                </Box>
            </Box>

            {/* Scrollable Content Area */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Grid container spacing={3}>
                    {/* Basic Information */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <BusinessIcon sx={{ fontSize: 20 }} />
                                Basic Information
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                                            Tracking Number
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151' }}>
                                            {shipmentData.trackingNumber || shipmentData.selectedRate?.trackingNumber || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                                            Carrier
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151' }}>
                                            {shipmentData.carrier || shipmentData.selectedRate?.carrier || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                                            Company
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151' }}>
                                            {shipmentData.companyName || shipmentData.companyID || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                                            Service Type
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151' }}>
                                            {shipmentData.serviceType || shipmentData.selectedRate?.service || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                                            Created At
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151' }}>
                                            {formatDate(shipmentData.createdAt)}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                                            Shipment Type
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151' }}>
                                            {shipmentData.shipmentType || shipmentData.shipmentInfo?.shipmentType || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Shipping Progress */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TimeIcon sx={{ fontSize: 20 }} />
                                Shipping Progress
                            </Typography>
                            <Stepper activeStep={getStatusStep(shipmentData.status)} orientation="vertical">
                                <Step>
                                    <StepLabel>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Order Created</Typography>
                                    </StepLabel>
                                    <StepContent>
                                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                            {formatDate(shipmentData.createdAt)}
                                        </Typography>
                                    </StepContent>
                                </Step>
                                <Step>
                                    <StepLabel>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>In Transit</Typography>
                                    </StepLabel>
                                    <StepContent>
                                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                            {formatDate(shipmentData.inTransitDate || shipmentData.pickedUpDate)}
                                        </Typography>
                                    </StepContent>
                                </Step>
                                <Step>
                                    <StepLabel>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>Delivered</Typography>
                                    </StepLabel>
                                    <StepContent>
                                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                            {formatDate(shipmentData.deliveredDate)}
                                        </Typography>
                                    </StepContent>
                                </Step>
                            </Stepper>
                        </Paper>
                    </Grid>

                    {/* Addresses */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px', height: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocationIcon sx={{ fontSize: 20 }} />
                                Origin Address
                            </Typography>
                            <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151', whiteSpace: 'pre-line' }}>
                                {formatAddress(shipmentData.shipFrom || shipmentData.shipfrom)}
                            </Typography>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px', height: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocationIcon sx={{ fontSize: 20 }} />
                                Destination Address
                            </Typography>
                            <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151', whiteSpace: 'pre-line' }}>
                                {formatAddress(shipmentData.shipTo || shipmentData.shipto)}
                            </Typography>
                        </Paper>
                    </Grid>

                    {/* Package Details */}
                    {(shipmentData.packages || shipmentData.packageDetails) && (
                        <Grid item xs={12}>
                            <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <InfoIcon sx={{ fontSize: 20 }} />
                                    Package Details
                                </Typography>
                                {shipmentData.packages && Array.isArray(shipmentData.packages) ? (
                                    shipmentData.packages.map((pkg, index) => (
                                        <Box key={index} sx={{ mb: 2, p: 2, bgcolor: '#f9fafb', borderRadius: '4px' }}>
                                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                Package {index + 1}
                                            </Typography>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} md={3}>
                                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                        Weight
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                        {pkg.weight || 'N/A'} {pkg.weightUnit || 'lbs'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} md={4}>
                                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                        Dimensions
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                        {pkg.length || 'N/A'} × {pkg.width || 'N/A'} × {pkg.height || 'N/A'} {pkg.dimensionUnit || 'in'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} md={3}>
                                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                        Declared Value
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                        ${pkg.declaredValue || '0.00'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} md={2}>
                                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                        Quantity
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                        {pkg.packagingQuantity || pkg.quantity || 1}
                                                    </Typography>
                                                </Grid>
                                                {pkg.itemDescription && (
                                                    <Grid item xs={12}>
                                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                            Description
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                            {pkg.itemDescription}
                                                        </Typography>
                                                    </Grid>
                                                )}
                                            </Grid>
                                        </Box>
                                    ))
                                ) : (
                                    <Box sx={{ p: 2, bgcolor: '#f9fafb', borderRadius: '4px' }}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} md={4}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                    Weight
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    {shipmentData.packageDetails?.weight || 'N/A'} {shipmentData.packageDetails?.weightUnit || 'lbs'}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                    Dimensions
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    {shipmentData.packageDetails?.length || 'N/A'} × {shipmentData.packageDetails?.width || 'N/A'} × {shipmentData.packageDetails?.height || 'N/A'} {shipmentData.packageDetails?.dimensionUnit || 'in'}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', mb: 0.5 }}>
                                                    Declared Value
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    ${shipmentData.packageDetails?.declaredValue || '0.00'}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                )}
                            </Paper>
                        </Grid>
                    )}

                    {/* Tracking Timeline */}
                    {shipmentData.trackingHistory && shipmentData.trackingHistory.length > 0 && (
                        <Grid item xs={12}>
                            <Paper sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TimeIcon sx={{ fontSize: 20 }} />
                                    Tracking Timeline
                                </Typography>
                                <Timeline>
                                    {shipmentData.trackingHistory.map((event, index) => (
                                        <TimelineItem key={index}>
                                            <TimelineSeparator>
                                                <TimelineDot color="primary" sx={{ bgcolor: '#374151' }} />
                                                {index < shipmentData.trackingHistory.length - 1 && <TimelineConnector sx={{ bgcolor: '#e5e7eb' }} />}
                                            </TimelineSeparator>
                                            <TimelineContent>
                                                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                    {event.status}
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                    {formatDate(event.timestamp)}
                                                </Typography>
                                                {event.location && (
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {event.location}
                                                    </Typography>
                                                )}
                                            </TimelineContent>
                                        </TimelineItem>
                                    ))}
                                </Timeline>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            </Box>
        </Box>
    );
};

export default ShipmentDetails; 