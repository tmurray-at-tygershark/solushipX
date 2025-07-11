import React, { useState, useEffect } from 'react';
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
    Tooltip,
    Autocomplete,
    TextField,
    ListItemText,
    ListItemIcon
} from '@mui/material';
import {
    Edit as EditIcon,
    Warning as WarningIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Category as CategoryIcon,
    List as ListIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import dynamicStatusService from '../../../services/DynamicStatusService';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';

const ManualStatusOverride = ({
    shipment,
    onStatusUpdated,
    onShowSnackbar,
    disabled = false
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusesLoading, setStatusesLoading] = useState(true);
    const [availableStatuses, setAvailableStatuses] = useState([]);
    const [masterStatuses, setMasterStatuses] = useState([]);
    const [error, setError] = useState(null);

    const currentStatus = shipment?.status;
    const isManuallyOverridden = shipment?.statusOverride?.isManual;

    // Initialize dynamic status service and load available statuses
    useEffect(() => {
        const loadStatuses = async () => {
            try {
                setStatusesLoading(true);
                setError(null);

                // Initialize the dynamic status service
                await dynamicStatusService.initialize();

                // Get all available statuses for manual override
                const masterStatuses = dynamicStatusService.getMasterStatuses();
                const shipmentStatuses = dynamicStatusService.getShipmentStatuses();

                setMasterStatuses(masterStatuses);
                setAvailableStatuses(shipmentStatuses);

                console.log('📊 Manual Status Override loaded:', {
                    masterStatuses: masterStatuses.length,
                    shipmentStatuses: shipmentStatuses.length
                });

            } catch (err) {
                console.error('Error loading statuses for manual override:', err);
                setError(err.message);
                onShowSnackbar('Failed to load available statuses', 'error');
            } finally {
                setStatusesLoading(false);
            }
        };

        loadStatuses();
    }, [onShowSnackbar]);

    // Get current status display
    const getCurrentStatusDisplay = () => {
        if (statusesLoading) return null;
        return dynamicStatusService.getStatusDisplay(currentStatus);
    };

    // Group statuses by master status for better UX
    const getGroupedStatuses = () => {
        const grouped = {};

        availableStatuses.forEach(status => {
            const masterStatus = masterStatuses.find(ms => ms.id === status.masterStatus);
            if (masterStatus) {
                if (!grouped[masterStatus.id]) {
                    grouped[masterStatus.id] = {
                        masterStatus,
                        statuses: []
                    };
                }
                grouped[masterStatus.id].statuses.push(status);
            }
        });

        return Object.values(grouped).sort((a, b) => a.masterStatus.sortOrder - b.masterStatus.sortOrder);
    };

    const handleEditClick = () => {
        setSelectedStatus(null);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setSelectedStatus(null);
    };

    const handleStatusChange = (event, newValue) => {
        setSelectedStatus(newValue);
    };

    const handleConfirm = () => {
        if (selectedStatus && selectedStatus.id !== currentStatus) {
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
                newStatus: selectedStatus.statusLabel, // Use the status label
                newStatusCode: selectedStatus.statusCode, // Include status code
                previousStatus: currentStatus,
                reason: 'Manual status override by user',
                userId: 'current_user', // Will be populated by the cloud function
                timestamp: new Date().toISOString()
            });

            if (result.data.success) {
                onShowSnackbar(`Status manually updated to ${selectedStatus.statusLabel}`, 'success');

                // Call the callback to refresh shipment data
                if (onStatusUpdated) {
                    onStatusUpdated(selectedStatus.statusLabel);
                }

                setIsEditing(false);
                setConfirmDialogOpen(false);
                setSelectedStatus(null);
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

    // Loading state
    if (statusesLoading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                    Loading statuses...
                </Typography>
            </Box>
        );
    }

    // Error state
    if (error) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="error" sx={{ fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontSize: '12px', color: 'error.main' }}>
                    Error loading statuses
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Current Status Display */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!isEditing ? (
                    <>
                        <EnhancedStatusChip
                            status={currentStatus}
                            size="small"
                            displayMode="master"
                            showTooltip={true}
                        />
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
                        <Autocomplete
                            value={selectedStatus}
                            onChange={handleStatusChange}
                            options={availableStatuses}
                            getOptionLabel={(option) => option.statusLabel}
                            groupBy={(option) => {
                                const masterStatus = masterStatuses.find(ms => ms.id === option.masterStatus);
                                return masterStatus ? masterStatus.displayLabel : 'Other';
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    size="small"
                                    sx={{ minWidth: 200 }}
                                    placeholder="Select status..."
                                />
                            )}
                            renderOption={(props, option) => {
                                const masterStatus = masterStatuses.find(ms => ms.id === option.masterStatus);
                                return (
                                    <Box component="li" {...props}>
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            <ListIcon sx={{ fontSize: 16, color: masterStatus?.color || '#6b7280' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={option.statusLabel}
                                            secondary={option.statusMeaning}
                                            primaryTypographyProps={{ fontSize: '12px' }}
                                            secondaryTypographyProps={{ fontSize: '11px' }}
                                        />
                                    </Box>
                                );
                            }}
                            renderGroup={(params) => {
                                const masterStatus = masterStatuses.find(ms => ms.displayLabel === params.group);
                                return (
                                    <Box key={params.key}>
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            p: 1,
                                            backgroundColor: masterStatus?.color + '10' || '#f5f5f5',
                                            borderBottom: `2px solid ${masterStatus?.color || '#e0e0e0'}`
                                        }}>
                                            <CategoryIcon sx={{ fontSize: 14, color: masterStatus?.color || '#6b7280' }} />
                                            <Typography variant="subtitle2" sx={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: masterStatus?.color || '#6b7280'
                                            }}>
                                                {params.group}
                                            </Typography>
                                        </Box>
                                        {params.children}
                                    </Box>
                                );
                            }}
                        />

                        {/* Action Buttons */}
                        <IconButton
                            size="small"
                            onClick={handleConfirm}
                            disabled={!selectedStatus}
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
                            <li>Change the status to <strong>{selectedStatus?.statusLabel}</strong></li>
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
                            <EnhancedStatusChip
                                status={currentStatus}
                                size="small"
                                displayMode="master"
                            />
                        </Box>
                        <Typography variant="h6" color="text.secondary">→</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">New</Typography>
                            {selectedStatus && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                    {/* Show master status */}
                                    {(() => {
                                        const masterStatus = masterStatuses.find(ms => ms.id === selectedStatus.masterStatus);
                                        return masterStatus ? (
                                            <Chip
                                                label={masterStatus.displayLabel}
                                                size="small"
                                                sx={{
                                                    backgroundColor: masterStatus.color,
                                                    color: masterStatus.fontColor,
                                                    fontSize: '11px',
                                                    fontWeight: 600
                                                }}
                                            />
                                        ) : null;
                                    })()}
                                    {/* Show sub-status */}
                                    <Typography sx={{
                                        fontSize: '10px',
                                        color: '#6b7280',
                                        textAlign: 'center'
                                    }}>
                                        {selectedStatus.statusLabel}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>

                    {/* Status meaning */}
                    {selectedStatus && (
                        <Box sx={{ mt: 2, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, mb: 0.5 }}>
                                What this means:
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                {selectedStatus.statusMeaning}
                            </Typography>
                        </Box>
                    )}
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