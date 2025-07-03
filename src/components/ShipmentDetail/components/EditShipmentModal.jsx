import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Alert,
    IconButton,
    Divider,
    Chip,
    LinearProgress
} from '@mui/material';
import {
    Close as CloseIcon,
    Edit as EditIcon,
    Warning as WarningIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';

// Import the MODERN form components and provider
import { ShipmentFormProvider } from '../../../contexts/ShipmentFormContext';
import CreateShipmentX from '../../CreateShipment/CreateShipmentX';
import QuickShip from '../../CreateShipment/QuickShip';

const EditShipmentModal = ({
    open,
    onClose,
    shipment,
    onShipmentUpdated,
    showNotification
}) => {
    const [loading, setLoading] = useState(false);
    const [formMode, setFormMode] = useState(null); // 'quickship' or 'advanced'

    // Determine which form to use based on shipment creation method
    useEffect(() => {
        if (shipment && open) {
            const creationMethod = shipment.creationMethod;

            if (creationMethod === 'quickship') {
                setFormMode('quickship');
            } else {
                // Default to advanced for all other shipments (including legacy)
                setFormMode('advanced');
            }
        }
    }, [shipment, open]);

    // Handle successful shipment update
    const handleShipmentUpdated = useCallback((updatedShipment) => {
        showNotification('Shipment updated successfully!', 'success');

        if (onShipmentUpdated) {
            onShipmentUpdated(updatedShipment);
        }

        onClose();
    }, [onShipmentUpdated, onClose, showNotification]);

    // Handle close
    const handleClose = useCallback(() => {
        setFormMode(null);
        onClose();
    }, [onClose]);

    if (!formMode) {
        return null; // Don't render until we know which form to use
    }

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth={false}
            fullWidth
            PaperProps={{
                sx: {
                    width: '95vw',
                    height: '95vh',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    m: 2
                }
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e0e0e0',
                    p: 2
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EditIcon />
                    <Typography variant="h6">
                        Edit {formMode === 'quickship' ? 'Quick Ship' : 'Advanced'} Shipment
                    </Typography>
                    <Chip
                        label={shipment?.shipmentID || 'N/A'}
                        variant="outlined"
                        size="small"
                    />
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
                {/* Warning about editing booked shipments */}
                <Alert
                    severity="warning"
                    icon={<WarningIcon />}
                    sx={{ m: 2, mb: 0 }}
                >
                    <Typography variant="body2">
                        <strong>Editing Booked Shipment:</strong> Changes to addresses, packages, or weights may require
                        document regeneration and carrier notification. Significant changes might require cancellation
                        and rebooking.
                    </Typography>
                </Alert>

                {/* Render the appropriate form */}
                <Box sx={{ height: 'calc(100% - 80px)', overflow: 'auto' }}>
                    {formMode === 'quickship' ? (
                        <ShipmentFormProvider>
                            <QuickShip
                                isModal={true}
                                onClose={onClose}
                                showCloseButton={false}
                                editMode={true}
                                editShipment={shipment}
                                onShipmentUpdated={onShipmentUpdated}
                                showNotification={showNotification}
                            />
                        </ShipmentFormProvider>
                    ) : (
                        <CreateShipmentX
                            isModal={true}
                            onClose={handleClose}
                            draftId={shipment?.id} // Pass the shipment ID as draft ID for editing
                            onShipmentCreated={handleShipmentUpdated}
                            editMode={true}
                            editShipment={shipment}
                        />
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default EditShipmentModal; 