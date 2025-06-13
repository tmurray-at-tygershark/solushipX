import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    CircularProgress
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import ShipmentTimeline from '../../Tracking/ShipmentTimeline';

const ShipmentHistory = ({
    mergedEvents = [],
    historyLoading = false
}) => {
    return (
        <Grid item xs={12}>
            <Paper sx={{ height: '100%' }} elevation={1}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '16px' }}>
                        Shipment History
                    </Typography>
                </Box>
                <Box sx={{
                    p: 2
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
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
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