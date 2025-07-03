import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    TextField,
    FormControlLabel,
    Checkbox,
    Alert,
    IconButton,
    Divider,
    LinearProgress,
    RadioGroup,
    Radio,
    FormControl,
    FormLabel
} from '@mui/material';
import {
    Close as CloseIcon,
    Cancel as CancelIcon,
    Warning as WarningIcon,
    NotificationsActive as NotificationIcon,
    Archive as ArchiveIcon,
    MonetizationOn as RefundIcon
} from '@mui/icons-material';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';

const CancelShipmentModal = ({
    open,
    onClose,
    shipment,
    onShipmentCancelled,
    showNotification
}) => {
    // Form state
    const [cancellationReason, setCancellationReason] = useState('');
    const [selectedReasonType, setSelectedReasonType] = useState('customer_request');
    const [notifyCarrier, setNotifyCarrier] = useState(true);
    const [notifyShipper, setNotifyShipper] = useState(true);
    const [loading, setLoading] = useState(false);

    // Predefined cancellation reasons
    const cancellationReasons = {
        customer_request: 'Customer requested cancellation',
        address_error: 'Incorrect pickup or delivery address',
        package_error: 'Package details incorrect',
        timing_issue: 'Schedule no longer works',
        cost_issue: 'Cost-related concerns',
        carrier_issue: 'Carrier availability problem',
        duplicate_booking: 'Duplicate shipment booking',
        other: 'Other reason (specify below)'
    };

    // Get carrier support info
    const getCarrierCancelSupport = () => {
        const carrierName = shipment?.selectedCarrier?.toLowerCase() || shipment?.carrier?.toLowerCase();
        const supportedCarriers = ['eshipplus', 'canpar', 'polaris'];

        return {
            supported: supportedCarriers.includes(carrierName),
            carrier: carrierName,
            automatic: supportedCarriers.includes(carrierName)
        };
    };

    const carrierSupport = getCarrierCancelSupport();

    // Check if shipment can be cancelled
    const canCancelShipment = () => {
        const status = shipment?.status?.toLowerCase();
        return status !== 'delivered' &&
            status !== 'cancelled' &&
            status !== 'canceled' &&
            status !== 'void' &&
            status !== 'voided';
    };

    // Get warning message based on shipment status
    const getCancellationWarning = () => {
        const status = shipment?.status?.toLowerCase();

        if (status === 'in_transit' || status === 'in transit') {
            return {
                severity: 'warning',
                message: 'This shipment is currently in transit. Cancellation may not be possible or may incur additional fees.'
            };
        }

        if (status === 'out_for_delivery') {
            return {
                severity: 'error',
                message: 'This shipment is out for delivery. Cancellation is likely not possible at this stage.'
            };
        }

        if (!carrierSupport.supported && notifyCarrier) {
            return {
                severity: 'info',
                message: 'Automatic carrier notification is not available for this carrier. Manual notification will be required.'
            };
        }

        return null;
    };

    const warning = getCancellationWarning();

    // Handle cancellation
    const handleCancelShipment = async () => {
        if (!canCancelShipment()) {
            showNotification('This shipment cannot be cancelled', 'error');
            return;
        }

        const finalReason = selectedReasonType === 'other'
            ? cancellationReason
            : `${cancellationReasons[selectedReasonType]}${cancellationReason ? `: ${cancellationReason}` : ''}`;

        if (!finalReason.trim()) {
            showNotification('Please provide a cancellation reason', 'error');
            return;
        }

        try {
            setLoading(true);
            showNotification('Cancelling shipment...', 'info');

            const cancelShipmentFunction = httpsCallable(functions, 'cancelShipment');
            const result = await cancelShipmentFunction({
                shipmentId: shipment.shipmentID || shipment.id,
                firebaseDocId: shipment.id,
                reason: finalReason,
                notifyCarrier: notifyCarrier,
                notifyShipper: notifyShipper
            });

            if (result.data && result.data.success) {
                const data = result.data.data;

                // Show appropriate success message
                let successMessage = 'Shipment cancelled successfully!';
                if (data.carrierCancellation?.success) {
                    successMessage += ' Carrier has been notified.';
                } else if (notifyCarrier && !data.carrierCancellation?.success) {
                    successMessage += ' Manual carrier notification required.';
                }

                showNotification(successMessage, 'success');

                // Notify parent component
                if (onShipmentCancelled) {
                    onShipmentCancelled(data);
                }

                // Close modal
                onClose();
            } else {
                throw new Error(result.data?.error || 'Failed to cancel shipment');
            }

        } catch (error) {
            console.error('Error cancelling shipment:', error);
            showNotification(`Failed to cancel shipment: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Handle close
    const handleClose = () => {
        if (!loading) {
            onClose();
        }
    };

    if (!canCancelShipment()) {
        return (
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="error" />
                    Cannot Cancel Shipment
                    <IconButton onClick={handleClose} sx={{ ml: 'auto' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        This shipment cannot be cancelled because it is {shipment?.status?.toLowerCase() || 'in an invalid state'}.
                    </Alert>
                    <Typography variant="body2" color="text.secondary">
                        Shipments that have been delivered, cancelled, or voided cannot be cancelled again.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Close</Button>
                </DialogActions>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: '1px solid #e5e7eb',
                pb: 2
            }}>
                <CancelIcon color="error" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Cancel Shipment: {shipment?.shipmentID}
                </Typography>
                <IconButton onClick={handleClose} sx={{ ml: 'auto' }} disabled={loading}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {loading && <LinearProgress />}

            <DialogContent sx={{ pt: 3 }}>
                {/* Warning message */}
                {warning && (
                    <Alert severity={warning.severity} sx={{ mb: 3 }}>
                        {warning.message}
                    </Alert>
                )}

                {/* Cancellation reason selection */}
                <Box sx={{ mb: 3 }}>
                    <FormControl component="fieldset" fullWidth>
                        <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                            Reason for Cancellation *
                        </FormLabel>
                        <RadioGroup
                            value={selectedReasonType}
                            onChange={(e) => setSelectedReasonType(e.target.value)}
                        >
                            {Object.entries(cancellationReasons).map(([key, label]) => (
                                <FormControlLabel
                                    key={key}
                                    value={key}
                                    control={<Radio size="small" />}
                                    label={label}
                                    sx={{
                                        '& .MuiFormControlLabel-label': {
                                            fontSize: '14px'
                                        }
                                    }}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                </Box>

                {/* Additional details */}
                <Box sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        label={selectedReasonType === 'other' ? "Cancellation Reason *" : "Additional Details (Optional)"}
                        multiline
                        rows={3}
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        placeholder={selectedReasonType === 'other'
                            ? "Please specify the reason for cancellation..."
                            : "Any additional details about the cancellation..."
                        }
                        required={selectedReasonType === 'other'}
                        variant="outlined"
                    />
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Cancellation options */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Cancellation Options
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ml: 1 }}>
                    {/* Carrier notification */}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={notifyCarrier}
                                onChange={(e) => setNotifyCarrier(e.target.checked)}
                                disabled={loading}
                            />
                        }
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <NotificationIcon fontSize="small" color={notifyCarrier ? "primary" : "disabled"} />
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        Notify Carrier
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {carrierSupport.supported
                                            ? `Automatically notify ${carrierSupport.carrier} via API`
                                            : 'Manual carrier notification will be required'
                                        }
                                    </Typography>
                                </Box>
                            </Box>
                        }
                    />

                    {/* Notify Shipper */}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={notifyShipper}
                                onChange={(e) => setNotifyShipper(e.target.checked)}
                                disabled={loading}
                            />
                        }
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <NotificationIcon fontSize="small" color={notifyShipper ? "primary" : "disabled"} />
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        Notify Shipper (Sender)
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Notify the sender of the shipment
                                    </Typography>
                                </Box>
                            </Box>
                        }
                    />
                </Box>

                {/* Shipment summary */}
                <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Shipment Summary:
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        <strong>From:</strong> {shipment?.shipFrom?.companyName || shipment?.shipFrom?.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        <strong>To:</strong> {shipment?.shipTo?.companyName || shipment?.shipTo?.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        <strong>Carrier:</strong> {shipment?.selectedCarrier || shipment?.carrier || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        <strong>Status:</strong> {shipment?.status || 'N/A'}
                    </Typography>
                    {shipment?.selectedRate?.totalCost && (
                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                            <strong>Cost:</strong> ${shipment.selectedRate.totalCost} {shipment.selectedRate.currency || 'CAD'}
                        </Typography>
                    )}
                </Box>
            </DialogContent>

            <Divider />

            <DialogActions sx={{ p: 3, gap: 1 }}>
                <Button
                    onClick={handleClose}
                    disabled={loading}
                    variant="outlined"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleCancelShipment}
                    disabled={loading || (selectedReasonType === 'other' && !cancellationReason.trim())}
                    variant="contained"
                    color="error"
                    startIcon={<CancelIcon />}
                >
                    {loading ? 'Cancelling...' : 'Cancel Shipment'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CancelShipmentModal; 