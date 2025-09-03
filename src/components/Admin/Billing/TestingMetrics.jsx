import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    LinearProgress,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    TrendingUp as TrendingIcon,
    Assessment as MetricsIcon,
    Speed as PerformanceIcon,
    Timeline as HistoryIcon,
    CheckCircle as SuccessIcon,
    Warning as WarningIcon,
    Error as ErrorIcon
} from '@mui/icons-material';

export default function TestingMetrics({ carrierId, testingHistory = [], isLoading = false }) {
    const [metrics, setMetrics] = useState({
        totalTests: 0,
        averageAccuracy: 0,
        averageConfidence: 0,
        accuracyTrend: 'stable',
        fieldAccuracy: {},
        qualityDistribution: {},
        recentPerformance: []
    });

    useEffect(() => {
        if (testingHistory.length > 0) {
            calculateMetrics();
        }
    }, [testingHistory]);

    const calculateMetrics = () => {
        const totalTests = testingHistory.length;

        // Calculate averages
        const accuracySum = testingHistory.reduce((sum, test) =>
            sum + (test.accuracyMetrics?.overall || 0), 0);
        const confidenceSum = testingHistory.reduce((sum, test) =>
            sum + (test.accuracyMetrics?.confidence || 0), 0);

        const averageAccuracy = totalTests > 0 ? accuracySum / totalTests : 0;
        const averageConfidence = totalTests > 0 ? confidenceSum / totalTests : 0;

        // Calculate field accuracy averages
        const fieldAccuracy = {};
        const fields = ['carrier', 'invoiceNumber', 'totalAmount', 'shipmentIds'];

        fields.forEach(field => {
            const fieldSum = testingHistory.reduce((sum, test) =>
                sum + (test.accuracyMetrics?.fieldAccuracy?.[field] || 0), 0);
            fieldAccuracy[field] = totalTests > 0 ? fieldSum / totalTests : 0;
        });

        // Calculate quality distribution
        const qualityDistribution = testingHistory.reduce((dist, test) => {
            const quality = test.accuracyMetrics?.extractionQuality || 'medium';
            dist[quality] = (dist[quality] || 0) + 1;
            return dist;
        }, {});

        // Calculate trend (simple: compare recent half vs older half)
        let accuracyTrend = 'stable';
        if (totalTests >= 4) {
            const midPoint = Math.floor(totalTests / 2);
            const recentTests = testingHistory.slice(0, midPoint);
            const olderTests = testingHistory.slice(midPoint);

            const recentAvg = recentTests.reduce((sum, test) =>
                sum + (test.accuracyMetrics?.overall || 0), 0) / recentTests.length;
            const olderAvg = olderTests.reduce((sum, test) =>
                sum + (test.accuracyMetrics?.overall || 0), 0) / olderTests.length;

            if (recentAvg > olderAvg + 0.05) accuracyTrend = 'improving';
            else if (recentAvg < olderAvg - 0.05) accuracyTrend = 'declining';
        }

        // Recent performance (last 5 tests)
        const recentPerformance = testingHistory.slice(0, 5).map(test => ({
            fileName: test.fileName,
            accuracy: test.accuracyMetrics?.overall || 0,
            confidence: test.accuracyMetrics?.confidence || 0,
            quality: test.accuracyMetrics?.extractionQuality || 'medium',
            timestamp: test.timestamps?.processed
        }));

        setMetrics({
            totalTests,
            averageAccuracy,
            averageConfidence,
            accuracyTrend,
            fieldAccuracy,
            qualityDistribution,
            recentPerformance
        });
    };

    const getAccuracyColor = (accuracy) => {
        if (accuracy >= 0.9) return 'success';
        if (accuracy >= 0.7) return 'warning';
        return 'error';
    };

    const getTrendColor = (trend) => {
        if (trend === 'improving') return '#10b981';
        if (trend === 'declining') return '#ef4444';
        return '#6b7280';
    };

    const getTrendIcon = (trend) => {
        if (trend === 'improving') return '📈';
        if (trend === 'declining') return '📉';
        return '📊';
    };

    const formatPercentage = (value) => `${Math.round(value * 100)}%`;

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!carrierId) {
        return (
            <Alert severity="info" sx={{ fontSize: '12px' }}>
                Select a carrier to view testing metrics
            </Alert>
        );
    }

    if (testingHistory.length === 0) {
        return (
            <Alert severity="info" sx={{ fontSize: '12px' }}>
                No testing data available. Run some tests to see metrics here.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Overall Performance Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <MetricsIcon sx={{ fontSize: 40, color: '#3b82f6', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600 }}>
                                {metrics.totalTests}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Total Tests Run
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <TrendingIcon sx={{ fontSize: 40, color: '#10b981', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600 }}>
                                {formatPercentage(metrics.averageAccuracy)}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                Average Accuracy
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <span style={{ fontSize: '12px' }}>{getTrendIcon(metrics.accuracyTrend)}</span>
                                <Typography sx={{ fontSize: '11px', color: getTrendColor(metrics.accuracyTrend) }}>
                                    {metrics.accuracyTrend}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <PerformanceIcon sx={{ fontSize: 40, color: '#f59e0b', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600 }}>
                                {formatPercentage(metrics.averageConfidence)}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Average Confidence
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={metrics.averageConfidence * 100}
                                sx={{ mt: 1, height: 4, borderRadius: 2 }}
                            />
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <HistoryIcon sx={{ fontSize: 40, color: '#8b5cf6', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600 }}>
                                {metrics.recentPerformance.length}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Recent Tests
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#9ca3af', mt: 1 }}>
                                Last 5 results
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Field Accuracy Breakdown */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                            Field Accuracy Breakdown
                        </Typography>

                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography sx={{ fontSize: '12px' }}>Carrier</Typography>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    {formatPercentage(metrics.fieldAccuracy.carrier || 0)}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(metrics.fieldAccuracy.carrier || 0) * 100}
                                color={getAccuracyColor(metrics.fieldAccuracy.carrier || 0)}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography sx={{ fontSize: '12px' }}>Invoice Number</Typography>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    {formatPercentage(metrics.fieldAccuracy.invoiceNumber || 0)}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(metrics.fieldAccuracy.invoiceNumber || 0) * 100}
                                color={getAccuracyColor(metrics.fieldAccuracy.invoiceNumber || 0)}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography sx={{ fontSize: '12px' }}>Total Amount</Typography>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    {formatPercentage(metrics.fieldAccuracy.totalAmount || 0)}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(metrics.fieldAccuracy.totalAmount || 0) * 100}
                                color={getAccuracyColor(metrics.fieldAccuracy.totalAmount || 0)}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>

                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography sx={{ fontSize: '12px' }}>Shipment IDs</Typography>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    {formatPercentage(metrics.fieldAccuracy.shipmentIds || 0)}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(metrics.fieldAccuracy.shipmentIds || 0) * 100}
                                color={getAccuracyColor(metrics.fieldAccuracy.shipmentIds || 0)}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* Quality Distribution */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                            Quality Distribution
                        </Typography>

                        {Object.entries(metrics.qualityDistribution).map(([quality, count]) => (
                            <Box key={quality} sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontSize: '12px', textTransform: 'capitalize' }}>
                                            {quality} Quality
                                        </Typography>
                                        <Chip
                                            label={quality}
                                            size="small"
                                            color={quality === 'high' ? 'success' : quality === 'medium' ? 'warning' : 'error'}
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </Box>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                        {count} tests ({Math.round((count / metrics.totalTests) * 100)}%)
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={(count / metrics.totalTests) * 100}
                                    color={quality === 'high' ? 'success' : quality === 'medium' ? 'warning' : 'error'}
                                    sx={{ height: 6, borderRadius: 3 }}
                                />
                            </Box>
                        ))}
                    </Paper>
                </Grid>

                {/* Recent Performance */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                            Recent Performance
                        </Typography>

                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>File Name</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Accuracy</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Confidence</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Quality</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Date</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {metrics.recentPerformance.map((test, index) => (
                                        <TableRow key={index}>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {test.fileName}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {formatPercentage(test.accuracy)}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {formatPercentage(test.confidence)}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={test.quality}
                                                    size="small"
                                                    color={test.quality === 'high' ? 'success' : test.quality === 'medium' ? 'warning' : 'error'}
                                                    sx={{ fontSize: '10px' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {test.accuracy >= 0.8 ? (
                                                    <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                ) : test.accuracy >= 0.6 ? (
                                                    <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                                                ) : (
                                                    <ErrorIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {test.timestamp ? new Date(test.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
