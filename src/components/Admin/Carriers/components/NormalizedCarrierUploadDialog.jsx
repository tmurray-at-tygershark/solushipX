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
    Paper,
    Tabs,
    Tab,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    Info as InfoIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Close as CloseIcon,
    Factory as TerminalIcon,
    LocalShipping as SkidIcon,
    Map as ZoneIcon,
    Build as HybridIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const getCarrierImportFormats = httpsCallable(functions, 'getCarrierImportFormats');
const generateNormalizedTemplate = httpsCallable(functions, 'generateNormalizedTemplate');
const importNormalizedCarrierConfig = httpsCallable(functions, 'importNormalizedCarrierConfig');

const STEPS = ['Select Format', 'Configure Templates', 'Upload Files', 'Review & Import'];

export default function NormalizedCarrierUploadDialog({ open, onClose, carrier }) {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [selectedFormat, setSelectedFormat] = useState('');
    const [formats, setFormats] = useState({});
    const [loading, setLoading] = useState(false);
    const [uploadedTemplates, setUploadedTemplates] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [importResult, setImportResult] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    // Configuration
    const [configName, setConfigName] = useState('');
    const [currency, setCurrency] = useState('CAD');

    // Load formats when dialog opens
    React.useEffect(() => {
        if (open) {
            loadImportFormats();
            resetDialog();
        }
    }, [open]);

    const loadImportFormats = async () => {
        try {
            const result = await getCarrierImportFormats();
            if (result.data.success) {
                setFormats(result.data.formats);
            }
        } catch (error) {
            console.error('Error loading import formats:', error);
            enqueueSnackbar('Failed to load import formats', { variant: 'error' });
        }
    };

    const resetDialog = () => {
        setActiveStep(0);
        setSelectedFormat('');
        setUploadedTemplates({});
        setValidationErrors({});
        setImportResult(null);
        setActiveTab(0);
        setConfigName('');
        setCurrency('CAD');
    };

    const handleNext = () => {
        setActiveStep((prevStep) => prevStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const handleFormatSelect = (formatKey) => {
        setSelectedFormat(formatKey);
        const format = formats[formatKey];
        setConfigName(`${carrier?.name || 'Carrier'} ${format?.name || 'Configuration'}`);
    };

    const handleDownloadTemplate = async (templateType) => {
        if (!selectedFormat) return;

        setLoading(true);
        try {
            const result = await generateNormalizedTemplate({
                format: selectedFormat,
                templateType,
                carrierId: carrier?.id
            });

            if (result.data.success) {
                // Create and download CSV file
                const blob = new Blob([result.data.csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = result.data.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                enqueueSnackbar(`${result.data.fileName} downloaded successfully`, { variant: 'success' });
            }
        } catch (error) {
            console.error('Error downloading template:', error);
            enqueueSnackbar('Failed to download template', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const createDropzone = (templateType, templateInfo) => {
        const onDrop = useCallback((acceptedFiles) => {
            const file = acceptedFiles[0];
            if (file) {
                Papa.parse(file, {
                    complete: (results) => {
                        setUploadedTemplates(prev => ({
                            ...prev,
                            [templateType]: {
                                file,
                                data: results.data,
                                fileName: file.name
                            }
                        }));
                        setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors[templateType];
                            return newErrors;
                        });
                    },
                    header: false,
                    skipEmptyLines: true
                });
            }
        }, [templateType]);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
            onDrop,
            accept: {
                'text/csv': ['.csv'],
                'application/vnd.ms-excel': ['.csv']
            },
            multiple: false
        });

        const hasFile = uploadedTemplates[templateType];
        const hasError = validationErrors[templateType];

        return (
            <Box key={templateType} mb={2}>
                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                    {templateInfo.name}
                    {templateInfo.required && (
                        <Chip label="Required" size="small" color="error" sx={{ ml: 1, fontSize: '10px', height: '18px' }} />
                    )}
                </Typography>

                <Paper
                    {...getRootProps()}
                    sx={{
                        p: 2,
                        textAlign: 'center',
                        border: hasError ? '2px dashed #ef4444' : hasFile ? '2px dashed #10b981' : '2px dashed #d1d5db',
                        backgroundColor: isDragActive ? '#f3f4f6' : hasFile ? '#f0fdf4' : '#fafafa',
                        cursor: 'pointer',
                        '&:hover': {
                            borderColor: '#7c3aed',
                            backgroundColor: '#f9fafb'
                        },
                        transition: 'all 0.2s'
                    }}
                >
                    <input {...getInputProps()} />
                    {hasFile ? (
                        <Box>
                            <CheckIcon sx={{ fontSize: 32, color: '#10b981', mb: 1 }} />
                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                                {hasFile.fileName}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                {hasFile.data.length - 1} data rows uploaded
                            </Typography>
                        </Box>
                    ) : (
                        <Box>
                            <UploadIcon sx={{ fontSize: 32, color: '#9ca3af', mb: 1 }} />
                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                {isDragActive ? 'Drop CSV file here' : 'Upload CSV or drag & drop'}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                {templateInfo.file}
                            </Typography>
                        </Box>
                    )}
                </Paper>

                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadTemplate(templateType)}
                        disabled={loading}
                        sx={{ fontSize: '11px' }}
                    >
                        Download Template
                    </Button>

                    {hasFile && (
                        <Button
                            variant="text"
                            size="small"
                            color="error"
                            onClick={() => {
                                setUploadedTemplates(prev => {
                                    const newTemplates = { ...prev };
                                    delete newTemplates[templateType];
                                    return newTemplates;
                                });
                            }}
                            sx={{ fontSize: '11px' }}
                        >
                            Remove
                        </Button>
                    )}
                </Box>

                {hasError && (
                    <Alert severity="error" sx={{ mt: 1, fontSize: '11px' }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 0.5 }}>
                            Validation Errors:
                        </Typography>
                        {hasError.map((error, index) => (
                            <Typography key={index} sx={{ fontSize: '10px' }}>
                                • {error}
                            </Typography>
                        ))}
                    </Alert>
                )}
            </Box>
        );
    };

    const handleImport = async () => {
        if (!selectedFormat || !carrier || Object.keys(uploadedTemplates).length === 0) return;

        setLoading(true);
        try {
            const templates = {};
            Object.entries(uploadedTemplates).forEach(([templateType, templateData]) => {
                templates[templateType] = templateData.data;
            });

            const result = await importNormalizedCarrierConfig({
                carrierId: carrier.id,
                format: selectedFormat,
                templates,
                configName,
                currency
            });

            if (result.data.success) {
                setImportResult(result.data);
                enqueueSnackbar('Carrier configuration imported successfully!', { variant: 'success' });
                handleNext();
            } else if (result.data.validationFailed) {
                setValidationErrors(result.data.errors || {});
                enqueueSnackbar('Configuration validation failed. Please fix errors and try again.', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error importing configuration:', error);
            enqueueSnackbar('Failed to import carrier configuration', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const getFormatIcon = (formatKey) => {
        const icons = {
            terminal_weight_based: <TerminalIcon />,
            skid_based: <SkidIcon />,
            zone_matrix: <ZoneIcon />,
            hybrid_terminal_zone: <HybridIcon />
        };
        return icons[formatKey] || <InfoIcon />;
    };

    const getComplexityColor = (complexity) => {
        const colors = {
            simple: '#10b981',
            medium: '#f59e0b',
            advanced: '#ef4444',
            expert: '#8b5cf6'
        };
        return colors[complexity] || '#6b7280';
    };

    const getStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Choose Import Format
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Select the format that matches your carrier's rate structure
                        </Typography>

                        <Grid container spacing={2}>
                            {Object.entries(formats).map(([key, format]) => (
                                <Grid item xs={12} sm={6} key={key}>
                                    <Card
                                        sx={{
                                            cursor: 'pointer',
                                            border: selectedFormat === key ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                                            backgroundColor: selectedFormat === key ? '#f3f4f6' : 'white',
                                            '&:hover': {
                                                borderColor: '#7c3aed',
                                                backgroundColor: '#f9fafb'
                                            },
                                            transition: 'all 0.2s',
                                            minHeight: 180
                                        }}
                                        onClick={() => handleFormatSelect(key)}
                                    >
                                        <CardContent sx={{ p: 2 }}>
                                            <Box display="flex" alignItems="center" mb={1}>
                                                <Typography sx={{ fontSize: '24px', mr: 1 }}>
                                                    {format.icon}
                                                </Typography>
                                                <Box flex={1}>
                                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                        {format.name}
                                                    </Typography>
                                                    <Chip
                                                        label={format.complexity}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '9px',
                                                            height: '16px',
                                                            backgroundColor: getComplexityColor(format.complexity),
                                                            color: 'white'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 1 }}>
                                                {format.description}
                                            </Typography>
                                            {format.example && (
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontSize: '10px', fontWeight: 600, color: '#374151', mb: 0.5 }}>
                                                        Example: {format.example.carrier}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '9px', color: '#6b7280' }}>
                                                        {format.example.description}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                );

            case 1:
                const selectedFormatInfo = formats[selectedFormat];
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Configure Import Settings
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Set up your configuration details
                        </Typography>

                        <Grid container spacing={3} mb={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Configuration Name"
                                    value={configName}
                                    onChange={(e) => setConfigName(e.target.value)}
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                    <Select
                                        value={currency}
                                        label="Currency"
                                        onChange={(e) => setCurrency(e.target.value)}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD (Canadian Dollar)</MenuItem>
                                        <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD (US Dollar)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {selectedFormatInfo && (
                            <Paper sx={{ p: 2, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Typography variant="h6" gutterBottom sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    📋 {selectedFormatInfo.name} Requirements
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    {selectedFormatInfo.description}
                                </Typography>

                                <Box>
                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Required Templates:
                                    </Typography>
                                    {selectedFormatInfo.templates?.map((template, index) => (
                                        <Box key={index} display="flex" alignItems="center" mb={0.5}>
                                            <Chip
                                                label={template.required ? 'Required' : 'Optional'}
                                                size="small"
                                                color={template.required ? 'error' : 'default'}
                                                sx={{ fontSize: '9px', height: '16px', mr: 1 }}
                                            />
                                            <Typography sx={{ fontSize: '10px' }}>
                                                {template.name} ({template.file})
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        )}
                    </Box>
                );

            case 2:
                const templates = formats[selectedFormat]?.templates || [];
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Upload Template Files
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Upload your completed CSV files for each required template
                        </Typography>

                        <Box>
                            {templates.map((template, index) =>
                                createDropzone(template.file.replace('_template.csv', '').replace('.csv', ''), template)
                            )}
                        </Box>
                    </Box>
                );

            case 3:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Review & Import
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Review your configuration and import to the system
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
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Configuration Name:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{importResult.configName}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Total Records:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{importResult.totalRecords}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Format:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{importResult.format}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Currency:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{currency}</Typography>
                                    </Grid>
                                </Grid>

                                {importResult.summary?.details && (
                                    <Box mt={2}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Details:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            {JSON.stringify(importResult.summary.details, null, 2)}
                                        </Typography>
                                    </Box>
                                )}
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
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Format:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{formats[selectedFormat]?.name}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Configuration:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{configName}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Templates Uploaded:</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{Object.keys(uploadedTemplates).length}</Typography>
                                    </Grid>
                                </Grid>

                                {Object.keys(uploadedTemplates).length > 0 && (
                                    <Button
                                        variant="contained"
                                        startIcon={loading ? <CircularProgress size={16} /> : <UploadIcon />}
                                        onClick={handleImport}
                                        disabled={loading}
                                        sx={{ mt: 2, fontSize: '12px' }}
                                    >
                                        {loading ? 'Importing...' : 'Import Configuration'}
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
                return selectedFormat !== '';
            case 1:
                return configName.trim() !== '';
            case 2:
                const selectedFormatInfo = formats[selectedFormat];
                const requiredTemplates = selectedFormatInfo?.templates?.filter(t => t.required) || [];
                return requiredTemplates.every(template => {
                    const templateKey = template.file.replace('_template.csv', '').replace('.csv', '');
                    return uploadedTemplates[templateKey];
                });
            case 3:
                return importResult !== null;
            default:
                return false;
        }
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetDialog, 300);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    minHeight: 700,
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
                        Import Carrier Configuration - {carrier?.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Advanced carrier rate configuration with terminal mapping
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
