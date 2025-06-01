import React from 'react';
import { Chip } from '@mui/material';

const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            // Draft/Initial States - Grey
            case 'draft':
                return {
                    color: '#64748b',
                    bgcolor: '#f1f5f9',
                    label: 'Draft'
                };
            case 'unknown':
                return {
                    color: '#6b7280',
                    bgcolor: '#f9fafb',
                    label: 'Unknown'
                };

            // Early Processing - Light Grey
            case 'pending':
            case 'created':
                return {
                    color: '#d97706',
                    bgcolor: '#fef3c7',
                    label: 'Pending'
                };

            // Scheduled - Light Blue
            case 'scheduled':
                return {
                    color: '#7c3aed',
                    bgcolor: '#ede9fe',
                    label: 'Scheduled'
                };

            // Confirmed - Blue
            case 'booked':
                return {
                    color: '#2563eb',
                    bgcolor: '#dbeafe',
                    label: 'Booked'
                };

            // Ready to Ship - Orange
            case 'awaiting pickup':
            case 'awaiting shipment':
            case 'awaiting_shipment':
            case 'label_created':
                return {
                    color: '#ea580c',
                    bgcolor: '#fed7aa',
                    label: 'Awaiting Shipment'
                };

            // In Motion - Purple
            case 'in transit':
            case 'in_transit':
                return {
                    color: '#7c2d92',
                    bgcolor: '#f3e8ff',
                    label: 'In Transit'
                };

            // Success - Green (Reserved for completion)
            case 'delivered':
                return {
                    color: '#16a34a',
                    bgcolor: '#dcfce7',
                    label: 'Delivered'
                };

            // Problem States - Red variants
            case 'on hold':
            case 'on_hold':
                return {
                    color: '#dc2626',
                    bgcolor: '#fee2e2',
                    label: 'On Hold'
                };
            case 'cancelled':
            case 'canceled':
                return {
                    color: '#b91c1c',
                    bgcolor: '#fecaca',
                    label: 'Cancelled'
                };
            case 'void':
                return {
                    color: '#7f1d1d',
                    bgcolor: '#f3f4f6',
                    label: 'Void'
                };

            default:
                return {
                    color: '#6b7280',
                    bgcolor: '#f9fafb',
                    label: status || 'Unknown'
                };
        }
    };

    const { color, bgcolor, label } = getStatusConfig(status);

    return (
        <Chip
            label={label}
            sx={{
                color: color,
                bgcolor: bgcolor,
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: '24px',
                '& .MuiChip-label': {
                    px: 2
                }
            }}
            size="small"
        />
    );
});

export default StatusChip; 