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
    Breadcrumbs,
} from '@mui/material';
import {
    LocalShipping as ShippingIcon,
    LocationOn as LocationIcon,
    AccessTime as TimeIcon,
    Info as InfoIcon,
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

    if (loading) return <Typography>Loading...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!shipmentData) return <Typography>No shipment data available</Typography>;

    const getStatusStep = (status) => {
        switch (status) {
            case 'pending':
                return 0;
            case 'in_transit':
                return 1;
            case 'delivered':
                return 2;
            case 'cancelled':
                return -1;
            default:
                return 0;
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return timestamp.toDate().toLocaleString();
    };

    return (
        <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header with Breadcrumbs and Title */}
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <ShippingIcon sx={{ color: 'primary.main', fontSize: 32, mr: 1 }} />
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                            Shipment Detail
                        </Typography>
                    </Box>
                    <Box>
                        <Breadcrumbs aria-label="breadcrumb">
                            <Typography
                                component="a"
                                href="/admin"
                                sx={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
                            >
                                Admin
                            </Typography>
                            <Typography
                                component="a"
                                href="/admin/shipments"
                                sx={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
                            >
                                Shipments
                            </Typography>
                            <Typography color="text.primary">
                                {shipmentData?.shipmentId || 'Shipment'}
                            </Typography>
                        </Breadcrumbs>
                    </Box>
                </Box>
                <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
                    <Grid container spacing={3}>
                        {/* Basic Information */}
                        <Grid item xs={12}>
                            <Paper className="shipment-info-paper">
                                <Typography variant="h6" gutterBottom>
                                    Basic Information
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Tracking Number
                                        </Typography>
                                        <Typography variant="body1">
                                            {shipmentData.trackingNumber}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Carrier
                                        </Typography>
                                        <Typography variant="body1">
                                            {shipmentData.carrier}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Company
                                        </Typography>
                                        <Typography variant="body1">
                                            {shipmentData.companyName}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Service Type
                                        </Typography>
                                        <Typography variant="body1">
                                            {shipmentData.serviceType || 'N/A'}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Shipping Progress */}
                        <Grid item xs={12}>
                            <Paper className="shipment-progress-paper">
                                <Typography variant="h6" gutterBottom>
                                    Shipping Progress
                                </Typography>
                                <Stepper activeStep={getStatusStep(shipmentData.status)} orientation="vertical">
                                    <Step>
                                        <StepLabel>Order Created</StepLabel>
                                        <StepContent>
                                            <Typography variant="body2" color="textSecondary">
                                                {formatDate(shipmentData.createdAt)}
                                            </Typography>
                                        </StepContent>
                                    </Step>
                                    <Step>
                                        <StepLabel>In Transit</StepLabel>
                                        <StepContent>
                                            <Typography variant="body2" color="textSecondary">
                                                {formatDate(shipmentData.inTransitDate)}
                                            </Typography>
                                        </StepContent>
                                    </Step>
                                    <Step>
                                        <StepLabel>Delivered</StepLabel>
                                        <StepContent>
                                            <Typography variant="body2" color="textSecondary">
                                                {formatDate(shipmentData.deliveredDate)}
                                            </Typography>
                                        </StepContent>
                                    </Step>
                                </Stepper>
                            </Paper>
                        </Grid>

                        {/* Addresses */}
                        <Grid item xs={12} md={6}>
                            <Paper className="shipment-address-paper">
                                <Typography variant="h6" gutterBottom>
                                    <LocationIcon sx={{ mr: 1 }} />
                                    Shipping Address
                                </Typography>
                                <Typography variant="body1">
                                    {shipmentData.shippingAddress?.street}
                                </Typography>
                                <Typography variant="body1">
                                    {shipmentData.shippingAddress?.city}, {shipmentData.shippingAddress?.state} {shipmentData.shippingAddress?.zipCode}
                                </Typography>
                                <Typography variant="body1">
                                    {shipmentData.shippingAddress?.country}
                                </Typography>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper className="shipment-address-paper">
                                <Typography variant="h6" gutterBottom>
                                    <LocationIcon sx={{ mr: 1 }} />
                                    Delivery Address
                                </Typography>
                                <Typography variant="body1">
                                    {shipmentData.deliveryAddress?.street}
                                </Typography>
                                <Typography variant="body1">
                                    {shipmentData.deliveryAddress?.city}, {shipmentData.deliveryAddress?.state} {shipmentData.deliveryAddress?.zipCode}
                                </Typography>
                                <Typography variant="body1">
                                    {shipmentData.deliveryAddress?.country}
                                </Typography>
                            </Paper>
                        </Grid>

                        {/* Tracking Timeline */}
                        <Grid item xs={12}>
                            <Paper className="shipment-timeline-paper">
                                <Typography variant="h6" gutterBottom>
                                    <TimeIcon sx={{ mr: 1 }} />
                                    Tracking Timeline
                                </Typography>
                                <Timeline>
                                    {shipmentData.trackingHistory?.map((event, index) => (
                                        <TimelineItem key={index}>
                                            <TimelineSeparator>
                                                <TimelineDot color="primary" />
                                                {index < shipmentData.trackingHistory.length - 1 && <TimelineConnector />}
                                            </TimelineSeparator>
                                            <TimelineContent>
                                                <Typography variant="subtitle2">
                                                    {event.status}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    {formatDate(event.timestamp)}
                                                </Typography>
                                                {event.location && (
                                                    <Typography variant="body2">
                                                        {event.location}
                                                    </Typography>
                                                )}
                                            </TimelineContent>
                                        </TimelineItem>
                                    ))}
                                </Timeline>
                            </Paper>
                        </Grid>

                        {/* Package Details */}
                        <Grid item xs={12}>
                            <Paper className="shipment-package-paper">
                                <Typography variant="h6" gutterBottom>
                                    <InfoIcon sx={{ mr: 1 }} />
                                    Package Details
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Weight
                                        </Typography>
                                        <Typography variant="body1">
                                            {shipmentData.packageDetails?.weight} {shipmentData.packageDetails?.weightUnit}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Dimensions
                                        </Typography>
                                        <Typography variant="body1">
                                            {shipmentData.packageDetails?.length} x {shipmentData.packageDetails?.width} x {shipmentData.packageDetails?.height} {shipmentData.packageDetails?.dimensionUnit}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Declared Value
                                        </Typography>
                                        <Typography variant="body1">
                                            ${shipmentData.packageDetails?.declaredValue}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>
                    </Grid>
                </Paper>
            </Box>
        </Box>
    );
};

export default ShipmentDetails; 