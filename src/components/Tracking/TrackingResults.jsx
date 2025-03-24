import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Chip,
    Container
} from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import {
    LocalShipping as ShippingIcon,
    LocationOn as LocationIcon,
    CheckCircle as DeliveredIcon,
    Schedule as PendingIcon
} from '@mui/icons-material';

const TrackingResults = () => {
    const { trackingNumber } = useParams();

    // Mock tracking data - in a real app, this would come from an API
    const trackingData = {
        trackingNumber: trackingNumber,
        status: 'In Transit',
        estimatedDelivery: '2024-03-25',
        origin: 'New Berlin, WI',
        destination: 'Mississauga, ON',
        carrier: 'FedEx',
        service: 'Express',
        events: [
            {
                timestamp: '2024-03-23T14:30:00',
                location: 'Detroit, MI',
                status: 'In Transit',
                description: 'Arrived at sorting facility'
            },
            {
                timestamp: '2024-03-23T08:15:00',
                location: 'Milwaukee, WI',
                status: 'In Transit',
                description: 'Departed FedEx location'
            },
            {
                timestamp: '2024-03-22T16:45:00',
                location: 'New Berlin, WI',
                status: 'In Transit',
                description: 'Picked up by carrier'
            }
        ]
    };

    const getStatusIcon = (status) => {
        switch (status.toLowerCase()) {
            case 'delivered':
                return <DeliveredIcon />;
            case 'in transit':
                return <ShippingIcon />;
            case 'pending':
                return <PendingIcon />;
            default:
                return <LocationIcon />;
        }
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'delivered':
                return 'success';
            case 'in transit':
                return 'primary';
            case 'pending':
                return 'default';
            default:
                return 'default';
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa', py: 8 }}>
            <Container maxWidth="lg">
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#000000' }}>
                        Tracking Details
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem' }}>
                        Tracking Number: <span style={{ fontWeight: 500, color: '#2C6ECB' }}>{trackingData.trackingNumber}</span>
                    </Typography>
                    <Chip
                        label={trackingData.status}
                        color={getStatusColor(trackingData.status)}
                        sx={{
                            mt: 1,
                            fontWeight: 500,
                            '& .MuiChip-label': {
                                fontSize: '0.9rem'
                            }
                        }}
                    />
                </Box>

                {/* Overview */}
                <Paper sx={{ p: 3, mb: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3 }}>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                Estimated Delivery
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {new Date(trackingData.estimatedDelivery).toLocaleDateString()}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                Origin
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>{trackingData.origin}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                Destination
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>{trackingData.destination}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                Service
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>{trackingData.carrier} {trackingData.service}</Typography>
                        </Box>
                    </Box>
                </Paper>

                {/* Timeline */}
                <Paper sx={{ p: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#000000' }}>
                        Tracking History
                    </Typography>
                    <Timeline>
                        {trackingData.events.map((event, index) => (
                            <TimelineItem key={index}>
                                <TimelineSeparator>
                                    <TimelineDot color={index === 0 ? 'primary' : 'grey'}>
                                        {getStatusIcon(event.status)}
                                    </TimelineDot>
                                    {index < trackingData.events.length - 1 && <TimelineConnector />}
                                </TimelineSeparator>
                                <TimelineContent>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" component="span" sx={{ fontWeight: 500, color: '#2C6ECB' }}>
                                            {new Date(event.timestamp).toLocaleString()}
                                        </Typography>
                                        <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                                            {event.description}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                                            {event.location}
                                        </Typography>
                                    </Box>
                                </TimelineContent>
                            </TimelineItem>
                        ))}
                    </Timeline>
                </Paper>
            </Container>
        </Box>
    );
};

export default TrackingResults; 