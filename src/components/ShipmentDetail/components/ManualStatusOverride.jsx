import React, { useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Alert,
    Chip,
    CircularProgress,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Edit as EditIcon,
    Warning as WarningIcon,
    Check as CheckIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { SHIPMENT_STATUSES, STATUS_DISPLAY_NAMES, getStatusColor } from '../../../utils/universalDataModel';

// Main statuses available for manual override (excluding system statuses)
const MANUAL_OVERRIDE_STATUSES = [
    SHIPMENT_STATUSES.PENDING,
    SHIPMENT_STATUSES.BOOKED,
    SHIPMENT_STATUSES.SCHEDULED,
    SHIPMENT_STATUSES.AWAITING_SHIPMENT,
    SHIPMENT_STATUSES.IN_TRANSIT,
    SHIPMENT_STATUSES.DELIVERED,
    SHIPMENT_STATUSES.ON_HOLD,
    SHIPMENT_STATUSES.CANCELED,
    SHIPMENT_STATUSES.VOID
];

const ManualStatusOverride = ({
    shipment,
    onStatusUpdated,
    onShowSnackbar,
    disabled = false
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const currentStatus = shipment?.status;
    const isManuallyOverridden = shipment?.statusOverride?.isManual;

    const handleEditClick = () => {
        setSelectedStatus(currentStatus || '');
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setSelectedStatus('');
    };

    const handleStatusChange = (event) => {
        setSelectedStatus(event.target.value);
    };

    const handleConfirm = () => {
        if (selectedStatus && selectedStatus !== currentStatus) {
            setConfirmDialogOpen(true);
        } else {
            setIsEditing(false);
        }
    };

    const handleConfirmStatusOverride = async () => {
        if (!selectedStatus || !shipment?.id) {
            console.error('Missing required data for status override');
            return;
        }

        setLoading(true);

        try {
            const updateManualStatusFunction = httpsCallable(functions, 'updateManualShipmentStatus');

            const result = await updateManualStatusFunction({
                shipmentId: shipment.id,
                newStatus: selectedStatus,
                previousStatus: currentStatus,
                reason: 'Manual status override by user',
                userId: 'current_user', // Will be populated by the cloud function
                timestamp: new Date().toISOString()
            });

            if (result.data.success) {
                onShowSnackbar(`Status manually updated to ${STATUS_DISPLAY_NAMES[selectedStatus]}`, 'success');

                // Call the callback to refresh shipment data
                if (onStatusUpdated) {
                    onStatusUpdated(selectedStatus);
                }

                setIsEditing(false);
                setConfirmDialogOpen(false);
            } else {
                throw new Error(result.data.error || 'Failed to update status');
            }
        } catch (error) {
            console.error('Error updating manual status:', error);
            onShowSnackbar('Failed to update status: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const getStatusDisplayChip = (status) => {
        const colors = getStatusColor(status);
        return (
            <Chip
                label={STATUS_DISPLAY_NAMES[status] || status}
                size="small"
                sx={{
                    color: colors.color,
                    backgroundColor: colors.bgcolor,
                    fontWeight: 500,
                    fontSize: '11px',
                    height: '20px'
                }}
            />
        );
    };

    return (
        <Box>
            {/* Current Status Display */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!isEditing ? (
                    <>
                        {getStatusDisplayChip(currentStatus)}
                        {isManuallyOverridden && (
                            <Tooltip title="Status manually overridden">
                                <Chip
                                    icon={<EditIcon sx={{ fontSize: '12px !important' }} />}
                                    label="Manual"
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        height: '20px',
                                        fontSize: '10px',
                                        color: 'orange',
                                        borderColor: 'orange',
                                        '& .MuiChip-icon': {
                                            fontSize: '12px',
                                            color: 'orange'
                                        }
                                    }}
                                />
                            </Tooltip>
                        )}
                        <Tooltip title="Override status manually">
                            <IconButton
                                size="small"
                                onClick={handleEditClick}
                                disabled={disabled}
                                sx={{
                                    padding: '4px',
                                    '&:hover': { bgcolor: 'action.hover' }
                                }}
                            >
                                <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>
                    </>
                ) : (
                    <>
                        {/* Status Selection Dropdown */}
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <Select
                                value={selectedStatus}
                                onChange={handleStatusChange}
                                sx={{ fontSize: '12px' }}
                                displayEmpty
                            >
                                {MANUAL_OVERRIDE_STATUSES.map((status) => (
                                    <MenuItem key={status} value={status} sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {getStatusDisplayChip(status)}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Action Buttons */}
                        <IconButton
                            size="small"
                            onClick={handleConfirm}
                            disabled={!selectedStatus || selectedStatus === currentStatus}
                            sx={{ color: 'success.main' }}
                        >
                            <CheckIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={handleCancelEdit}
                            sx={{ color: 'error.main' }}
                        >
                            <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </>
                )}
            </Box>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialogOpen}
                onClose={() => setConfirmDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="warning" />
                    <Typography variant="h6">Confirm Status Override</Typography>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            Important: Manual Status Override
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            You are about to manually override the shipment status. This action will:
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, mb: 1 }}>
                            <li>Change the status from <strong>{STATUS_DISPLAY_NAMES[currentStatus]}</strong> to <strong>{STATUS_DISPLAY_NAMES[selectedStatus]}</strong></li>
                            <li>Prevent automatic status updates from the carrier</li>
                            <li>Mark this shipment as manually managed</li>
                            <li>Create an audit trail entry</li>
                        </Box>
                        <Typography variant="body2">
                            Once manually overridden, only manual updates will change this shipment's status.
                        </Typography>
                    </Alert>

                    {/* Status Change Summary */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Current</Typography>
                            {getStatusDisplayChip(currentStatus)}
                        </Box>
                        <Typography variant="h6" color="text.secondary">→</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">New</Typography>
                            {getStatusDisplayChip(selectedStatus)}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setConfirmDialogOpen(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmStatusOverride}
                        disabled={loading}
                        variant="contained"
                        color="warning"
                        startIcon={loading ? <CircularProgress size={16} /> : null}
                    >
                        {loading ? 'Updating...' : 'Override Status'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ManualStatusOverride; 