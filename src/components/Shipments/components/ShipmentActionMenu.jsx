import React from 'react';
import {
    Menu,
    MenuItem,
    ListItemIcon,
    CircularProgress
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    Print as PrintIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Description as DescriptionIcon,
    Warning as WarningIcon,
    Repeat as RepeatIcon,
    Archive as ArchiveIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../utils/rolePermissions';

const ShipmentActionMenu = ({
    anchorEl,
    open,
    onClose,
    selectedShipment,
    onDeleteDraft,
    onPrintLabel,
    onPrintBOL,
    onViewShipmentDetail,
    onRepeatShipment,
    onEditDraftShipment,
    onEditShipment,
    onArchiveShipment,
    documentAvailability,
    checkingDocuments
}) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // Get user role for permission checking
    const userRole = currentUser?.role || 'user';

    // Check permissions for various actions
    const canViewShipments = hasPermission(userRole, PERMISSIONS.VIEW_SHIPMENTS);
    const canEditShipments = hasPermission(userRole, PERMISSIONS.EDIT_SHIPMENTS);
    const canViewBOL = hasPermission(userRole, PERMISSIONS.VIEW_BOL);
    const canArchiveShipment = hasPermission(userRole, PERMISSIONS.ARCHIVE_SHIPMENT);
    const canCreateShipments = hasPermission(userRole, PERMISSIONS.CREATE_SHIPMENTS); // For repeat functionality

    const handleViewDetails = () => {
        onClose();
        if (onViewShipmentDetail) {
            // Use slide-over functionality if available
            onViewShipmentDetail(selectedShipment?.id);
        } else {
            // Fallback to navigation
            navigate(`/shipment/${selectedShipment?.shipmentID || selectedShipment?.id}`);
        }
    };

    const handleEditDraft = () => {
        onClose();
        if (onEditDraftShipment) {
            // Use the modern edit draft callback
            onEditDraftShipment(selectedShipment.id);
        } else {
            console.error('❌ No onEditDraftShipment callback available');
            // Never navigate to the old form - this should not happen
        }
    };

    const handleEditShipment = () => {
        onClose();
        if (onEditShipment) {
            // Use the edit shipment callback for booked shipments
            onEditShipment(selectedShipment);
        } else {
            console.error('❌ No onEditShipment callback available');
        }
    };

    const handleRepeatShipment = () => {
        onClose();
        if (onRepeatShipment) {
            onRepeatShipment(selectedShipment);
        }
    };

    const handleArchiveShipment = () => {
        onClose();
        if (onArchiveShipment) {
            onArchiveShipment(selectedShipment);
        }
    };

    const handleDeleteDraft = () => {
        onClose();
        if (onDeleteDraft) {
            onDeleteDraft(selectedShipment);
        }
    };

    // Check shipment status for edit availability
    const shipmentStatus = selectedShipment?.status?.toLowerCase() || '';
    const isDraft = shipmentStatus === 'draft';
    const isCancelled = ['cancelled', 'canceled', 'void', 'voided'].includes(shipmentStatus);
    const isDelivered = shipmentStatus === 'delivered';
    const isArchived = shipmentStatus === 'archived';
    const canEditShipment = !isDraft && !isCancelled && !isDelivered && !isArchived;

    return (
        <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right'
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right'
            }}
            PaperProps={{
                sx: {
                    '& .MuiMenuItem-root': { fontSize: '12px' },
                    minWidth: 160,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e5e7eb'
                }
            }}
        >
            {/* View Details - Only for non-draft shipments and users with VIEW_SHIPMENTS permission */}
            {selectedShipment?.status !== 'draft' && canViewShipments && (
                <>
                    <MenuItem onClick={handleViewDetails}>
                        <ListItemIcon>
                            <VisibilityIcon sx={{ fontSize: '14px' }} />
                        </ListItemIcon>
                        View Details
                    </MenuItem>

                    {/* Edit Shipment - Only for users with EDIT_SHIPMENTS permission and valid shipment state */}
                    {canEditShipment && canEditShipments && onEditShipment && (
                        <MenuItem onClick={handleEditShipment}>
                            <ListItemIcon>
                                <EditIcon sx={{ fontSize: '14px' }} />
                            </ListItemIcon>
                            Edit Shipment
                        </MenuItem>
                    )}

                    {/* Repeat Shipment - Only for users with CREATE_SHIPMENTS permission */}
                    {canCreateShipments && (
                        <MenuItem onClick={handleRepeatShipment}>
                            <ListItemIcon>
                                <RepeatIcon sx={{ fontSize: '14px' }} />
                            </ListItemIcon>
                            Repeat
                        </MenuItem>
                    )}
                </>
            )}

            {/* Draft shipment options - Only for users with EDIT_SHIPMENTS permission */}
            {selectedShipment?.status === 'draft' && canEditShipments && (
                <>
                    <MenuItem onClick={handleEditDraft}>
                        <ListItemIcon>
                            <EditIcon sx={{ fontSize: '14px' }} />
                        </ListItemIcon>
                        Edit Draft
                    </MenuItem>
                    <MenuItem onClick={() => {
                        onClose();
                        onDeleteDraft(selectedShipment);
                    }}>
                        <ListItemIcon>
                            <DeleteIcon sx={{ fontSize: '14px' }} />
                        </ListItemIcon>
                        Delete Draft
                    </MenuItem>
                </>
            )}

            {/* Show loading while checking documents */}
            {selectedShipment?.status !== 'draft' && checkingDocuments && (
                <MenuItem disabled>
                    <ListItemIcon>
                        <CircularProgress size={14} />
                    </ListItemIcon>
                    Fetching
                </MenuItem>
            )}

            {/* Print Label - Only for non-draft shipments that have labels */}
            {selectedShipment?.status !== 'draft' &&
                !checkingDocuments &&
                documentAvailability[selectedShipment?.id]?.hasLabels && (
                    <MenuItem onClick={() => onPrintLabel(selectedShipment)}>
                        <ListItemIcon>
                            <PrintIcon sx={{ fontSize: '14px' }} />
                        </ListItemIcon>
                        Print Label
                    </MenuItem>
                )}

            {/* Print BOL - Only for users with VIEW_BOL permission and non-draft shipments that have BOLs */}
            {selectedShipment?.status !== 'draft' &&
                !checkingDocuments &&
                canViewBOL &&
                documentAvailability[selectedShipment?.id]?.hasBOLs && (
                    <MenuItem onClick={() => onPrintBOL(selectedShipment)}>
                        <ListItemIcon>
                            <DescriptionIcon sx={{ fontSize: '14px' }} />
                        </ListItemIcon>
                        Print BOL
                    </MenuItem>
                )}

            {/* Show message if no documents available for non-draft shipments */}
            {selectedShipment?.status !== 'draft' &&
                !checkingDocuments &&
                documentAvailability[selectedShipment?.id] &&
                !documentAvailability[selectedShipment?.id]?.hasLabels &&
                !documentAvailability[selectedShipment?.id]?.hasBOLs && (
                    <MenuItem disabled>
                        <ListItemIcon>
                            <WarningIcon sx={{ fontSize: '14px', color: '#f59e0b' }} />
                        </ListItemIcon>
                        No documents available
                    </MenuItem>
                )}

            {/* Archive option - Only for users with ARCHIVE_SHIPMENT permission and non-draft, non-archived shipments */}
            {selectedShipment?.status !== 'draft' && !isArchived && canArchiveShipment && onArchiveShipment && (
                <MenuItem onClick={handleArchiveShipment}>
                    <ListItemIcon>
                        <ArchiveIcon sx={{ fontSize: '14px' }} />
                    </ListItemIcon>
                    Archive
                </MenuItem>
            )}
        </Menu>
    );
};

export default ShipmentActionMenu;
