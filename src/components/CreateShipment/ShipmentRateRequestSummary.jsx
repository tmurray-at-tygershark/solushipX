import React from 'react';
import { Card, CardContent, Typography, Grid, Divider, Box } from '@mui/material';

const ShipmentRateRequestSummary = ({ origin, destination, shipmentDetails, packages }) => {
    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Fetching Rates For:
                </Typography>
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="overline" display="block">Origin</Typography>
                        <Typography variant="body2">
                            {origin?.company || origin?.name || 'N/A'}<br />
                            {origin?.street || ''} {origin?.street2 || ''}<br />
                            {origin?.city || ''}, {origin?.state || ''} {origin?.postalCode || ''}<br />
                            {origin?.country || ''}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="overline" display="block">Destination</Typography>
                        <Typography variant="body2">
                            {destination?.company || destination?.name || 'N/A'}<br />
                            {destination?.street || ''} {destination?.street2 || ''}<br />
                            {destination?.city || ''}, {destination?.state || ''} {destination?.postalCode || ''}<br />
                            {destination?.country || ''}
                        </Typography>
                    </Grid>
                </Grid>
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                    <Grid item xs={6} sm={3}>
                        <Typography variant="caption" display="block">Ship Date</Typography>
                        <Typography variant="body2">{shipmentDetails?.shipmentDate || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Typography variant="caption" display="block">Type</Typography>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {shipmentDetails?.shipmentType?.toLowerCase() || 'N/A'}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Typography variant="caption" display="block">Reference</Typography>
                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            {shipmentDetails?.referenceNumber || 'N/A'}
                        </Typography>
                    </Grid>
                </Grid>
                {packages && packages.length > 0 && (
                    <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="overline" display="block" sx={{ mb: 1 }}>
                            Packages
                        </Typography>
                        {packages.map((pkg, index) => (
                            <Box key={index} sx={{ mb: packages.length > 1 && index < packages.length - 1 ? 1.5 : 0 }}>
                                <Typography variant="body2" gutterBottom>
                                    {pkg.packagingQuantity || 1} x {pkg.itemDescription || 'Package'}
                                </Typography>
                                <Grid container spacing={{ xs: 1, sm: 2 }}>
                                    <Grid item xs={6} sm={4}>
                                        <Typography variant="caption" display="block">Dimensions (LxWxH)</Typography>
                                        <Typography variant="body2">
                                            {pkg.length || 0}" x {pkg.width || 0}" x {pkg.height || 0}"
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" display="block">Weight</Typography>
                                        <Typography variant="body2">{pkg.weight || 0} lbs</Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" display="block">Freight Class</Typography>
                                        <Typography variant="body2">{pkg.freightClass || 'N/A'}</Typography>
                                    </Grid>
                                    {pkg.declaredValue > 0 && (
                                        <Grid item xs={6} sm={2}>
                                            <Typography variant="caption" display="block">Value</Typography>
                                            <Typography variant="body2">${pkg.declaredValue.toFixed(2)}</Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        ))}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default ShipmentRateRequestSummary; 