import React from 'react';
import { Chip } from '@mui/material';

const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
            case 'created':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Pending'
                };
            case 'booked':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Booked'
                };
            case 'awaiting pickup':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Awaiting Pickup'
                };
            case 'awaiting shipment':
            case 'label_created':
                return {
                    color: '#3B82F6',
                    bgcolor: '#EFF6FF',
                    label: 'Awaiting Shipment'
                };
            case 'in transit':
            case 'in_transit':
                return {
                    color: '#6366F1',
                    bgcolor: '#EEF2FF',
                    label: 'In Transit'
                };
            case 'on hold':
            case 'on_hold':
                return {
                    color: '#7C3AED',
                    bgcolor: '#F5F3FF',
                    label: 'On Hold'
                };
            case 'delivered':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Delivered'
                };
            case 'cancelled':
            case 'canceled':
                return {
                    color: '#EF4444',
                    bgcolor: '#FEE2E2',
                    label: 'Cancelled'
                };
            default:
                return {
                    color: '#6B7280',
                    bgcolor: '#F3F4F6',
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