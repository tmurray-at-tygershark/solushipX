import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Stack,
    Chip,
    IconButton,
    CircularProgress,
    Link,
    Avatar
} from '@mui/material';
import {
    LocalShipping as LocalShippingIcon,
    AccessTime as AccessTimeIcon,
    Assignment as AssignmentIcon,
    ContentCopy as ContentCopyIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import StatusChip from '../../StatusChip/StatusChip';

// CarrierDisplay component to show carrier logo and name
const CarrierDisplay = React.memo(({ carrierName, carrierData, size = 'medium', isIntegrationCarrier }) => {
    const sizeConfig = {
        small: { logoSize: 24, fontSize: '0.875rem' },
        medium: { logoSize: 32, fontSize: '1rem' },
        large: { logoSize: 40, fontSize: '1.125rem' }
    };

    const { logoSize, fontSize } = sizeConfig[size] || sizeConfig.medium;

    if (!carrierName || carrierName === 'N/A') {
        return <Typography variant="body1" sx={{ fontSize }}>N/A</Typography>;
    }

    const logoUrl = carrierData?.logoUrl || carrierData?.image;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {logoUrl ? (
                <Box
                    component="img"
                    src={logoUrl}
                    alt={`${carrierName} logo`}
                    sx={{
                        width: logoSize,
                        height: logoSize,
                        objectFit: 'contain',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        p: 0.5
                    }}
                    onError={(e) => {
                        e.target.style.display = 'none';
                    }}
                />
            ) : (
                <Avatar
                    sx={{
                        width: logoSize,
                        height: logoSize,
                        bgcolor: 'primary.main',
                        fontSize: fontSize,
                        fontWeight: 600
                    }}
                >
                    {carrierName.charAt(0).toUpperCase()}
                </Avatar>
            )}
            <Typography variant="body1" sx={{ fontSize, fontWeight: 500 }}>
                {carrierName}
                {isIntegrationCarrier && (
                    <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                        (via eShipPlus)
                    </Typography>
                )}
            </Typography>
        </Box>
    );
});

const ShipmentInformation = ({
    shipment,
    getBestRateInfo,
    carrierData,
    mergedEvents,
    actionStates,
    smartUpdateLoading,
    onRefreshStatus,
    onShowSnackbar
}) => {
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown time';

        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleString();
        } catch (error) {
            return 'Unknown time';
        }
    };

    const getLastUpdatedTimestamp = (shipment, mergedEvents) => {
        if (!shipment && !mergedEvents) return null;

        const timestamps = [];

        if (shipment?.updatedAt) {
            timestamps.push(shipment.updatedAt);
        }

        if (mergedEvents && Array.isArray(mergedEvents)) {
            mergedEvents.forEach(event => {
                if (event.timestamp) timestamps.push(event.timestamp);
                if (event.eventTime) timestamps.push(event.eventTime);
            });
        }

        if (timestamps.length === 0) return null;

        return timestamps.reduce((latest, current) => {
            const currentTime = current?.toDate ? current.toDate() : new Date(current);
            const latestTime = latest?.toDate ? latest.toDate() : new Date(latest);
            return currentTime > latestTime ? current : latest;
        });
    };

    const capitalizeShipmentType = (type) => {
        if (!type) return 'N/A';
        return type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    const handleCopyTracking = () => {
        const trackingNum = (() => {
            const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
                carrierData?.name?.toLowerCase().includes('canpar') ||
                carrierData?.carrierID === 'CANPAR';
            if (isCanparShipment) {
                return shipment?.trackingNumber ||
                    shipment?.carrierBookingConfirmation?.trackingNumber ||
                    shipment?.selectedRate?.TrackingNumber ||
                    shipment?.selectedRate?.Barcode ||
                    shipment?.id;
            } else {
                return shipment?.carrierBookingConfirmation?.proNumber ||
                    shipment?.carrierBookingConfirmation?.confirmationNumber ||
                    shipment?.trackingNumber ||
                    shipment?.id;
            }
        })();

        if (trackingNum && trackingNum !== 'N/A') {
            navigator.clipboard.writeText(trackingNum);
            onShowSnackbar('Tracking number copied!', 'success');
        } else {
            onShowSnackbar('No tracking number to copy.', 'warning');
        }
    };

    const getTrackingNumber = () => {
        const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
            carrierData?.name?.toLowerCase().includes('canpar') ||
            carrierData?.carrierID === 'CANPAR';

        if (isCanparShipment) {
            return shipment?.trackingNumber ||
                shipment?.carrierBookingConfirmation?.trackingNumber ||
                shipment?.selectedRate?.TrackingNumber ||
                shipment?.selectedRate?.Barcode ||
                shipment?.id ||
                'N/A';
        } else {
            return shipment?.carrierBookingConfirmation?.proNumber ||
                shipment?.carrierBookingConfirmation?.confirmationNumber ||
                shipment?.trackingNumber ||
                shipment?.id ||
                'N/A';
        }
    };

    return (
        <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <LocalShippingIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Shipment Information</Typography>
                </Box>

                <Grid container spacing={3}>
                    {/* Basic Information */}
                    <Grid item xs={12} md={3}>
                        <Box sx={{
                            p: 2,
                            bgcolor: 'background.default',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%'
                        }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Basic Information
                            </Typography>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Shipment Type</Typography>
                                    <Typography variant="body2">{capitalizeShipmentType(shipment?.shipmentInfo?.shipmentType || 'N/A')}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Reference Number</Typography>
                                    <Typography variant="body2">{shipment?.shipmentInfo?.shipperReferenceNumber || shipment?.shipmentID || 'N/A'}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Bill Type</Typography>
                                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                        {shipment?.shipmentInfo?.shipmentBillType?.toLowerCase() || 'N/A'}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                    </Grid>

                    {/* Timing Information */}
                    <Grid item xs={12} md={3}>
                        <Box sx={{
                            p: 2,
                            bgcolor: 'background.default',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%'
                        }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Timing Information
                            </Typography>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Shipment Date</Typography>
                                    <Typography variant="body2">
                                        {shipment?.shipmentInfo?.shipmentDate ? new Date(shipment.shipmentInfo.shipmentDate).toLocaleDateString() : 'N/A'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Estimated Delivery</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: '0.9rem' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {(() => {
                                                const deliveryDate =
                                                    shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                                                    getBestRateInfo?.transit?.estimatedDelivery ||
                                                    getBestRateInfo?.estimatedDeliveryDate;

                                                if (deliveryDate) {
                                                    try {
                                                        const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                                                        return date.toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        });
                                                    } catch (error) {
                                                        return 'Invalid Date';
                                                    }
                                                }
                                                return 'N/A';
                                            })()}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Pickup Window</Typography>
                                    <Typography variant="body2">
                                        {shipment?.shipmentInfo?.earliestPickupTime && shipment?.shipmentInfo?.latestPickupTime
                                            ? `${shipment.shipmentInfo.earliestPickupTime} - ${shipment.shipmentInfo.latestPickupTime}`
                                            : '09:00 - 17:00'}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                    </Grid>

                    {/* Tracking Information */}
                    <Grid item xs={12} md={3}>
                        <Box sx={{
                            p: 2,
                            bgcolor: 'background.default',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%'
                        }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Tracking & Status
                            </Typography>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Current Status</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <StatusChip status={shipment?.status} />
                                        <IconButton
                                            size="small"
                                            onClick={onRefreshStatus}
                                            disabled={smartUpdateLoading || actionStates.refreshStatus.loading || shipment?.status === 'draft'}
                                            sx={{
                                                padding: '4px',
                                                '&:hover': { bgcolor: 'action.hover' }
                                            }}
                                            title="Refresh status"
                                        >
                                            {smartUpdateLoading || actionStates.refreshStatus.loading ?
                                                <CircularProgress size={14} /> :
                                                <RefreshIcon sx={{ fontSize: 16 }} />
                                            }
                                        </IconButton>
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Carrier</Typography>
                                    <CarrierDisplay
                                        carrierName={getBestRateInfo?.carrier}
                                        carrierData={carrierData}
                                        size="small"
                                        isIntegrationCarrier={getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus'}
                                    />
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Tracking Number</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Link
                                            component={RouterLink}
                                            to={`/tracking/${getTrackingNumber()}`}
                                            style={{ textDecoration: 'none' }}
                                        >
                                            <Box sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.5,
                                                '&:hover': { color: 'primary.dark' }
                                            }}>
                                                <AssignmentIcon sx={{ color: 'primary.main', fontSize: '0.9rem' }} />
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 500,
                                                        color: 'primary.main',
                                                        '&:hover': { textDecoration: 'underline' }
                                                    }}
                                                >
                                                    {getTrackingNumber()}
                                                </Typography>
                                            </Box>
                                        </Link>
                                        <IconButton
                                            size="small"
                                            onClick={handleCopyTracking}
                                            sx={{ padding: '2px' }}
                                            title="Copy tracking number"
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                        </IconButton>
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Last Updated</Typography>
                                    <Typography variant="body2">
                                        {(() => {
                                            const lastUpdated = getLastUpdatedTimestamp(shipment, mergedEvents);
                                            return lastUpdated ? formatTimestamp(lastUpdated) : 'N/A';
                                        })()}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                    </Grid>

                    {/* Service Options */}
                    <Grid item xs={12} md={3}>
                        <Box sx={{
                            p: 2,
                            bgcolor: 'background.default',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%'
                        }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Service Options
                            </Typography>
                            <Stack spacing={2}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">Hold for Pickup</Typography>
                                    <Chip
                                        size="small"
                                        label={(shipment?.shipmentInfo?.holdForPickup === true || String(shipment?.shipmentInfo?.holdForPickup).toLowerCase() === "true") ? "Yes" : "No"}
                                        color={(shipment?.shipmentInfo?.holdForPickup === true || String(shipment?.shipmentInfo?.holdForPickup).toLowerCase() === "true") ? "primary" : "default"}
                                        variant="outlined"
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">International</Typography>
                                    <Chip
                                        size="small"
                                        label={shipment?.shipFrom?.country && shipment?.shipTo?.country && shipment.shipFrom.country !== shipment.shipTo.country ? "Yes" : "No"}
                                        color={shipment?.shipFrom?.country && shipment?.shipTo?.country && shipment.shipFrom.country !== shipment.shipTo.country ? "primary" : "default"}
                                        variant="outlined"
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">Saturday Delivery</Typography>
                                    <Chip
                                        size="small"
                                        label={(shipment?.shipmentInfo?.saturdayDelivery === true || String(shipment?.shipmentInfo?.saturdayDelivery).toLowerCase() === "true") ? "Yes" : "No"}
                                        color={(shipment?.shipmentInfo?.saturdayDelivery === true || String(shipment?.shipmentInfo?.saturdayDelivery).toLowerCase() === "true") ? "primary" : "default"}
                                        variant="outlined"
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">Signature Required</Typography>
                                    <Chip
                                        size="small"
                                        label={(shipment?.shipmentInfo?.signatureRequired === true || String(shipment?.shipmentInfo?.signatureRequired).toLowerCase() === "true") ? "Yes" : "No"}
                                        color={(shipment?.shipmentInfo?.signatureRequired === true || String(shipment?.shipmentInfo?.signatureRequired).toLowerCase() === "true") ? "primary" : "default"}
                                        variant="outlined"
                                    />
                                </Box>
                            </Stack>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>
        </Grid>
    );
};

export default ShipmentInformation; 