import React from 'react';
import {
    Box,
    Paper,
    Typography,
    LinearProgress,
    Chip,
    Grid,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    TrendingUp as ImprovementIcon,
    Psychology as AIIcon,
    CheckCircle as SuccessIcon,
    Warning as WarningIcon,
    Lightbulb as InsightIcon
} from '@mui/icons-material';

export default function TrainingMetrics({ metrics }) {
    if (!metrics) return null;

    const {
        correctionCount = 0,
        metrics: improvementMetrics = {},
        learningInsights = {},
        updatedConfidence = 0
    } = metrics;

    const confidencePercentage = Math.round(updatedConfidence * 100);
    const totalImprovements = Object.values(improvementMetrics).reduce((sum, count) => sum + count, 0);

    return (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <AIIcon sx={{ color: '#6366f1' }} />
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Training Metrics
                </Typography>
            </Box>

            {/* Overall Confidence */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                        Overall Confidence
                    </Typography>
                    <Chip
                        label={`${confidencePercentage}%`}
                        size="small"
                        color={confidencePercentage >= 80 ? 'success' : confidencePercentage >= 60 ? 'warning' : 'error'}
                        sx={{ fontWeight: 600 }}
                    />
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={confidencePercentage}
                    sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#e5e7eb',
                        '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            backgroundColor: confidencePercentage >= 80 ? '#10b981' :
                                confidencePercentage >= 60 ? '#f59e0b' : '#ef4444'
                        }
                    }}
                />
            </Box>

            {/* Improvement Summary */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#6366f1' }}>
                                {correctionCount}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Corrections Applied
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>
                                {totalImprovements}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Total Improvements
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Improvement Breakdown */}
            {Object.keys(improvementMetrics).length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                        Improvement Breakdown
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {improvementMetrics.confidenceImprovements > 0 && (
                            <Chip
                                icon={<ImprovementIcon sx={{ fontSize: '16px' }} />}
                                label={`${improvementMetrics.confidenceImprovements} Confidence`}
                                size="small"
                                variant="outlined"
                                color="primary"
                            />
                        )}
                        {improvementMetrics.newFieldsAdded > 0 && (
                            <Chip
                                icon={<SuccessIcon sx={{ fontSize: '16px' }} />}
                                label={`${improvementMetrics.newFieldsAdded} New Fields`}
                                size="small"
                                variant="outlined"
                                color="success"
                            />
                        )}
                        {improvementMetrics.incorrectFieldsRemoved > 0 && (
                            <Chip
                                icon={<WarningIcon sx={{ fontSize: '16px' }} />}
                                label={`${improvementMetrics.incorrectFieldsRemoved} Removed`}
                                size="small"
                                variant="outlined"
                                color="warning"
                            />
                        )}
                    </Box>
                </Box>
            )}

            {/* Learning Insights */}
            {learningInsights.recommendedImprovements && learningInsights.recommendedImprovements.length > 0 && (
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <InsightIcon sx={{ fontSize: '18px', color: '#f59e0b' }} />
                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                            AI Learning Insights
                        </Typography>
                    </Box>
                    <List dense>
                        {learningInsights.recommendedImprovements.map((insight, index) => (
                            <ListItem key={index} sx={{ pl: 0 }}>
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    <Box
                                        sx={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            backgroundColor: '#f59e0b'
                                        }}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primary={insight}
                                    primaryTypographyProps={{
                                        fontSize: '12px',
                                        color: '#374151'
                                    }}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

            {/* Most Common Corrections */}
            {learningInsights.mostCommonCorrections && Object.keys(learningInsights.mostCommonCorrections).length > 0 && (
                <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                        Common Correction Types
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {Object.entries(learningInsights.mostCommonCorrections).map(([type, count]) => (
                            <Chip
                                key={type}
                                label={`${type.replace(/_/g, ' ')}: ${count}`}
                                size="small"
                                sx={{
                                    fontSize: '10px',
                                    backgroundColor: '#f3f4f6',
                                    color: '#374151'
                                }}
                            />
                        ))}
                    </Box>
                </Box>
            )}
        </Paper>
    );
}
