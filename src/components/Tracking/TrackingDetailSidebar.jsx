import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    CircularProgress,
    Alert,
    IconButton,
    Divider,
    Avatar,
    Chip,
    Button
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    ContentCopy as ContentCopyIcon,
    LocationOn as LocationIcon,
    CalendarToday as CalendarIcon,
    LocalShipping as ShippingIcon,
    Close as CloseIcon,
    QrCode as QrCodeIcon,
} from '@mui/icons-material';
import StatusChip from '../StatusChip/StatusChip';
import ShipmentTimeline from './ShipmentTimeline';
import QRCode from 'qrcode';

// Helper functions (copied from Tracking.jsx)
const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        case 'draft': return '#64748b';
        case 'unknown': return '#6b7280';
        case 'pending':
        case 'created': return '#d97706';
        case 'scheduled': return '#7c3aed';
        case 'booked': return '#2563eb';
        case 'awaiting_shipment':
        case 'awaiting shipment':
        case 'label_created': return '#ea580c';
        case 'in_transit':
        case 'in transit': return '#7c2d92';
        case 'delivered': return '#16a34a';
        case 'on_hold':
        case 'on hold': return '#dc2626';
        case 'canceled':
        case 'cancelled': return '#b91c1c';
        case 'void': return '#7f1d1d';
        default: return '#6b7280';
    }
};

const formatAddressDisplay = (address) => {
    if (!address) return 'N/A';
    const parts = [address.city, address.state, address.country].filter(Boolean);
    return parts.join(', ');
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch (error) {
        return 'Invalid Date';
    }
};

const CarrierDisplay = React.memo(({ carrierName, size = 'small' }) => {
    const sizeConfig = {
        small: { logoSize: 24, fontSize: '0.875rem' },
        medium: { logoSize: 32, fontSize: '1rem' },
        large: { logoSize: 40, fontSize: '1.125rem' }
    };

    const { logoSize, fontSize } = sizeConfig[size] || sizeConfig.small;

    if (!carrierName || carrierName === 'N/A' || carrierName.toLowerCase() === 'unknown') {
        return <Typography variant="body2" sx={{ fontSize, fontWeight: 500 }}>Carrier: Unknown</Typography>;
    }

    let logoUrl = null;
    const lcCarrierName = carrierName.toLowerCase();
    if (lcCarrierName.includes('canpar')) {
        logoUrl = '/assets/logos/canpar-logo.png';
    } else if (lcCarrierName.includes('eshipplus') || lcCarrierName.includes('e-ship')) {
        logoUrl = '/assets/logos/eshipplus-logo.png';
    } else if (lcCarrierName.includes('fedex')) {
        logoUrl = '/assets/logos/fedex-logo.png';
    } else if (lcCarrierName.includes('ups')) {
        logoUrl = '/assets/logos/ups-logo.png';
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {logoUrl ? (
                <Avatar
                    src={logoUrl}
                    alt={`${carrierName} logo`}
                    sx={{ width: logoSize, height: logoSize, borderRadius: 1 }}
                    imgProps={{ style: { objectFit: 'contain' } }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            ) : (
                <Avatar sx={{ width: logoSize, height: logoSize, bgcolor: 'primary.main', fontSize: fontSize }}>
                    {carrierName.charAt(0).toUpperCase()}
                </Avatar>
            )}
            <Typography variant="body2" sx={{ fontSize, fontWeight: 500 }}>
                {carrierName}
            </Typography>
        </Box>
    );
});

const TrackingDetailSidebar = ({
    shipmentData,
    carrier,
    loading,
    error,
    mergedEvents,
    onRefresh,
    isRefreshing,
    trackingNumber,
    onClose
}) => {
    // QR Code state
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [qrCodeLoading, setQrCodeLoading] = useState(false);

    // Generate QR code for tracking URL
    const generateQRCode = async (trackingId) => {
        if (!trackingId || trackingId === 'N/A') {
            setQrCodeUrl(null);
            return;
        }

        try {
            setQrCodeLoading(true);
            const trackingUrl = `${window.location.origin}/tracking/${encodeURIComponent(trackingId)}`;
            const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
                width: 150,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            setQrCodeUrl(qrDataUrl);
        } catch (error) {
            console.error('Error generating QR code:', error);
            setQrCodeUrl(null);
        } finally {
            setQrCodeLoading(false);
        }
    };

    // Generate QR code when shipment data is available
    useEffect(() => {
        if (shipmentData?.shipmentID || trackingNumber) {
            const trackingId = shipmentData?.shipmentID || trackingNumber;
            generateQRCode(trackingId);
        }
    }, [shipmentData?.shipmentID, trackingNumber]);

    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            console.log(`${label} copied to clipboard: ${text}`);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    return (
        <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#ffffff',
            color: 'text.primary'
        }}>
            {/* Header */}
            <Box sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Tracking Details
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {shipmentData?.status !== 'draft' && shipmentData?.status !== 'delivered' && (
                        <IconButton
                            size="small"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            title="Refresh status"
                            sx={{
                                '&:hover': { bgcolor: 'action.hover' }
                            }}
                        >
                            {isRefreshing ? (
                                <CircularProgress size={16} />
                            ) : (
                                <RefreshIcon sx={{ fontSize: 18 }} />
                            )}
                        </IconButton>
                    )}
                    <IconButton
                        size="small"
                        onClick={onClose}
                        title="Close"
                        sx={{
                            '&:hover': { bgcolor: 'action.hover' }
                        }}
                    >
                        <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            </Box>

            {/* Content */}
            <Box sx={{
                flex: 1,
                overflowY: 'auto',
                p: 2
            }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                ) : shipmentData ? (
                    <>
                        {/* Shipment ID */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                SolushipX Shipment ID
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    {shipmentData?.shipmentID || 'N/A'}
                                </Typography>
                                {shipmentData?.shipmentID && (
                                    <IconButton
                                        size="small"
                                        onClick={() => copyToClipboard(shipmentData.shipmentID, 'SolushipX Shipment ID')}
                                        sx={{ padding: '2px', color: 'text.secondary' }}
                                    >
                                        <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                                    </IconButton>
                                )}
                            </Box>
                        </Box>

                        {/* Carrier Tracking Number */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Carrier Tracking Number
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                                    {trackingNumber || 'N/A'}
                                </Typography>
                                {trackingNumber && (
                                    <IconButton
                                        size="small"
                                        onClick={() => copyToClipboard(trackingNumber, 'Carrier tracking number')}
                                        sx={{ padding: '2px', color: 'text.secondary' }}
                                    >
                                        <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                                    </IconButton>
                                )}
                            </Box>
                        </Box>

                        {/* Carrier */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Carrier
                            </Typography>
                            <CarrierDisplay carrierName={carrier || (shipmentData?.carrier || 'Unknown')} size="small" />
                        </Box>

                        {/* Status */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Status
                            </Typography>
                            <StatusChip status={shipmentData?.status} />
                        </Box>

                        {/* QR Code Section */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                QR Code
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                {qrCodeLoading ? (
                                    <Box sx={{
                                        width: 150,
                                        height: 150,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1
                                    }}>
                                        <CircularProgress size={24} />
                                    </Box>
                                ) : qrCodeUrl ? (
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        bgcolor: 'background.paper'
                                    }}>
                                        <img
                                            src={qrCodeUrl}
                                            alt="Tracking QR Code"
                                            style={{
                                                width: 130,
                                                height: 130,
                                                display: 'block'
                                            }}
                                        />
                                    </Box>
                                ) : (
                                    <Box sx={{
                                        width: 150,
                                        height: 150,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px dashed',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        bgcolor: 'grey.50'
                                    }}>
                                        <QrCodeIcon sx={{ fontSize: '2rem', color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                            No QR Code
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Estimated Delivery */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Estimated Delivery
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <CalendarIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                                <Typography variant="body1">
                                    {formatDate(shipmentData?.selectedRate?.estimatedDeliveryDate ||
                                        shipmentData?.carrierBookingConfirmation?.estimatedDeliveryDate)}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Origin */}
                        {shipmentData?.shipFrom && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Origin
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <LocationIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                                    <Typography variant="body1">{formatAddressDisplay(shipmentData.shipFrom)}</Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Destination */}
                        {shipmentData?.shipTo && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Destination
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <LocationIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                                    <Typography variant="body1">{formatAddressDisplay(shipmentData.shipTo)}</Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Tracking Timeline */}
                        {mergedEvents && mergedEvents.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Tracking History
                                </Typography>
                                <Box>
                                    <ShipmentTimeline events={mergedEvents} />
                                </Box>
                            </Box>
                        )}
                    </>
                ) : (
                    <Typography color="text.secondary" align="center">
                        Enter a tracking number to view details
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default TrackingDetailSidebar; 