import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    CircularProgress
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimelineIcon from '@mui/icons-material/Timeline';
import ShipmentTimeline from '../../Tracking/ShipmentTimeline';

const ShipmentHistory = ({
    mergedEvents = [],
    historyLoading = false
}) => {
    return (
        <Grid item xs={12} md={6}>
            <Paper sx={{ height: '100%' }} elevation={1}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon />
                        Shipment History
                    </Typography>
                </Box>
                <Box sx={{
                    p: 2,
                    height: '600px',
                    overflowY: 'auto',
                    '&::-webkit-scrollbar': {
                        width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: '#f1f1f1',
                        borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: '#888',
                        borderRadius: '4px',
                        '&:hover': {
                            background: '#555',
                        },
                    },
                }}>
                    {historyLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : mergedEvents.length === 0 ? (
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 4,
                            textAlign: 'center'
                        }}>
                            <TimelineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No History Available
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Tracking and event information will appear here as they become available.
                            </Typography>
                        </Box>
                    ) : (
                        <ShipmentTimeline events={mergedEvents} />
                    )}
                </Box>
            </Paper>
        </Grid>
    );
};

export default ShipmentHistory; 