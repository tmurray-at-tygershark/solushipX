import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Box,
    Button
} from '@mui/material';
import { Close as CloseIcon, GetApp as DownloadIcon } from '@mui/icons-material';

const PdfViewerDialog = ({ open, onClose, pdfUrl, title }) => {
    const handleDownload = () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={false}
            PaperProps={{
                sx: {
                    width: '75vw',
                    height: '75vh',
                    maxWidth: '75vw',
                    maxHeight: '75vh',
                    borderRadius: 2,
                    zIndex: 1600
                }
            }}
            BackdropProps={{
                sx: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 1599
                }
            }}
        >
            <DialogTitle sx={{
                m: 0,
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {title}
                </Box>
                <Box>
                    <Button
                        startIcon={<DownloadIcon />}
                        onClick={handleDownload}
                        sx={{ mr: 1 }}
                    >
                        Download
                    </Button>
                    <IconButton
                        aria-label="close"
                        onClick={onClose}
                        sx={{
                            color: (theme) => theme.palette.grey[500],
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 0, height: 'calc(100% - 64px)' }}>
                <iframe
                    src={pdfUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none'
                    }}
                    title="PDF Viewer"
                />
            </DialogContent>
        </Dialog>
    );
};

export default PdfViewerDialog;
