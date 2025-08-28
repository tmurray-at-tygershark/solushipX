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
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    Chip,
    IconButton,
    Divider,
    Paper
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    Info as InfoIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const getRateTemplates = httpsCallable(functions, 'getRateTemplates');
const generateRateTemplate = httpsCallable(functions, 'generateRateTemplate');
const importRateCard = httpsCallable(functions, 'importRateCard');

// Simple carrier functions
const generateSimpleCarrierTemplate = httpsCallable(functions, 'generateSimpleCarrierTemplate');
const importSimpleCarrierRates = httpsCallable(functions, 'importSimpleCarrierRates');

const STEPS = ['Select Template', 'Configure Rate Card', 'Upload CSV', 'Review & Import'];

export default function CarrierRateUploadDialog({ open, onClose, carrier }) {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [templates, setTemplates] = useState({});
    const [loading, setLoading] = useState(false);
    const [csvData, setCsvData] = useState(null);
    const [csvFile, setCsvFile] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [importResult, setImportResult] = useState(null);

    // Rate card configuration
    const [rateCardConfig, setRateCardConfig] = useState({
        rateCardName: '',
        currency: 'CAD',
        serviceLevel: 'Standard'
    });

    // Load templates when dialog opens
    React.useEffect(() => {
        if (open) {
            loadTemplates();
            resetDialog();
        }
    }, [open]);

    const loadTemplates = async () => {
        try {
            const result = await getRateTemplates();
            if (result.data.success) {
                // Add simple carrier templates at the top (most common)
                const simpleTemplates = {
                    'city_to_city_skid': {
                        name: 'City to City - Skid Rates',
                        description: 'Most common: From/To cities with 1-26 skid pricing',
                        icon: '🏙️',
                        complexity: 'simple',
                        recommended: true,
                        fields: ['From_City', 'To_City', 'Min_Weight', 'Skid_Rates'],
                        isSimple: true
                    },
                    'city_to_city_weight': {
                        name: 'City to City - Weight Rates',
                        description: 'From/To cities with weight-based pricing per 100lbs',
                        icon: '⚖️',
                        complexity: 'simple',
                        fields: ['From_City', 'To_City', 'Weight_Min', 'Weight_Max', 'Rate_Per_100Lbs', 'Min_Charge'],
                        isSimple: true
                    },
                    'postal_to_postal_skid': {
                        name: 'Postal to Postal - Skid Rates',
                        description: 'FSA postal codes with skid pricing (M5V → H3B)',
                        icon: '📦',
                        complexity: 'simple',
                        fields: ['From_Postal_FSA', 'To_Postal_FSA', 'Min_Weight', 'Skid_Rates'],
                        isSimple: true
                    },
                    'postal_to_postal_weight': {
                        name: 'Postal to Postal - Weight Rates',
                        description: 'FSA postal codes with weight-based pricing',
                        icon: '🚛',
                        complexity: 'simple',
                        fields: ['From_Postal_FSA', 'To_Postal_FSA', 'Weight_Min', 'Weight_Max', 'Rate_Per_100Lbs', 'Min_Charge'],
                        isSimple: true
                    }
                };

                // Combine simple templates with existing complex templates
                setTemplates({ ...simpleTemplates, ...result.data.templates });
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            enqueueSnackbar('Failed to load rate templates', { variant: 'error' });
        }
    };

    const resetDialog = () => {
        setActiveStep(0);
        setSelectedTemplate('');
        setCsvData(null);
        setCsvFile(null);
        setValidationErrors([]);
        setImportResult(null);
        setRateCardConfig({
            rateCardName: '',
            currency: 'CAD',
            serviceLevel: 'Standard'
        });
    };

    const handleNext = () => {
        setActiveStep((prevStep) => prevStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const handleTemplateSelect = (templateType) => {
        setSelectedTemplate(templateType);
        const template = templates[templateType];
        setRateCardConfig(prev => ({
            ...prev,
            rateCardName: `${carrier?.name || 'Carrier'} ${template?.name || 'Rate Card'}`
        }));
    };

    const handleDownloadTemplate = async () => {
        if (!selectedTemplate) return;

        setLoading(true);
        try {
            const selectedTemplateData = templates[selectedTemplate];
            let result;

            // Check if this is a simple template or complex template
            if (selectedTemplateData?.isSimple) {
                // Use simple carrier template function
                result = await generateSimpleCarrierTemplate({
                    templateType: selectedTemplate,
                    includePostal: false
                });
            } else {
                // Use existing complex template function
                result = await generateRateTemplate({ templateType: selectedTemplate });
            }

            if (result.data.success) {
                // Create and download CSV file
                const csvContent = result.data.template?.csvContent || result.data.csvContent;
                const fileName = result.data.fileName || `${selectedTemplate}_template.csv`;

                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                enqueueSnackbar('Template downloaded successfully', { variant: 'success' });
            }
        } catch (error) {
            console.error('Error downloading template:', error);
            enqueueSnackbar('Failed to download template', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const onDrop = useCallback((acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
            setCsvFile(file);
            Papa.parse(file, {
                complete: (results) => {
                    setCsvData(results.data);
                    setValidationErrors([]);
                },
                header: false,
                skipEmptyLines: true
            });
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv']
        },
        multiple: false
    });

    const handleImport = async () => {
        if (!csvData || !selectedTemplate || !carrier) return;

        setLoading(true);
        try {
            const selectedTemplateData = templates[selectedTemplate];
            let result;

            // Check if this is a simple template or complex template
            if (selectedTemplateData?.isSimple) {
                // Use simple carrier import function
                result = await importSimpleCarrierRates({
                    carrierId: carrier.id,
                    carrierName: carrier.name,
                    csvData: csvData,
                    templateType: selectedTemplate,
                    currency: rateCardConfig.currency,
                    effectiveDate: new Date().toISOString()
                });
            } else {
                // Use existing complex import function
                result = await importRateCard({
                    carrierId: carrier.id,
                    templateType: selectedTemplate,
                    csvData: csvData,
                    rateCardName: rateCardConfig.rateCardName,
                    currency: rateCardConfig.currency,
                    serviceLevel: rateCardConfig.serviceLevel
                });
            }

            if (result.data.success) {
                setImportResult(result.data);
                enqueueSnackbar('Rate card imported successfully!', { variant: 'success' });
                handleNext();
            } else if (result.data.validationFailed || result.data.validationErrors) {
                const errors = result.data.errors || result.data.validationErrors || [];
                setValidationErrors(errors);
                enqueueSnackbar('CSV validation failed. Please fix errors and try again.', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error importing rate card:', error);
            enqueueSnackbar('Failed to import rate card', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetDialog, 300); // Allow dialog to close before resetting
    };

    const getStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Choose Rate Structure
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Select the pricing model that best fits your carrier's rate structure
                        </Typography>

                        <Grid container spacing={2}>
                            {Object.entries(templates).map(([key, template]) => (
                                <Grid item xs={12} sm={6} key={key}>
                                    <Card
                                        sx={{
                                            cursor: 'pointer',
                                            border: selectedTemplate === key ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                                            backgroundColor: selectedTemplate === key ? '#f3f4f6' : 'white',
                                            '&:hover': {
                                                borderColor: '#7c3aed',
                                                backgroundColor: '#f9fafb'
                                            },
                                            transition: 'all 0.2s'
                                        }}
                                        onClick={() => handleTemplateSelect(key)}
                                    >
                                        <CardContent sx={{ p: 2 }}>
                                            <Box display="flex" alignItems="center" mb={1}>
                                                <Typography sx={{ fontSize: '20px', mr: 1 }}>
                                                    {template.icon}
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                    {template.name}
                                                    {template.recommended && (
                                                        <Chip
                                                            label="Recommended"
                                                            size="small"
                                                            color="primary"
                                                            sx={{ ml: 1, fontSize: '10px', height: '18px' }}
                                                        />
                                                    )}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 1 }}>
                                                {template.description}
                                            </Typography>
                                            <Box display="flex" flexWrap="wrap" gap={0.5}>
                                                {template.fields.slice(0, 3).map((field) => (
                                                    <Chip
                                                        key={field}
                                                        label={field.replace(/_/g, ' ')}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '9px', height: '16px' }}
                                                    />
                                                ))}
                                                {template.fields.length > 3 && (
                                                    <Chip
                                                        label={`+${template.fields.length - 3} more`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '9px', height: '16px' }}
                                                    />
                                                )}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Configure Rate Card
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Set up your rate card details and download the template
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Rate Card Name"
                                    value={rateCardConfig.rateCardName}
                                    onChange={(e) => setRateCardConfig(prev => ({ ...prev, rateCardName: e.target.value }))}
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                    <Select
                                        value={rateCardConfig.currency}
                                        label="Currency"
                                        onChange={(e) => setRateCardConfig(prev => ({ ...prev, currency: e.target.value }))}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD (Canadian Dollar)</MenuItem>
                                        <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD (US Dollar)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Service Level</InputLabel>
                                    <Select
                                        value={rateCardConfig.serviceLevel}
                                        label="Service Level"
                                        onChange={(e) => setRateCardConfig(prev => ({ ...prev, serviceLevel: e.target.value }))}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <MenuItem value="Standard" sx={{ fontSize: '12px' }}>Standard</MenuItem>
                                        <MenuItem value="Express" sx={{ fontSize: '12px' }}>Express</MenuItem>
                                        <MenuItem value="Economy" sx={{ fontSize: '12px' }}>Economy</MenuItem>
                                        <MenuItem value="Overnight" sx={{ fontSize: '12px' }}>Overnight</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 3 }} />

                        <Paper sx={{ p: 2, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" gutterBottom sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                📋 Template Information
                            </Typography>
                            {selectedTemplate && templates[selectedTemplate] && (
                                <Box>
                                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                        {templates[selectedTemplate].description}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Required Fields:
                                    </Typography>
                                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                                        {templates[selectedTemplate].fields.map((field) => (
                                            <Chip
                                                key={field}
                                                label={field.replace(/_/g, ' ')}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '10px', height: '18px' }}
                                            />
                                        ))}
                                    </Box>
                                    <Button
                                        variant="contained"
                                        startIcon={<DownloadIcon />}
                                        onClick={handleDownloadTemplate}
                                        disabled={loading}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {loading ? 'Generating...' : 'Download Template'}
                                    </Button>
                                </Box>
                            )}
                        </Paper>
                    </Box>
                );

            case 2:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Upload CSV File
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Upload your completed rate card CSV file
                        </Typography>

                        <Paper
                            {...getRootProps()}
                            sx={{
                                p: 4,
                                textAlign: 'center',
                                border: '2px dashed #d1d5db',
                                backgroundColor: isDragActive ? '#f3f4f6' : '#fafafa',
                                cursor: 'pointer',
                                '&:hover': {
                                    borderColor: '#7c3aed',
                                    backgroundColor: '#f9fafb'
                                },
                                transition: 'all 0.2s'
                            }}
                        >
                            <input {...getInputProps()} />
                            <UploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                {isDragActive ? 'Drop the CSV file here' : 'Drag & drop your CSV file here'}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                or click to browse and select a file
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                Supported formats: .csv
                            </Typography>
                        </Paper>

                        {csvFile && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    File uploaded: <strong>{csvFile.name}</strong> ({csvData?.length - 1} data rows)
                                </Typography>
                            </Alert>
                        )}

                        {validationErrors.length > 0 && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                    Validation Errors:
                                </Typography>
                                {validationErrors.map((error, index) => (
                                    <Typography key={index} sx={{ fontSize: '11px' }}>
                                        • {error}
                                    </Typography>
                                ))}
                            </Alert>
                        )}

                        {csvData && csvData.length > 1 && (
                            <Paper sx={{ mt: 2, p: 2, backgroundColor: '#f8fafc' }}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                    CSV Preview (First 5 rows)
                                </Typography>
                                <Box sx={{ overflow: 'auto', maxHeight: 200 }}>
                                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                {csvData[0].map((header, index) => (
                                                    <th key={index} style={{
                                                        padding: '4px 8px',
                                                        backgroundColor: '#e5e7eb',
                                                        border: '1px solid #d1d5db',
                                                        fontSize: '10px',
                                                        fontWeight: 600
                                                    }}>
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvData.slice(1, 6).map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    {row.map((cell, cellIndex) => (
                                                        <td key={cellIndex} style={{
                                                            padding: '4px 8px',
                                                            border: '1px solid #d1d5db',
                                                            fontSize: '10px'
                                                        }}>
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Box>
                            </Paper>
                        )}
                    </Box>
                );

            case 3:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Review & Import
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Review your rate card configuration and import
                        </Typography>

                        {importResult ? (
                            <Paper sx={{ p: 3, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <Box display="flex" alignItems="center" mb={2}>
                                    <CheckIcon sx={{ color: '#16a34a', mr: 1 }} />
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#16a34a' }}>
                                        Import Successful!
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Rate Card Name:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{importResult.rateCardName}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Records Imported:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{importResult.recordCount}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Template Type:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{importResult.summary?.type}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Coverage:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{importResult.summary?.coverage}</Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        ) : (
                            <Paper sx={{ p: 3, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                    Import Summary
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Carrier:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{carrier?.name}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Template Type:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{templates[selectedTemplate]?.name}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Rate Card Name:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{rateCardConfig.rateCardName}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Data Rows:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{csvData ? csvData.length - 1 : 0}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Currency:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{rateCardConfig.currency}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Service Level:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{rateCardConfig.serviceLevel}</Typography>
                                    </Grid>
                                </Grid>

                                {csvData && csvData.length > 1 && (
                                    <Button
                                        variant="contained"
                                        startIcon={loading ? <CircularProgress size={16} /> : <UploadIcon />}
                                        onClick={handleImport}
                                        disabled={loading || validationErrors.length > 0}
                                        sx={{ mt: 2, fontSize: '12px' }}
                                    >
                                        {loading ? 'Importing...' : 'Import Rate Card'}
                                    </Button>
                                )}
                            </Paper>
                        )}
                    </Box>
                );

            default:
                return null;
        }
    };

    const canProceed = () => {
        switch (activeStep) {
            case 0:
                return selectedTemplate !== '';
            case 1:
                return rateCardConfig.rateCardName.trim() !== '';
            case 2:
                return csvData && csvData.length > 1 && validationErrors.length === 0;
            case 3:
                return importResult !== null;
            default:
                return false;
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    minHeight: 600,
                    borderRadius: '8px'
                }
            }}
        >
            <DialogTitle sx={{
                borderBottom: '1px solid #e5e7eb',
                p: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Box>
                    <Typography variant="h5" sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                        Upload Rate Card - {carrier?.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Import carrier rates using CSV templates
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {STEPS.map((label) => (
                        <Step key={label}>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px' } }}>
                                {label}
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {getStepContent(activeStep)}
            </DialogContent>

            <DialogActions sx={{
                borderTop: '1px solid #e5e7eb',
                p: 3,
                gap: 1,
                justifyContent: 'space-between'
            }}>
                <Box>
                    {activeStep > 0 && (
                        <Button
                            onClick={handleBack}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Back
                        </Button>
                    )}
                </Box>

                <Box display="flex" gap={1}>
                    <Button
                        onClick={handleClose}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>

                    {activeStep < STEPS.length - 1 ? (
                        <Button
                            variant="contained"
                            onClick={handleNext}
                            disabled={!canProceed()}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Next
                        </Button>
                    ) : (
                        importResult && (
                            <Button
                                variant="contained"
                                onClick={handleClose}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Done
                            </Button>
                        )
                    )}
                </Box>
            </DialogActions>
        </Dialog>
    );
}
