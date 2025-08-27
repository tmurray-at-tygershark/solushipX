import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    LinearProgress,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tabs,
    Tab,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    Badge,
    CircularProgress,
    Switch,
    FormControlLabel,
    TextField,
    Autocomplete,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Psychology as AIIcon,
    AutoFixHigh as EnhanceIcon,
    CheckCircle as CheckIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Visibility as ViewIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    TrendingUp as TrendingUpIcon,
    Speed as SpeedIcon,
    Security as SecurityIcon,
    ExpandMore as ExpandMoreIcon,
    Assignment as AssignmentIcon,
    LocalShipping as ShippingIcon,
    AttachMoney as MoneyIcon,
    Dashboard as DashboardIcon,
    School as TrainingIcon,
    PlayArrow as ProcessIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';

/**
 * 🚀 UNIFIED INVOICE PROCESSOR
 * 
 * Revolutionary AI-powered invoice processing system that seamlessly integrates:
 * - Training and production processing
 * - Multi-modal AI analysis with Gemini 2.5 Flash
 * - Intelligent shipment matching
 * - Confidence-based routing
 * - Continuous learning from corrections
 */

const PROCESSING_MODES = [
    {
        id: 'production',
        name: 'Production Processing',
        description: 'High-speed processing for live invoice processing',
        icon: <SpeedIcon />,
        color: 'primary'
    },
    {
        id: 'training',
        name: 'Training Mode',
        description: 'Train AI models with new carrier formats',
        icon: <TrainingIcon />,
        color: 'secondary'
    },
    {
        id: 'hybrid',
        name: 'Smart Hybrid',
        description: 'Process invoices while continuously learning',
        icon: <EnhanceIcon />,
        color: 'success'
    }
];

const CONFIDENCE_LEVELS = {
    high: { color: 'success', label: 'High Confidence', threshold: 0.9 },
    medium: { color: 'warning', label: 'Medium Confidence', threshold: 0.7 },
    low: { color: 'error', label: 'Low Confidence', threshold: 0.0 }
};

export default function UnifiedInvoiceProcessor() {
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth();
    const { companyIdForAddress } = useCompany();

    // Processing state
    const [processingMode, setProcessingMode] = useState('hybrid');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingStage, setProcessingStage] = useState('');

    // Upload state
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [carrierOptions, setCarrierOptions] = useState([]);

    // Results state
    const [processingResults, setProcessingResults] = useState([]);
    const [selectedResult, setSelectedResult] = useState(null);
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

    // Carrier management state
    const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
    const [newCarrierName, setNewCarrierName] = useState('');

    // UI state
    const [activeTab, setActiveTab] = useState(0);
    const [expandedAccordions, setExpandedAccordions] = useState(new Set(['overview']));

    // Advanced options
    const [advancedOptions, setAdvancedOptions] = useState({
        enableAutoUpdate: true,
        confidenceThreshold: 0.8,
        enableLearning: true,
        batchProcessing: false
    });

    // Load carriers on mount
    useEffect(() => {
        loadCarriers();
    }, []);

    const loadCarriers = async () => {
        try {
            const getCarriers = httpsCallable(functions, 'getCarrierManagementCarriers');
            const result = await getCarriers();

            if (result.data?.success) {
                const carrierList = [
                    { id: 'auto-detect', name: 'Auto-Detect (Recommended)', intelligent: true },
                    ...result.data.carriers.map(c => ({
                        id: c.id,
                        name: c.name,
                        confidence: c.confidence,
                        sampleCount: c.sampleCount,
                        source: c.source
                    }))
                ];
                setCarrierOptions(carrierList);
                setSelectedCarrier(carrierList[0]); // Default to auto-detect
            }
        } catch (error) {
            console.error('Error loading carriers:', error);
            enqueueSnackbar('Failed to load carriers', { variant: 'warning' });
        }
    };

    // Carrier management functions
    const addNewCarrier = async () => {
        if (!newCarrierName.trim()) {
            enqueueSnackbar('Please enter a carrier name', { variant: 'warning' });
            return;
        }

        try {
            const addCarrier = httpsCallable(functions, 'addUnifiedTrainingCarrier');
            const result = await addCarrier({
                name: newCarrierName.trim(),
                companyId: companyIdForAddress
            });

            if (result.data?.success) {
                enqueueSnackbar('Carrier added successfully', { variant: 'success' });
                setNewCarrierName('');
                setCarrierDialogOpen(false);
                loadCarriers(); // Reload the list
            } else {
                throw new Error(result.data?.error || 'Failed to add carrier');
            }
        } catch (error) {
            console.error('Error adding carrier:', error);
            enqueueSnackbar(`Failed to add carrier: ${error.message}`, { variant: 'error' });
        }
    };

    const deleteCarrier = async (carrierId) => {
        try {
            const deleteCarrier = httpsCallable(functions, 'deleteUnifiedTrainingCarrier');
            const result = await deleteCarrier({ carrierId });

            if (result.data?.success) {
                enqueueSnackbar('Carrier deleted successfully', { variant: 'success' });
                loadCarriers(); // Reload the list
                // Reset selected carrier if it was deleted
                if (selectedCarrier?.id === carrierId) {
                    setSelectedCarrier(carrierOptions[0]); // Reset to auto-detect
                }
            } else {
                throw new Error(result.data?.error || 'Failed to delete carrier');
            }
        } catch (error) {
            console.error('Error deleting carrier:', error);
            enqueueSnackbar(`Failed to delete carrier: ${error.message}`, { variant: 'error' });
        }
    };

    // File upload handling
    const onDrop = useCallback(async (acceptedFiles) => {
        const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');

        if (pdfFiles.length === 0) {
            enqueueSnackbar('Please upload PDF files only', { variant: 'warning' });
            return;
        }

        const newFiles = pdfFiles.map(file => ({
            id: `file_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            file: file,
            name: file.name,
            size: file.size,
            status: 'ready',
            progress: 0
        }));

        setUploadedFiles(prev => [...prev, ...newFiles]);

        // Auto-process if in production mode
        if (processingMode === 'production' && advancedOptions.batchProcessing) {
            setTimeout(() => processFiles(newFiles), 1000);
        }
    }, [processingMode, advancedOptions.batchProcessing]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true
    });

    // Main processing function
    const processFiles = async (filesToProcess = uploadedFiles.filter(f => f.status === 'ready')) => {
        if (filesToProcess.length === 0) {
            enqueueSnackbar('No files to process', { variant: 'warning' });
            return;
        }

        setIsProcessing(true);
        setProcessingProgress(0);
        setProcessingStage('Initializing...');

        try {
            for (let i = 0; i < filesToProcess.length; i++) {
                const fileData = filesToProcess[i];

                // Update file status
                setUploadedFiles(prev => prev.map(f =>
                    f.id === fileData.id
                        ? { ...f, status: 'processing', progress: 0 }
                        : f
                ));

                await processIndividualFile(fileData, i, filesToProcess.length);
            }

            setProcessingStage('Processing completed!');
            enqueueSnackbar(`Successfully processed ${filesToProcess.length} files`, { variant: 'success' });

        } catch (error) {
            console.error('Processing error:', error);
            enqueueSnackbar(`Processing failed: ${error.message}`, { variant: 'error' });
        } finally {
            setIsProcessing(false);
            setProcessingProgress(100);
        }
    };

    const processIndividualFile = async (fileData, index, total) => {
        try {
            // Convert file to base64
            const base64 = await convertFileToBase64(fileData.file);

            // Upload file first
            setProcessingStage(`Uploading ${fileData.name}...`);
            const uploadResult = await uploadFileToStorage(fileData.file, base64);

            if (!uploadResult.success) {
                throw new Error(uploadResult.error);
            }

            // Update progress
            const baseProgress = (index / total) * 100;
            setProcessingProgress(baseProgress + 10);
            setUploadedFiles(prev => prev.map(f =>
                f.id === fileData.id
                    ? { ...f, progress: 20, downloadURL: uploadResult.downloadURL }
                    : f
            ));

            // Process with unified AI system
            setProcessingStage(`AI processing ${fileData.name}...`);
            const processInvoice = httpsCallable(functions, 'processInvoiceUnified');

            const processingOptions = {
                pdfUrl: uploadResult.downloadURL,
                carrierHint: selectedCarrier?.id !== 'auto-detect' ? selectedCarrier?.name : null,
                processingMode: processingMode,
                companyId: companyIdForAddress,
                options: {
                    enableAutoUpdate: advancedOptions.enableAutoUpdate,
                    confidenceThreshold: advancedOptions.confidenceThreshold,
                    enableLearning: advancedOptions.enableLearning
                }
            };

            // Simulate progressive updates
            const progressSteps = [
                { progress: 40, stage: 'Analyzing document structure...' },
                { progress: 60, stage: 'Extracting invoice data...' },
                { progress: 80, stage: 'Matching shipments...' },
                { progress: 95, stage: 'Finalizing results...' }
            ];

            for (const step of progressSteps) {
                setTimeout(() => {
                    setProcessingProgress(baseProgress + step.progress);
                    setProcessingStage(step.stage);
                    setUploadedFiles(prev => prev.map(f =>
                        f.id === fileData.id
                            ? { ...f, progress: step.progress }
                            : f
                    ));
                }, 1000 * progressSteps.indexOf(step));
            }

            const result = await processInvoice(processingOptions);

            if (result.data?.success) {
                const processedResult = {
                    id: result.data.processingId,
                    fileId: fileData.id,
                    fileName: fileData.name,
                    strategy: result.data.strategy,
                    aiResults: result.data.aiResults,
                    finalResults: result.data.finalResults,
                    timestamp: result.data.timestamp,
                    confidence: calculateOverallConfidence(result.data.aiResults),
                    status: determineResultStatus(result.data.strategy, result.data.finalResults)
                };

                setProcessingResults(prev => [...prev, processedResult]);

                // Update file status
                setUploadedFiles(prev => prev.map(f =>
                    f.id === fileData.id
                        ? {
                            ...f,
                            status: 'completed',
                            progress: 100,
                            result: processedResult
                        }
                        : f
                ));

                // Show result-specific notification
                showResultNotification(processedResult);

            } else {
                throw new Error(result.data?.error || 'Processing failed');
            }

        } catch (error) {
            console.error(`Error processing ${fileData.name}:`, error);

            setUploadedFiles(prev => prev.map(f =>
                f.id === fileData.id
                    ? { ...f, status: 'error', error: error.message }
                    : f
            ));

            enqueueSnackbar(`Failed to process ${fileData.name}: ${error.message}`, { variant: 'error' });
        }
    };

    // Helper functions
    const convertFileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const uploadFileToStorage = async (file, base64) => {
        try {
            const uploadFunc = httpsCallable(functions, 'uploadFileBase64');
            const result = await uploadFunc({
                fileName: file.name,
                fileData: base64,
                fileType: 'application/pdf',
                fileSize: file.size
            });

            if (result.data?.success) {
                return {
                    success: true,
                    downloadURL: result.data.downloadURL
                };
            } else {
                return {
                    success: false,
                    error: result.data?.error || 'Upload failed'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    };

    const calculateOverallConfidence = (aiResults) => {
        return aiResults?.qualityAssessment?.overallScore || 0;
    };

    const determineResultStatus = (strategy, finalResults) => {
        if (strategy.route === 'auto_production' && finalResults?.summary?.autoUpdatedShipments > 0) {
            return 'auto_processed';
        } else if (strategy.route === 'manual_review') {
            return 'needs_review';
        } else if (strategy.route === 'training_enhancement') {
            return 'training_completed';
        } else {
            return 'completed';
        }
    };

    const showResultNotification = (result) => {
        const confidence = result.confidence;
        const confidenceLevel = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';

        if (result.status === 'auto_processed') {
            enqueueSnackbar(
                `✅ ${result.fileName}: Automatically processed with ${Math.round(confidence * 100)}% confidence`,
                { variant: 'success' }
            );
        } else if (result.status === 'needs_review') {
            enqueueSnackbar(
                `⚠️ ${result.fileName}: Requires manual review (${Math.round(confidence * 100)}% confidence)`,
                { variant: 'warning' }
            );
        } else if (result.status === 'training_completed') {
            enqueueSnackbar(
                `📚 ${result.fileName}: Training data created successfully`,
                { variant: 'info' }
            );
        }
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.9) return 'success';
        if (confidence >= 0.7) return 'warning';
        return 'error';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'auto_processed': return <CheckIcon color="success" />;
            case 'needs_review': return <WarningIcon color="warning" />;
            case 'training_completed': return <TrainingIcon color="info" />;
            case 'error': return <ErrorIcon color="error" />;
            default: return <AssignmentIcon color="primary" />;
        }
    };

    const toggleAccordion = (accordionId) => {
        setExpandedAccordions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(accordionId)) {
                newSet.delete(accordionId);
            } else {
                newSet.add(accordionId);
            }
            return newSet;
        });
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
                    AI Invoice Processing Engine
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>
                    State-of-the-art invoice processing with Gemini AI, intelligent matching, and continuous learning
                </Typography>

                {/* Processing Mode Selection */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {PROCESSING_MODES.map((mode) => (
                        <Grid item xs={12} md={4} key={mode.id}>
                            <Card
                                variant={processingMode === mode.id ? 'outlined' : 'elevation'}
                                sx={{
                                    cursor: 'pointer',
                                    border: processingMode === mode.id ? '2px solid #6366f1' : undefined,
                                    backgroundColor: processingMode === mode.id ? '#f8fafc' : undefined,
                                    '&:hover': { boxShadow: 3 }
                                }}
                                onClick={() => setProcessingMode(mode.id)}
                            >
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        {mode.icon}
                                        <Typography variant="h6" sx={{ ml: 1, fontSize: '14px', fontWeight: 600 }}>
                                            {mode.name}
                                        </Typography>
                                        {processingMode === mode.id && (
                                            <Chip label="ACTIVE" size="small" color="primary" sx={{ ml: 'auto' }} />
                                        )}
                                    </Box>
                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        {mode.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* Main Content */}
            <Grid container spacing={3}>
                {/* Left Column - Upload and Configuration */}
                <Grid item xs={12} lg={6}>
                    {/* File Upload */}
                    <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                            Upload Invoice Documents
                        </Typography>

                        <Box
                            {...getRootProps()}
                            sx={{
                                border: '2px dashed #d1d5db',
                                borderRadius: 2,
                                p: 4,
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: isDragActive ? '#f8fafc' : 'transparent',
                                '&:hover': { backgroundColor: '#f8fafc' }
                            }}
                        >
                            <input {...getInputProps()} />
                            <UploadIcon sx={{ fontSize: 48, color: '#6b7280', mb: 2 }} />
                            <Typography variant="h6" sx={{ mb: 1, fontSize: '14px' }}>
                                {isDragActive ? 'Drop files here...' : 'Drop PDF files or click to browse'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                Support for carrier invoices, BOLs, and shipping documents
                            </Typography>
                        </Box>

                        {/* Carrier Selection */}
                        <Box sx={{ mt: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Carrier Preference
                                </Typography>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<SettingsIcon />}
                                    onClick={() => setCarrierDialogOpen(true)}
                                    sx={{ fontSize: '11px' }}
                                >
                                    Manage Carriers
                                </Button>
                            </Box>
                            <Autocomplete
                                value={selectedCarrier}
                                onChange={(_, newValue) => setSelectedCarrier(newValue)}
                                options={carrierOptions}
                                getOptionLabel={(option) => option.name}
                                size="small"
                                renderOption={(props, option) => (
                                    <Box component="li" {...props}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {option.name}
                                            </Typography>
                                            {option.confidence && (
                                                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '10px' }}>
                                                    {Math.round(option.confidence * 100)}% confidence • {option.sampleCount} samples
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                                renderInput={(params) => (
                                    <TextField {...params} placeholder="Select carrier or use auto-detect" />
                                )}
                            />
                        </Box>

                        {/* Process Button */}
                        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                            <Button
                                variant="contained"
                                onClick={() => processFiles()}
                                disabled={isProcessing || uploadedFiles.filter(f => f.status === 'ready').length === 0}
                                startIcon={isProcessing ? <CircularProgress size={16} /> : <ProcessIcon />}
                                sx={{ flex: 1 }}
                            >
                                {isProcessing ? 'Processing...' : `Process ${uploadedFiles.filter(f => f.status === 'ready').length} Files`}
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => setUploadedFiles([])}
                                disabled={isProcessing}
                                startIcon={<RefreshIcon />}
                            >
                                Clear
                            </Button>
                        </Box>
                    </Paper>

                    {/* Advanced Options */}
                    <Accordion
                        expanded={expandedAccordions.has('options')}
                        onChange={() => toggleAccordion('options')}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                Advanced Options
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={advancedOptions.enableAutoUpdate}
                                                onChange={(e) => setAdvancedOptions(prev => ({
                                                    ...prev,
                                                    enableAutoUpdate: e.target.checked
                                                }))}
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: '12px' }}>
                                                Auto-update shipment charges
                                            </Typography>
                                        }
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={advancedOptions.enableLearning}
                                                onChange={(e) => setAdvancedOptions(prev => ({
                                                    ...prev,
                                                    enableLearning: e.target.checked
                                                }))}
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: '12px' }}>
                                                Enable continuous learning
                                            </Typography>
                                        }
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="body2" sx={{ fontSize: '12px', mb: 1 }}>
                                        Confidence Threshold: {Math.round(advancedOptions.confidenceThreshold * 100)}%
                                    </Typography>
                                    <Box sx={{ px: 1 }}>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="0.95"
                                            step="0.05"
                                            value={advancedOptions.confidenceThreshold}
                                            onChange={(e) => setAdvancedOptions(prev => ({
                                                ...prev,
                                                confidenceThreshold: parseFloat(e.target.value)
                                            }))}
                                            style={{ width: '100%' }}
                                        />
                                    </Box>
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Right Column - Progress and Results */}
                <Grid item xs={12} lg={6}>
                    {/* Processing Status */}
                    {isProcessing && (
                        <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                                Processing Status
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                    {processingStage}
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={processingProgress}
                                    sx={{ height: 8, borderRadius: 4 }}
                                />
                                <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280', mt: 0.5, display: 'block' }}>
                                    {Math.round(processingProgress)}% complete
                                </Typography>
                            </Box>
                        </Paper>
                    )}

                    {/* Uploaded Files */}
                    <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                            Uploaded Files ({uploadedFiles.length})
                        </Typography>

                        {uploadedFiles.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 4, color: '#6b7280' }}>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    No files uploaded yet
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                                {uploadedFiles.map((file) => (
                                    <Box key={file.id} sx={{ mb: 2, p: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            {getStatusIcon(file.status)}
                                            <Typography variant="body2" sx={{ ml: 1, fontSize: '12px', fontWeight: 500, flex: 1 }}>
                                                {file.name}
                                            </Typography>
                                            <Chip
                                                label={file.status}
                                                size="small"
                                                color={file.status === 'completed' ? 'success' : file.status === 'error' ? 'error' : 'default'}
                                                sx={{ fontSize: '10px' }}
                                            />
                                        </Box>

                                        {file.status === 'processing' && (
                                            <LinearProgress
                                                variant="determinate"
                                                value={file.progress}
                                                sx={{ mt: 1, height: 4 }}
                                            />
                                        )}

                                        {file.status === 'completed' && file.result && (
                                            <Box sx={{ mt: 1 }}>
                                                <Chip
                                                    label={`${Math.round(file.result.confidence * 100)}% confidence`}
                                                    size="small"
                                                    color={getConfidenceColor(file.result.confidence)}
                                                    sx={{ fontSize: '10px', mr: 1 }}
                                                />
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => {
                                                        setSelectedResult(file.result);
                                                        setReviewDialogOpen(true);
                                                    }}
                                                    sx={{ fontSize: '10px' }}
                                                >
                                                    View Results
                                                </Button>
                                            </Box>
                                        )}

                                        {file.status === 'error' && (
                                            <Alert severity="error" sx={{ mt: 1 }}>
                                                <Typography variant="caption" sx={{ fontSize: '10px' }}>
                                                    {file.error}
                                                </Typography>
                                            </Alert>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Paper>

                    {/* Recent Results Summary */}
                    {processingResults.length > 0 && (
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                                Processing Summary
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h4" sx={{ color: '#059669', fontWeight: 700 }}>
                                            {processingResults.filter(r => r.status === 'auto_processed').length}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                            Auto Processed
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6}>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h4" sx={{ color: '#d97706', fontWeight: 700 }}>
                                            {processingResults.filter(r => r.status === 'needs_review').length}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                            Need Review
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                    )}
                </Grid>
            </Grid>

            {/* Results Review Dialog */}
            <Dialog
                open={reviewDialogOpen}
                onClose={() => setReviewDialogOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                {selectedResult && (
                    <>
                        <DialogTitle>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Processing Results: {selectedResult.fileName}
                            </Typography>
                        </DialogTitle>
                        <DialogContent dividers>
                            {/* Results content would go here - detailed view of processing results */}
                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                Detailed results view would be implemented here with:
                                - Extracted invoice data
                                - Shipment matching results
                                - Confidence scores
                                - Correction interface
                                - Approval/rejection actions
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setReviewDialogOpen(false)}>
                                Close
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* Carrier Management Dialog */}
            <Dialog
                open={carrierDialogOpen}
                onClose={() => setCarrierDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Manage Training Carriers
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    {/* Add New Carrier */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                            Add New Carrier
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Carrier Name"
                                value={newCarrierName}
                                onChange={(e) => setNewCarrierName(e.target.value)}
                                size="small"
                                sx={{ flex: 1 }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        addNewCarrier();
                                    }
                                }}
                            />
                            <Button
                                variant="contained"
                                onClick={addNewCarrier}
                                startIcon={<AddIcon />}
                                disabled={!newCarrierName.trim()}
                                sx={{ fontSize: '12px' }}
                            >
                                Add
                            </Button>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Existing Carriers */}
                    <Typography variant="subtitle2" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        Existing Carriers
                    </Typography>

                    {carrierOptions.filter(c => c.id !== 'auto-detect').length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 3, color: '#6b7280' }}>
                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                No carriers added yet. Add your first carrier above.
                            </Typography>
                        </Box>
                    ) : (
                        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                            {carrierOptions
                                .filter(carrier => carrier.id !== 'auto-detect')
                                .map((carrier) => (
                                    <ListItem key={carrier.id} divider>
                                        <ListItemText
                                            primary={
                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {carrier.name}
                                                </Typography>
                                            }
                                            secondary={
                                                carrier.sampleCount > 0 && (
                                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        {carrier.sampleCount} training samples • {Math.round(carrier.confidence * 100)}% confidence
                                                    </Typography>
                                                )
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                edge="end"
                                                onClick={() => deleteCarrier(carrier.id)}
                                                size="small"
                                                sx={{ color: '#dc2626' }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCarrierDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
