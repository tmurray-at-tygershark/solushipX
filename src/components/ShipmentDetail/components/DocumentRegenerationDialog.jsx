import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    IconButton,
    CircularProgress,
    LinearProgress
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Close as CloseIcon,
    Visibility as VisibilityIcon,
    PictureAsPdf as PdfIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';

const DocumentRegenerationDialog = ({
    open,
    onClose,
    onViewDocument,
    documentType,
    shipmentID,
    isLoading = false
}) => {
    const handleViewClick = () => {
        onViewDocument();
        onClose();
    };

    const getDocumentDisplayName = () => {
        switch (documentType) {
            case 'bol':
                return 'Bill of Lading';
            case 'carrierConfirmation':
                return 'Carrier Confirmation';
            default:
                return 'Document';
        }
    };

    const getDocumentIcon = () => {
        if (isLoading) {
            return <RefreshIcon sx={{ color: '#f59e0b', fontSize: 24, animation: 'spin 1s linear infinite' }} />;
        }
        return <PdfIcon sx={{ color: '#d32f2f', fontSize: 24 }} />;
    };

    const getTitle = () => {
        if (isLoading) {
            return 'Regenerating Document...';
        }
        return 'Document Generated Successfully';
    };

    const getTitleIcon = () => {
        if (isLoading) {
            return <CircularProgress size={24} sx={{ color: '#f59e0b' }} />;
        }
        return <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 28 }} />;
    };

    const getMainMessage = () => {
        if (isLoading) {
            return (
                <Typography
                    variant="body1"
                    sx={{
                        textAlign: 'center',
                        color: '#374151',
                        fontSize: '16px',
                        lineHeight: 1.5
                    }}
                >
                    Please wait while we regenerate your <strong>{getDocumentDisplayName()}</strong> for shipment{' '}
                    <strong>{shipmentID}</strong> with the latest information.
                </Typography>
            );
        }

        return (
            <Typography
                variant="body1"
                sx={{
                    textAlign: 'center',
                    color: '#374151',
                    fontSize: '16px',
                    lineHeight: 1.5
                }}
            >
                Your <strong>{getDocumentDisplayName()}</strong> has been successfully regenerated for shipment{' '}
                <strong>{shipmentID}</strong>.
            </Typography>
        );
    };

    const getSubMessage = () => {
        if (isLoading) {
            return (
                <Typography
                    variant="body2"
                    sx={{
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '14px'
                    }}
                >
                    This usually takes 10-30 seconds. Please don't close this dialog.
                </Typography>
            );
        }

        return (
            <Typography
                variant="body2"
                sx={{
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '14px'
                }}
            >
                The document is now ready and all buttons will point to the new version.
            </Typography>
        );
    };

    return (
        <>
            {/* Add CSS for spinner animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <Dialog
                open={open}
                onClose={isLoading ? undefined : onClose} // Prevent closing while loading
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        minHeight: 200
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pb: 1,
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getTitleIcon()}
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
                            {getTitle()}
                        </Typography>
                    </Box>
                    {!isLoading && (
                        <IconButton
                            onClick={onClose}
                            size="small"
                            sx={{ color: '#6b7280' }}
                        >
                            <CloseIcon />
                        </IconButton>
                    )}
                </DialogTitle>

                {/* Progress bar for loading state */}
                {isLoading && (
                    <LinearProgress
                        sx={{
                            height: 3,
                            backgroundColor: '#f3f4f6',
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: '#f59e0b'
                            }
                        }}
                    />
                )}

                <DialogContent sx={{ pt: 3, pb: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {getDocumentIcon()}

                        {getMainMessage()}

                        {getSubMessage()}

                        {isLoading && (
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mt: 1,
                                px: 3,
                                py: 1.5,
                                backgroundColor: '#fef3c7',
                                borderRadius: 1,
                                border: '1px solid #f59e0b'
                            }}>
                                <RefreshIcon sx={{
                                    color: '#d97706',
                                    fontSize: 18,
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: '#92400e',
                                        fontSize: '13px',
                                        fontWeight: 500
                                    }}
                                >
                                    Generating document with latest shipment data...
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </DialogContent>

                <DialogActions sx={{
                    justifyContent: 'center',
                    gap: 2,
                    p: 3,
                    pt: 1,
                    borderTop: '1px solid #f3f4f6'
                }}>
                    {isLoading ? (
                        <Typography
                            variant="body2"
                            sx={{
                                color: '#6b7280',
                                fontSize: '14px',
                                fontStyle: 'italic'
                            }}
                        >
                            Please wait while the document is being generated...
                        </Typography>
                    ) : (
                        <>
                            <Button
                                onClick={onClose}
                                variant="outlined"
                                sx={{
                                    minWidth: 100,
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    borderColor: '#d1d5db',
                                    color: '#374151',
                                    '&:hover': {
                                        borderColor: '#9ca3af',
                                        backgroundColor: '#f9fafb'
                                    }
                                }}
                            >
                                OK
                            </Button>

                            <Button
                                onClick={handleViewClick}
                                variant="contained"
                                startIcon={<VisibilityIcon />}
                                sx={{
                                    minWidth: 120,
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    backgroundColor: '#3b82f6',
                                    '&:hover': {
                                        backgroundColor: '#2563eb'
                                    }
                                }}
                            >
                                View Document
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
};

export default DocumentRegenerationDialog; 