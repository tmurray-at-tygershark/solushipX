import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Alert,
    CircularProgress,
    Chip,
    IconButton,
    Divider,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Close as CloseIcon,
    LocationCity as CityIcon,
    LocalShipping as TruckIcon,
    Scale as WeightIcon,
    Inventory as SkidIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase/config';

// Cloud function imports
const generateSimpleCarrierTemplate = httpsCallable(functions, 'generateSimpleCarrierTemplate');
const importSimpleCarrierRates = httpsCallable(functions, 'importSimpleCarrierRates');

const templateOptions = [
    {
        value: 'city_to_city_skid',
        label: 'City to City - Skid Rates',
        description: 'Most common: Toronto → Montreal with 1-26 skid pricing',
        icon: <CityIcon />,
        example: 'Toronto, ON → Montreal, QC: 1 skid = $485, 2 skids = $650...'
    },
    {
        value: 'city_to_city_weight',
        label: 'City to City - Weight Rates',
        description: 'City routing with weight-based pricing per 100lbs',
        icon: <WeightIcon />,
        example: 'Toronto, ON → Montreal, QC: 0-500lbs = $78.50/100lbs'
    },
    {
        value: 'postal_to_postal_skid',
        label: 'Postal to Postal - Skid Rates',
        description: 'FSA postal codes with skid pricing',
        icon: <SkidIcon />,
        example: 'M5V → H3B: 1 skid = $485, 2 skids = $650...'
    },
    {
        value: 'postal_to_postal_weight',
        label: 'Postal to Postal - Weight Rates',
        description: 'FSA postal codes with weight-based pricing',
        icon: <TruckIcon />,
        example: 'M5V → H3B: 0-500lbs = $78.50/100lbs'
    }
];

export default function SimpleCarrierUploadDialog({ open, onClose, carrier }) {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('city_to_city_skid');
    const [includePostal, setIncludePostal] = useState(false);
    const [csvData, setCsvData] = useState(null);
    const [csvFile, setCsvFile] = useState(null);
    const [validationResult, setValidationResult] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const [currentStep, setCurrentStep] = useState('template'); // template, upload, validate, import, complete

    // Carrier configuration
    const [carrierConfig, setCarrierConfig] = useState({
        carrierName: carrier?.name || '',
        currency: 'CAD',
        effectiveDate: new Date().toISOString().split('T')[0]
    });

    React.useEffect(() => {
        if (open && carrier) {
            resetDialog();
        }
    }, [open, carrier]);

    const resetDialog = () => {
        setCurrentStep('template');
        setSelectedTemplate('city_to_city_skid');
        setIncludePostal(false);
        setCsvData(null);
        setCsvFile(null);
        setValidationResult(null);
        setImportResult(null);
        setCarrierConfig({
            carrierName: carrier?.name || '',
            currency: 'CAD',
            effectiveDate: new Date().toISOString().split('T')[0]
        });
    };

    // Download template
    const handleDownloadTemplate = async () => {
        setLoading(true);
        try {
            const result = await generateSimpleCarrierTemplate({
                templateType: selectedTemplate,
                includePostal: includePostal && selectedTemplate.includes('city')
            });

            if (result.data.success) {
                // Create and download CSV file
                const blob = new Blob([result.data.template.csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.data.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                enqueueSnackbar('Template downloaded successfully!', { variant: 'success' });
                setCurrentStep('upload');
            }
        } catch (error) {
            console.error('Download error:', error);
            enqueueSnackbar('Failed to download template', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // CSV Upload
    const onDrop = useCallback((acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
            setCsvFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const rows = text.split('\n').map(row =>
                        row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
                    );
                    const filteredRows = rows.filter(row => row.some(cell => cell.length > 0));
                    setCsvData(filteredRows);

                    enqueueSnackbar(`CSV uploaded: ${filteredRows.length - 1} data rows`, { variant: 'success' });
                    setCurrentStep('validate');
                } catch (error) {
                    enqueueSnackbar('Error parsing CSV file', { variant: 'error' });
                }
            };
            reader.readAsText(file);
        }
    }, [enqueueSnackbar]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv']
        },
        multiple: false
    });

    // Import rates
    const handleImport = async () => {
        if (!csvData || !carrier) return;

        setLoading(true);
        try {
            const result = await importSimpleCarrierRates({
                carrierId: carrier.id,
                carrierName: carrierConfig.carrierName,
                csvData: csvData,
                templateType: selectedTemplate,
                currency: carrierConfig.currency,
                effectiveDate: carrierConfig.effectiveDate
            });

            if (result.data.success) {
                setImportResult(result.data);
                enqueueSnackbar('Carrier rates imported successfully!', { variant: 'success' });
                setCurrentStep('complete');
            } else if (result.data.validationErrors) {
                setValidationResult({
                    valid: false,
                    errors: result.data.validationErrors,
                    sampleErrors: result.data.sampleErrors || []
                });
                enqueueSnackbar('CSV validation failed. Please fix errors and try again.', { variant: 'error' });
            }
        } catch (error) {
            console.error('Import error:', error);
            enqueueSnackbar('Failed to import carrier rates', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetDialog, 300);
    };

    const getStepContent = () => {
        switch (currentStep) {
            case 'template':
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <DownloadIcon sx={{ mr: 1 }} />
                            Choose Rate Template
                        </Typography>

                        <Alert severity="info" sx={{ mb: 3 }}>
                            Most carriers have simple rate tables: <strong>From/To locations</strong> with either <strong>skid-based</strong> or <strong>weight-based</strong> pricing.
                        </Alert>

                        <Grid container spacing={2}>
                            {templateOptions.map((option) => (
                                <Grid item xs={12} md={6} key={option.value}>
                                    <Card
                                        sx={{
                                            cursor: 'pointer',
                                            border: selectedTemplate === option.value ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                            '&:hover': { boxShadow: 3 }
                                        }}
                                        onClick={() => setSelectedTemplate(option.value)}
                                    >
                                        <CardContent>
                                            <Box display="flex" alignItems="center" mb={1}>
                                                {option.icon}
                                                <Typography variant="subtitle1" sx={{ ml: 1, fontWeight: 600 }}>
                                                    {option.label}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" color="textSecondary" gutterBottom>
                                                {option.description}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                                                {option.example}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>

                        {selectedTemplate.includes('city') && (
                            <Box sx={{ mt: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={includePostal}
                                            onChange={(e) => setIncludePostal(e.target.checked)}
                                        />
                                    }
                                    label="Include postal code columns (optional)"
                                />
                            </Box>
                        )}

                        <Box sx={{ mt: 3 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Carrier Name"
                                        value={carrierConfig.carrierName}
                                        onChange={(e) => setCarrierConfig(prev => ({
                                            ...prev,
                                            carrierName: e.target.value
                                        }))}
                                    />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Currency</InputLabel>
                                        <Select
                                            value={carrierConfig.currency}
                                            onChange={(e) => setCarrierConfig(prev => ({
                                                ...prev,
                                                currency: e.target.value
                                            }))}
                                            label="Currency"
                                        >
                                            <MenuItem value="CAD">CAD</MenuItem>
                                            <MenuItem value="USD">USD</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Effective Date"
                                        type="date"
                                        value={carrierConfig.effectiveDate}
                                        onChange={(e) => setCarrierConfig(prev => ({
                                            ...prev,
                                            effectiveDate: e.target.value
                                        }))}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>
                );

            case 'upload':
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <UploadIcon sx={{ mr: 1 }} />
                            Upload Your Rate CSV
                        </Typography>

                        <Alert severity="success" sx={{ mb: 2 }}>
                            Template downloaded! Fill it out with your rates and upload it here.
                        </Alert>

                        <Paper
                            {...getRootProps()}
                            sx={{
                                border: '2px dashed #ccc',
                                borderRadius: 2,
                                p: 4,
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: isDragActive ? '#f5f5f5' : 'white',
                                '&:hover': { backgroundColor: '#f9f9f9' }
                            }}
                        >
                            <input {...getInputProps()} />
                            <UploadIcon sx={{ fontSize: 48, color: '#666', mb: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                {isDragActive ? 'Drop CSV file here' : 'Upload Completed Rate CSV'}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Drag and drop your completed rate CSV file, or click to browse
                            </Typography>
                        </Paper>

                        {csvFile && (
                            <Card sx={{ mt: 2 }}>
                                <CardContent>
                                    <Typography variant="subtitle1" gutterBottom>
                                        📄 {csvFile.name}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Size: {(csvFile.size / 1024).toFixed(1)} KB
                                    </Typography>
                                    {csvData && (
                                        <Typography variant="body2" color="textSecondary">
                                            Rows: {csvData.length - 1} data rows, {csvData[0]?.length} columns
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </Box>
                );

            case 'validate':
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <CheckIcon sx={{ mr: 1 }} />
                            Validate & Preview Data
                        </Typography>

                        {csvData && (
                            <Box>
                                <Card sx={{ mb: 2 }}>
                                    <CardContent>
                                        <Typography variant="subtitle1" gutterBottom>
                                            CSV Preview (First 3 rows)
                                        </Typography>
                                        <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        {csvData[0]?.map((header, index) => (
                                                            <TableCell key={index} sx={{ fontWeight: 'bold', fontSize: '12px' }}>
                                                                {header}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {csvData.slice(1, 3).map((row, rowIndex) => (
                                                        <TableRow key={rowIndex}>
                                                            {row.map((cell, cellIndex) => (
                                                                <TableCell key={cellIndex} sx={{ fontSize: '12px' }}>
                                                                    {cell}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>

                                {validationResult && !validationResult.valid && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2">Validation Errors:</Typography>
                                        {validationResult.errors.map((error, index) => (
                                            <Typography key={index} variant="body2">• {error}</Typography>
                                        ))}
                                        {validationResult.sampleErrors.length > 0 && (
                                            <Box sx={{ mt: 1 }}>
                                                <Typography variant="subtitle2">Sample Data Issues:</Typography>
                                                {validationResult.sampleErrors.map((error, index) => (
                                                    <Typography key={index} variant="body2">• {error}</Typography>
                                                ))}
                                            </Box>
                                        )}
                                    </Alert>
                                )}

                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                    <Chip
                                        label={`${csvData.length - 1} routes`}
                                        color="primary"
                                        size="small"
                                    />
                                    <Chip
                                        label={selectedTemplate.replace(/_/g, ' ')}
                                        color="secondary"
                                        size="small"
                                    />
                                    <Chip
                                        label={carrierConfig.currency}
                                        variant="outlined"
                                        size="small"
                                    />
                                </Box>
                            </Box>
                        )}
                    </Box>
                );

            case 'complete':
                return (
                    <Box textAlign="center">
                        <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h5" gutterBottom>
                            Import Complete!
                        </Typography>
                        <Typography variant="body1" color="textSecondary" gutterBottom>
                            Successfully imported {importResult?.processedRows} rate records for {carrierConfig.carrierName}
                        </Typography>

                        <Card sx={{ mt: 3 }}>
                            <CardContent>
                                <Typography variant="subtitle1" gutterBottom>
                                    📊 Import Summary
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>Rate Card ID:</strong><br />
                                            {importResult?.rateCardId}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>Template Type:</strong><br />
                                            {importResult?.templateType?.replace(/_/g, ' ')}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        <Alert severity="success" sx={{ mt: 2 }}>
                            Your carrier rates are now available in QuickShip for real-time rating!
                        </Alert>
                    </Box>
                );

            default:
                return <div>Unknown step</div>;
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { minHeight: '600px' }
            }}
        >
            <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0', pb: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center">
                        <TruckIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Box>
                            <Typography variant="h6">
                                Simple Carrier Rate Import
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                {carrier?.name} - Upload from/to rate table
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {getStepContent()}
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid #e0e0e0', p: 2, gap: 1 }}>
                <Button onClick={handleClose} color="inherit">
                    {currentStep === 'complete' ? 'Close' : 'Cancel'}
                </Button>

                <Box sx={{ flex: 1 }} />

                {currentStep === 'template' && (
                    <Button
                        onClick={handleDownloadTemplate}
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} /> : <DownloadIcon />}
                        disabled={loading}
                    >
                        {loading ? 'Generating...' : 'Download Template'}
                    </Button>
                )}

                {currentStep === 'upload' && csvData && (
                    <Button
                        onClick={() => setCurrentStep('validate')}
                        variant="contained"
                    >
                        Validate Data
                    </Button>
                )}

                {currentStep === 'validate' && (
                    <Button
                        onClick={handleImport}
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} /> : <UploadIcon />}
                        disabled={loading || (validationResult && !validationResult.valid)}
                    >
                        {loading ? 'Importing...' : 'Import Rates'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
