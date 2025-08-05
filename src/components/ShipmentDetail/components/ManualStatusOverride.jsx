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
    Card,
    CardContent,
    Grid,
    Divider,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    ButtonGroup
} from '@mui/material';
import {
    Edit as EditIcon,
    Warning as WarningIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Category as CategoryIcon,
    List as ListIcon,
    ArrowForward as ArrowForwardIcon,
    ArrowBack as ArrowBackIcon,
    Done as DoneIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import dynamicStatusService from '../../../services/DynamicStatusService';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';
import { hasPermission, PERMISSIONS } from '../../../utils/rolePermissions';
import { useAuth } from '../../../contexts/AuthContext';

const ManualStatusOverride = ({
    shipment,
    onStatusUpdated,
    onShowSnackbar,
    disabled = false
}) => {
    // Get user role for permission checking
    const { user, currentUser } = useAuth();
    const userRole = user?.role || currentUser?.role;

    // Debug: Check permission logic
    const hasManualOverridePermission = hasPermission(userRole, PERMISSIONS.MANUAL_STATUS_OVERRIDE);
    console.log('ManualStatusOverride - userRole:', userRole, 'hasPermission:', hasManualOverridePermission);
    const [isEditing, setIsEditing] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedMasterStatus, setSelectedMasterStatus] = useState(null);
    const [selectedSubStatus, setSelectedSubStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusesLoading, setStatusesLoading] = useState(true);
    const [masterStatuses, setMasterStatuses] = useState([]);
    const [subStatuses, setSubStatuses] = useState([]);
    const [step, setStep] = useState(0); // 0 = master status, 1 = sub status (optional)
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

                // Get all available statuses
                const allMasterStatuses = dynamicStatusService.getMasterStatuses();
                const allSubStatuses = dynamicStatusService.getShipmentStatuses();

                setMasterStatuses(allMasterStatuses);
                setSubStatuses(allSubStatuses);

                console.log('📊 Enhanced Manual Status Override loaded:', {
                    masterStatuses: allMasterStatuses.length,
                    subStatuses: allSubStatuses.length
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

    // Get sub-statuses for selected master status
    const getSubStatusesForMaster = () => {
        if (!selectedMasterStatus) return [];
        return subStatuses.filter(status => status.masterStatus === selectedMasterStatus.id);
    };

    const handleEditClick = () => {
        setSelectedMasterStatus(null);
        setSelectedSubStatus(null);
        setStep(0);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setSelectedMasterStatus(null);
        setSelectedSubStatus(null);
        setStep(0);
    };

    const handleMasterStatusSelect = (masterStatus) => {
        console.log('🔄 Master status selected:', {
            masterStatus,
            masterStatusId: masterStatus.id,
            masterStatusLabel: masterStatus.label,
            allSubStatuses: subStatuses.length,
            subStatusesForMaster: subStatuses.filter(status => status.masterStatus === masterStatus.id).length
        });

        setSelectedMasterStatus(masterStatus);
        setSelectedSubStatus(null);

        // If there are sub-statuses available, go to step 1, otherwise finish
        const availableSubStatuses = subStatuses.filter(status => status.masterStatus === masterStatus.id);
        console.log('📊 Available sub-statuses for master:', availableSubStatuses);

        if (availableSubStatuses.length > 0) {
            console.log('➡️ Moving to step 1 (sub-statuses available)');
            setStep(1);
        } else {
            console.log('✅ No sub-statuses, proceeding directly to confirmation');
            // No sub-statuses available, use master status only
            // Pass the masterStatus directly since React state hasn't updated yet
            handleConfirmWithStatus(masterStatus, null);
        }
    };

    const handleSubStatusSelect = (subStatus) => {
        console.log('🔄 Sub-status selected:', subStatus);
        handleConfirmWithStatus(selectedMasterStatus, subStatus);
    };

    const handleSkipSubStatus = () => {
        // Use master status only
        console.log('⏭️ Skipping sub-status, using master only');
        handleConfirmWithStatus(selectedMasterStatus, null);
    };

    const handleBackToMasterStatus = () => {
        setSelectedSubStatus(null);
        setStep(0);
    };

    const handleConfirmWithStatus = (masterStatus, subStatus) => {
        // Use sub-status if provided, otherwise use master status
        const finalStatus = subStatus || masterStatus;

        console.log('🎯 handleConfirmWithStatus called:', {
            masterStatus: masterStatus,
            subStatus: subStatus,
            finalStatus: finalStatus,
            currentStatus: currentStatus,
            shipmentId: shipment?.id
        });

        if (finalStatus) {
            // Temporarily set the state for the confirmation dialog
            setSelectedMasterStatus(masterStatus);
            setSelectedSubStatus(subStatus);

            console.log('✅ Status selection confirmed:', {
                currentStatus,
                masterStatusLabel: masterStatus?.label,
                subStatusLabel: subStatus?.statusLabel,
                finalStatus: finalStatus
            });

            console.log('🔔 Opening confirmation dialog...');
            setConfirmDialogOpen(true);
        } else {
            console.log('❌ No final status provided, closing editor');
            setIsEditing(false);
        }
    };

    const handleConfirm = () => {
        // Use sub-status if selected, otherwise use master status
        const finalStatus = selectedSubStatus || selectedMasterStatus;

        console.log('🎯 handleConfirm called:', {
            selectedMasterStatus: selectedMasterStatus,
            selectedSubStatus: selectedSubStatus,
            finalStatus: finalStatus,
            currentStatus: currentStatus,
            shipmentId: shipment?.id
        });

        if (finalStatus) {
            // Always show confirmation dialog when a status is selected
            // This ensures all changes (including sub-status changes within same master) are processed
            console.log('✅ Status selection confirmed:', {
                currentStatus,
                selectedMasterStatus: selectedMasterStatus?.label,
                selectedSubStatus: selectedSubStatus?.statusLabel,
                finalStatus: finalStatus
            });

            console.log('🔔 Opening confirmation dialog...');
            setConfirmDialogOpen(true);
        } else {
            console.log('❌ No final status selected, closing editor');
            setIsEditing(false);
        }
    };

    const handleConfirmStatusOverride = async () => {
        const finalStatus = selectedSubStatus || selectedMasterStatus;

        console.log('🚀 Starting status override:', {
            finalStatus: finalStatus,
            shipmentId: shipment?.id,
            selectedMasterStatus: selectedMasterStatus,
            selectedSubStatus: selectedSubStatus
        });

        if (!finalStatus || !shipment?.id) {
            console.error('❌ Missing required data for status override:', {
                finalStatus: !!finalStatus,
                shipmentId: !!shipment?.id
            });
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
                newStatus: legacyStatusCode, // Send legacy-compatible status code
                previousStatus: currentStatus,
                reason: selectedSubStatus ?
                    `Manual status override: ${selectedMasterStatus.displayLabel} → ${selectedSubStatus.statusLabel}` :
                    `Manual status override: ${selectedMasterStatus.displayLabel}`,
                userId: 'current_user',
                timestamp: new Date().toISOString(),
                // Add enhanced status information to ensure database changes
                enhancedStatus: enhancedStatusInfo
            });

            console.log('📨 Cloud function result:', result.data);

            if (result.data.success) {
                const statusLabel = selectedSubStatus ? selectedSubStatus.statusLabel : selectedMasterStatus.displayLabel;
                console.log('✅ Status update successful:', statusLabel);
                onShowSnackbar(`Status manually updated to ${statusLabel}`, 'success');

                // Call the callback to refresh shipment data
                if (onStatusUpdated) {
                    console.log('🔄 Calling onStatusUpdated callback with:', legacyStatusCode);
                    onStatusUpdated(legacyStatusCode); // Use the legacy status code for updates
                }

                console.log('🧹 Cleaning up state and closing dialogs...');
                setIsEditing(false);
                setConfirmDialogOpen(false);
                setSelectedMasterStatus(null);
                setSelectedSubStatus(null);
                setStep(0);
            } else {
                console.error('❌ Cloud function returned error:', result.data.error);
                throw new Error(result.data.error || 'Failed to update status');
            }
        } catch (error) {
            console.error('Error updating manual status:', error);
            onShowSnackbar('Failed to update status: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Get enhanced status from shipment's statusOverride if available
    const getEnhancedStatusFromShipment = () => {
        // Check if there's enhanced status information in statusOverride
        if (shipment?.statusOverride?.enhancedStatus) {
            return shipment.statusOverride.enhancedStatus;
        }

        // Fall back to the legacy status
        return currentStatus;
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
            {/* Current Status Display - Always visible */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EnhancedStatusChip
                    status={getEnhancedStatusFromShipment()}
                    size="small"
                    displayMode="auto"
                    showTooltip={true}
                />

                {/* Manual Status Override Edit Button - Only show if user has permission */}
                {hasManualOverridePermission && (
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
                )}
            </Box>

            {/* Enhanced Status Selection Dialog */}
            <Dialog
                open={isEditing}
                onClose={handleCancelEdit}
                maxWidth="md"
                fullWidth
                PaperProps={{
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
            </Dialog>

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
                        <Typography variant="body2">
                            You are about to manually override the shipment status.
                        </Typography>
                    </Alert>

                    {/* Status Change Preview */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Current</Typography>
                            <EnhancedStatusChip
                                status={currentStatus}
                                size="small"
                                displayMode="auto"
                            />
                        </Box>
                        <ArrowForwardIcon color="primary" />
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">New</Typography>
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
                        </Box>
                    </Box>

                    {/* Status meaning */}
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, mb: 0.5 }}>
                            What this means:
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                            {selectedSubStatus ? selectedSubStatus.statusMeaning : selectedMasterStatus?.description}
                        </Typography>
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