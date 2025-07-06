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
    FormControl,
    InputLabel,
    Select,
    MenuItem
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
import { useAuth } from '../../../contexts/AuthContext';

const CancelShipmentModal = ({
    open,
    onClose,
    shipment,
    onShipmentCancelled,
    showNotification
}) => {
    const { currentUser } = useAuth();

    // Form state
    const [cancellationReason, setCancellationReason] = useState('');
    const [selectedReasonType, setSelectedReasonType] = useState('customer_request');
    const [notifyCarrier, setNotifyCarrier] = useState(true);
    const [notifyShipper, setNotifyShipper] = useState(true);
    const [loading, setLoading] = useState(false);
    const [chargesToCancel, setChargesToCancel] = useState([]);

    // Check if user is admin or super admin
    const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

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

    // Get available charges for selection
    const getAvailableCharges = () => {
        const charges = [];

        // Add manual rates
        if (shipment?.manualRates && shipment.manualRates.length > 0) {
            shipment.manualRates.forEach((rate, index) => {
                const charge = parseFloat(rate.charge) || 0;
                const cost = parseFloat(rate.cost) || 0;

                if (charge > 0 || cost > 0) {
                    charges.push({
                        id: rate.id || `manual_${index}`,
                        name: rate.chargeName || rate.name || `Charge ${index + 1}`,
                        charge: charge,
                        cost: cost,
                        currency: rate.currency || shipment.currency || 'CAD',
                        type: 'manual'
                    });
                }
            });
        }

        // Add carrier confirmation rates if no manual rates
        if (charges.length === 0 && shipment?.carrierConfirmationRates && shipment.carrierConfirmationRates.length > 0) {
            shipment.carrierConfirmationRates.forEach((rate, index) => {
                const charge = parseFloat(rate.charge) || 0;
                const cost = parseFloat(rate.cost) || 0;

                if (charge > 0 || cost > 0) {
                    charges.push({
                        id: rate.id || `carrier_${index}`,
                        name: rate.chargeName || rate.name || `Charge ${index + 1}`,
                        charge: charge,
                        cost: cost,
                        currency: rate.currency || shipment.currency || 'CAD',
                        type: 'carrier'
                    });
                }
            });
        }

        return charges;
    };

    const availableCharges = getAvailableCharges();

    // Handle charge selection
    const handleChargeToggle = (chargeId) => {
        setChargesToCancel(prev => {
            if (prev.includes(chargeId)) {
                return prev.filter(id => id !== chargeId);
            } else {
                return [...prev, chargeId];
            }
        });
    };

    // No smart defaults - preserve all charges by default

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
                notifyShipper: notifyShipper,
                chargesToCancel: chargesToCancel.length > 0 ? chargesToCancel : null
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
                    <FormControl fullWidth required>
                        <InputLabel id="cancellation-reason-label">Reason for Cancellation</InputLabel>
                        <Select
                            labelId="cancellation-reason-label"
                            value={selectedReasonType}
                            onChange={(e) => setSelectedReasonType(e.target.value)}
                            label="Reason for Cancellation"
                            size="medium"
                        >
                            {Object.entries(cancellationReasons).map(([key, label]) => (
                                <MenuItem key={key} value={key}>
                                    {label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Additional details - only show for "other" or as optional for non-other */}
                {selectedReasonType === 'other' ? (
                    <Box sx={{ mb: 3 }}>
                        <TextField
                            fullWidth
                            label="Cancellation Reason *"
                            multiline
                            rows={3}
                            value={cancellationReason}
                            onChange={(e) => setCancellationReason(e.target.value)}
                            placeholder="Please specify the reason for cancellation..."
                            required
                            variant="outlined"
                        />
                    </Box>
                ) : (
                    <Box sx={{ mb: 3 }}>
                        <TextField
                            fullWidth
                            label="Additional Details (Optional)"
                            multiline
                            rows={3}
                            value={cancellationReason}
                            onChange={(e) => setCancellationReason(e.target.value)}
                            placeholder="Any additional details about the cancellation..."
                            variant="outlined"
                        />
                    </Box>
                )}

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

                {/* Charge Selection - Only for Admin/Super Admin */}
                {availableCharges.length > 0 && isAdminUser && (
                    <>
                        <Divider sx={{ my: 3 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            <RefundIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Charge Cancellation
                        </Typography>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <strong>Admin Control:</strong> By default, all charges are preserved when cancelling shipments.
                            As an admin, you can select specific charges to cancel if needed.
                        </Alert>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 1 }}>
                            {availableCharges.map((charge) => {
                                const isSelected = chargesToCancel.includes(charge.id);

                                return (
                                    <FormControlLabel
                                        key={charge.id}
                                        control={
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={() => handleChargeToggle(charge.id)}
                                                disabled={loading}
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                        {charge.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {isSelected ? 'Will be cancelled' : 'Will be preserved (default)'}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="body2" sx={{
                                                    fontWeight: 600,
                                                    color: isSelected ? 'error.main' : 'success.main'
                                                }}>
                                                    ${charge.charge.toFixed(2)} {charge.currency}
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{
                                            alignItems: 'flex-start',
                                            '& .MuiFormControlLabel-label': { width: '100%' }
                                        }}
                                    />
                                );
                            })}
                        </Box>

                        {/* Charge summary */}
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                Cancellation Summary:
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    <strong>Charges to Cancel:</strong>
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: 'error.main', fontWeight: 600 }}>
                                    ${availableCharges
                                        .filter(charge => chargesToCancel.includes(charge.id))
                                        .reduce((sum, charge) => sum + charge.charge, 0)
                                        .toFixed(2)} {availableCharges[0]?.currency || 'CAD'}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    <strong>Charges to Preserve:</strong>
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: 'success.main', fontWeight: 600 }}>
                                    ${availableCharges
                                        .filter(charge => !chargesToCancel.includes(charge.id))
                                        .reduce((sum, charge) => sum + charge.charge, 0)
                                        .toFixed(2)} {availableCharges[0]?.currency || 'CAD'}
                                </Typography>
                            </Box>
                        </Box>
                    </>
                )}


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