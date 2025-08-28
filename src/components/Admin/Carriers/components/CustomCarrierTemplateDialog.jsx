import React, { useState, useCallback, useEffect } from 'react';
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Switch,
    FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Tabs,
    Tab
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    Info as InfoIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Close as CloseIcon,
    AutoAwesome as AutoDetectIcon,
    Visibility as PreviewIcon,
    Save as SaveIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    ExpandMore as ExpandMoreIcon,
    Assignment as TemplateIcon,
    Mapping as MappingIcon,
    Settings as RulesIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase/config';

// Cloud function imports
const createCarrierTemplateMapping = httpsCallable(functions, 'createCarrierTemplateMapping');
const autoDetectCarrierCSV = httpsCallable(functions, 'autoDetectCarrierCSV');
const importWithCustomTemplate = httpsCallable(functions, 'importWithCustomTemplate');
const getCarrierTemplateMappings = httpsCallable(functions, 'getCarrierTemplateMappings');

const steps = ['Upload CSV', 'Auto-Detect Fields', 'Configure Mapping', 'Set Rules', 'Save Template'];

export default function CustomCarrierTemplateDialog({ open, onClose, carrier }) {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // CSV Upload State
    const [csvData, setCsvData] = useState(null);
    const [csvFile, setCsvFile] = useState(null);

    // Auto-Detection State
    const [detectionResults, setDetectionResults] = useState(null);
    const [existingTemplates, setExistingTemplates] = useState([]);

    // Template Configuration State
    const [templateConfig, setTemplateConfig] = useState({
        templateName: '',
        carrierName: carrier?.name || '',
        csvStructure: {
            hasHeaders: true,
            headerRow: 1,
            dataStartRow: 2,
            delimiter: ',',
            encoding: 'utf-8',
            expectedColumns: [],
            requiredColumns: []
        },
        fieldMappings: {},
        rateCalculationRules: {
            calculationType: 'explicit',
            baseUnit: 'weight',
            unitMultiplier: 1,
            weightCalculation: {
                method: 'per_lb',
                roundingRule: 'up',
                roundingIncrement: 1
            },
            fuelSurcharge: {
                type: 'percentage',
                applyTo: 'base_rate',
                defaultValue: 0
            },
            minimumCharge: {
                applyGlobally: false,
                defaultValue: 0
            }
        },
        validationRules: {
            requiredFields: [],
            numericFields: []
        }
    });

    // UI State
    const [tabValue, setTabValue] = useState(0);
    const [previewData, setPreviewData] = useState([]);

    useEffect(() => {
        if (open && carrier) {
            loadExistingTemplates();
            resetDialog();
        }
    }, [open, carrier]);

    const loadExistingTemplates = async () => {
        try {
            const result = await getCarrierTemplateMappings({ carrierId: carrier.id });
            if (result.data.success) {
                setExistingTemplates(result.data.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    const resetDialog = () => {
        setActiveStep(0);
        setCsvData(null);
        setCsvFile(null);
        setDetectionResults(null);
        setPreviewData([]);
        setTabValue(0);
        setTemplateConfig(prev => ({
            ...prev,
            templateName: '',
            carrierName: carrier?.name || '',
            fieldMappings: {},
            csvStructure: {
                ...prev.csvStructure,
                expectedColumns: [],
                requiredColumns: []
            }
        }));
    };

    // CSV Upload Handling
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
                    setCsvData(rows.filter(row => row.some(cell => cell.length > 0)));

                    // Update expected columns
                    setTemplateConfig(prev => ({
                        ...prev,
                        csvStructure: {
                            ...prev.csvStructure,
                            expectedColumns: rows[0] || []
                        }
                    }));

                    enqueueSnackbar(`CSV uploaded: ${rows.length - 1} data rows`, { variant: 'success' });
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

    // Auto-Detection
    const handleAutoDetect = async () => {
        if (!csvData || !carrier) return;

        setLoading(true);
        try {
            const result = await autoDetectCarrierCSV({
                csvData: csvData,
                carrierId: carrier.id
            });

            if (result.data.success) {
                setDetectionResults(result.data.suggestions);

                // Update template config with suggestions
                setTemplateConfig(prev => ({
                    ...prev,
                    csvStructure: {
                        ...prev.csvStructure,
                        ...result.data.suggestions.csvStructure
                    },
                    fieldMappings: result.data.suggestions.fieldMappings,
                    rateCalculationRules: {
                        ...prev.rateCalculationRules,
                        ...result.data.suggestions.rateCalculationRules
                    }
                }));

                enqueueSnackbar(
                    `Auto-detection completed (${result.data.suggestions.confidence.overall}% confidence)`,
                    { variant: 'success' }
                );
                handleNext();
            }
        } catch (error) {
            console.error('Auto-detection error:', error);
            enqueueSnackbar('Auto-detection failed', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Field Mapping Handlers
    const handleFieldMappingChange = (field, csvColumn) => {
        setTemplateConfig(prev => ({
            ...prev,
            fieldMappings: {
                ...prev.fieldMappings,
                [field]: csvColumn === '' ? null : csvColumn
            }
        }));
    };

    const handleRuleChange = (category, field, value) => {
        setTemplateConfig(prev => ({
            ...prev,
            rateCalculationRules: {
                ...prev.rateCalculationRules,
                [category]: {
                    ...prev.rateCalculationRules[category],
                    [field]: value
                }
            }
        }));
    };

    // Save Template
    const handleSaveTemplate = async () => {
        if (!templateConfig.templateName.trim()) {
            enqueueSnackbar('Template name is required', { variant: 'error' });
            return;
        }

        setLoading(true);
        try {
            const result = await createCarrierTemplateMapping({
                carrierId: carrier.id,
                templateName: templateConfig.templateName,
                carrierName: templateConfig.carrierName,
                csvStructure: templateConfig.csvStructure,
                fieldMappings: templateConfig.fieldMappings,
                rateCalculationRules: templateConfig.rateCalculationRules,
                validationRules: templateConfig.validationRules,
                sampleData: csvData?.slice(1, 6) || []
            });

            if (result.data.success) {
                enqueueSnackbar('Custom template created successfully!', { variant: 'success' });
                handleNext();
            }
        } catch (error) {
            console.error('Template save error:', error);
            enqueueSnackbar('Failed to save template', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Test Import
    const handleTestImport = async () => {
        if (!csvData) return;

        setLoading(true);
        try {
            // First save the template if not already saved
            if (activeStep < 4) {
                await handleSaveTemplate();
            }

            // TODO: Test import with the saved template
            enqueueSnackbar('Template saved and ready for testing!', { variant: 'success' });
        } catch (error) {
            console.error('Test import error:', error);
            enqueueSnackbar('Test import failed', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        setActiveStep((prevStep) => prevStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetDialog, 300);
    };

    const getStepContent = (step) => {
        switch (step) {
            case 0: // Upload CSV
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <UploadIcon sx={{ mr: 1 }} />
                            Upload Carrier CSV File
                        </Typography>

                        {existingTemplates.length > 0 && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Found {existingTemplates.length} existing template(s) for {carrier?.name}.
                                You can create a new template or update an existing one.
                            </Alert>
                        )}

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
                                {isDragActive ? 'Drop CSV file here' : 'Upload Carrier Rate CSV'}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Drag and drop your carrier's rate CSV file, or click to browse
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

            case 1: // Auto-Detect Fields
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <AutoDetectIcon sx={{ mr: 1 }} />
                            Auto-Detect Field Mappings
                        </Typography>

                        {csvData && (
                            <Box>
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    We'll analyze your CSV headers and sample data to automatically suggest field mappings.
                                </Alert>

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

                                {detectionResults && (
                                    <Card>
                                        <CardContent>
                                            <Typography variant="subtitle1" gutterBottom>
                                                🎯 Auto-Detection Results
                                            </Typography>
                                            <Chip
                                                label={`${detectionResults.confidence.overall}% Confidence`}
                                                color={detectionResults.confidence.overall > 70 ? 'success' : 'warning'}
                                                sx={{ mb: 2 }}
                                            />
                                            <Typography variant="body2" color="textSecondary">
                                                Found {Object.keys(detectionResults.fieldMappings).length} potential field mappings.
                                                You can review and adjust these in the next step.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                )}
                            </Box>
                        )}
                    </Box>
                );

            case 2: // Configure Mapping
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <MappingIcon sx={{ mr: 1 }} />
                            Configure Field Mappings
                        </Typography>

                        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
                            <Tab label="Geographic Fields" />
                            <Tab label="Rate Fields" />
                            <Tab label="Service Fields" />
                        </Tabs>

                        {tabValue === 0 && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Origin</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.origin || ''}
                                            onChange={(e) => handleFieldMappingChange('origin', e.target.value)}
                                            label="Origin"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Destination</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.destination || ''}
                                            onChange={(e) => handleFieldMappingChange('destination', e.target.value)}
                                            label="Destination"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Origin City</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.originCity || ''}
                                            onChange={(e) => handleFieldMappingChange('originCity', e.target.value)}
                                            label="Origin City"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Destination City</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.destinationCity || ''}
                                            onChange={(e) => handleFieldMappingChange('destinationCity', e.target.value)}
                                            label="Destination City"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        )}

                        {tabValue === 1 && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Base Rate</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.baseRate || ''}
                                            onChange={(e) => handleFieldMappingChange('baseRate', e.target.value)}
                                            label="Base Rate"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Total Rate</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.totalRate || ''}
                                            onChange={(e) => handleFieldMappingChange('totalRate', e.target.value)}
                                            label="Total Rate"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Fuel Surcharge %</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.fuelSurchargePct || ''}
                                            onChange={(e) => handleFieldMappingChange('fuelSurchargePct', e.target.value)}
                                            label="Fuel Surcharge %"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Minimum Charge</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.minCharge || ''}
                                            onChange={(e) => handleFieldMappingChange('minCharge', e.target.value)}
                                            label="Minimum Charge"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        )}

                        {tabValue === 2 && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Weight</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.weight || ''}
                                            onChange={(e) => handleFieldMappingChange('weight', e.target.value)}
                                            label="Weight"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Skid Count</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.skidCount || ''}
                                            onChange={(e) => handleFieldMappingChange('skidCount', e.target.value)}
                                            label="Skid Count"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Service Level</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.serviceLevel || ''}
                                            onChange={(e) => handleFieldMappingChange('serviceLevel', e.target.value)}
                                            label="Service Level"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Transit Days</InputLabel>
                                        <Select
                                            value={templateConfig.fieldMappings.transitDays || ''}
                                            onChange={(e) => handleFieldMappingChange('transitDays', e.target.value)}
                                            label="Transit Days"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {templateConfig.csvStructure.expectedColumns.map(col => (
                                                <MenuItem key={col} value={col}>{col}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        )}
                    </Box>
                );

            case 3: // Set Rules
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <RulesIcon sx={{ mr: 1 }} />
                            Configure Rate Calculation Rules
                        </Typography>

                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">Basic Calculation Settings</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Calculation Type</InputLabel>
                                            <Select
                                                value={templateConfig.rateCalculationRules.calculationType}
                                                onChange={(e) => setTemplateConfig(prev => ({
                                                    ...prev,
                                                    rateCalculationRules: {
                                                        ...prev.rateCalculationRules,
                                                        calculationType: e.target.value
                                                    }
                                                }))}
                                                label="Calculation Type"
                                            >
                                                <MenuItem value="explicit">Explicit Rates (use CSV values directly)</MenuItem>
                                                <MenuItem value="per_unit">Per Unit Calculation</MenuItem>
                                                <MenuItem value="hybrid">Hybrid Calculation</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Base Unit</InputLabel>
                                            <Select
                                                value={templateConfig.rateCalculationRules.baseUnit}
                                                onChange={(e) => setTemplateConfig(prev => ({
                                                    ...prev,
                                                    rateCalculationRules: {
                                                        ...prev.rateCalculationRules,
                                                        baseUnit: e.target.value
                                                    }
                                                }))}
                                                label="Base Unit"
                                            >
                                                <MenuItem value="weight">Weight-based</MenuItem>
                                                <MenuItem value="skid">Skid-based</MenuItem>
                                                <MenuItem value="lf">Linear Feet</MenuItem>
                                                <MenuItem value="cube">Cube-based</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">Weight Calculation Rules</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Weight Method</InputLabel>
                                            <Select
                                                value={templateConfig.rateCalculationRules.weightCalculation.method}
                                                onChange={(e) => handleRuleChange('weightCalculation', 'method', e.target.value)}
                                                label="Weight Method"
                                            >
                                                <MenuItem value="per_lb">Per Pound</MenuItem>
                                                <MenuItem value="per_100lbs">Per 100 Pounds</MenuItem>
                                                <MenuItem value="flat_rate">Flat Rate</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Rounding Rule</InputLabel>
                                            <Select
                                                value={templateConfig.rateCalculationRules.weightCalculation.roundingRule}
                                                onChange={(e) => handleRuleChange('weightCalculation', 'roundingRule', e.target.value)}
                                                label="Rounding Rule"
                                            >
                                                <MenuItem value="up">Round Up</MenuItem>
                                                <MenuItem value="down">Round Down</MenuItem>
                                                <MenuItem value="nearest">Round to Nearest</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Rounding Increment"
                                            type="number"
                                            value={templateConfig.rateCalculationRules.weightCalculation.roundingIncrement}
                                            onChange={(e) => handleRuleChange('weightCalculation', 'roundingIncrement', parseFloat(e.target.value))}
                                        />
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">Fuel Surcharge Settings</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Fuel Surcharge Type</InputLabel>
                                            <Select
                                                value={templateConfig.rateCalculationRules.fuelSurcharge.type}
                                                onChange={(e) => handleRuleChange('fuelSurcharge', 'type', e.target.value)}
                                                label="Fuel Surcharge Type"
                                            >
                                                <MenuItem value="percentage">Percentage</MenuItem>
                                                <MenuItem value="flat">Flat Amount</MenuItem>
                                                <MenuItem value="embedded">Embedded in Rate</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Apply To</InputLabel>
                                            <Select
                                                value={templateConfig.rateCalculationRules.fuelSurcharge.applyTo}
                                                onChange={(e) => handleRuleChange('fuelSurcharge', 'applyTo', e.target.value)}
                                                label="Apply To"
                                            >
                                                <MenuItem value="base_rate">Base Rate</MenuItem>
                                                <MenuItem value="total_rate">Total Rate</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                );

            case 4: // Save Template
                return (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                            <TemplateIcon sx={{ mr: 1 }} />
                            Save Custom Template
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Template Name"
                                    value={templateConfig.templateName}
                                    onChange={(e) => setTemplateConfig(prev => ({
                                        ...prev,
                                        templateName: e.target.value
                                    }))}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Carrier Name"
                                    value={templateConfig.carrierName}
                                    onChange={(e) => setTemplateConfig(prev => ({
                                        ...prev,
                                        carrierName: e.target.value
                                    }))}
                                />
                            </Grid>
                        </Grid>

                        <Card sx={{ mt: 2 }}>
                            <CardContent>
                                <Typography variant="subtitle1" gutterBottom>
                                    📋 Template Summary
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>Field Mappings:</strong> {Object.keys(templateConfig.fieldMappings).filter(k => templateConfig.fieldMappings[k]).length}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>Calculation Type:</strong> {templateConfig.rateCalculationRules.calculationType}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>Base Unit:</strong> {templateConfig.rateCalculationRules.baseUnit}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>CSV Columns:</strong> {templateConfig.csvStructure.expectedColumns.length}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>Weight Method:</strong> {templateConfig.rateCalculationRules.weightCalculation.method}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            <strong>Fuel Surcharge:</strong> {templateConfig.rateCalculationRules.fuelSurcharge.type}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
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
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { minHeight: '600px' }
            }}
        >
            <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0', pb: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center">
                        <TemplateIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Box>
                            <Typography variant="h6">
                                Create Custom Template
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                {carrier?.name} - Custom CSV Rate Import
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {getStepContent(activeStep)}
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid #e0e0e0', p: 2, gap: 1 }}>
                <Button onClick={handleClose} color="inherit">
                    Cancel
                </Button>

                <Box sx={{ flex: 1 }} />

                {activeStep === 1 && csvData && (
                    <Button
                        onClick={handleAutoDetect}
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} /> : <AutoDetectIcon />}
                        disabled={loading}
                    >
                        {loading ? 'Analyzing...' : 'Auto-Detect Fields'}
                    </Button>
                )}

                {activeStep > 0 && (
                    <Button onClick={handleBack} disabled={loading}>
                        Back
                    </Button>
                )}

                {activeStep < steps.length - 1 && activeStep !== 1 && (
                    <Button
                        onClick={handleNext}
                        variant="contained"
                        disabled={!csvData || (activeStep === 0 && !csvFile)}
                    >
                        Next
                    </Button>
                )}

                {activeStep === steps.length - 1 && (
                    <Button
                        onClick={handleSaveTemplate}
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
                        disabled={loading || !templateConfig.templateName.trim()}
                    >
                        {loading ? 'Saving...' : 'Save Template'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
