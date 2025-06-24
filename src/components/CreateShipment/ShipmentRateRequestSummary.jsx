import React from 'react';
import { Card, CardContent, Typography, Grid, Divider, Box, Chip } from '@mui/material';

const ShipmentRateRequestSummary = ({ origin, destination, shipmentDetails, packages }) => {
    // Calculate totals
    const totalPackages = packages?.reduce((sum, pkg) => sum + (Number(pkg.packagingQuantity) || 1), 0) || 0;
    const totalWeight = packages?.reduce((sum, pkg) => sum + ((Number(pkg.weight) || 0) * (Number(pkg.packagingQuantity) || 1)), 0) || 0;
    const totalValue = packages?.reduce((sum, pkg) => sum + (Number(pkg.declaredValue) || 0), 0) || 0;

    const formatAddress = (address) => {
        if (!address) return 'N/A';
        const parts = [
            address.street,
            address.street2,
            `${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim(),
            address.country
        ].filter(Boolean);
        return parts;
    };

    const originParts = formatAddress(origin);
    const destinationParts = formatAddress(destination);

    return (
        <Card
            elevation={2}
            sx={{
                mb: 2,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                border: '1px solid #e2e8f0'
            }}
        >
            <CardContent sx={{ p: 2 }}>
                {/* Header */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '14px' }}>
                        Shipment Summary
                    </Typography>
                </Box>

                {/* Origin & Destination Section */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.primary', fontSize: '12px' }}>
                        Route
                    </Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Box sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: 'rgba(16, 185, 129, 0.05)',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'success.dark', fontSize: '11px', mb: 1 }}>
                                    ORIGIN
                                </Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, fontSize: '12px' }}>
                                    {origin?.company || origin?.name || 'N/A'}
                                </Typography>
                                {originParts.map((part, index) => (
                                    <Typography
                                        key={index}
                                        variant="body2"
                                        sx={{
                                            color: 'text.secondary',
                                            fontSize: '12px',
                                            lineHeight: 1.4
                                        }}
                                    >
                                        {part}
                                    </Typography>
                                ))}
                                {origin?.postalCode && (
                                    <Chip
                                        label={origin.postalCode}
                                        size="small"
                                        sx={{
                                            mt: 1,
                                            bgcolor: 'success.main',
                                            color: 'white',
                                            fontWeight: 600,
                                            fontSize: '11px'
                                        }}
                                    />
                                )}
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: 'rgba(59, 130, 246, 0.05)',
                                border: '1px solid rgba(59, 130, 246, 0.2)'
                            }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.dark', fontSize: '11px', mb: 1 }}>
                                    DESTINATION
                                </Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, fontSize: '12px' }}>
                                    {destination?.company || destination?.name || 'N/A'}
                                </Typography>
                                {destinationParts.map((part, index) => (
                                    <Typography
                                        key={index}
                                        variant="body2"
                                        sx={{
                                            color: 'text.secondary',
                                            fontSize: '12px',
                                            lineHeight: 1.4
                                        }}
                                    >
                                        {part}
                                    </Typography>
                                ))}
                                {destination?.postalCode && (
                                    <Chip
                                        label={destination.postalCode}
                                        size="small"
                                        sx={{
                                            mt: 1,
                                            bgcolor: 'primary.main',
                                            color: 'white',
                                            fontWeight: 600,
                                            fontSize: '11px'
                                        }}
                                    />
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(0,0,0,0.08)' }} />

                {/* Shipment Details Section */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.primary', fontSize: '12px' }}>
                        Shipment Details
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={6} sm={4}>
                            <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '10px' }}>
                                    SHIP DATE
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px', mt: 0.5 }}>
                                    {shipmentDetails?.shipmentDate || 'N/A'}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={4}>
                            <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '10px' }}>
                                    TYPE
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px', mt: 0.5, textTransform: 'capitalize' }}>
                                    {shipmentDetails?.shipmentType?.toLowerCase() || 'N/A'}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '10px' }}>
                                    REFERENCE
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: '11px',
                                        mt: 0.5,
                                        wordBreak: 'break-all',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {shipmentDetails?.referenceNumber || 'N/A'}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </Box>

                {/* Packages Section */}
                {packages && packages.length > 0 && (
                    <Box>
                        <Divider sx={{ my: 2, borderColor: 'rgba(0,0,0,0.08)' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.primary', fontSize: '12px' }}>
                            Package Summary
                        </Typography>

                        {/* Package Totals */}
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={4}>
                                <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '14px' }}>
                                        {totalPackages}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '10px' }}>
                                        PACKAGES
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={4}>
                                <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '14px' }}>
                                        {totalWeight.toFixed(1)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '10px' }}>
                                        LBS TOTAL
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={4}>
                                <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '14px' }}>
                                        ${totalValue.toFixed(0)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '10px' }}>
                                        VALUE
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>

                        {/* Individual Package Details */}
                        {packages.map((pkg, index) => (
                            <Box
                                key={index}
                                sx={{
                                    mb: 1.5,
                                    p: 1.5,
                                    borderRadius: 2,
                                    bgcolor: 'rgba(0,0,0,0.02)',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}
                            >
                                <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, fontSize: '11px', display: 'block' }}>
                                    Package {index + 1}: {pkg.packagingQuantity || 1} x {pkg.itemDescription || 'Package'}
                                </Typography>
                                <Grid container spacing={1.5}>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '9px' }}>
                                            DIMENSIONS
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '11px' }}>
                                            {pkg.length || 0}" × {pkg.width || 0}" × {pkg.height || 0}"
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '9px' }}>
                                            WEIGHT
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '11px' }}>
                                            {pkg.weight || 0} lbs
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '9px' }}>
                                            CLASS
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '11px' }}>
                                            {pkg.freightClass || 'N/A'}
                                        </Typography>
                                    </Grid>
                                    {pkg.declaredValue > 0 && (
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '9px' }}>
                                                VALUE
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '11px' }}>
                                                ${pkg.declaredValue.toFixed(2)}
                                            </Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        ))}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

export default ShipmentRateRequestSummary; 