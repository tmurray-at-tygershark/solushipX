import React, { useState, useCallback, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Chip,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    IconButton,
    Tooltip,
    Alert,
    LinearProgress,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    CheckCircle as ValidIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Visibility as PreviewIcon,
    AutoFixHigh as AutoFixIcon,
    Assessment as AnalyticsIcon
} from '@mui/icons-material';

export default function AdvancedValidationEngine({
    annotations,
    steps,
    onValidationUpdate,
    onAutoFix
}) {
    const [validationResults, setValidationResults] = useState({});
    const [overallScore, setOverallScore] = useState(0);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedValidation, setSelectedValidation] = useState(null);

    // Advanced validation rules
    const validateAdvanced = useCallback((stepId, annotation, step) => {
        const errors = [];
        const warnings = [];
        const suggestions = [];

        // Basic size validation
        if (step.validationRules) {
            const { minWidth, minHeight, maxAnnotations, expectedPatterns } = step.validationRules;

            if (annotation.width < minWidth) {
                errors.push(`Annotation too narrow (${annotation.width}px < ${minWidth}px)`);
            }
            if (annotation.height < minHeight) {
                errors.push(`Annotation too short (${annotation.height}px < ${minHeight}px)`);
            }

            // Pattern matching for text-based fields
            if (expectedPatterns && annotation.extractedText) {
                const matchesPattern = expectedPatterns.some(pattern =>
                    pattern.test(annotation.extractedText)
                );
                if (!matchesPattern) {
                    errors.push('Content doesn\'t match expected format');
                    suggestions.push('Consider re-selecting the area or check for typos');
                }
            }
        }

        // Advanced validation logic
        switch (stepId) {
            case 'carrier':
                if (annotation.width < 100) {
                    warnings.push('Carrier logo/name might be too small');
                }
                if (annotation.y > 200) {
                    warnings.push('Carrier info usually appears in the top section');
                }
                break;

            case 'invoice_number':
                if (!annotation.extractedText || annotation.extractedText.length < 3) {
                    errors.push('Invoice number seems too short');
                }
                if (annotation.extractedText && !/\d/.test(annotation.extractedText)) {
                    warnings.push('Invoice numbers typically contain digits');
                }
                break;

            case 'total':
                if (!annotation.extractedText || !annotation.extractedText.includes('$')) {
                    warnings.push('Total amount should include currency symbol');
                }
                if (annotation.extractedText && parseFloat(annotation.extractedText.replace(/[^0-9.-]/g, '')) < 1) {
                    warnings.push('Total amount seems unusually low');
                }
                break;

            case 'charges':
                if (annotation.width < 200) {
                    warnings.push('Charges table might be too narrow');
                }
                if (annotation.height < 50) {
                    warnings.push('Charges section might be too short');
                }
                break;

            default:
                break;
        }

        // Quality scoring
        let qualityScore = 100;
        qualityScore -= errors.length * 25;
        qualityScore -= warnings.length * 10;
        qualityScore = Math.max(0, qualityScore);

        return {
            errors,
            warnings,
            suggestions,
            qualityScore,
            valid: errors.length === 0
        };
    }, []);

    // Run validation for all annotations
    const runFullValidation = useCallback(() => {
        const results = {};
        let totalScore = 0;
        let stepCount = 0;

        Object.keys(annotations).forEach(stepId => {
            const step = steps.find(s => s.id === stepId);
            if (!step) return;

            const stepAnnotations = Array.isArray(annotations[stepId])
                ? annotations[stepId]
                : [annotations[stepId]];

            const stepResults = stepAnnotations.map(ann =>
                validateAdvanced(stepId, ann, step)
            );

            results[stepId] = {
                step,
                annotations: stepResults,
                overallScore: stepResults.reduce((sum, r) => sum + r.qualityScore, 0) / stepResults.length
            };

            totalScore += results[stepId].overallScore;
            stepCount++;
        });

        setValidationResults(results);
        setOverallScore(stepCount > 0 ? totalScore / stepCount : 0);

        if (onValidationUpdate) {
            onValidationUpdate(results, totalScore / stepCount);
        }
    }, [annotations, steps, validateAdvanced, onValidationUpdate]);

    // Auto-run validation when annotations change
    useEffect(() => {
        runFullValidation();
    }, [runFullValidation]);

    const getScoreColor = (score) => {
        if (score >= 90) return 'success';
        if (score >= 70) return 'warning';
        return 'error';
    };

    const handleAutoFix = useCallback(() => {
        if (onAutoFix) {
            onAutoFix(validationResults);
        }
    }, [validationResults, onAutoFix]);

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    Advanced Validation
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                        label={`${Math.round(overallScore)}%`}
                        color={getScoreColor(overallScore)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                    />
                    <Tooltip title="Auto-fix common issues">
                        <IconButton size="small" onClick={handleAutoFix}>
                            <AutoFixIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Overall Progress */}
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                        Validation Quality
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                        {Math.round(overallScore)}%
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={overallScore}
                    sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#e5e7eb',
                        '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            backgroundColor: overallScore >= 90 ? '#10b981' :
                                overallScore >= 70 ? '#f59e0b' : '#ef4444'
                        }
                    }}
                />
            </Box>

            {/* Step-by-step Results */}
            <List dense sx={{ p: 0 }}>
                {Object.entries(validationResults).map(([stepId, result]) => {
                    const totalErrors = result.annotations.reduce((sum, a) => sum + a.errors.length, 0);
                    const totalWarnings = result.annotations.reduce((sum, a) => sum + a.warnings.length, 0);

                    return (
                        <ListItem
                            key={stepId}
                            sx={{ px: 0, py: 0.5 }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                {totalErrors > 0 ? (
                                    <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                                ) : totalWarnings > 0 ? (
                                    <WarningIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                                ) : (
                                    <ValidIcon sx={{ fontSize: 16, color: '#10b981' }} />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                        {result.step.label}
                                    </Typography>
                                }
                                secondary={
                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        {totalErrors > 0 && `${totalErrors} error(s)`}
                                        {totalWarnings > 0 && `${totalWarnings} warning(s)`}
                                        {totalErrors === 0 && totalWarnings === 0 && 'Valid'}
                                        {` • Score: ${Math.round(result.overallScore)}%`}
                                    </Typography>
                                }
                            />
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setSelectedValidation({ stepId, ...result });
                                    setDetailsDialogOpen(true);
                                }}
                            >
                                <PreviewIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </ListItem>
                    );
                })}
            </List>

            {/* Validation Details Dialog */}
            <Dialog
                open={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Validation Details: {selectedValidation?.step?.label}
                </DialogTitle>
                <DialogContent>
                    {selectedValidation && selectedValidation.annotations.map((result, index) => (
                        <Box key={index} sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                                Annotation {index + 1} (Score: {Math.round(result.qualityScore)}%)
                            </Typography>

                            {result.errors.length > 0 && (
                                <Alert severity="error" sx={{ mb: 1, fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>Errors:</Typography>
                                    {result.errors.map((error, i) => (
                                        <Typography key={i} sx={{ fontSize: '11px' }}>• {error}</Typography>
                                    ))}
                                </Alert>
                            )}

                            {result.warnings.length > 0 && (
                                <Alert severity="warning" sx={{ mb: 1, fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>Warnings:</Typography>
                                    {result.warnings.map((warning, i) => (
                                        <Typography key={i} sx={{ fontSize: '11px' }}>• {warning}</Typography>
                                    ))}
                                </Alert>
                            )}

                            {result.suggestions.length > 0 && (
                                <Alert severity="info" sx={{ mb: 1, fontSize: '12px' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>Suggestions:</Typography>
                                    {result.suggestions.map((suggestion, i) => (
                                        <Typography key={i} sx={{ fontSize: '11px' }}>• {suggestion}</Typography>
                                    ))}
                                </Alert>
                            )}
                        </Box>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
