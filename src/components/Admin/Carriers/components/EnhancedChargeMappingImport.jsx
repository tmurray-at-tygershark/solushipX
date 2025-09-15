/**
 * Enhanced Charge Mapping CSV Import Dialog
 * Allows bulk import of rate cards for routes, services, and service types
 */

import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Alert,
    CircularProgress,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    Close as CloseIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const EnhancedChargeMappingImport = ({ isOpen, onClose, carrierId, carrierName, onImportComplete }) => {
    const { enqueueSnackbar } = useSnackbar();

    const [loading, setLoading] = useState(false);
    const [csvData, setCsvData] = useState('');
    const [previewData, setPreviewData] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [importResults, setImportResults] = useState(null);

    const handleFileUpload = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setCsvData(e.target.result);
        };
        reader.readAsText(file);
    }, []);

    const parseCSVData = useCallback((csvText) => {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) continue;

            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }

        return data;
    }, []);

    const handlePreview = useCallback(async () => {
        if (!csvData.trim()) {
            enqueueSnackbar('Please upload a CSV file first', { variant: 'error' });
            return;
        }

        setLoading(true);
        try {
            const parsedData = parseCSVData(csvData);

            // Validate and transform data
            const validatedData = parsedData.map((row, index) => {
                const errors = [];

                // Required fields validation
                if (!row.routeid) errors.push('Missing routeId');
                if (!row.service) errors.push('Missing service');
                if (!row.servicetype) errors.push('Missing serviceType');
                if (!row.ratetype) errors.push('Missing rateType');

                // Rate type specific validation
                if (row.ratetype === 'skid_based' && !row.skidcount) {
                    errors.push('Missing skidCount for skid-based rate');
                }
                if (row.ratetype === 'weight_based' && (!row.minweight || !row.maxweight)) {
                    errors.push('Missing weight range for weight-based rate');
                }

                return {
                    ...row,
                    rowIndex: index + 2, // +2 because we start from row 2 (after header)
                    errors,
                    isValid: errors.length === 0
                };
            });

            setPreviewData(validatedData);
            setShowPreview(true);
        } catch (error) {
            console.error('Error parsing CSV:', error);
            enqueueSnackbar('Error parsing CSV file', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [csvData, parseCSVData, enqueueSnackbar]);

    const handleImport = useCallback(async () => {
        if (previewData.length === 0) {
            enqueueSnackbar('No valid data to import', { variant: 'error' });
            return;
        }

        const validData = previewData.filter(row => row.isValid);
        if (validData.length === 0) {
            enqueueSnackbar('No valid rows to import', { variant: 'error' });
            return;
        }

        setLoading(true);
        try {
            const bulkImportEnhancedRateCards = httpsCallable(functions, 'bulkImportEnhancedRateCards');
            const result = await bulkImportEnhancedRateCards({
                carrierId,
                csvData: validData,
                preview: false
            });

            if (result.data.success) {
                setImportResults(result.data.results);
                enqueueSnackbar(`Import completed: ${result.data.results.success} successful, ${result.data.results.errors.length} errors`, {
                    variant: result.data.results.errors.length > 0 ? 'warning' : 'success'
                });
            } else {
                enqueueSnackbar('Import failed', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error importing data:', error);
            enqueueSnackbar('Error importing data', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, previewData, enqueueSnackbar]);

    const handleClose = useCallback(() => {
        setCsvData('');
        setPreviewData([]);
        setShowPreview(false);
        setImportResults(null);
        onClose();
    }, [onClose]);

    const handleImportComplete = useCallback(() => {
        if (onImportComplete) {
            onImportComplete();
        }
        handleClose();
    }, [onImportComplete, handleClose]);

    const downloadTemplate = useCallback(() => {
        const template = [
            'routeId,service,serviceType,rateType,currency,enabled,skidCount,price,minWeight,maxWeight,pricePerLb,minimumCharge,notes',
            'route_1,LTL,rush,skid_based,CAD,true,12,599.00,,,,,Barrie to Toronto rush rate',
            'route_1,LTL,standard,skid_based,CAD,true,12,499.00,,,,,Barrie to Toronto standard rate',
            'route_2,FTL,direct,weight_based,CAD,true,,,0,1000,2.50,100.00,Weight-based FTL rate'
        ].join('\n');

        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'enhanced_rate_cards_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, []);

    const getValidationIcon = (isValid) => {
        return isValid ?
            <CheckCircleIcon sx={{ color: '#10b981', fontSize: '16px' }} /> :
            <ErrorIcon sx={{ color: '#ef4444', fontSize: '16px' }} />;
    };

    const getValidationColor = (isValid) => {
        return isValid ? 'success' : 'error';
    };

    return (
        <Dialog
            open={isOpen}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { height: '90vh' } }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UploadIcon sx={{ color: '#7c3aed' }} />
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Import Enhanced Rate Cards - {carrierName}
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {!showPreview && !importResults && (
                    <Box>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography sx={{ fontSize: '12px' }}>
                                <strong>CSV Format:</strong> Upload a CSV file with rate card data.
                                Download the template below for the correct format.
                            </Typography>
                        </Alert>

                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadIcon />}
                                    sx={{ fontSize: '12px', mb: 2 }}
                                >
                                    Upload CSV File
                                    <input
                                        type="file"
                                        accept=".csv"
                                        hidden
                                        onChange={handleFileUpload}
                                    />
                                </Button>
                            </Grid>

                            <Grid item xs={12}>
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={downloadTemplate}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Download Template
                                </Button>
                            </Grid>

                            {csvData && (
                                <Grid item xs={12}>
                                    <Paper sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                            CSV Data Preview:
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                            {csvData.split('\n').slice(0, 3).join('\n')}
                                            {csvData.split('\n').length > 3 && '\n...'}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            )}
                        </Grid>
                    </Box>
                )}

                {showPreview && !importResults && (
                    <Box>
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#374151', mb: 2 }}>
                            Data Preview ({previewData.length} rows)
                        </Typography>

                        <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', maxHeight: 400 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Row</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Route ID</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Service</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Rate Type</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Errors</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {previewData.map((row, index) => (
                                        <TableRow key={index}>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {row.rowIndex}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {row.routeid}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {row.service}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {row.servicetype}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {row.ratetype}
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    {getValidationIcon(row.isValid)}
                                                    <Chip
                                                        label={row.isValid ? 'Valid' : 'Invalid'}
                                                        size="small"
                                                        color={getValidationColor(row.isValid)}
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '11px', color: '#ef4444' }}>
                                                {row.errors.length > 0 ? row.errors.join(', ') : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => setShowPreview(false)}
                                sx={{ fontSize: '12px' }}
                            >
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleImport}
                                disabled={loading || previewData.filter(r => r.isValid).length === 0}
                                sx={{ fontSize: '12px' }}
                            >
                                {loading ? 'Importing...' : 'Import Valid Rows'}
                            </Button>
                        </Box>
                    </Box>
                )}

                {importResults && (
                    <Box>
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#374151', mb: 2 }}>
                            Import Results
                        </Typography>

                        <Alert
                            severity={importResults.errors.length > 0 ? 'warning' : 'success'}
                            sx={{ mb: 3 }}
                        >
                            <Typography sx={{ fontSize: '12px' }}>
                                Import completed: {importResults.success} successful, {importResults.errors.length} errors
                            </Typography>
                        </Alert>

                        {importResults.errors.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                    Errors:
                                </Typography>
                                <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', maxHeight: 200 }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Row</TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Error</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {importResults.errors.map((error, index) => (
                                                <TableRow key={index}>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {error.data.routeid || 'Unknown'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '11px', color: '#ef4444' }}>
                                                        {error.error}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setShowPreview(false);
                                    setImportResults(null);
                                }}
                                sx={{ fontSize: '12px' }}
                            >
                                Import More
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleImportComplete}
                                sx={{ fontSize: '12px' }}
                            >
                                Done
                            </Button>
                        </Box>
                    </Box>
                )}

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} sx={{ fontSize: '12px' }}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EnhancedChargeMappingImport;
