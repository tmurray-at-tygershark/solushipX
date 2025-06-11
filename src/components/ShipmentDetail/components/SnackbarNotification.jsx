import React from 'react';
import { Snackbar, Alert } from '@mui/material';

const SnackbarNotification = ({
    open = false,
    message = '',
    severity = 'info',
    onClose = () => { },
    // Legacy support for snackbar object prop
    snackbar = null
}) => {
    // Support both prop styles for backward compatibility
    const isOpen = snackbar ? snackbar.open : open;
    const alertMessage = snackbar ? snackbar.message : message;
    const alertSeverity = snackbar ? snackbar.severity : severity;

    return (
        <Snackbar
            open={isOpen}
            autoHideDuration={alertSeverity === 'error' ? 8000 : 4000}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
            <Alert
                onClose={onClose}
                severity={alertSeverity}
                variant="filled"
                sx={{
                    width: '100%',
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                }}
            >
                {alertMessage}
            </Alert>
        </Snackbar>
    );
};

export default SnackbarNotification; 