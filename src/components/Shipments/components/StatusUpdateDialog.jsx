import React from 'react';
import StatusUpdateProgress from '../../StatusUpdateProgress/StatusUpdateProgress';

const StatusUpdateDialog = ({
    open,
    onClose,
    updateProgress,
    isUpdating,
    results,
    updateStats,
    onCancel,
    onRetryErrors
}) => {
    return (
        <StatusUpdateProgress
            open={open}
            onClose={onClose}
            updateProgress={updateProgress}
            isUpdating={isUpdating}
            results={results}
            updateStats={updateStats}
            onCancel={onCancel}
            onRetryErrors={onRetryErrors}
        />
    );
};

export default StatusUpdateDialog; 