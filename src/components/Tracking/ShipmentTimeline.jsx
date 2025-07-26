import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
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
    Info as InfoIcon,
    Description as DescriptionIcon,
    Assignment as AssignmentIcon
} from '@mui/icons-material';
import { dynamicStatusService } from '../../services/DynamicStatusService';

// Consistent helper functions (can be moved to a utils file later)
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Not Available';

    try {
        // Handle serverTimestamp placeholders
        if (timestamp._methodName === 'serverTimestamp') {
            return 'Pending...';
        }

        let date;

        // Handle Firestore Timestamp
        if (timestamp && typeof timestamp === 'object' && timestamp.toDate && typeof timestamp.toDate === 'function') {
            try {
                date = timestamp.toDate();
            } catch (error) {
                console.warn('Error calling toDate() on timestamp:', error);
                return 'Invalid Date';
            }
        }
        // Handle timestamp objects with seconds and nanoseconds
        else if (timestamp && typeof timestamp === 'object' && typeof timestamp.seconds === 'number') {
            try {
                date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
            } catch (error) {
                console.warn('Error parsing timestamp with seconds:', error);
                return 'Invalid Date';
            }
        }
        // Handle timestamp objects with _seconds (alternative format)
        else if (timestamp && typeof timestamp === 'object' && typeof timestamp._seconds === 'number') {
            try {
                date = new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
            } catch (error) {
                console.warn('Error parsing timestamp with _seconds:', error);
                return 'Invalid Date';
            }
        }
        // Handle numeric timestamps (milliseconds)
        else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        }
        // Handle Date objects
        else if (timestamp instanceof Date) {
            date = timestamp;
        }
        // Handle string timestamps
        else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        }
        // Handle invalid or unknown timestamp formats
        else {
            console.warn('Unknown timestamp format:', timestamp);
            return 'Invalid Format';
        }

        // Final validation
        if (!date || isNaN(date.getTime())) {
            console.warn('Invalid date after parsing:', date, 'from timestamp:', timestamp);
            return 'Invalid Date';
        }

        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        console.error('Error formatting timestamp:', error, timestamp);
        return 'Format Error';
    }
};

const getStatusColor = (status, eventType) => {
    // First check eventType for specific colors
    if (eventType) {
        const eventTypeStr = eventType.toLowerCase();
        if (eventTypeStr === 'document_generated') return 'success.main'; // Green for documents
        if (eventTypeStr === 'booking_confirmed') return 'primary.main'; // Blue for booking
        if (eventTypeStr === 'shipment_cancelled') return 'error.main'; // Red for cancellation
        if (eventTypeStr === 'created') return 'info.main'; // Light blue for creation
        if (eventTypeStr === 'status_update') return 'warning.main'; // Orange for updates
        if (eventTypeStr === 'user_action') return 'secondary.main'; // Purple for user actions
        if (eventTypeStr === 'tracking_update') return 'primary.main'; // Blue for tracking
        if (eventTypeStr === 'carrier_update') return 'primary.main'; // Blue for carrier updates
    }

    // Fallback to status-based colors
    const s = status?.toLowerCase() || '';
    if (s.includes('delivered')) return 'success.main';
    if (s.includes('picked up') || s.includes('departed') || s.includes('in transit') || s.includes('arrived') || s.includes('in_transit')) return 'primary.main';
    if (s.includes('exception') || s.includes('issue') || s.includes('on hold') || s.includes('on_hold')) return 'error.main';
    if (s.includes('pending') || s.includes('created')) return 'warning.main';
    if (s.includes('scheduled')) return 'info.main';
    if (s.includes('booked') || s.includes('booking confirmed')) return 'primary.main';
    if (s.includes('cancelled') || s.includes('canceled') || s.includes('void')) return 'error.main';
    if (s.includes('draft')) return 'grey.500';
    if (s.includes('generated') || s.includes('confirmation') || s.includes('bol')) return 'success.main';
    return 'grey.600'; // Default grey for unknown events
};

const getStatusIcon = (status, eventType) => {
    if (!status && !eventType) return <HelpOutlineIcon sx={{ fontSize: '1.2rem', color: 'grey.500' }} />;

    // First check eventType for specific event types
    if (eventType) {
        const eventTypeStr = eventType.toLowerCase();
        // Document generation events
        if (eventTypeStr === 'document_generated') {
            // Check the title to determine specific document type
            const titleStr = status?.toLowerCase() || '';
            if (titleStr.includes('bol')) {
                return <DescriptionIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
            }
            if (titleStr.includes('confirmation')) {
                return <AssignmentIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
            }
            return <CheckCircleOutlineIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
        // Booking confirmation events
        if (eventTypeStr === 'booking_confirmed') {
            return <CheckCircleOutlineIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
        // Cancellation events
        if (eventTypeStr === 'shipment_cancelled') {
            return <CancelIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
        // Creation events
        if (eventTypeStr === 'created') {
            return <AccessTimeIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
        // Status update events
        if (eventTypeStr === 'status_update') {
            return <InfoIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
        // User action events
        if (eventTypeStr === 'user_action') {
            return <EditIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
        // Tracking update events
        if (eventTypeStr === 'tracking_update') {
            return <LocalShippingIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
        // Carrier update events
        if (eventTypeStr === 'carrier_update') {
            return <LocalShippingIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
        }
    }

    // Fallback to status-based icon detection
    if (!status) return <HelpOutlineIcon sx={{ fontSize: '1.2rem', color: 'grey.500' }} />;

    // Normalize: remove common prefixes and trim
    let s = status.toLowerCase().trim();
    // Remove 'status updated:' or 'status updated -' prefix
    s = s.replace(/^status updated[:\-]?\s*/i, '');
    // Remove 'shipment booking confirmed' prefix
    if (s.startsWith('shipment booking confirmed')) s = 'booking confirmed';
    // Remove 'status:' prefix
    s = s.replace(/^status[:\-]?\s*/i, '');

    // Status update events
    if (status.toLowerCase().includes('status updated') || status.toLowerCase().includes('status_update')) return <InfoIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    // Booking events
    if (s.includes('booking confirmed') || s.includes('booking_confirmed')) return <CheckCircleOutlineIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    // Document generation events
    if (s.includes('bol generated') || s.includes('bol')) return <DescriptionIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('confirmation generated') || s.includes('carrier confirmation')) return <AssignmentIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('generated')) return <CheckCircleOutlineIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    // Status-specific icons
    if (s.includes('delivered')) return <CheckCircleIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('in transit') || s.includes('in_transit') || s.includes('picked up') || s.includes('departed') || s.includes('arrived'))
        return <LocalShippingIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('awaiting_shipment') || s.includes('awaiting shipment') || s.includes('label_created'))
        return <AccessTimeIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('on_hold') || s.includes('on hold') || s.includes('exception') || s.includes('issue'))
        return <ErrorOutlineIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('canceled') || s.includes('cancelled') || s.includes('void'))
        return <CancelIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('draft')) return <EditIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('booked')) return <CheckCircleOutlineIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('scheduled')) return <CalendarIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    if (s.includes('pending') || s.includes('created')) return <AccessTimeIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
    // Default icon for unknown status
    return <HelpOutlineIcon sx={{ fontSize: '1.2rem', color: 'white' }} />;
};


const ShipmentTimeline = ({ events }) => {
    const [statusService, setStatusService] = useState(null);
    const [statusServiceInitialized, setStatusServiceInitialized] = useState(false);

    // Initialize DynamicStatusService
    useEffect(() => {
        const initializeStatusService = async () => {
            try {
                await dynamicStatusService.initialize();
                setStatusService(dynamicStatusService);
                setStatusServiceInitialized(true);
                console.log('📊 [ShipmentTimeline] DynamicStatusService initialized');
            } catch (error) {
                console.error('📊 [ShipmentTimeline] Failed to initialize DynamicStatusService:', error);
                setStatusServiceInitialized(true); // Still set to true to avoid infinite loading
            }
        };

        initializeStatusService();
    }, []);

    // Function to format status display with master and substatus
    const formatStatusDisplay = (event) => {
        const rawStatus = event.status || event.title || 'Status Unavailable';

        // For user action events (like invoice status changes), display the title directly
        // without trying to process it through the status service
        if (event.eventType === 'user_action') {
            return { displayText: rawStatus, masterStatus: null, subStatus: null };
        }

        if (!statusService || !statusServiceInitialized) {
            return { displayText: rawStatus, masterStatus: null, subStatus: null };
        }

        try {
            const statusDisplay = statusService.getStatusDisplay(rawStatus);

            if (statusDisplay && statusDisplay.masterStatus) {
                const { masterStatus, subStatus } = statusDisplay;

                if (subStatus) {
                    // Show both master and substatus: "In Transit: Border Crossing"
                    return {
                        displayText: `${masterStatus.displayLabel}: ${subStatus.statusLabel}`,
                        masterStatus,
                        subStatus
                    };
                } else {
                    // Show only master status: "In Transit"
                    return {
                        displayText: masterStatus.displayLabel,
                        masterStatus,
                        subStatus: null
                    };
                }
            }
        } catch (error) {
            console.warn('📊 [ShipmentTimeline] Error formatting status display:', error);
        }

        // Fallback to raw status
        return { displayText: rawStatus, masterStatus: null, subStatus: null };
    };

    if (!events || events.length === 0) {
        return (
            <Paper elevation={0} sx={{ mt: 3, p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>No tracking history available yet.</Typography>
            </Paper>
        );
    }

    // Ensure events are sorted by timestamp, latest first
    const sortedEvents = [...events].sort((a, b) => {
        const getDateFromTimestamp = (timestamp) => {
            if (!timestamp) return new Date(0);

            try {
                // Handle serverTimestamp placeholders
                if (timestamp._methodName === 'serverTimestamp') {
                    return new Date(); // Use current date for pending timestamps
                }

                // Handle Firestore Timestamp
                if (timestamp && typeof timestamp === 'object' && timestamp.toDate && typeof timestamp.toDate === 'function') {
                    try {
                        return timestamp.toDate();
                    } catch (error) {
                        console.warn('Error calling toDate() during sorting:', error, timestamp);
                        return new Date(0);
                    }
                }
                // Handle timestamp objects with seconds and nanoseconds
                if (timestamp && typeof timestamp === 'object' && typeof timestamp.seconds === 'number') {
                    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
                }
                // Handle numeric timestamps
                if (typeof timestamp === 'number') {
                    const date = new Date(timestamp);
                    return isNaN(date.getTime()) ? new Date(0) : date;
                }
                // Handle Date objects
                if (timestamp instanceof Date) {
                    return isNaN(timestamp.getTime()) ? new Date(0) : timestamp;
                }
                // Handle string timestamps
                if (typeof timestamp === 'string') {
                    const date = new Date(timestamp);
                    return isNaN(date.getTime()) ? new Date(0) : date;
                }

                // Unknown format
                console.warn('Unknown timestamp format during sorting:', typeof timestamp, timestamp);
                return new Date(0);
            } catch (error) {
                console.warn('Error parsing timestamp for sorting:', timestamp, error);
                return new Date(0);
            }
        };

        const dateA = getDateFromTimestamp(a.timestamp);
        const dateB = getDateFromTimestamp(b.timestamp);
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
                                bgcolor: getStatusColor(event.status || event.title, event.eventType),
                                '& .MuiSvgIcon-root': {
                                    color: 'white !important'
                                }
                            }}
                        >
                            {getStatusIcon(event.status || event.title, event.eventType)}
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
                            {(() => {
                                const statusDisplay = formatStatusDisplay(event);
                                return (
                                    <Box sx={{ mb: 0.5 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '12px', mb: 0.5 }}>
                                            {statusDisplay.displayText}
                                        </Typography>
                                        {statusDisplay.subStatus && (
                                            <Chip
                                                label={statusDisplay.subStatus.statusLabel}
                                                size="small"
                                                sx={{
                                                    fontSize: '10px',
                                                    height: '20px',
                                                    backgroundColor: statusDisplay.masterStatus?.color || '#6b7280',
                                                    color: statusDisplay.masterStatus?.fontColor || '#ffffff',
                                                    '& .MuiChip-label': {
                                                        px: 1,
                                                        fontSize: '10px'
                                                    }
                                                }}
                                            />
                                        )}
                                    </Box>
                                );
                            })()}
                            {(event.location && (typeof event.location === 'string' || event.location.city || event.location.state || event.location.postalCode)) && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '12px' }}>
                                    {typeof event.location === 'string'
                                        ? event.location
                                        : [
                                            event.location.city,
                                            event.location.state,
                                            event.location.postalCode
                                        ].filter(Boolean).join(', ')}
                                </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '12px' }}>
                                {formatTimestamp(event.timestamp)}
                            </Typography>
                            {event.description && (
                                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line', fontSize: '12px' }}>
                                    {event.description}
                                </Typography>
                            )}
                            {event.userData && (event.userData.userEmail || event.userData.email) && (
                                <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '12px' }}>
                                        {`User: ${event.userData.userName || event.userData.userEmail || event.userData.email}`}
                                    </Typography>
                                </Box>
                            )}
                            {event.source && (
                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontSize: '12px' }}>
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