import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    Button,
    IconButton
} from '@mui/material';
import {
    PictureAsPdf as PictureAsPdfIcon,
    FileDownload as FileDownloadIcon,
    Close as CloseIcon
} from '@mui/icons-material';

const PdfViewerDialog = ({ open, onClose, pdfUrl, title }) => {
    const handleDownload = () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    };

    const handleClose = () => {
        onClose();
        // Clean up blob URL if needed
        if (pdfUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(pdfUrl);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    height: '90vh',
                    borderRadius: 2
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PictureAsPdfIcon color="error" />
                    <Typography variant="h6">{title}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        onClick={handleDownload}
                        startIcon={<FileDownloadIcon />}
                        size="small"
                    >
                        Download
                    </Button>
                    <IconButton onClick={handleClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 0, height: '100%' }}>
                {pdfUrl && (
                    <Box sx={{ height: '100%', width: '100%' }}>
                        <iframe
                            src={pdfUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none'
                            }}
                            title={title}
                        />
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PdfViewerDialog;
