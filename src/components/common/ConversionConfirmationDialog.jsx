import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Alert,
    AlertTitle,
    Checkbox,
    FormControlLabel,
    LinearProgress,
    Divider,
    Grid
} from '@mui/material';
import {
    WarningAmberIcon,
    ExpandMoreIcon,
    SecurityIcon,
    BackupIcon,
    DataArrayIcon,
    CompareArrowsIcon,
    CheckCircleIcon,
    ErrorIcon
} from '@mui/icons-material';

const ConversionConfirmationDialog = ({
    open,
    onClose,
    onConfirm,
    shipmentData,
    fromFormat,
    toFormat,
    convertedData,
    loading = false,
    conversionResult = null
}) => {
    const [userConsent, setUserConsent] = useState({
        understandsRisk: false,
        acceptsDataLoss: false,
        wantsBackup: true
    });
    const [showDataPreview, setShowDataPreview] = useState(false);

    // Reset consent when dialog opens
    useEffect(() => {
        if (open) {
            setUserConsent({
                understandsRisk: false,
                acceptsDataLoss: false,
                wantsBackup: true
            });
            setShowDataPreview(false);
        }
    }, [open]);

    const isConversionEnabled = userConsent.understandsRisk && userConsent.acceptsDataLoss;

    const getFormatDisplayName = (format) => {
        return format === 'quickship' ? 'QuickShip (Manual Entry)' : 'Advanced (Multi-Step)';
    };

    const getDataSummary = (data, format) => {
        if (!data) return 'No data';

        const summary = {
            packages: data.packages?.length || 0,
            addresses: [data.shipFromAddress, data.shipToAddress].filter(Boolean).length,
            shipmentInfo: Object.keys(data.shipmentInfo || {}).length
        };

        if (format === 'quickship') {
            summary.manualRates = data.manualRates?.length || 0;
            summary.carrier = data.selectedCarrier || 'None';
        } else {
            summary.selectedRate = data.selectedRate ? 'Yes' : 'No';
            summary.additionalServices = data.additionalServices?.length || 0;
        }

        return summary;
    };

    const handleConfirm = () => {
        if (isConversionEnabled && onConfirm) {
            onConfirm(userConsent.wantsBackup);
        }
    };

    const renderConversionResult = () => {
        if (!conversionResult) return null;

        if (conversionResult.success) {
            return (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                    <AlertTitle>Conversion Successful!</AlertTitle>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        {conversionResult.message}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#2e7d32' }}>
                        Conversion ID: {conversionResult.conversionId}
                    </Typography>
                </Alert>
            );
        } else if (conversionResult.rollbackSuccessful) {
            return (
                <Alert severity="warning" icon={<WarningAmberIcon />}>
                    <AlertTitle>Conversion Failed - Data Restored</AlertTitle>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        {conversionResult.message}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#ed6c02' }}>
                        Error: {conversionResult.error}
                    </Typography>
                </Alert>
            );
        } else {
            return (
                <Alert severity="error" icon={<ErrorIcon />}>
                    <AlertTitle>🚨 CRITICAL: Conversion and Rollback Failed</AlertTitle>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        {conversionResult.message}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#d32f2f' }}>
                        Manual recovery required. Contact support immediately.
                    </Typography>
                    {conversionResult.backup && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'monospace' }}>
                            Backup ID: {conversionResult.backup.conversionId}
                        </Typography>
                    )}
                </Alert>
            );
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown={loading}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: '1px solid #e0e0e0'
            }}>
                <CompareArrowsIcon sx={{ color: '#ff9800' }} />
                Shipment Format Conversion
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {loading && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                            Converting Shipment...
                        </Typography>
                        <LinearProgress />
                        <Typography variant="caption" sx={{ color: '#666', mt: 1 }}>
                            This process includes backup, validation, and atomic conversion.
                        </Typography>
                    </Box>
                )}

                {conversionResult && renderConversionResult()}

                {!loading && !conversionResult && (
                    <>
                        {/* Conversion Overview */}
                        <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={5}>
                                    <Box textAlign="center">
                                        <Typography variant="h6" sx={{ color: '#1976d2' }}>
                                            {getFormatDisplayName(fromFormat)}
                                        </Typography>
                                        <Chip
                                            label="Current Format"
                                            size="small"
                                            color="primary"
                                            sx={{ mt: 1 }}
                                        />
                                    </Box>
                                </Grid>
                                <Grid item xs={2}>
                                    <Box textAlign="center">
                                        <CompareArrowsIcon sx={{ fontSize: 40, color: '#ff9800' }} />
                                    </Box>
                                </Grid>
                                <Grid item xs={5}>
                                    <Box textAlign="center">
                                        <Typography variant="h6" sx={{ color: '#388e3c' }}>
                                            {getFormatDisplayName(toFormat)}
                                        </Typography>
                                        <Chip
                                            label="Target Format"
                                            size="small"
                                            color="success"
                                            sx={{ mt: 1 }}
                                        />
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Critical Warning */}
                        <Alert severity="error" sx={{ mb: 3 }}>
                            <AlertTitle>⚠️ CRITICAL WARNING - READ CAREFULLY</AlertTitle>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                This operation will <strong>completely replace</strong> the shipment's data structure.
                                This is a <strong>complex and potentially risky</strong> operation.
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                What happens during conversion:
                            </Typography>
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                <li>Full backup of original data is created</li>
                                <li>All shipment data is replaced with new format</li>
                                <li>ShipmentID and core metadata are preserved</li>
                                <li>Automatic rollback if conversion fails</li>
                                <li>Manual recovery available if needed</li>
                            </ul>
                        </Alert>

                        {/* Safety Features */}
                        <Paper sx={{ p: 2, mb: 3, border: '1px solid #4caf50' }}>
                            <Typography variant="h6" sx={{
                                color: '#2e7d32',
                                mb: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <SecurityIcon />
                                Safety Features Enabled
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <BackupIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                                        <Typography variant="body2">
                                            Automatic backup before conversion
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                                        <Typography variant="body2">
                                            Data validation and integrity checks
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <DataArrayIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                                        <Typography variant="body2">
                                            Atomic transaction (all-or-nothing)
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CompareArrowsIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                                        <Typography variant="body2">
                                            Automatic rollback on failure
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Data Preview */}
                        <Accordion expanded={showDataPreview} onChange={() => setShowDataPreview(!showDataPreview)}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="h6">
                                    Data Preview & Comparison
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                            Current Data ({fromFormat})
                                        </Typography>
                                        <Paper sx={{ p: 2, bgcolor: '#fff3e0' }}>
                                            {Object.entries(getDataSummary(shipmentData, fromFormat)).map(([key, value]) => (
                                                <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
                                                    <strong>{key}:</strong> {value}
                                                </Typography>
                                            ))}
                                        </Paper>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                            Converted Data ({toFormat})
                                        </Typography>
                                        <Paper sx={{ p: 2, bgcolor: '#e8f5e8' }}>
                                            {Object.entries(getDataSummary(convertedData, toFormat)).map(([key, value]) => (
                                                <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
                                                    <strong>{key}:</strong> {value}
                                                </Typography>
                                            ))}
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        <Divider sx={{ my: 3 }} />

                        {/* User Consent */}
                        <Typography variant="h6" sx={{ mb: 2, color: '#d32f2f' }}>
                            Required Confirmations
                        </Typography>

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={userConsent.understandsRisk}
                                    onChange={(e) => setUserConsent(prev => ({
                                        ...prev,
                                        understandsRisk: e.target.checked
                                    }))}
                                    color="error"
                                />
                            }
                            label={
                                <Typography variant="body2">
                                    I understand this is a <strong>complex operation</strong> that will completely
                                    replace the shipment's data structure and may result in data loss.
                                </Typography>
                            }
                            sx={{ mb: 2, alignItems: 'flex-start' }}
                        />

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={userConsent.acceptsDataLoss}
                                    onChange={(e) => setUserConsent(prev => ({
                                        ...prev,
                                        acceptsDataLoss: e.target.checked
                                    }))}
                                    color="error"
                                />
                            }
                            label={
                                <Typography variant="body2">
                                    I accept the risk of <strong>potential data loss</strong> and understand
                                    that while safety measures are in place, data recovery may not always be possible.
                                </Typography>
                            }
                            sx={{ mb: 2, alignItems: 'flex-start' }}
                        />

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={userConsent.wantsBackup}
                                    onChange={(e) => setUserConsent(prev => ({
                                        ...prev,
                                        wantsBackup: e.target.checked
                                    }))}
                                    color="primary"
                                />
                            }
                            label={
                                <Typography variant="body2">
                                    <strong>Recommended:</strong> Create detailed backup for manual recovery
                                    (slightly slower but much safer)
                                </Typography>
                            }
                            sx={{ mb: 2, alignItems: 'flex-start' }}
                        />
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0' }}>
                {!loading && !conversionResult && (
                    <>
                        <Button
                            onClick={onClose}
                            color="inherit"
                            size="large"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!isConversionEnabled}
                            variant="contained"
                            color="error"
                            size="large"
                            sx={{ ml: 2 }}
                        >
                            Convert Shipment
                        </Button>
                    </>
                )}

                {conversionResult && (
                    <Button
                        onClick={onClose}
                        variant="contained"
                        color="primary"
                        size="large"
                    >
                        {conversionResult.success ? 'Continue' : 'Close'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ConversionConfirmationDialog; 