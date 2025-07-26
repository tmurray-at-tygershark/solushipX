import React from 'react';
import { Paper, Box, Typography, Grid, Button } from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

const ShipmentSummary = ({ shipment }) => {
    const { userRole } = useAuth();
    const isAdminView = userRole === 'admin' || userRole === 'superadmin';

    // Hide the entire component in admin view
    if (isAdminView) {
        return null;
    }
    return (
        <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Shipment Summary</Typography>
                </Box>
            </Box>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Shipment ID</Typography>
                    <Link
                        to={`/tracking/${encodeURIComponent(shipment?.shipmentID || 'N/A')}`}
                        style={{ textDecoration: 'none' }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: 600,
                                color: 'primary.main',
                                cursor: 'pointer',
                                '&:hover': {
                                    textDecoration: 'underline',
                                    color: 'primary.dark'
                                }
                            }}
                        >
                            {shipment?.shipmentID || 'N/A'}
                        </Typography>
                    </Link>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Company ID</Typography>
                    <Typography variant="body2">{shipment?.companyID || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Customer ID</Typography>
                    <Typography variant="body2">{shipment?.shipTo?.customerID || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Created At</Typography>
                    <Typography variant="body2">
                        {shipment?.createdAt?.toDate ?
                            shipment.createdAt.toDate().toLocaleString() :
                            (shipment?.createdAt ? new Date(shipment.createdAt).toLocaleString() : 'N/A')
                        }
                    </Typography>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ShipmentSummary; 