import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    Warning as WarningIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';

const DeleteConfirmationDialog = ({ open, type, name, onConfirm, onClose }) => {
    const [deleting, setDeleting] = React.useState(false);

    const handleConfirm = async () => {
        setDeleting(true);
        try {
            await onConfirm();
        } catch (error) {
            console.error('Error deleting:', error);
        } finally {
            setDeleting(false);
        }
    };

    const getTitle = () => {
        if (type === 'master') {
            return 'Delete Master Status';
        } else {
            return 'Delete Shipment Status';
        }
    };

    const getWarningMessage = () => {
        if (type === 'master') {
            return 'Deleting a master status will prevent it from being used for new shipment statuses. This action cannot be undone.';
        } else {
            return 'Deleting a shipment status will prevent it from being used for new shipments. This action cannot be undone.';
        }
    };

    const getConsequences = () => {
        if (type === 'master') {
            return [
                'All shipment statuses using this master status will become orphaned',
                'Reports and analytics may be affected',
                'Status filtering in the system may be impacted'
            ];
        } else {
            return [
                'This status will no longer be available for manual status overrides',
                'Existing shipments with this status will retain it but cannot be set to this status again',
                'Status filtering may be affected'
            ];
        }
    };

    return (
        <Dialog
            open={open}
            onClose={deleting ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: '1px solid #e5e7eb',
                fontSize: '16px',
                fontWeight: 600,
                color: '#dc2626'
            }}>
                <WarningIcon sx={{ fontSize: 20, color: '#dc2626' }} />
                {getTitle()}
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                        Are you sure you want to delete "{name}"?
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        {getWarningMessage()}
                    </Typography>
                </Box>

                <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                        This action will have the following consequences:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2, fontSize: '11px' }}>
                        {getConsequences().map((consequence, index) => (
                            <Box component="li" key={index} sx={{ mb: 0.5 }}>
                                {consequence}
                            </Box>
                        ))}
                    </Box>
                </Alert>

                <Alert severity="error">
                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                        ⚠️ This action cannot be undone!
                    </Typography>
                    <Typography sx={{ fontSize: '11px', mt: 0.5 }}>
                        Consider disabling the {type === 'master' ? 'master status' : 'shipment status'} instead of deleting it to preserve data integrity.
                    </Typography>
                </Alert>
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb', gap: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={deleting}
                    size="small"
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="error"
                    disabled={deleting}
                    size="small"
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                    startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                >
                    {deleting ? 'Deleting...' : 'Delete Permanently'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteConfirmationDialog; 