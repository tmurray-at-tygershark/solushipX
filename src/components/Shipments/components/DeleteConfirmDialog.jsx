import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Box,
    Button
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

const DeleteConfirmDialog = ({ open, onClose, shipmentToDelete, onConfirm }) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                Delete Draft Shipment
            </DialogTitle>
            <DialogContent>
                <Typography variant="body1" sx={{ mb: 2 }}>
                    Are you sure you want to delete this draft shipment? This action cannot be undone.
                </Typography>
                {shipmentToDelete && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffcc02' }}>
                        <Typography variant="subtitle2">
                            Shipment: {shipmentToDelete.shipmentID || shipmentToDelete.id}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {shipmentToDelete.shipTo?.company || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            Status: {shipmentToDelete.status}
                        </Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    variant="outlined"
                >
                    Cancel
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon />}
                >
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteConfirmDialog; 