import React from 'react';
import { Box, Paper, Skeleton, Grid } from '@mui/material';

const LoadingSkeleton = () => (
    <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
        <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header Skeleton */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width={300} height={40} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Skeleton width={100} height={40} />
                    <Skeleton width={100} height={40} />
                </Box>
            </Box>

            {/* Shipment Info Skeleton */}
            <Paper sx={{ mb: 3 }}>
                <Box sx={{ p: 2 }}>
                    <Skeleton width={200} height={32} />
                </Box>
                <Box sx={{ p: 3 }}>
                    <Grid container spacing={2}>
                        {[1, 2, 3].map((i) => (
                            <Grid item xs={12} md={4} key={i}>
                                <Box sx={{ display: 'grid', gap: 2 }}>
                                    <Skeleton width={150} height={24} />
                                    <Skeleton width={200} height={24} />
                                    <Skeleton width={180} height={24} />
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Paper>

            {/* Locations and Rate Details Skeleton */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ mb: 3 }}>
                        <Box sx={{ p: 2 }}>
                            <Skeleton width={200} height={32} />
                        </Box>
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                                {[1, 2].map((i) => (
                                    <Grid item xs={12} md={6} key={i}>
                                        <Skeleton width={150} height={32} />
                                        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} />
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Skeleton width={200} height={24} />
                                            <Skeleton width={180} height={24} />
                                            <Skeleton width={160} height={24} />
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper>
                        <Box sx={{ p: 2 }}>
                            <Skeleton width={150} height={32} />
                        </Box>
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton key={i} width={200} height={24} />
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    </Box>
);

export default LoadingSkeleton; 