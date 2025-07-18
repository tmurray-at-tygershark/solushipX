import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Chip,
    Paper,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    CircularProgress,
    Badge
} from '@mui/material';
import {
    Edit as EditIcon,
    Print as PrintIcon,
    MoreVert as MoreVertIcon,
    Refresh as RefreshIcon,
    Cancel as CancelIcon,
    PictureAsPdf as PdfIcon,
    Assignment as DocumentIcon,
    LocalShipping as ShipmentIcon,
    FileCopy as DuplicateIcon,
    Archive as ArchiveIcon,
    NotificationsActive as NotifyIcon,
    AssignmentInd as FollowUpIcon
} from '@mui/icons-material';

// Add CSS for spinning animation
const spinAnimation = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
`;

// Inject the CSS
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = spinAnimation;
    document.head.appendChild(style);
}

const ShipmentHeader = ({
    shipment,
    onEditShipment,
    onCancelShipment,
    onPrintShipment,
    onPrintBOL,
    onPrintConfirmation,
    onPrintLabel,
    onRegenerateBOL,
    onRegenerateCarrierConfirmation,
    onRefreshShipment,
    onArchiveShipment,
    onCreateFollowUp, // Add follow-up handler
    onViewFollowUps, // Add view follow-ups handler
    followUpCount = 0, // Add follow-up counter
    actionStates = {}
}) => {
    // Menu states
    const [documentsMenuAnchor, setDocumentsMenuAnchor] = useState(null);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [confirmRegenerateDialog, setConfirmRegenerateDialog] = useState({ open: false, type: null });

    const shipmentStatus = shipment?.status?.toLowerCase() || '';
    const isDraft = shipmentStatus === 'draft';
    const isCancelled = ['cancelled', 'canceled', 'void', 'voided'].includes(shipmentStatus);
    const isDelivered = shipmentStatus === 'delivered';
    const isArchived = shipmentStatus === 'archived';

    // Determine if this is a freight shipment
    const isFreightShipment = shipment?.shipmentInfo?.shipmentType === 'freight' ||
        shipment?.packages?.some(pkg => pkg.weight > 150);

    // Handle menu actions
    const handleDocumentsMenuOpen = (event) => {
        setDocumentsMenuAnchor(event.currentTarget);
    };

    const handleActionsMenuOpen = (event) => {
        setActionsMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = () => {
        setDocumentsMenuAnchor(null);
        setActionsMenuAnchor(null);
    };

    const handleDocumentAction = (action) => {
        handleMenuClose();

        // Show confirmation dialog for regenerate actions
        if (action === 'regenerateBOL' || action === 'regenerateConfirmation') {
            setConfirmRegenerateDialog({
                open: true,
                type: action === 'regenerateBOL' ? 'BOL' : 'Confirmation'
            });
            return;
        }

        switch (action) {
            case 'printBOL': onPrintBOL?.(); break;
            case 'printConfirmation': onPrintConfirmation?.(); break;
            case 'printLabel': onPrintLabel?.(); break;
            default: break;
        }
    };

    const handleConfirmRegenerate = () => {
        const { type } = confirmRegenerateDialog;
        setConfirmRegenerateDialog({ open: false, type: null });

        if (type === 'BOL') {
            onRegenerateBOL?.();
        } else if (type === 'Confirmation') {
            onRegenerateCarrierConfirmation?.();
        }
    };

    const handleCancelRegenerate = () => {
        setConfirmRegenerateDialog({ open: false, type: null });
    };

    const handleAction = (action) => {
        handleMenuClose();
        switch (action) {
            case 'refreshStatus': onRefreshShipment?.(); break;
            case 'cancel': onCancelShipment?.(); break;
            case 'archive': onArchiveShipment?.(); break;
            default: break;
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered': return 'success';
            case 'in_transit': case 'in transit': case 'picked_up': return 'primary';
            case 'on_hold': case 'delayed': case 'exception': return 'warning';
            case 'cancelled': case 'canceled': case 'void': return 'error';
            case 'draft': return 'default';
            case 'scheduled': case 'booked': return 'info';
            default: return 'default';
        }
    };

    // Check if any regeneration is in progress
    const isRegenerating = actionStates.regenerateBOL?.loading || actionStates.regenerateConfirmation?.loading;
    const regenerationType = actionStates.regenerateBOL?.loading ? 'BOL' :
        actionStates.regenerateConfirmation?.loading ? 'Carrier Confirmation' : '';

    return (
        <>
            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    mb: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    position: 'relative'
                }}
            >
                {/* Header Row */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2
                }}>
                    {/* Left Side - Shipment Info */}
                    <Box>
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 600,
                                color: 'text.primary',
                                mb: 1
                            }}
                        >
                            {shipment?.shipmentID || 'Loading...'}
                        </Typography>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                                label={shipment?.status === 'draft' ? 'DRAFT' : (shipment?.status || 'Unknown')}
                                color={getStatusColor(shipment?.status)}
                                size="small"
                                sx={{ fontWeight: 500, fontSize: '11px' }}
                            />

                            {shipment?.shipmentInfo?.shipmentType && (
                                <Chip
                                    label={shipment.shipmentInfo.shipmentType.toUpperCase()}
                                    variant="outlined"
                                    size="small"
                                    sx={{ fontSize: '11px' }}
                                />
                            )}

                            {shipment?.selectedCarrier && (
                                <Typography variant="body2" color="text.secondary">
                                    via {shipment.selectedCarrier}
                                </Typography>
                            )}
                        </Stack>
                    </Box>

                    {/* Right Side - Primary Actions */}
                    <Stack direction="row" spacing={1} alignItems="center">
                        {/* Edit Button - Most Important */}
                        {!isDraft && (
                            <Button
                                variant="contained"
                                startIcon={<EditIcon />}
                                onClick={onEditShipment}
                                disabled={actionStates.editShipment?.loading}
                                sx={{ minWidth: 120, fontSize: '12px' }}
                            >
                                Edit
                            </Button>
                        )}

                        {/* Follow-Up Button - After Edit Button */}
                        <Badge
                            badgeContent={followUpCount}
                            color="error"
                            sx={{
                                '& .MuiBadge-badge': {
                                    fontSize: '10px',
                                    height: '18px',
                                    minWidth: '18px',
                                    right: -3,
                                    top: 3
                                }
                            }}
                        >
                            <Button
                                variant="outlined"
                                startIcon={<FollowUpIcon />}
                                onClick={onViewFollowUps}
                                disabled={actionStates.createFollowUp?.loading}
                                sx={{
                                    minWidth: 120,
                                    fontSize: '12px',
                                    borderColor: '#f59e0b',
                                    color: '#f59e0b',
                                    paddingRight: '16px', // Add 8px padding (8px + default 8px = 16px)
                                    '&:hover': {
                                        borderColor: '#d97706',
                                        bgcolor: '#fef3c7'
                                    }
                                }}
                            >
                                Follow-Ups
                            </Button>
                        </Badge>

                        {/* Print BOL Button - Direct Access */}
                        {!isDraft && isFreightShipment && (
                            <Button
                                variant="outlined"
                                startIcon={actionStates.printBOL?.loading ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <PdfIcon />}
                                onClick={onPrintBOL}
                                disabled={actionStates.printBOL?.loading}
                                sx={{ minWidth: 100, fontSize: '12px' }}
                            >
                                {actionStates.printBOL?.loading ? 'Generating...' : 'BOL'}
                            </Button>
                        )}

                        {/* Print Carrier Confirmation Button - Direct Access */}
                        {!isDraft && (
                            <Button
                                variant="outlined"
                                startIcon={actionStates.printConfirmation?.loading ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <DocumentIcon />}
                                onClick={onPrintConfirmation}
                                disabled={actionStates.printConfirmation?.loading}
                                sx={{ minWidth: 100, fontSize: '12px' }}
                            >
                                {actionStates.printConfirmation?.loading ? 'Generating...' : 'Confirmation'}
                            </Button>
                        )}

                        {/* Documents Menu */}
                        {!isDraft && (
                            <IconButton
                                onClick={handleDocumentsMenuOpen}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    '&:hover': { bgcolor: 'action.hover' }
                                }}
                            >
                                <DocumentIcon />
                            </IconButton>
                        )}

                        {/* More Actions Menu */}
                        <IconButton
                            onClick={handleActionsMenuOpen}
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                '&:hover': { bgcolor: 'action.hover' }
                            }}
                        >
                            <MoreVertIcon />
                        </IconButton>
                    </Stack>
                </Box>

                {/* Documents Menu */}
                <Menu
                    anchorEl={documentsMenuAnchor}
                    open={Boolean(documentsMenuAnchor)}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: { minWidth: 220 }
                    }}
                >
                    <MenuItem onClick={() => handleDocumentAction('printBOL')}>
                        <ListItemIcon><PdfIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Print BOL" sx={{ '& .MuiListItemText-primary': { fontSize: '12px' } }} />
                    </MenuItem>

                    <MenuItem onClick={() => handleDocumentAction('printConfirmation')}>
                        <ListItemIcon><DocumentIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Print Confirmation" sx={{ '& .MuiListItemText-primary': { fontSize: '12px' } }} />
                    </MenuItem>

                    <MenuItem onClick={() => handleDocumentAction('printLabel')}>
                        <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Print Label" sx={{ '& .MuiListItemText-primary': { fontSize: '12px' } }} />
                    </MenuItem>

                    <Divider />

                    <MenuItem
                        onClick={() => handleDocumentAction('regenerateBOL')}
                        disabled={actionStates.regenerateBOL?.loading}
                    >
                        <ListItemIcon>
                            {actionStates.regenerateBOL?.loading ? (
                                <CircularProgress size={16} color="warning" />
                            ) : (
                                <RefreshIcon fontSize="small" color="warning" />
                            )}
                        </ListItemIcon>
                        <ListItemText
                            primary={actionStates.regenerateBOL?.loading ? "Regenerating BOL..." : "Regenerate BOL"}
                            secondary={actionStates.regenerateBOL?.loading ? "Please wait..." : "Creates new version"}
                            sx={{
                                '& .MuiListItemText-primary': { fontSize: '12px' },
                                '& .MuiListItemText-secondary': { fontSize: '11px' }
                            }}
                        />
                    </MenuItem>

                    {onRegenerateCarrierConfirmation && (
                        <MenuItem
                            onClick={() => handleDocumentAction('regenerateConfirmation')}
                            disabled={actionStates.regenerateConfirmation?.loading}
                        >
                            <ListItemIcon>
                                {actionStates.regenerateConfirmation?.loading ? (
                                    <CircularProgress size={16} color="warning" />
                                ) : (
                                    <RefreshIcon fontSize="small" color="warning" />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={actionStates.regenerateConfirmation?.loading ? "Regenerating Confirmation..." : "Regenerate Confirmation"}
                                secondary={actionStates.regenerateConfirmation?.loading ? "Please wait..." : "Creates new version"}
                                sx={{
                                    '& .MuiListItemText-primary': { fontSize: '12px' },
                                    '& .MuiListItemText-secondary': { fontSize: '11px' }
                                }}
                            />
                        </MenuItem>
                    )}
                </Menu>

                {/* Actions Menu */}
                <Menu
                    anchorEl={actionsMenuAnchor}
                    open={Boolean(actionsMenuAnchor)}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: { minWidth: 200 }
                    }}
                >
                    <MenuItem onClick={() => handleAction('refreshStatus')}>
                        <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Refresh Status" sx={{ '& .MuiListItemText-primary': { fontSize: '12px' } }} />
                    </MenuItem>

                    <MenuItem onClick={() => handleAction('duplicate')}>
                        <ListItemIcon><DuplicateIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Duplicate Shipment" sx={{ '& .MuiListItemText-primary': { fontSize: '12px' } }} />
                    </MenuItem>

                    {!isDraft && !isArchived && (
                        <MenuItem
                            onClick={() => handleAction('archive')}
                            disabled={actionStates.archiveShipment?.loading}
                        >
                            <ListItemIcon>
                                {actionStates.archiveShipment?.loading ? (
                                    <CircularProgress size={16} />
                                ) : (
                                    <ArchiveIcon fontSize="small" />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={actionStates.archiveShipment?.loading ? "Archiving..." : "Archive"}
                                sx={{ '& .MuiListItemText-primary': { fontSize: '12px' } }}
                            />
                        </MenuItem>
                    )}

                    <Divider />

                    {!isCancelled && !isDelivered && (
                        <MenuItem
                            onClick={() => handleAction('cancel')}
                            sx={{ color: 'error.main' }}
                        >
                            <ListItemIcon><CancelIcon fontSize="small" color="error" /></ListItemIcon>
                            <ListItemText primary="Cancel Shipment" sx={{ '& .MuiListItemText-primary': { fontSize: '12px' } }} />
                        </MenuItem>
                    )}
                </Menu>

                {/* Regenerate Confirmation Dialog */}
                <Dialog
                    open={confirmRegenerateDialog.open}
                    onClose={handleCancelRegenerate}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RefreshIcon color="warning" />
                        Regenerate {confirmRegenerateDialog.type}?
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            This will create a new version of the {confirmRegenerateDialog.type?.toLowerCase()} document
                            with the latest shipment information. The previous version will be archived.
                        </DialogContentText>
                        <DialogContentText sx={{ mt: 2, fontWeight: 500 }}>
                            Are you sure you want to continue?
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCancelRegenerate} sx={{ fontSize: '12px' }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmRegenerate}
                            variant="contained"
                            color="warning"
                            startIcon={<RefreshIcon />}
                            sx={{ fontSize: '12px' }}
                        >
                            Regenerate {confirmRegenerateDialog.type}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </>
    );
};

export default ShipmentHeader; 