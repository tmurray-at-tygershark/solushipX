// Bulk Processing Summary Component
// Displays results and metrics for bulk document processing

import React from 'react';
import {
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    Box,
    Chip,
    LinearProgress,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Alert
} from '@mui/material';
import {
    Description as DescriptionIcon,
    Business as BusinessIcon,
    Assessment as AssessmentIcon,
    Speed as SpeedIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Info as InfoIcon
} from '@mui/icons-material';

const BulkProcessingSummary = ({ bulkResults, isProcessing = false }) => {
    if (!bulkResults && !isProcessing) {
        return null;
    }

    // Processing in progress
    if (isProcessing) {
        return (
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                    🏭 Bulk Processing in Progress
                </Typography>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Analyzing large document for optimal processing strategy...
                </Typography>
            </Paper>
        );
    }

    const { bulkProcessing, shipments = [], carrier, confidence } = bulkResults;
    const totalShipments = shipments.length;

    // Strategy descriptions
    const strategyDescriptions = {
        'small': {
            name: 'Small Document',
            description: 'Full multi-modal analysis with AI vision',
            icon: '📄',
            color: '#10b981'
        },
        'medium': {
            name: 'Medium Document',
            description: 'Header analysis + optimized batch processing',
            icon: '📋',
            color: '#3b82f6'
        },
        'large': {
            name: 'Large Bulk',
            description: 'Smart sampling + parallel processing',
            icon: '📊',
            color: '#f59e0b'
        },
        'massive': {
            name: 'Massive Bulk',
            description: 'Streaming + intelligent chunking',
            icon: '🏭',
            color: '#ef4444'
        }
    };

    const strategy = strategyDescriptions[bulkProcessing?.strategy] || strategyDescriptions['medium'];

    return (
        <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                🏭 Bulk Processing Results
            </Typography>

            <Grid container spacing={3}>
                {/* Strategy Overview */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%', border: '1px solid #e5e7eb' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ fontSize: '24px', mr: 2 }}>{strategy.icon}</Box>
                                <Box>
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                        {strategy.name} Strategy
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        {strategy.description}
                                    </Typography>
                                </Box>
                            </Box>

                            <List dense>
                                <ListItem sx={{ pl: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <DescriptionIcon sx={{ fontSize: 16, color: strategy.color }} />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`${totalShipments} shipments processed`}
                                        primaryTypographyProps={{ fontSize: '12px' }}
                                    />
                                </ListItem>
                                <ListItem sx={{ pl: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <BusinessIcon sx={{ fontSize: 16, color: strategy.color }} />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Carrier: ${carrier?.name || 'Unknown'}`}
                                        primaryTypographyProps={{ fontSize: '12px' }}
                                    />
                                </ListItem>
                                <ListItem sx={{ pl: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <AssessmentIcon sx={{ fontSize: 16, color: strategy.color }} />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Confidence: ${Math.round((confidence || 0.8) * 100)}%`}
                                        primaryTypographyProps={{ fontSize: '12px' }}
                                    />
                                </ListItem>
                                <ListItem sx={{ pl: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <SpeedIcon sx={{ fontSize: 16, color: strategy.color }} />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Processing time: ${bulkProcessing?.processingTime || 'Unknown'}`}
                                        primaryTypographyProps={{ fontSize: '12px' }}
                                    />
                                </ListItem>
                            </List>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Document Analysis */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%', border: '1px solid #e5e7eb' }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                📋 Document Analysis
                            </Typography>

                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                    Document Type
                                </Typography>
                                <Chip
                                    label={bulkProcessing?.documentType || 'Unknown'}
                                    size="small"
                                    sx={{
                                        fontSize: '11px',
                                        backgroundColor: strategy.color,
                                        color: 'white',
                                        fontWeight: 500
                                    }}
                                />
                            </Box>

                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                    Processing Optimizations
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {bulkProcessing?.optimizations?.useMultiModal && (
                                        <Chip label="Multi-Modal AI" size="small" sx={{ fontSize: '10px' }} />
                                    )}
                                    {bulkProcessing?.optimizations?.parallelProcessing && (
                                        <Chip label="Parallel Processing" size="small" sx={{ fontSize: '10px' }} />
                                    )}
                                    {bulkProcessing?.optimizations?.batchSize && (
                                        <Chip
                                            label={`Batch Size: ${bulkProcessing.optimizations.batchSize}`}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    )}
                                </Box>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Box>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                    Estimated Shipments
                                </Typography>
                                <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 700, color: strategy.color }}>
                                    {bulkProcessing?.estimatedShipments || totalShipments}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Processing Capabilities */}
                <Grid item xs={12}>
                    <Alert
                        severity="info"
                        icon={<InfoIcon />}
                        sx={{
                            fontSize: '12px',
                            '& .MuiAlert-message': { fontSize: '12px' }
                        }}
                    >
                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                            Intelligent Bulk Processing
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '11px', mb: 1 }}>
                            • <strong>Intelligent Strategy Selection:</strong> Automatic processing optimization based on document size and complexity
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '11px', mb: 1 }}>
                            • <strong>Scalable Processing:</strong> Handles documents from single invoices to massive manifests with 1000+ shipments
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '11px', mb: 1 }}>
                            • <strong>Smart Sampling:</strong> Uses AI to learn patterns from sample data and apply to bulk processing
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '11px' }}>
                            • <strong>Real-time Progress:</strong> Live updates and batch processing with quality checkpoints
                        </Typography>
                    </Alert>
                </Grid>

                {/* Shipment Matching Results */}
                {totalShipments > 0 && (
                    <Grid item xs={12}>
                        <Card sx={{ border: '1px solid #e5e7eb' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                    📊 Shipment Matching Progress
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <CheckCircleIcon sx={{ color: '#10b981', mr: 1, fontSize: 16 }} />
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        Ready for batch shipment matching - {totalShipments} shipments queued
                                    </Typography>
                                </Box>

                                <Alert
                                    severity="warning"
                                    icon={<WarningIcon />}
                                    sx={{
                                        fontSize: '12px',
                                        '& .MuiAlert-message': { fontSize: '12px' }
                                    }}
                                >
                                    Bulk matching will process shipments in batches of 25 to prevent system overload.
                                    This may take several minutes for large documents.
                                </Alert>
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        </Paper>
    );
};

export default BulkProcessingSummary; 