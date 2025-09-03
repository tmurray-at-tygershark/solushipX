import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    LinearProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    CheckCircle as SuccessIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    TrendingUp as AccuracyIcon,
    Speed as ConfidenceIcon,
    Assignment as ExtractedIcon,
    Visibility as ViewIcon,
    Download as DownloadIcon,
    Lightbulb as RecommendationIcon,
    ExpandMore as ExpandMoreIcon,
    Compare as CompareIcon
} from '@mui/icons-material';

export default function TestResultsComparison({ testResults, expectedResults = null }) {
    const [expandedAccordion, setExpandedAccordion] = useState('overview');

    if (!testResults) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                    No test results available
                </Typography>
            </Box>
        );
    }

    const { aiResults, accuracyMetrics, recommendations, metadata } = testResults;
    const extractedData = aiResults?.enhancedResults?.extractedData || aiResults?.extractedData || {};

    const getAccuracyColor = (accuracy) => {
        if (accuracy >= 0.9) return 'success';
        if (accuracy >= 0.7) return 'warning';
        return 'error';
    };

    const getQualityColor = (quality) => {
        if (quality === 'high') return 'success';
        if (quality === 'medium') return 'warning';
        return 'error';
    };

    const getPriorityColor = (priority) => {
        if (priority === 'high') return 'error';
        if (priority === 'medium') return 'warning';
        return 'info';
    };

    const formatAccuracy = (accuracy) => {
        return `${Math.round((accuracy || 0) * 100)}%`;
    };

    const renderOverview = () => (
        <Grid container spacing={3}>
            {/* Overall Metrics */}
            <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <AccuracyIcon sx={{ fontSize: 40, color: '#3b82f6', mb: 1 }} />
                        <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600, color: '#111827' }}>
                            {formatAccuracy(accuracyMetrics?.overall)}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Overall Accuracy
                        </Typography>
                        <Chip
                            label={accuracyMetrics?.extractionQuality || 'Medium'}
                            size="small"
                            color={getQualityColor(accuracyMetrics?.extractionQuality)}
                            sx={{ mt: 1, fontSize: '10px' }}
                        />
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <ConfidenceIcon sx={{ fontSize: 40, color: '#10b981', mb: 1 }} />
                        <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600, color: '#111827' }}>
                            {formatAccuracy(accuracyMetrics?.confidence)}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            AI Confidence
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={(accuracyMetrics?.confidence || 0) * 100}
                            sx={{ mt: 1, height: 4, borderRadius: 2 }}
                        />
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <ExtractedIcon sx={{ fontSize: 40, color: '#f59e0b', mb: 1 }} />
                        <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 600, color: '#111827' }}>
                            {formatAccuracy(accuracyMetrics?.completeness || 0.8)}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Data Completeness
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: '#9ca3af', mt: 1 }}>
                            Fields Extracted
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            {/* Test Information */}
            <Grid item xs={12}>
                <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Test Information
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>File Name</Typography>
                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                {testResults.fileName}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>Test Type</Typography>
                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                {testResults.testType === 'accuracy_test' ? 'Accuracy Test' : 'Quality Test'}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>Model Version</Typography>
                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                {metadata?.modelVersion || 'v1.0'}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>Processing Time</Typography>
                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                {new Date(metadata?.processingTime || Date.now()).toLocaleTimeString()}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            </Grid>
        </Grid>
    );

    const renderFieldComparison = () => (
        <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
            <Table>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Field</TableCell>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>AI Extracted</TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Expected</TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Accuracy</TableCell>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {/* Carrier */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Carrier</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.carrierInformation?.company || 'Not detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {expectedResults.carrier || 'Not provided'}
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.carrier || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.carrier || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>

                    {/* Invoice Number */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Invoice Number</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.invoiceDetails?.invoiceNumber || 'Not detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {expectedResults.invoiceNumber || 'Not provided'}
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.invoiceNumber || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.invoiceNumber || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>

                    {/* Total Amount */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Total Amount</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.totalAmount?.amount ? `$${extractedData.totalAmount.amount.toFixed(2)} ${extractedData.totalAmount.currency || ''}` : 'Not detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {expectedResults.totalAmount !== null && expectedResults.totalAmount !== undefined
                                    ? `$${parseFloat(expectedResults.totalAmount).toFixed(2)}`
                                    : 'Not provided'}
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.totalAmount || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.totalAmount || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>

                    {/* Shipment ID (using billOfLading field for data) */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Shipment ID</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.invoiceDetails?.billOfLading || 'None detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {Array.isArray(expectedResults.shipmentIds)
                                    ? expectedResults.shipmentIds.join(', ') || 'None provided'
                                    : 'None provided'
                                }
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.billOfLading || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.billOfLading || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>

                    {/* Invoice Terms */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Invoice Terms</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.invoiceDetails?.invoiceDate || 'Not detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {expectedResults.invoiceTerms || 'Not provided'}
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.invoiceTerms || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.invoiceTerms || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>

                    {/* Shipper (Ship From) */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Shipper (Ship From)</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.shipper?.company ?
                                `${extractedData.shipper.company}${extractedData.shipper.address ? `, ${extractedData.shipper.address}` : ''}`
                                : 'Not detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {expectedResults.shipper || 'Not provided'}
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.shipper || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.shipper || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>

                    {/* Consignee (Ship To) */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Consignee (Ship To)</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.consignee?.company ?
                                `${extractedData.consignee.company}${extractedData.consignee.address ? `, ${extractedData.consignee.address}` : ''}`
                                : 'Not detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {expectedResults.consignee || 'Not provided'}
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.consignee || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.consignee || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>

                    {/* Weight & Dimensions */}
                    <TableRow>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Weight & Dimensions</TableCell>
                        <TableCell sx={{ fontSize: '12px' }}>
                            {extractedData.packageDetails && extractedData.packageDetails.length > 0 ?
                                extractedData.packageDetails.map((pkg, index) =>
                                    `${pkg.quantity || 1}x ${pkg.description || 'Package'}: ${pkg.weight || 'No weight'}, ${pkg.dimensions || 'No dimensions'}`
                                ).join('; ')
                                : 'Not detected'}
                        </TableCell>
                        {expectedResults && (
                            <TableCell sx={{ fontSize: '12px' }}>
                                {expectedResults.weightDimensions || 'Not provided'}
                            </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '12px' }}>
                            {formatAccuracy(accuracyMetrics?.fieldAccuracy?.weightDimensions || 0)}
                        </TableCell>
                        <TableCell>
                            {(accuracyMetrics?.fieldAccuracy?.weightDimensions || 0) >= 0.8 ? (
                                <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />
                            ) : (
                                <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />
                            )}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>
    );

    const renderLineItems = () => (
        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                Extracted Line Items
            </Typography>

            {extractedData.charges && extractedData.charges.length > 0 ? (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Description</TableCell>
                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Amount</TableCell>
                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Rate</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {extractedData.charges.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {item.description || 'No description'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {item.amount ? `$${item.amount.toFixed(2)}` : 'No amount'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={item.rate || 'N/A'}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <Alert severity="info" sx={{ fontSize: '12px' }}>
                    No line items detected in this invoice
                </Alert>
            )}
        </Paper>
    );

    const renderRecommendations = () => (
        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                Training Recommendations
            </Typography>

            {recommendations && recommendations.length > 0 ? (
                <List sx={{ p: 0 }}>
                    {recommendations.map((rec, index) => (
                        <ListItem key={index} sx={{ px: 0, py: 1, alignItems: 'flex-start' }}>
                            <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                                <RecommendationIcon
                                    sx={{
                                        fontSize: 16,
                                        color: getPriorityColor(rec.priority) === 'error' ? '#ef4444' :
                                            getPriorityColor(rec.priority) === 'warning' ? '#f59e0b' : '#3b82f6'
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            {rec.title}
                                        </Typography>
                                        <Chip
                                            label={rec.priority}
                                            size="small"
                                            color={getPriorityColor(rec.priority)}
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </Box>
                                }
                                secondary={
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                            {rec.description}
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                            Action: {rec.action}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            ) : (
                <Alert severity="success" sx={{ fontSize: '12px' }}>
                    No specific recommendations - training performance looks good!
                </Alert>
            )}
        </Paper>
    );

    return (
        <Box sx={{ p: 3 }}>
            {/* Accordion Layout */}
            <Accordion
                expanded={expandedAccordion === 'overview'}
                onChange={() => setExpandedAccordion(expandedAccordion === 'overview' ? '' : 'overview')}
                sx={{ mb: 2 }}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                        Test Overview & Metrics
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {renderOverview()}
                </AccordionDetails>
            </Accordion>

            <Accordion
                expanded={expandedAccordion === 'comparison'}
                onChange={() => setExpandedAccordion(expandedAccordion === 'comparison' ? '' : 'comparison')}
                sx={{ mb: 2 }}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                        Field-by-Field Comparison
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {renderFieldComparison()}
                </AccordionDetails>
            </Accordion>

            <Accordion
                expanded={expandedAccordion === 'lineItems'}
                onChange={() => setExpandedAccordion(expandedAccordion === 'lineItems' ? '' : 'lineItems')}
                sx={{ mb: 2 }}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                        Extracted Line Items
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {renderLineItems()}
                </AccordionDetails>
            </Accordion>

            <Accordion
                expanded={expandedAccordion === 'recommendations'}
                onChange={() => setExpandedAccordion(expandedAccordion === 'recommendations' ? '' : 'recommendations')}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                        Training Recommendations
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {renderRecommendations()}
                </AccordionDetails>
            </Accordion>
        </Box>
    );
}
