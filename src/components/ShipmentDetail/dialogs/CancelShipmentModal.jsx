import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

const CancelShipmentModal = ({
    open = false,
    onClose = () => { },
    onConfirm = () => { },
    shipment = null,
    loading = false
}) => {
    const [reason, setReason] = useState('');

    const handleConfirm = () => {
        onConfirm(reason);
        setReason('');
    };

    const handleClose = () => {
        setReason('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <WarningIcon color="warning" />
                Cancel Shipment
            </DialogTitle>

            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                    <Alert severity="warning">
                        <Typography variant="body2">
                            <strong>Warning:</strong> This action cannot be undone. Canceling this shipment will:
                        </Typography>
                        <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                            <li>Mark the shipment as cancelled</li>
                            <li>Potentially void any tracking numbers</li>
                            <li>May incur cancellation fees from the carrier</li>
                        </Box>
                    </Alert>

                    {shipment && (
                        <Box sx={{
                            p: 2,
                            bgcolor: 'grey.50',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'grey.200'
                        }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Shipment Details:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                <strong>Shipment ID:</strong> {shipment.id}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                <strong>Status:</strong> {shipment.status}
                            </Typography>
                            {shipment.trackingNumber && (
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Tracking:</strong> {shipment.trackingNumber}
                                </Typography>
                            )}
                            {shipment.carrierName && (
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Carrier:</strong> {shipment.carrierName}
                                </Typography>
                            )}
                        </Box>
                    )}

                    <TextField
                        label="Cancellation Reason"
                        placeholder="Please provide a reason for cancelling this shipment..."
                        multiline
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        fullWidth
                        required
                        helperText="A reason is required to cancel the shipment"
                    />
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Keep Shipment
                </Button>
                <Button
                    onClick={handleConfirm}
                    color="error"
                    variant="contained"
                    disabled={!reason.trim() || loading}
                >
                    {loading ? 'Cancelling...' : 'Cancel Shipment'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CancelShipmentModal; 