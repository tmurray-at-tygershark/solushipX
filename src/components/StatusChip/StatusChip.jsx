import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import {
    getEnhancedStatus,
    getEnhancedStatusColor,
    legacyToEnhanced,
    enhancedToLegacy
} from '../../utils/enhancedStatusModel';

/**
 * Enhanced StatusChip Component
 * Supports both enhanced status IDs and legacy status strings
 * Maintains backward compatibility while providing granular status display
 */
const StatusChip = React.memo(({
    status,           // Can be either enhanced status ID (number) or legacy status (string)
    enhancedStatusId, // Optional: explicitly pass enhanced status ID
    showTooltip = true,  // Show tooltip with description
    size = 'small',      // Chip size
    variant = 'filled'   // Chip variant
}) => {
    /**
     * Get enhanced status configuration
     */
    const getEnhancedStatusConfig = (statusInput) => {
        let statusId;
        let enhancedStatusObj;

        // Handle different input types
        if (enhancedStatusId) {
            // Explicitly provided enhanced status ID
            statusId = enhancedStatusId;
        } else if (typeof statusInput === 'number') {
            // Status is already an enhanced status ID
            statusId = statusInput;
        } else if (typeof statusInput === 'string') {
            // Convert legacy status string to enhanced status ID
            statusId = legacyToEnhanced(statusInput);
        } else {
            // Default fallback
            statusId = 230; // 'Any' status
        }

        // Get enhanced status object
        enhancedStatusObj = getEnhancedStatus(statusId);

        if (!enhancedStatusObj) {
            // Fallback to default if status not found
            return {
                color: '#6b7280',
                bgcolor: '#f9fafb',
                label: statusInput?.toString() || 'Unknown',
                description: 'Unknown status',
                statusId: 230
            };
        }

        // Get color configuration
        const colorConfig = getEnhancedStatusColor(statusId);

        return {
            color: colorConfig.color,
            bgcolor: colorConfig.bgcolor,
            label: enhancedStatusObj.name,
            description: enhancedStatusObj.description,
            category: enhancedStatusObj.category,
            group: enhancedStatusObj.group,
            statusId: statusId
        };
    };

    /**
     * Legacy status configuration (for backward compatibility)
     */
    const getLegacyStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            case 'draft':
                return { color: '#64748b', bgcolor: '#f1f5f9', label: 'Draft', description: 'Draft shipment' };
            case 'unknown':
                return { color: '#6b7280', bgcolor: '#f9fafb', label: 'Unknown', description: 'Unknown status' };
            case 'pending':
            case 'created':
                return { color: '#d97706', bgcolor: '#fef3c7', label: 'Pending', description: 'Pending processing' };
            case 'scheduled':
                return { color: '#7c3aed', bgcolor: '#ede9fe', label: 'Scheduled', description: 'Scheduled for pickup' };
            case 'booked':
                return { color: '#2563eb', bgcolor: '#dbeafe', label: 'Booked', description: 'Booking confirmed' };
            case 'awaiting pickup':
            case 'awaiting shipment':
            case 'awaiting_shipment':
            case 'label_created':
                return { color: '#ea580c', bgcolor: '#fed7aa', label: 'Awaiting Shipment', description: 'Awaiting shipment' };
            case 'in transit':
            case 'in_transit':
                return { color: '#7c2d92', bgcolor: '#f3e8ff', label: 'In Transit', description: 'In transit' };
            case 'delivered':
                return { color: '#16a34a', bgcolor: '#dcfce7', label: 'Delivered', description: 'Successfully delivered' };
            case 'on hold':
            case 'on_hold':
                return { color: '#dc2626', bgcolor: '#fee2e2', label: 'On Hold', description: 'Shipment on hold' };
            case 'cancelled':
            case 'canceled':
                return { color: '#b91c1c', bgcolor: '#fecaca', label: 'Cancelled', description: 'Shipment cancelled' };
            case 'void':
                return { color: '#7f1d1d', bgcolor: '#f3f4f6', label: 'Void', description: 'Shipment voided' };
            default:
                return { color: '#6b7280', bgcolor: '#f9fafb', label: status || 'Unknown', description: 'Unknown status' };
        }
    };

    // Determine whether to use enhanced or legacy configuration
    const isEnhancedStatus = enhancedStatusId ||
        typeof status === 'number' ||
        (typeof status === 'string' && !isNaN(parseInt(status)));

    const statusConfig = isEnhancedStatus
        ? getEnhancedStatusConfig(status)
        : getLegacyStatusConfig(status);

    const { color, bgcolor, label, description, category, group, statusId } = statusConfig;

    const chipElement = (
        <Chip
            label={label}
            sx={{
                color: color,
                bgcolor: bgcolor,
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: size === 'small' ? '0.75rem' : '0.875rem',
                height: size === 'small' ? '24px' : '32px',
                transition: 'all 0.2s ease-in-out',
                cursor: 'default',
                '& .MuiChip-label': {
                    px: size === 'small' ? 2 : 3
                },
                '&:hover': {
                    transform: 'scale(1.02)',
                    boxShadow: `0 2px 8px ${color}40`
                }
            }}
            size={size}
            variant={variant}
            title={showTooltip ? description : undefined}
        />
    );

    // Wrap with tooltip if enabled and we have enhanced status info
    if (showTooltip && isEnhancedStatus && category && group) {
        const tooltipTitle = (
            <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {label} (ID: {statusId})
                </div>
                <div style={{ marginBottom: '2px' }}>
                    {description}
                </div>
                <div style={{ fontSize: '0.85em', opacity: 0.9 }}>
                    Category: {category} • Group: {group}
                </div>
            </div>
        );

        return (
            <Tooltip title={tooltipTitle} placement="top" arrow>
                {chipElement}
            </Tooltip>
        );
    }

    return chipElement;
});

StatusChip.displayName = 'StatusChip';

export default StatusChip; 