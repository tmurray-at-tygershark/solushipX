import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    IconButton,
    Collapse,
    CircularProgress,
    Alert,
    Button,
    Chip
} from '@mui/material';
import {
    Description as DescriptionIcon,
    ExpandMore as ExpandMoreIcon,
    PictureAsPdf as PictureAsPdfIcon
} from '@mui/icons-material';

const ShipmentDocuments = ({
    shipment,
    expanded = true,
    onToggle = () => { },
    shipmentDocuments = { labels: [], bol: [], other: [] },
    documentsLoading = false,
    documentsError = null,
    onRetryFetch = () => { },
    onViewPdf = () => { }
}) => {
    // Don't show documents section for draft shipments
    if (shipment?.status === 'draft') {
        return null;
    }

    return (
        <Grid item xs={12}>
            <Paper sx={{ mt: 3 }}>
                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #e0e0e0'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DescriptionIcon sx={{ color: '#000' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                            Documents
                        </Typography>
                    </Box>
                    <IconButton onClick={onToggle}>
                        <ExpandMoreIcon
                            sx={{
                                transform: expanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.3s',
                                color: '#666'
                            }}
                        />
                    </IconButton>
                </Box>
                <Collapse in={expanded}>
                    <Box sx={{ p: 3 }}>
                        {documentsLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : documentsError ? (
                            <Alert
                                severity="error"
                                action={
                                    <Button
                                        color="inherit"
                                        size="small"
                                        onClick={onRetryFetch}
                                    >
                                        Retry
                                    </Button>
                                }
                            >
                                Failed to load documents: {documentsError}
                            </Alert>
                        ) : Object.values(shipmentDocuments).flat().length === 0 ? (
                            <Alert severity="info">
                                No documents available yet. Documents will be available after the shipment is booked.
                            </Alert>
                        ) : (
                            <Grid container spacing={2}>
                                {/* Labels */}
                                {shipmentDocuments.labels?.length > 0 && (
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                            Shipping Labels
                                        </Typography>
                                        <Grid container spacing={1}>
                                            {shipmentDocuments.labels
                                                .filter(label => {
                                                    const filename = (label.filename || '').toLowerCase();
                                                    const docType = (label.documentType || '').toLowerCase();
                                                    const isBOL = label.isGeneratedBOL === true ||
                                                        label.metadata?.generated === true ||
                                                        label.metadata?.eshipplus?.generated === true ||
                                                        label.metadata?.polaris?.generated === true ||
                                                        label.metadata?.canpar?.generated === true ||
                                                        filename.includes('bol') ||
                                                        filename.includes('bill-of-lading') ||
                                                        filename.includes('bill_of_lading') ||
                                                        filename.includes('billoflading') ||
                                                        docType.includes('bol') ||
                                                        docType.includes('bill of lading');
                                                    return !isBOL;
                                                })
                                                .map((label) => (
                                                    <Grid item key={label.id}>
                                                        <Chip
                                                            icon={<PictureAsPdfIcon />}
                                                            label={label.filename || 'Label'}
                                                            onClick={() => onViewPdf(label.id, label.filename, 'Shipping Label')}
                                                            clickable
                                                            color="primary"
                                                            variant="outlined"
                                                        />
                                                    </Grid>
                                                ))}
                                        </Grid>
                                    </Grid>
                                )}

                                {/* BOL */}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                        Bill of Lading
                                    </Typography>
                                    <Grid container spacing={1}>
                                        {shipmentDocuments.bol
                                            .filter(bol => {
                                                const filename = (bol.filename || '').toUpperCase();
                                                return filename.startsWith('SOLUSHIP-') && filename.endsWith('-BOL.PDF');
                                            })
                                            .map((bol) => (
                                                <Grid item key={bol.id}>
                                                    <Chip
                                                        icon={<DescriptionIcon />}
                                                        label={bol.filename || 'BOL'}
                                                        onClick={() => onViewPdf(bol.id, bol.filename, 'Bill of Lading')}
                                                        clickable
                                                        color="secondary"
                                                        variant="outlined"
                                                    />
                                                </Grid>
                                            ))}
                                    </Grid>
                                </Grid>

                                {/* Other Documents */}
                                {shipmentDocuments.other?.length > 0 && (
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                            Other Documents
                                        </Typography>
                                        <Grid container spacing={1}>
                                            {shipmentDocuments.other.map((doc) => (
                                                <Grid item key={doc.id}>
                                                    <Chip
                                                        icon={<DescriptionIcon />}
                                                        label={doc.filename || 'Document'}
                                                        onClick={() => onViewPdf(doc.id, doc.filename, 'Document')}
                                                        clickable
                                                        variant="outlined"
                                                    />
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Grid>
                                )}
                            </Grid>
                        )}
                    </Box>
                </Collapse>
            </Paper>
        </Grid>
    );
};

export default ShipmentDocuments; 