import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Chip,
    Grid,
    LinearProgress,
    Tooltip,
    IconButton,
    Alert
} from '@mui/material';
import {
    Timeline as PerformanceIcon,
    Speed as AccuracyIcon,
    Warning as WarningIcon,
    CheckCircle as ValidIcon,
    Undo as UndoIcon,
    Redo as RedoIcon,
    Save as SaveIcon,
    BugReport as ErrorIcon
} from '@mui/icons-material';

export default function EnterprisePerformanceDashboard({
    performanceStats,
    validationErrors,
    annotationHistory,
    historyIndex,
    autoSaveStatus,
    errorRecovery,
    onUndo,
    onRedo,
    onManualSave,
    onValidate
}) {
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < annotationHistory.length - 1;

    const getAccuracyColor = (accuracy) => {
        if (accuracy >= 90) return 'success';
        if (accuracy >= 75) return 'warning';
        return 'error';
    };

    const getAutoSaveColor = () => {
        switch (autoSaveStatus) {
            case 'saving': return 'info';
            case 'saved': return 'success';
            case 'error': return 'error';
            default: return 'default';
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#f8fafc'
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    Enterprise Training Monitor
                </Typography>

                {/* Action Controls */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Undo Last Action (Ctrl+Z)">
                        <IconButton
                            size="small"
                            onClick={onUndo}
                            disabled={!canUndo}
                            color={canUndo ? "primary" : "default"}
                        >
                            <UndoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Redo Action (Ctrl+Y)">
                        <IconButton
                            size="small"
                            onClick={onRedo}
                            disabled={!canRedo}
                            color={canRedo ? "primary" : "default"}
                        >
                            <RedoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Manual Save (Ctrl+S)">
                        <IconButton
                            size="small"
                            onClick={onManualSave}
                            color="primary"
                        >
                            <SaveIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Metrics Grid */}
            <Grid container spacing={1} sx={{ mb: 2 }}>
                {/* Performance Metrics */}
                <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                        <PerformanceIcon sx={{ fontSize: 20, color: '#6366f1', mb: 0.5 }} />
                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                            Total Annotations
                        </Typography>
                        <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            {performanceStats.totalAnnotations}
                        </Typography>
                    </Box>
                </Grid>

                {/* Accuracy Metrics */}
                <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                        <AccuracyIcon sx={{ fontSize: 20, color: '#10b981', mb: 0.5 }} />
                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                            Accuracy Score
                        </Typography>
                        <Chip
                            label={`${Math.round(performanceStats.accuracy)}%`}
                            size="small"
                            color={getAccuracyColor(performanceStats.accuracy)}
                            sx={{ fontSize: '11px', fontWeight: 600 }}
                        />
                    </Box>
                </Grid>
            </Grid>

            {/* Auto-Save Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                    Auto-Save Status
                </Typography>
                <Chip
                    label={autoSaveStatus === 'saving' ? 'Saving...' : autoSaveStatus === 'saved' ? 'Saved' : 'Error'}
                    size="small"
                    color={getAutoSaveColor()}
                    sx={{ fontSize: '10px' }}
                />
            </Box>

            {/* History Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                    History ({historyIndex + 1}/{annotationHistory.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip
                        label={`${canUndo ? 'Undo' : 'None'}`}
                        size="small"
                        variant={canUndo ? 'filled' : 'outlined'}
                        color={canUndo ? 'primary' : 'default'}
                        sx={{ fontSize: '10px' }}
                    />
                    <Chip
                        label={`${canRedo ? 'Redo' : 'None'}`}
                        size="small"
                        variant={canRedo ? 'filled' : 'outlined'}
                        color={canRedo ? 'primary' : 'default'}
                        sx={{ fontSize: '10px' }}
                    />
                </Box>
            </Box>

            {/* Validation Status */}
            {Object.keys(validationErrors).length > 0 && (
                <Alert
                    severity="warning"
                    sx={{
                        mt: 1,
                        '& .MuiAlert-message': { fontSize: '11px' },
                        py: 0.5
                    }}
                    icon={<WarningIcon sx={{ fontSize: 16 }} />}
                >
                    <Typography sx={{ fontSize: '11px', fontWeight: 600 }}>
                        {Object.keys(validationErrors).length} Validation Warning(s)
                    </Typography>
                    <Typography sx={{ fontSize: '10px' }}>
                        {Object.keys(validationErrors).join(', ')}
                    </Typography>
                </Alert>
            )}

            {/* Error Recovery Status */}
            {errorRecovery.lastError && (
                <Alert
                    severity="error"
                    sx={{
                        mt: 1,
                        '& .MuiAlert-message': { fontSize: '11px' },
                        py: 0.5
                    }}
                    icon={<ErrorIcon sx={{ fontSize: 16 }} />}
                >
                    <Typography sx={{ fontSize: '11px', fontWeight: 600 }}>
                        Error Recovery ({errorRecovery.attempts}/3 attempts)
                    </Typography>
                    <Typography sx={{ fontSize: '10px' }}>
                        {errorRecovery.lastError}
                    </Typography>
                </Alert>
            )}

            {/* Performance Progress Bar */}
            <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                        Training Progress
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                        {Math.min(performanceStats.totalAnnotations * 20, 100)}%
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={Math.min(performanceStats.totalAnnotations * 20, 100)}
                    sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#e5e7eb',
                        '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            backgroundColor: '#6366f1'
                        }
                    }}
                />
            </Box>

            {/* Quick Actions */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Tooltip title="Validate All Annotations (Ctrl+V)">
                    <Chip
                        label="Validate All"
                        size="small"
                        onClick={onValidate}
                        clickable
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '10px' }}
                    />
                </Tooltip>
            </Box>
        </Paper>
    );
}
