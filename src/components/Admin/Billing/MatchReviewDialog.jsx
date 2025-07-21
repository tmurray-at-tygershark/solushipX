import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Button,
    Typography,
    Alert,
    Chip,
    Grid,
    LinearProgress,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Radio,
    RadioGroup,
    FormControlLabel,
    TextField,
    Divider
} from '@mui/material';
import {
    Close as CloseIcon,
    CheckCircle as CheckIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Search as SearchIcon,
    LocalShipping as ShippingIcon,
    Receipt as ReceiptIcon,
    AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';

const MatchReviewDialog = ({ open, onClose, invoiceData, matchResult, onApprove, onReject }) => {
    const [selectedMatch, setSelectedMatch] = useState(matchResult?.bestMatch?.shipment?.id || '');
    const [searching, setSearching] = useState(false);
    const [additionalMatches, setAdditionalMatches] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [creating, setCreating] = useState(false);

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.95) return 'success';
        if (confidence >= 0.85) return 'warning';
        if (confidence >= 0.70) return 'info';
        return 'error';
    };

    const getConfidenceIcon = (confidence) => {
        if (confidence >= 0.95) return <CheckIcon />;
        if (confidence >= 0.85) return <WarningIcon />;
        return <ErrorIcon />;
    };

    const handleManualSearch = async () => {
        if (!searchTerm) return;

        setSearching(true);
        try {
            const searchFunc = httpsCallable(functions, 'searchShipmentsForMatching');
            const result = await searchFunc({ searchTerm });

            if (result.data.success) {
                setAdditionalMatches(result.data.matches);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedMatch) return;

        setCreating(true);
        try {
            await onApprove(selectedMatch, invoiceData);
            onClose();
        } catch (error) {
            console.error('Approval error:', error);
        } finally {
            setCreating(false);
        }
    };

    const allMatches = [
        ...(matchResult?.matches || []),
        ...additionalMatches
    ];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ReceiptIcon sx={{ color: '#6366f1' }} />
                        <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600 }}>
                            Review Invoice Match
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers>
                {/* Invoice Summary */}
                <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa', border: '1px solid #e5e7eb' }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" sx={{ fontSize: '11px', color: '#6b7280', mb: 0.5 }}>
                                Invoice Details
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Invoice #:
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {invoiceData?.invoiceNumber || 'N/A'}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Carrier:
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {invoiceData?.carrier || 'Unknown'}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Amount:
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {invoiceData?.currency || 'CAD'} {invoiceData?.totalAmount?.toFixed(2) || '0.00'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" sx={{ fontSize: '11px', color: '#6b7280', mb: 0.5 }}>
                                Shipment References
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Tracking #:
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {invoiceData?.trackingNumber || 'N/A'}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Reference:
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {invoiceData?.references?.customerRef || invoiceData?.shipmentId || 'N/A'}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Date:
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {invoiceData?.shipmentDate || 'N/A'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Match Status */}
                {matchResult && (
                    <Alert
                        severity={getConfidenceColor(matchResult.confidence)}
                        icon={getConfidenceIcon(matchResult.confidence)}
                        sx={{ mb: 3 }}
                    >
                        <Typography sx={{ fontSize: '12px' }}>
                            <strong>Match Confidence: {(matchResult.confidence * 100).toFixed(1)}%</strong>
                            {matchResult.confidence < 0.85 && (
                                <> - Manual review required before creating charge</>
                            )}
                        </Typography>
                    </Alert>
                )}

                {/* Manual Search */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                        Manual Search
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder="Search by ICAL ID, tracking number, or reference..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                        />
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleManualSearch}
                            disabled={searching || !searchTerm}
                            startIcon={<SearchIcon />}
                            sx={{ fontSize: '12px' }}
                        >
                            Search
                        </Button>
                    </Box>
                </Box>

                {/* Matches Table */}
                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                    Available Matches
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Select</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Shipment ID</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Carrier</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Date</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Route</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Amount</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Match Info</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {allMatches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            No matches found. Try searching manually.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                allMatches.map((match, index) => (
                                    <TableRow
                                        key={match.shipment.id}
                                        hover
                                        selected={selectedMatch === match.shipment.id}
                                    >
                                        <TableCell>
                                            <Radio
                                                size="small"
                                                checked={selectedMatch === match.shipment.id}
                                                onChange={() => setSelectedMatch(match.shipment.id)}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            {match.shipment.shipmentID}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {match.shipment.selectedCarrier || match.shipment.carrier || 'N/A'}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {new Date(match.shipment.bookedAt?.toDate?.() || match.shipment.bookedAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '11px' }}>
                                            {match.shipment.shipFrom?.city} → {match.shipment.shipTo?.city}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            ${match.shipment.totalCharges?.toFixed(2) || '0.00'}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <Chip
                                                    label={`${(match.confidence * 100).toFixed(0)}%`}
                                                    size="small"
                                                    color={getConfidenceColor(match.confidence)}
                                                    sx={{ fontSize: '10px', height: '20px' }}
                                                />
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    {match.matchStrategy}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {searching && <LinearProgress sx={{ mt: 2 }} />}
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button
                    onClick={onClose}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Cancel
                </Button>
                <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => onReject(invoiceData)}
                    sx={{ fontSize: '12px' }}
                >
                    No Match - Queue for Review
                </Button>
                <Button
                    variant="contained"
                    size="small"
                    onClick={handleApprove}
                    disabled={!selectedMatch || creating}
                    startIcon={creating ? null : <CheckIcon />}
                    sx={{ fontSize: '12px' }}
                >
                    {creating ? 'Creating Charge...' : 'Approve & Create Charge'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MatchReviewDialog; 