import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    IconButton,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';

const PdfViewerModal = ({
    open = false,
    onClose = () => { },
    pdfData = { url: null, title: '' },
    loading = false
}) => {
    const handleDownload = () => {
        if (pdfData.url) {
            const link = document.createElement('a');
            link.href = pdfData.url;
            link.download = pdfData.title || 'document.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            sx={{
                '& .MuiDialog-paper': {
                    height: '90vh',
                    maxHeight: '90vh'
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
                <Typography variant="h6" component="div">
                    {pdfData.title || 'Document Viewer'}
                </Typography>
                <Box>
                    <IconButton onClick={handleDownload} disabled={!pdfData.url}>
                        <DownloadIcon />
                    </IconButton>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                {loading ? (
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flex: 1,
                        minHeight: '400px'
                    }}>
                        <CircularProgress />
                    </Box>
                ) : pdfData.url ? (
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                        <iframe
                            src={pdfData.url}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                            title={pdfData.title || 'PDF Document'}
                        />
                    </Box>
                ) : (
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flex: 1,
                        minHeight: '400px'
                    }}>
                        <Typography color="text.secondary">
                            No document available to display
                        </Typography>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                <Button onClick={onClose}>Close</Button>
                {pdfData.url && (
                    <Button
                        onClick={handleDownload}
                        variant="contained"
                        startIcon={<DownloadIcon />}
                    >
                        Download
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default PdfViewerModal; 