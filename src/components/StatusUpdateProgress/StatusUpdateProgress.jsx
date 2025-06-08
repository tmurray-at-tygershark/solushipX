import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    LinearProgress,
    Typography,
    Box,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Alert,
    Chip,
    IconButton,
    Collapse
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Refresh as RefreshIcon,
    Cancel as CancelIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

const StatusUpdateProgress = ({
    open,
    onClose,
    updateProgress,
    isUpdating,
    results,
    updateStats,
    onCancel,
    onRetryErrors
}) => {
    const [showDetails, setShowDetails] = React.useState(false);
    const [showErrors, setShowErrors] = React.useState(false);

    const progressPercentage = updateProgress.total > 0 ?
        Math.round((updateProgress.completed / updateProgress.total) * 100) : 0;

    const hasErrors = updateStats.failed > 0;
    const hasSuccess = updateStats.successful > 0;
    const hasSkipped = updateStats.skipped > 0;

    return (
        <Dialog
            open={open}
            onClose={!isUpdating ? onClose : undefined}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown={isUpdating}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RefreshIcon />
                    <Typography variant="h6">
                        Status Update Progress
                    </Typography>
                </Box>
                {isUpdating && (
                    <Chip
                        label="Updating..."
                        color="primary"
                        size="small"
                        icon={<RefreshIcon />}
                    />
                )}
            </DialogTitle>

            <DialogContent>
                <Box sx={{ mb: 3 }}>
                    {/* Progress Bar */}
                    <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Progress
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {updateProgress.completed} / {updateProgress.total}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={progressPercentage}
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </Box>

                    {/* Current Status */}
                    {isUpdating && updateProgress.current && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                Currently updating: <strong>{updateProgress.current}</strong>
                            </Typography>
                        </Alert>
                    )}

                    {/* Summary Statistics */}
                    {updateStats.hasResults && (
                        <Box sx={{
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                            mb: 2
                        }}>
                            {hasSuccess && (
                                <Chip
                                    icon={<CheckCircleIcon />}
                                    label={`${updateStats.successful} Successful`}
                                    color="success"
                                    variant="outlined"
                                    size="small"
                                />
                            )}
                            {updateStats.statusChanged > 0 && (
                                <Chip
                                    label={`${updateStats.statusChanged} Status Changed`}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                />
                            )}
                            {hasSkipped && (
                                <Chip
                                    icon={<WarningIcon />}
                                    label={`${updateStats.skipped} Skipped`}
                                    color="warning"
                                    variant="outlined"
                                    size="small"
                                />
                            )}
                            {hasErrors && (
                                <Chip
                                    icon={<ErrorIcon />}
                                    label={`${updateStats.failed} Failed`}
                                    color="error"
                                    variant="outlined"
                                    size="small"
                                />
                            )}
                        </Box>
                    )}

                    {/* Results Summary */}
                    {!isUpdating && updateStats.hasResults && (
                        <Alert
                            severity={hasErrors ? "warning" : "success"}
                            sx={{ mb: 2 }}
                        >
                            <Typography variant="body2">
                                {hasErrors ? (
                                    <>Update completed with some errors. {updateStats.successful} shipments updated successfully, {updateStats.failed} failed.</>
                                ) : (
                                    <>Update completed successfully! All {updateStats.successful} shipments were processed.</>
                                )}
                            </Typography>
                        </Alert>
                    )}

                    {/* Details Toggle */}
                    {updateStats.hasResults && (
                        <Box>
                            <Button
                                startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                onClick={() => setShowDetails(!showDetails)}
                                size="small"
                                sx={{ mb: 1 }}
                            >
                                {showDetails ? 'Hide Details' : 'Show Details'}
                            </Button>

                            <Collapse in={showDetails}>
                                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                                    <List dense>
                                        {Object.entries(results).map(([shipmentId, result]) => (
                                            <ListItem key={shipmentId}>
                                                <ListItemIcon>
                                                    {result.success ? (
                                                        <CheckCircleIcon color="success" />
                                                    ) : result.skipped ? (
                                                        <WarningIcon color="warning" />
                                                    ) : (
                                                        <ErrorIcon color="error" />
                                                    )}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={shipmentId}
                                                    secondary={
                                                        result.success ? (
                                                            result.statusChanged ?
                                                                `Status changed: ${result.previousStatus} → ${result.newStatus}` :
                                                                'Status confirmed (no change)'
                                                        ) : result.skipped ? (
                                                            result.reason
                                                        ) : (
                                                            result.error
                                                        )
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            </Collapse>
                        </Box>
                    )}

                    {/* Error Details */}
                    {hasErrors && (
                        <Box>
                            <Button
                                startIcon={showErrors ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                onClick={() => setShowErrors(!showErrors)}
                                color="error"
                                size="small"
                                sx={{ mb: 1 }}
                            >
                                {showErrors ? 'Hide Error Details' : 'Show Error Details'}
                            </Button>

                            <Collapse in={showErrors}>
                                <Alert severity="error">
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        The following shipments failed to update:
                                    </Typography>
                                    <List dense>
                                        {Object.entries(results)
                                            .filter(([, result]) => !result.success && !result.skipped)
                                            .map(([shipmentId, result]) => (
                                                <ListItem key={shipmentId}>
                                                    <ListItemText
                                                        primary={shipmentId}
                                                        secondary={result.error}
                                                    />
                                                </ListItem>
                                            ))
                                        }
                                    </List>
                                </Alert>
                            </Collapse>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions>
                {isUpdating ? (
                    <Button
                        onClick={onCancel}
                        startIcon={<CancelIcon />}
                        color="error"
                    >
                        Cancel Update
                    </Button>
                ) : (
                    <>
                        {hasErrors && onRetryErrors && (
                            <Button
                                onClick={onRetryErrors}
                                startIcon={<RefreshIcon />}
                                color="primary"
                                variant="outlined"
                            >
                                Retry Failed
                            </Button>
                        )}
                        <Button onClick={onClose}>
                            Close
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default StatusUpdateProgress; 