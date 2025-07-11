import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
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
<<<<<<< HEAD
    Card,
    CardContent,
    Grid,
    Divider,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    ButtonGroup
=======
    Autocomplete,
    TextField,
    ListItemText,
    ListItemIcon
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
} from '@mui/material';
import {
    Edit as EditIcon,
    Warning as WarningIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Category as CategoryIcon,
<<<<<<< HEAD
    List as ListIcon,
    ArrowForward as ArrowForwardIcon,
    ArrowBack as ArrowBackIcon,
    Done as DoneIcon
=======
    List as ListIcon
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
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
<<<<<<< HEAD
    const [selectedMasterStatus, setSelectedMasterStatus] = useState(null);
    const [selectedSubStatus, setSelectedSubStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusesLoading, setStatusesLoading] = useState(true);
    const [masterStatuses, setMasterStatuses] = useState([]);
    const [subStatuses, setSubStatuses] = useState([]);
    const [step, setStep] = useState(0); // 0 = master status, 1 = sub status (optional)
=======
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusesLoading, setStatusesLoading] = useState(true);
    const [availableStatuses, setAvailableStatuses] = useState([]);
    const [masterStatuses, setMasterStatuses] = useState([]);
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
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

<<<<<<< HEAD
                // Get all available statuses
                const allMasterStatuses = dynamicStatusService.getMasterStatuses();
                const allSubStatuses = dynamicStatusService.getShipmentStatuses();

                setMasterStatuses(allMasterStatuses);
                setSubStatuses(allSubStatuses);

                console.log('📊 Enhanced Manual Status Override loaded:', {
                    masterStatuses: allMasterStatuses.length,
                    subStatuses: allSubStatuses.length
=======
                // Get all available statuses for manual override
                const masterStatuses = dynamicStatusService.getMasterStatuses();
                const shipmentStatuses = dynamicStatusService.getShipmentStatuses();

                setMasterStatuses(masterStatuses);
                setAvailableStatuses(shipmentStatuses);

                console.log('📊 Manual Status Override loaded:', {
                    masterStatuses: masterStatuses.length,
                    shipmentStatuses: shipmentStatuses.length
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
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

<<<<<<< HEAD
    // Get sub-statuses for selected master status
    const getSubStatusesForMaster = () => {
        if (!selectedMasterStatus) return [];
        return subStatuses.filter(status => status.masterStatus === selectedMasterStatus.id);
    };

    const handleEditClick = () => {
        setSelectedMasterStatus(null);
        setSelectedSubStatus(null);
        setStep(0);
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
<<<<<<< HEAD
        setSelectedMasterStatus(null);
        setSelectedSubStatus(null);
        setStep(0);
    };

    const handleMasterStatusSelect = (masterStatus) => {
        setSelectedMasterStatus(masterStatus);
        setSelectedSubStatus(null);

        // If there are sub-statuses available, go to step 1, otherwise finish
        const availableSubStatuses = subStatuses.filter(status => status.masterStatus === masterStatus.id);
        if (availableSubStatuses.length > 0) {
            setStep(1);
        } else {
            // No sub-statuses available, use master status only
            handleConfirm();
        }
    };

    const handleSubStatusSelect = (subStatus) => {
        setSelectedSubStatus(subStatus);
        handleConfirm();
    };

    const handleSkipSubStatus = () => {
        // Use master status only
        setSelectedSubStatus(null);
        handleConfirm();
    };

    const handleBackToMasterStatus = () => {
        setSelectedSubStatus(null);
        setStep(0);
    };

    const handleConfirm = () => {
        // Use sub-status if selected, otherwise use master status
        const finalStatus = selectedSubStatus || selectedMasterStatus;

        if (finalStatus) {
            // Always show confirmation dialog when a status is selected
            // This ensures all changes (including sub-status changes within same master) are processed
            console.log('Status selection confirmed:', {
                currentStatus,
                selectedMasterStatus: selectedMasterStatus?.label,
                selectedSubStatus: selectedSubStatus?.statusLabel,
                finalStatus: finalStatus
            });

=======
        setSelectedStatus(null);
    };

    const handleStatusChange = (event, newValue) => {
        setSelectedStatus(newValue);
    };

    const handleConfirm = () => {
        if (selectedStatus && selectedStatus.id !== currentStatus) {
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
            setConfirmDialogOpen(true);
        } else {
            setIsEditing(false);
        }
    };

    const handleConfirmStatusOverride = async () => {
        const finalStatus = selectedSubStatus || selectedMasterStatus;

        if (!finalStatus || !shipment?.id) {
            console.error('Missing required data for status override');
            return;
        }

        setLoading(true);

        try {
            const updateManualStatusFunction = httpsCallable(functions, 'updateManualShipmentStatus');

            // Map dynamic status labels to legacy backend status codes
            const statusToLegacyMap = {
                'pending': 'pending',
                'booked': 'booked',
                'quoted': 'booked',        // Map "Quoted" to "booked"
                'scheduled': 'scheduled',
                'in_transit': 'in_transit',
                'delivered': 'delivered',
                'completed': 'delivered',   // Map "Completed" to "delivered"
                'exception': 'on_hold',     // Map "Exception" to "on_hold"
                'on_hold': 'on_hold',
                'cancelled': 'canceled',    // Note: backend uses "canceled" not "cancelled"
                'canceled': 'canceled'
            };

            // Get the master status label and map it to legacy status
            const masterStatusLabel = selectedMasterStatus.label.toLowerCase();
            const legacyStatusCode = statusToLegacyMap[masterStatusLabel] || 'booked'; // Default fallback

            // Create enhanced status information for the database
            const enhancedStatusInfo = {
                masterStatus: {
                    id: selectedMasterStatus.id,
                    label: selectedMasterStatus.label,
                    displayLabel: selectedMasterStatus.displayLabel,
                    color: selectedMasterStatus.color,
                    fontColor: selectedMasterStatus.fontColor
                },
                subStatus: selectedSubStatus ? {
                    id: selectedSubStatus.id,
                    statusLabel: selectedSubStatus.statusLabel,
                    statusMeaning: selectedSubStatus.statusMeaning,
                    masterStatus: selectedSubStatus.masterStatus
                } : null,
                displayText: selectedSubStatus ? selectedSubStatus.statusLabel : selectedMasterStatus.displayLabel,
                legacyStatusCode: legacyStatusCode,
                timestamp: new Date().toISOString()
            };

            console.log('Enhanced status mapping:', {
                masterStatusLabel,
                legacyStatusCode,
                selectedMasterStatus,
                selectedSubStatus,
                enhancedStatusInfo
            });

            const result = await updateManualStatusFunction({
                shipmentId: shipment.id,
<<<<<<< HEAD
                newStatus: legacyStatusCode, // Send legacy-compatible status code
=======
                newStatus: selectedStatus.statusLabel, // Use the status label
                newStatusCode: selectedStatus.statusCode, // Include status code
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                previousStatus: currentStatus,
                reason: selectedSubStatus ?
                    `Manual status override: ${selectedMasterStatus.displayLabel} → ${selectedSubStatus.statusLabel}` :
                    `Manual status override: ${selectedMasterStatus.displayLabel}`,
                userId: 'current_user',
                timestamp: new Date().toISOString(),
                // Add enhanced status information to ensure database changes
                enhancedStatus: enhancedStatusInfo
            });

            if (result.data.success) {
<<<<<<< HEAD
                const statusLabel = selectedSubStatus ? selectedSubStatus.statusLabel : selectedMasterStatus.displayLabel;
                onShowSnackbar(`Status manually updated to ${statusLabel}`, 'success');

                // Call the callback to refresh shipment data
                if (onStatusUpdated) {
                    onStatusUpdated(legacyStatusCode); // Use the legacy status code for updates
=======
                onShowSnackbar(`Status manually updated to ${selectedStatus.statusLabel}`, 'success');

                // Call the callback to refresh shipment data
                if (onStatusUpdated) {
                    onStatusUpdated(selectedStatus.statusLabel);
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                }

                setIsEditing(false);
                setConfirmDialogOpen(false);
<<<<<<< HEAD
                setSelectedMasterStatus(null);
                setSelectedSubStatus(null);
                setStep(0);
=======
                setSelectedStatus(null);
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
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

<<<<<<< HEAD
    // Get enhanced status from shipment's statusOverride if available
    const getEnhancedStatusFromShipment = () => {
        // Check if there's enhanced status information in statusOverride
        if (shipment?.statusOverride?.enhancedStatus) {
            return shipment.statusOverride.enhancedStatus;
        }

        // Fall back to the legacy status
        return currentStatus;
    };
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df

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
<<<<<<< HEAD
                <EnhancedStatusChip
                    status={getEnhancedStatusFromShipment()}
                    size="small"
                    displayMode="auto"
                    showTooltip={true}
                />
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
            </Box >

    {/* Enhanced Status Selection Dialog */ }
    < Dialog
open = { isEditing }
onClose = { handleCancelEdit }
maxWidth = "md"
fullWidth
PaperProps = {{
    sx: {
        borderRadius: 2,
            minHeight: '500px'
    }
}}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    borderBottom: '1px solid #e0e0e0',
                    pb: 2
                }}>
                    <CategoryIcon color="primary" />
                    <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600 }}>
                        Update Shipment Status
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Chip
                        label={step === 0 ? "Step 1: Master Status" : "Step 2: Detailed Status (Optional)"}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '11px' }}
                    />
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    {/* Step Indicator */}
                    <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: step === 0 ? 'primary.main' : 'success.main',
                            color: 'white'
                        }}>
                            {step === 0 ? (
                                <>
                                    <CategoryIcon sx={{ fontSize: 16 }} />
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        1. Choose Master Status
                                    </Typography>
                                </>
                            ) : (
                                <>
                                    <DoneIcon sx={{ fontSize: 16 }} />
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        1. {selectedMasterStatus?.displayLabel}
                                    </Typography>
                                </>
                            )}
                        </Box>

                        <ArrowForwardIcon sx={{ color: 'text.secondary', fontSize: 20 }} />

                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: step === 1 ? 'primary.main' : 'grey.300',
                            color: step === 1 ? 'white' : 'text.secondary'
                        }}>
                            <ListIcon sx={{ fontSize: 16 }} />
                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                2. Choose Details (Optional)
                            </Typography>
                        </Box>
                    </Box>

                    {step === 0 ? (
                        /* Step 1: Master Status Selection */
                        <Box>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                Select the main status category:
                            </Typography>
                            <Grid container spacing={2}>
                                {masterStatuses
                                    .sort((a, b) => a.sortOrder - b.sortOrder)
                                    .map((masterStatus) => (
                                        <Grid item xs={12} sm={6} md={4} key={masterStatus.id}>
                                            <Card
                                                onClick={() => handleMasterStatusSelect(masterStatus)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    border: '2px solid transparent',
                                                    borderRadius: 2,
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        borderColor: masterStatus.color,
                                                        transform: 'translateY(-2px)',
                                                        boxShadow: `0 4px 12px ${masterStatus.color}20`
                                                    }
                                                }}
                                            >
                                                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                                    <Chip
                                                        label={masterStatus.displayLabel}
                                                        sx={{
                                                            backgroundColor: masterStatus.color,
                                                            color: masterStatus.fontColor,
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            mb: 1,
                                                            minWidth: '100px'
                                                        }}
                                                    />
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontSize: '11px',
                                                            color: 'text.secondary',
                                                            lineHeight: 1.3
                                                        }}
                                                    >
                                                        {masterStatus.description}
                                                    </Typography>

                                                    {/* Show count of sub-statuses if available */}
                                                    {(() => {
                                                        const subCount = subStatuses.filter(s => s.masterStatus === masterStatus.id).length;
                                                        return subCount > 0 ? (
                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    fontSize: '10px',
                                                                    color: 'primary.main',
                                                                    mt: 0.5,
                                                                    display: 'block'
                                                                }}
                                                            >
                                                                +{subCount} detailed options
                                                            </Typography>
                                                        ) : (
                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    fontSize: '10px',
                                                                    color: 'text.disabled',
                                                                    mt: 0.5,
                                                                    display: 'block'
                                                                }}
                                                            >
                                                                Direct selection
                                                            </Typography>
                                                        );
                                                    })()}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                            </Grid>
                        </Box>
                    ) : (
                        /* Step 2: Sub-Status Selection */
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                <Button
                                    startIcon={<ArrowBackIcon />}
                                    onClick={handleBackToMasterStatus}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '11px' }}
                                >
                                    Back
                                </Button>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                        Selected:
                                    </Typography>
                                    <Chip
                                        label={selectedMasterStatus?.displayLabel}
                                        size="small"
                                        sx={{
                                            backgroundColor: selectedMasterStatus?.color,
                                            color: selectedMasterStatus?.fontColor,
                                            fontSize: '11px',
                                            fontWeight: 600
                                        }}
                                    />
                                </Box>
                            </Box>

                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                Choose a specific status (optional):
                            </Typography>

                            {/* Quick action buttons */}
                            <Box sx={{ mb: 3 }}>
                                <ButtonGroup size="small" variant="outlined">
                                    <Button
                                        onClick={handleSkipSubStatus}
                                        startIcon={<CheckIcon />}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Use "{selectedMasterStatus?.displayLabel}" only
                                    </Button>
                                </ButtonGroup>
                            </Box>

                            <Divider sx={{ mb: 3 }} />

                            {/* Sub-status options */}
                            <Grid container spacing={2}>
                                {getSubStatusesForMaster().map((subStatus) => (
                                    <Grid item xs={12} sm={6} md={4} key={subStatus.id}>
                                        <Card
                                            onClick={() => handleSubStatusSelect(subStatus)}
                                            sx={{
                                                cursor: 'pointer',
                                                border: '2px solid transparent',
                                                borderRadius: 2,
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    borderColor: selectedMasterStatus?.color,
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: `0 4px 12px ${selectedMasterStatus?.color}20`
                                                }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                                <Chip
                                                    label={subStatus.statusLabel}
                                                    sx={{
                                                        backgroundColor: selectedMasterStatus?.color,
                                                        color: selectedMasterStatus?.fontColor,
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        mb: 1,
                                                        minWidth: '100px'
                                                    }}
                                                />
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontSize: '11px',
                                                        color: 'text.secondary',
                                                        lineHeight: 1.3
                                                    }}
                                                >
                                                    {subStatus.statusMeaning || subStatus.description}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>

                            {getSubStatusesForMaster().length === 0 && (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                        No detailed statuses available for {selectedMasterStatus?.displayLabel}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={handleCancelEdit} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog >
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df

    {/* Confirmation Dialog */ }
    < Dialog
open = { confirmDialogOpen }
onClose = {() => setConfirmDialogOpen(false)}
maxWidth = "sm"
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
<<<<<<< HEAD
=======
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            You are about to manually override the shipment status. This action will:
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, mb: 1 }}>
                            <li>Change the status to <strong>{selectedStatus?.statusLabel}</strong></li>
                            <li>Prevent automatic status updates from the carrier</li>
                            <li>Mark this shipment as manually managed</li>
                            <li>Create an audit trail entry</li>
                        </Box>
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
<Typography variant="body2">
    You are about to manually override the shipment status.
</Typography>
                    </Alert >

    {/* Status Change Preview */ }
    < Box sx = {{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Current</Typography>
                            <EnhancedStatusChip
                                status={currentStatus}
                                size="small"
<<<<<<< HEAD
                                displayMode="auto"
=======
                                displayMode="master"
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                            />
                        </Box>
                        <ArrowForwardIcon color="primary" />
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">New</Typography>
<<<<<<< HEAD
<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
    <Chip
        label={selectedMasterStatus?.displayLabel}
        size="small"
        sx={{
            backgroundColor: selectedMasterStatus?.color,
            color: selectedMasterStatus?.fontColor,
            fontSize: '11px',
            fontWeight: 600
        }}
    />
    {selectedSubStatus && (
        <Chip
            label={selectedSubStatus.statusLabel}
            size="small"
            sx={{
                backgroundColor: selectedMasterStatus?.color,
                color: selectedMasterStatus?.fontColor,
                fontSize: '10px',
                fontWeight: 500,
                height: '20px'
            }}
        />
    )}
</Box>
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                        </Box >
                    </Box >

    {/* Status meaning */ }
<<<<<<< HEAD
    < Box sx = {{ mt: 2, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, mb: 0.5 }}>
                            What this means:
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                            {selectedSubStatus ? selectedSubStatus.statusMeaning : selectedMasterStatus?.description}
                        </Typography>
                    </Box >
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                </DialogContent >
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
            </Dialog >
        </Box >
    );
};

export default ManualStatusOverride; 