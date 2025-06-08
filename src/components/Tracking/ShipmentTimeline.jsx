import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot
} from '@mui/lab';
import {
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    ErrorOutline as ErrorOutlineIcon,
    LocalShipping as LocalShippingIcon,
    FlightTakeoff as FlightTakeoffIcon,
    AccessTime as AccessTimeIcon,
    Pause as PauseIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
    CalendarToday as CalendarIcon,
    HelpOutline as HelpOutlineIcon,
    CheckCircleOutline as CheckCircleOutlineIcon,
    Info as InfoIcon
} from '@mui/icons-material';

// Consistent helper functions (can be moved to a utils file later)
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'Invalid Date';
    }
};

const getStatusColor = (status) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('delivered')) return 'success.main';
    if (s.includes('picked up') || s.includes('departed') || s.includes('in transit') || s.includes('arrived') || s.includes('in_transit')) return 'primary.main';
    if (s.includes('exception') || s.includes('issue') || s.includes('on hold') || s.includes('on_hold')) return 'error.main';
    if (s.includes('pending') || s.includes('created')) return 'warning.main';
    if (s.includes('scheduled')) return 'info.main';
    if (s.includes('booked')) return 'secondary.main';
    if (s.includes('cancelled') || s.includes('canceled') || s.includes('void')) return 'error.dark';
    if (s.includes('draft')) return 'grey.500';
    return 'action.active';
};

const getStatusIcon = (status) => {
    if (!status) return <HelpOutlineIcon sx={{ fontSize: '1.2rem' }} />;
    // Normalize: remove common prefixes and trim
    let s = status.toLowerCase().trim();
    // Remove 'status updated:' or 'status updated -' prefix
    s = s.replace(/^status updated[:\-]?\s*/i, '');
    // Remove 'shipment booking confirmed' prefix
    if (s.startsWith('shipment booking confirmed')) s = 'booking confirmed';
    // Remove 'status:' prefix
    s = s.replace(/^status[:\-]?\s*/i, '');

    // Status update events
    if (status.toLowerCase().includes('status updated') || status.toLowerCase().includes('status_update')) return <InfoIcon sx={{ fontSize: '1.2rem' }} />;
    // Booking events
    if (s.includes('booking confirmed') || s.includes('booking_confirmed')) return <CheckCircleOutlineIcon sx={{ fontSize: '1.2rem' }} />;
    // Status-specific icons
    if (s.includes('delivered')) return <CheckCircleIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('in transit') || s.includes('in_transit') || s.includes('picked up') || s.includes('departed') || s.includes('arrived'))
        return <LocalShippingIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('awaiting_shipment') || s.includes('awaiting shipment') || s.includes('label_created'))
        return <AccessTimeIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('on_hold') || s.includes('on hold') || s.includes('exception') || s.includes('issue'))
        return <ErrorOutlineIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('canceled') || s.includes('cancelled') || s.includes('void'))
        return <CancelIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('draft')) return <EditIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('booked')) return <CheckCircleOutlineIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('scheduled')) return <CalendarIcon sx={{ fontSize: '1.2rem' }} />;
    if (s.includes('pending') || s.includes('created')) return <AccessTimeIcon sx={{ fontSize: '1.2rem' }} />;
    // Default icon for unknown status
    return <HelpOutlineIcon sx={{ fontSize: '1.2rem' }} />;
};


const ShipmentTimeline = ({ events }) => {
    if (!events || events.length === 0) {
        return (
            <Paper elevation={0} sx={{ mt: 3, p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="body1" color="text.secondary">No tracking history available yet.</Typography>
            </Paper>
        );
    }

    // Ensure events are sorted by timestamp, latest first
    const sortedEvents = [...events].sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return dateB - dateA;
    });

    return (
        <Timeline
            sx={{
                mt: 1, // Reduced margin top
                p: 0, // No padding on the timeline itself
                [`& .MuiTimelineItem-root`]: {
                    minHeight: 'auto',
                    '&:before': {
                        display: 'none', // Removes the default line on the left
                    },
                },
                [`& .MuiTimelineDot-root`]: {
                    margin: 0, // Reset margin
                    borderWidth: 0, // Remove border if any
                    boxShadow: 'none', // Remove shadow if any
                    p: '6px', // Adjust padding for dot size
                },
                [`& .MuiTimelineConnector-root`]: {
                    width: 2,
                    backgroundColor: 'divider', // Use theme divider color
                    flexGrow: 1, // Ensure connector fills space
                },
                [`& .MuiTimelineContent-root`]: {
                    padding: '0 0 20px 16px', // Adjust padding: top, right, bottom, left
                    flex: 1,
                },
                [`& .MuiTimelineItem-root:last-child .MuiTimelineConnector-root`]: {
                    display: 'none', // Hide connector for the last item
                },
            }}
        >
            {sortedEvents.map((event, index) => (
                <TimelineItem key={event.id || index}>
                    <TimelineSeparator>
                        <TimelineDot
                            sx={{
                                bgcolor: getStatusColor(event.status || event.eventType),
                                color: 'common.white',
                            }}
                        >
                            {getStatusIcon(event.status || event.eventType)}
                        </TimelineDot>
                        <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                        <Paper elevation={0} sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: index === 0 ? 'action.hover' : 'background.paper',
                        }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                                {event.status || event.title || 'Status Unavailable'}
                            </Typography>
                            {(event.location && (typeof event.location === 'string' || event.location.city || event.location.state || event.location.postalCode)) && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {typeof event.location === 'string'
                                        ? event.location
                                        : [
                                            event.location.city,
                                            event.location.state,
                                            event.location.postalCode
                                        ].filter(Boolean).join(', ')}
                                </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {formatTimestamp(event.timestamp)}
                            </Typography>
                            {event.description && (
                                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line' }}>
                                    {event.description}
                                </Typography>
                            )}
                            {event.userData && event.userData.email && (
                                <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {`User: ${event.userData.email}`}
                                    </Typography>
                                </Box>
                            )}
                            {event.source && (
                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                                    (Source: {event.source})
                                </Typography>
                            )}
                        </Paper>
                    </TimelineContent>
                </TimelineItem>
            ))}
        </Timeline>
    );
};

export default ShipmentTimeline; 