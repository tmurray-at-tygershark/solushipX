import React, { useState, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, IconButton, Stepper, Step, StepLabel,
    FormControl, InputLabel, Select, MenuItem,
    Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, CircularProgress, LinearProgress, Divider,
    List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import {
    Close as CloseIcon,
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Description as FileIcon,
    PlayArrow as ProcessIcon,
    GetApp as TemplateIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const steps = ['Select Template', 'Upload File', 'Preview & Validate', 'Import Results'];

const RateCardImportDialog = ({ isOpen, onClose, carrierId, carrierName, onImportComplete }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Step 1: Template selection
    const [selectedRateType, setSelectedRateType] = useState('');
    const [template, setTemplate] = useState(null);

    // Step 2: File upload
    const [uploadedFile, setUploadedFile] = useState(null);
    const [csvContent, setCsvContent] = useState('');

    // Step 3: Preview
    const [previewData, setPreviewData] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);

    // Step 4: Results
    const [importResults, setImportResults] = useState(null);

    const rateTypes = [
        { value: 'skid_based', label: 'Skid Based', description: 'Rates based on number of skids/pallets' },
        { value: 'weight_based', label: 'Weight Based', description: 'Rates based on weight breaks' },
        { value: 'zone_based', label: 'Zone Based', description: 'Rates based on geographic zones' },
        { value: 'flat', label: 'Flat Rate', description: 'Fixed rate regardless of shipment details' }
    ];

    const handleClose = () => {
        // Reset all state
        setActiveStep(0);
        setSelectedRateType('');
        setTemplate(null);
        setUploadedFile(null);
        setCsvContent('');
        setPreviewData(null);
        setValidationErrors([]);
        setImportResults(null);
        onClose();
    };

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    // Step 1: Download template
    const handleDownloadTemplate = useCallback(async () => {
        if (!selectedRateType) {
            enqueueSnackbar('Please select a rate type first', { variant: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const generateTemplate = httpsCallable(functions, 'generateRateCardTemplate');
            const result = await generateTemplate({ rateType: selectedRateType });

            if (result.data.success) {
                const template = result.data.template;
                setTemplate(template);

                // Create and download the CSV file
                const blob = new Blob([template.content], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = template.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                enqueueSnackbar(`Template downloaded: ${template.filename}`, { variant: 'success' });
            } else {
                enqueueSnackbar('Failed to generate template', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error downloading template:', error);
            enqueueSnackbar('Error downloading template: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [selectedRateType, enqueueSnackbar]);

    // Step 2: Handle file upload
    const handleFileUpload = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
            enqueueSnackbar('Please upload a CSV file', { variant: 'error' });
            return;
        }

        setUploadedFile(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            setCsvContent(e.target.result);
        };
        reader.readAsText(file);
    }, [enqueueSnackbar]);

    // Step 3: Preview and validate
    const handlePreview = useCallback(async () => {
        if (!csvContent || !selectedRateType) return;

        setLoading(true);
        try {
            const importRateCards = httpsCallable(functions, 'importRateCards');
            const result = await importRateCards({
                carrierId,
                csvContent,
                rateType: selectedRateType,
                preview: true
            });

            if (result.data.success) {
                setPreviewData(result.data.rateCards);
                setValidationErrors([]);
                enqueueSnackbar(`Preview generated: ${result.data.rateCards.length} rate cards found`, { variant: 'success' });
            } else if (result.data.validationFailed) {
                setValidationErrors(result.data.errors);
                setPreviewData(null);
                enqueueSnackbar(`Validation failed: ${result.data.errors.length} errors found`, { variant: 'error' });
            } else {
                enqueueSnackbar('Failed to preview data', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error previewing data:', error);
            enqueueSnackbar('Error previewing data: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [csvContent, selectedRateType, carrierId, enqueueSnackbar]);

    // Step 4: Execute import
    const handleImport = useCallback(async () => {
        if (!csvContent || !selectedRateType) return;

        setLoading(true);
        try {
            const importRateCards = httpsCallable(functions, 'importRateCards');
            const result = await importRateCards({
                carrierId,
                csvContent,
                rateType: selectedRateType,
                preview: false
            });

            if (result.data.success) {
                setImportResults(result.data);
                enqueueSnackbar(`Import completed: ${result.data.summary.successful} rate cards created`, { variant: 'success' });
                handleNext(); // Move to results step

                // Notify parent component
                if (onImportComplete) {
                    onImportComplete();
                }
            } else {
                enqueueSnackbar('Import failed', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error importing rate cards:', error);
            enqueueSnackbar('Error importing rate cards: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [csvContent, selectedRateType, carrierId, enqueueSnackbar, onImportComplete]);

    const getStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                            Select Rate Card Type
                        </Typography>
                        <Typography sx={{ mb: 3, fontSize: '12px', color: '#6b7280' }}>
                            Choose the type of rate card you want to import, then download the template to see the required format.
                        </Typography>

                        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                            <InputLabel sx={{ fontSize: '12px' }}>Rate Type</InputLabel>
                            <Select
                                value={selectedRateType}
                                onChange={(e) => setSelectedRateType(e.target.value)}
                                label="Rate Type"
                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                            >
                                {rateTypes.map((type) => (
                                    <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                        <Box>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{type.label}</Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{type.description}</Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button
                            variant="contained"
                            startIcon={<TemplateIcon />}
                            onClick={handleDownloadTemplate}
                            disabled={!selectedRateType || loading}
                            fullWidth
                            sx={{ mb: 2, fontSize: '12px' }}
                        >
                            {loading ? <CircularProgress size={20} /> : 'Download Template'}
                        </Button>

                        {template && (
                            <Alert severity="success" sx={{ fontSize: '12px' }}>
                                Template downloaded: <strong>{template.filename}</strong>
                                <br />
                                Fill in your rate data and upload the completed file in the next step.
                            </Alert>
                        )}
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                            Upload CSV File
                        </Typography>
                        <Typography sx={{ mb: 3, fontSize: '12px', color: '#6b7280' }}>
                            Upload the completed CSV template with your rate card data.
                        </Typography>

                        <Box
                            sx={{
                                border: '2px dashed #e5e7eb',
                                borderRadius: 2,
                                p: 3,
                                textAlign: 'center',
                                backgroundColor: '#f9fafb',
                                mb: 2
                            }}
                        >
                            <input
                                accept=".csv"
                                style={{ display: 'none' }}
                                id="csv-upload"
                                type="file"
                                onChange={handleFileUpload}
                            />
                            <label htmlFor="csv-upload">
                                <IconButton component="span" size="large">
                                    <UploadIcon sx={{ fontSize: 40, color: '#9ca3af' }} />
                                </IconButton>
                                <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                    Click to upload CSV file
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                    Only .csv files are supported
                                </Typography>
                            </label>
                        </Box>

                        {uploadedFile && (
                            <Alert severity="success" sx={{ fontSize: '12px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <FileIcon fontSize="small" />
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            {uploadedFile.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            {Math.round(uploadedFile.size / 1024)} KB
                                        </Typography>
                                    </Box>
                                </Box>
                            </Alert>
                        )}
                    </Box>
                );

            case 2:
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                            Preview & Validate
                        </Typography>

                        {loading && (
                            <Box sx={{ mb: 2 }}>
                                <Typography sx={{ fontSize: '12px', mb: 1 }}>Processing file...</Typography>
                                <LinearProgress />
                            </Box>
                        )}

                        {validationErrors.length > 0 && (
                            <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                    Validation Errors ({validationErrors.length})
                                </Typography>
                                <List dense>
                                    {validationErrors.slice(0, 10).map((error, index) => (
                                        <ListItem key={index} sx={{ py: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 20 }}>
                                                <ErrorIcon fontSize="small" color="error" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={error}
                                                primaryTypographyProps={{ fontSize: '11px' }}
                                            />
                                        </ListItem>
                                    ))}
                                    {validationErrors.length > 10 && (
                                        <Typography sx={{ fontSize: '11px', pl: 3, color: '#6b7280' }}>
                                            ... and {validationErrors.length - 10} more errors
                                        </Typography>
                                    )}
                                </List>
                            </Alert>
                        )}

                        {previewData && (
                            <Box>
                                <Alert severity="success" sx={{ mb: 2, fontSize: '12px' }}>
                                    ✅ Validation passed! Found {previewData.length} rate card(s) ready for import.
                                </Alert>

                                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Rate Card Name</TableCell>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Currency</TableCell>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Data Points</TableCell>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {previewData.map((card, index) => (
                                                <TableRow key={index}>
                                                    <TableCell sx={{ fontSize: '12px' }}>{card.rateCardName}</TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>{card.currency}</TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>{card.dataCount} records</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            icon={<CheckIcon />}
                                                            label="Ready"
                                                            color="success"
                                                            size="small"
                                                            sx={{ fontSize: '11px' }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}

                        {!loading && !previewData && !validationErrors.length && csvContent && (
                            <Button
                                variant="contained"
                                startIcon={<ProcessIcon />}
                                onClick={handlePreview}
                                fullWidth
                                sx={{ fontSize: '12px' }}
                            >
                                Validate Data
                            </Button>
                        )}
                    </Box>
                );

            case 3:
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                            Import Results
                        </Typography>

                        {importResults && (
                            <Box>
                                <Alert
                                    severity={importResults.summary.failed > 0 ? 'warning' : 'success'}
                                    sx={{ mb: 2, fontSize: '12px' }}
                                >
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Import Summary
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px' }}>
                                        ✅ Successful: {importResults.summary.successful} rate cards
                                    </Typography>
                                    {importResults.summary.failed > 0 && (
                                        <Typography sx={{ fontSize: '11px' }}>
                                            ❌ Failed: {importResults.summary.failed} rate cards
                                        </Typography>
                                    )}
                                </Alert>

                                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Rate Card Name</TableCell>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Details</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {importResults.results.map((result, index) => (
                                                <TableRow key={index}>
                                                    <TableCell sx={{ fontSize: '12px' }}>{result.name}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            icon={result.success ? <CheckIcon /> : <ErrorIcon />}
                                                            label={result.success ? 'Success' : 'Failed'}
                                                            color={result.success ? 'success' : 'error'}
                                                            size="small"
                                                            sx={{ fontSize: '11px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {result.success ? `Created (ID: ${result.id?.slice(-8)})` : result.error}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}
                    </Box>
                );

            default:
                return 'Unknown step';
        }
    };

    const canProceed = () => {
        switch (activeStep) {
            case 0: return selectedRateType && template;
            case 1: return uploadedFile && csvContent;
            case 2: return previewData && previewData.length > 0;
            case 3: return true;
            default: return false;
        }
    };

    return (
        <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UploadIcon />
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Import Rate Cards for {carrierName}
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px' } }}>
                                {label}
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Box sx={{ minHeight: 400 }}>
                    {getStepContent(activeStep)}
                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    sx={{ fontSize: '12px' }}
                >
                    Back
                </Button>

                {activeStep === 2 && previewData && (
                    <Button
                        variant="contained"
                        onClick={handleImport}
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                    >
                        {loading ? <CircularProgress size={20} /> : 'Import Rate Cards'}
                    </Button>
                )}

                {activeStep < 2 && (
                    <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={!canProceed()}
                        sx={{ fontSize: '12px' }}
                    >
                        Next
                    </Button>
                )}

                {activeStep === 3 && (
                    <Button
                        variant="contained"
                        onClick={handleClose}
                        sx={{ fontSize: '12px' }}
                    >
                        Done
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default RateCardImportDialog;
