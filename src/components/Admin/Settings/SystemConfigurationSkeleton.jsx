import React from 'react';
import {
    Box,
    Paper,
    Skeleton,
    Grid,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

const SystemConfigurationSkeleton = () => (
    <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
            borderBottom: '1px solid #e5e7eb',
            pb: 2
        }}>
            <Box>
                <Skeleton variant="text" width={280} height={32} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width={350} height={20} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton variant="circular" width={40} height={40} />
            </Box>
        </Box>

        {/* Configuration Sections Grid */}
        <Grid container spacing={3}>
            {/* Left Column */}
            <Grid item xs={12} md={6}>
                {/* Additional Services Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={160} height={24} />
                                <Skeleton variant="text" width={240} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>

                {/* Service Levels Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={140} height={24} />
                                <Skeleton variant="text" width={200} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>

                {/* Charge Types Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={120} height={24} />
                                <Skeleton variant="text" width={180} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>

                {/* Equipment Types Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={140} height={24} />
                                <Skeleton variant="text" width={200} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>
            </Grid>

            {/* Right Column */}
            <Grid item xs={12} md={6}>
                {/* Shipment Statuses Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={150} height={24} />
                                <Skeleton variant="text" width={220} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>

                {/* Invoice Statuses Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={130} height={24} />
                                <Skeleton variant="text" width={190} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>

                {/* Follow-Up Tasks Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={140} height={24} />
                                <Skeleton variant="text" width={210} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>

                {/* Notification Settings Skeleton */}
                <Accordion
                    expanded={false}
                    sx={{
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                            '& .MuiAccordionSummary-content': {
                                alignItems: 'center',
                                my: 1
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Skeleton variant="circular" width={24} height={24} />
                            <Box>
                                <Skeleton variant="text" width={160} height={24} />
                                <Skeleton variant="text" width={240} height={16} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                    </AccordionSummary>
                </Accordion>
            </Grid>
        </Grid>

        {/* Optional: Expanded Section Content Skeleton */}
        <Box sx={{ mt: 3 }}>
            <Paper sx={{
                border: '1px solid #e5e7eb',
                borderRadius: 2,
                overflow: 'hidden'
            }}>
                {/* Section Header */}
                <Box sx={{
                    p: 2,
                    bgcolor: '#f8fafc',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Skeleton variant="text" width={200} height={24} />
                    <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
                </Box>

                {/* Table Header */}
                <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
                    <Grid container spacing={2}>
                        <Grid item xs={3}>
                            <Skeleton variant="text" width={80} height={20} />
                        </Grid>
                        <Grid item xs={3}>
                            <Skeleton variant="text" width={100} height={20} />
                        </Grid>
                        <Grid item xs={4}>
                            <Skeleton variant="text" width={120} height={20} />
                        </Grid>
                        <Grid item xs={2}>
                            <Skeleton variant="text" width={60} height={20} />
                        </Grid>
                    </Grid>
                </Box>

                {/* Table Rows */}
                {[1, 2, 3].map((index) => (
                    <Box key={index} sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={3}>
                                <Skeleton variant="text" width={60} height={20} />
                            </Grid>
                            <Grid item xs={3}>
                                <Skeleton variant="text" width={90} height={20} />
                            </Grid>
                            <Grid item xs={4}>
                                <Skeleton variant="text" width={150} height={20} />
                            </Grid>
                            <Grid item xs={2}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Skeleton variant="circular" width={24} height={24} />
                                    <Skeleton variant="circular" width={24} height={24} />
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                ))}
            </Paper>
        </Box>
    </Box>
);

export default SystemConfigurationSkeleton;
