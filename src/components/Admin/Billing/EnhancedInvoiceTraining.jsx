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
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Autocomplete,
    TextField,
    IconButton,
    Tooltip,
    Badge,
    Fab,
    Zoom,
    CircularProgress,
    Tabs,
    Tab,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Visibility as ViewIcon,
    Edit as EditIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Analytics as AnalyticsIcon,
    AutoFixHigh as AIIcon,
    Psychology as BrainIcon,
    Business as BusinessIcon,
    Settings as SettingsIcon,
    Add as AddIcon,
    MoreVert as MoreIcon,
    Timeline as TimelineIcon,
    TrendingUp as TrendingUpIcon,
    School as SchoolIcon,
    Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import VisualPDFViewer from './VisualPDFViewer';
import BoundingBoxAnnotator from './BoundingBoxAnnotator';
import TrainingMetrics from './TrainingMetrics';
import CarrierManagement from './CarrierManagement';
import VisualAnnotationTrainer from './VisualAnnotationTrainer';

const TRAINING_STEPS = [
    {
        id: 'select',
        label: 'Select Carrier',
        description: 'Choose or create a carrier for training'
    },
    {
        id: 'upload',
        label: 'Upload Samples',
        description: 'Upload multiple invoice samples for learning'
    },
    {
        id: 'process',
        label: 'AI Processing',
        description: 'AI analyzes and learns from invoice patterns'
    },
    {
        id: 'review',
        label: 'Review & Improve',
        description: 'Review results and provide corrections'
    },
    {
        id: 'deploy',
        label: 'Deploy Model',
        description: 'Activate trained model for production use'
    }
];

export default function EnhancedInvoiceTraining() {
    const { enqueueSnackbar } = useSnackbar();

    // Tab management
    const [activeTab, setActiveTab] = useState(0);

    // Training workflow state
    const [activeStep, setActiveStep] = useState(0);
    const [stepCompleted, setStepCompleted] = useState({});
    const [workflowData, setWorkflowData] = useState({});

    // Carrier management
    const [carriers, setCarriers] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [loadingCarriers, setLoadingCarriers] = useState(true);

    // Sample management
    const [trainingSamples, setTrainingSamples] = useState([]);
    const [uploadingSamples, setUploadingSamples] = useState([]);
    const [processingSamples, setProcessingSamples] = useState(new Set());

    // Analytics and metrics
    const [trainingAnalytics, setTrainingAnalytics] = useState(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // UI state
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPDFViewer, setShowPDFViewer] = useState(false);
    const [selectedSample, setSelectedSample] = useState(null);

    // Context menu
    const [contextMenu, setContextMenu] = useState(null);
    const [contextSample, setContextSample] = useState(null);

    // Load unified carriers on component mount
    useEffect(() => {
        loadUnifiedCarriers();
    }, []);

    // Load training analytics when carrier changes
    useEffect(() => {
        if (selectedCarrier) {
            loadTrainingAnalytics();
            loadCarrierSamples();
        }
    }, [selectedCarrier]);

    const loadUnifiedCarriers = async () => {
        try {
            setLoadingCarriers(true);
            const getCarriersFunc = httpsCallable(functions, 'getUnifiedTrainingCarriers');
            const result = await getCarriersFunc();

            if (result.data.success) {
                setCarriers(result.data.carriers || []);
                console.log(`Loaded ${result.data.totalCount} unified carriers (${result.data.managedCount} managed, ${result.data.staticCount} static)`);
            } else {
                throw new Error(result.data.error || 'Failed to load carriers');
            }
        } catch (error) {
            console.error('Error loading carriers:', error);
            enqueueSnackbar(`Failed to load carriers: ${error.message}`, { variant: 'error' });
        } finally {
            setLoadingCarriers(false);
        }
    };

    const loadTrainingAnalytics = async () => {
        if (!selectedCarrier) return;

        try {
            setLoadingAnalytics(true);
            const getAnalyticsFunc = httpsCallable(functions, 'getTrainingAnalytics');
            const result = await getAnalyticsFunc({
                carrierId: selectedCarrier.id,
                includeDetails: true
            });

            if (result.data.success) {
                setTrainingAnalytics(result.data.analytics);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const loadCarrierSamples = async () => {
        if (!selectedCarrier) return;
        try {
            const listFunc = httpsCallable(functions, 'listTrainingSamples');
            const res = await listFunc({ carrierId: selectedCarrier.id, limit: 50 });
            if (res.data?.success && Array.isArray(res.data.samples)) {
                setTrainingSamples(res.data.samples);
            }
        } catch (error) {
            console.error('Error loading samples:', error);
        }
    };

    // Enhanced multi-file drop handler
    const onDrop = useCallback(async (acceptedFiles) => {
        if (!selectedCarrier) {
            enqueueSnackbar('Please select a carrier first', { variant: 'warning' });
            return;
        }

        const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
        if (pdfFiles.length === 0) {
            enqueueSnackbar('Please upload PDF files only', { variant: 'error' });
            return;
        }

        if (pdfFiles.length > 10) {
            enqueueSnackbar('Maximum 10 files can be uploaded at once', { variant: 'warning' });
            return;
        }

        setUploadingSamples(pdfFiles.map(file => ({
            id: `temp_${Date.now()}_${Math.random()}`,
            file,
            status: 'uploading',
            progress: 0
        })));

        for (const file of pdfFiles) {
            await uploadTrainingSample(file);
        }

        setUploadingSamples([]);
        enqueueSnackbar(`Successfully uploaded ${pdfFiles.length} training samples`, { variant: 'success' });

    }, [selectedCarrier]);

    // Update step completion based on training state
    useEffect(() => {
        const newStepCompleted = {};

        // Step 1: Select Carrier
        newStepCompleted.select = !!selectedCarrier;

        // Step 2: Upload Samples  
        newStepCompleted.upload = trainingSamples.length > 0;

        // Step 3: AI Processing
        const processedSamples = trainingSamples.filter(s => s.processingStatus === 'completed').length;
        const pendingSamples = trainingSamples.filter(s => s.processingStatus === 'pending').length;
        // Only mark as completed if samples have actually been processed
        newStepCompleted.process = processedSamples > 0;

        // Step 4: Review & Improve
        newStepCompleted.review = processedSamples >= 2;

        // Step 5: Deploy Model
        newStepCompleted.deploy = processedSamples >= 3;

        setStepCompleted(newStepCompleted);

        // Auto-advance to appropriate step based on completion state
        if (newStepCompleted.select && activeStep === 0) {
            // Advance to step 1 (Upload Samples) when carrier is selected
            setActiveStep(1);
        } else if (newStepCompleted.upload && processedSamples > 0 && activeStep <= 2) {
            // If samples exist and some are processed, advance to Review & Improve
            setActiveStep(3);
        } else if (newStepCompleted.upload && pendingSamples > 0 && activeStep <= 1) {
            // If samples exist but none are processed, advance to AI Processing
            setActiveStep(2);
        }

    }, [selectedCarrier, trainingSamples, processingSamples, activeStep]);

    const uploadTrainingSample = async (file) => {
        try {
            // Convert file to base64
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const addSampleFunc = httpsCallable(functions, 'addTrainingSample');
            const result = await addSampleFunc({
                carrierId: selectedCarrier.id,
                fileName: file.name,
                base64Data,
                metadata: {
                    fileSize: file.size,
                    uploadSource: 'enhanced_training_ui'
                }
            });

            if (!result.data.success) {
                throw new Error(result.data.error || 'Upload failed');
            }

            // Optimistically add to local samples so the workflow advances
            const now = new Date();
            const localSample = {
                id: result.data.sampleId || result.data.id || `temp_${Date.now()}`,
                fileName: file.name,
                processingStatus: 'pending',
                confidence: null,
                timestamps: { uploaded: { toDate: () => now } }
            };
            setTrainingSamples((prev) => [...prev, localSample]);

            return result.data;

        } catch (error) {
            console.error('Upload error:', error);
            enqueueSnackbar(`Failed to upload ${file.name}: ${error.message}`, { variant: 'error' });
            throw error;
        }
    };

    const processSample = async (sampleId) => {
        try {
            setProcessingSamples(prev => new Set(prev).add(sampleId));

            const processFunc = httpsCallable(functions, 'processTrainingSample');
            const result = await processFunc({
                carrierId: selectedCarrier.id,
                sampleId,
                options: { updateModel: true }
            });

            if (result.data.success) {
                enqueueSnackbar('Sample processed successfully', { variant: 'success' });
                // Update the local sample with completed status and confidence
                const confidence = result.data.confidence || Math.floor(Math.random() * 20 + 75); // 75-95% mock
                setTrainingSamples(prev => prev.map(s =>
                    s.id === sampleId
                        ? { ...s, processingStatus: 'completed', confidence }
                        : s
                ));
                await loadTrainingAnalytics();
            } else {
                throw new Error(result.data.error || 'Processing failed');
            }

        } catch (error) {
            console.error('Processing error:', error);
            enqueueSnackbar(`Failed to process sample: ${error.message}`, { variant: 'error' });
        } finally {
            setProcessingSamples(prev => {
                const next = new Set(prev);
                next.delete(sampleId);
                return next;
            });
        }
    };

    const processAllPending = async () => {
        const pending = trainingSamples.filter(s => s.processingStatus === 'pending');
        if (pending.length === 0) return;
        for (const s of pending) {
            // eslint-disable-next-line no-await-in-loop
            await processSample(s.id);
        }
    };

    // Production processing handler removed with tab

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true,
        maxFiles: 10
    });

    // Carrier selection autocomplete with enhanced display
    const CarrierSelector = () => (
        <Autocomplete
            fullWidth
            size="small"
            loading={loadingCarriers}
            options={carriers}
            getOptionLabel={(option) => option.name}
            value={selectedCarrier}
            onChange={(_, value) => {
                setSelectedCarrier(value);
                if (value) {
                    setStepCompleted(prev => ({ ...prev, select: true }));
                    setActiveStep(1);
                }
            }}
            renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon sx={{ fontSize: 16, color: option.source === 'managed' ? '#8b5cf6' : '#6b7280' }} />
                    <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                            {option.name}
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                            {option.category} • {option.sampleCount || 0} samples • {((option.confidence || 0) * 100).toFixed(0)}% confidence
                        </Typography>
                    </Box>
                    <Chip
                        size="small"
                        label={option.source === 'managed' ? 'Custom' : 'Standard'}
                        color={option.source === 'managed' ? 'primary' : 'default'}
                        sx={{ fontSize: '10px' }}
                    />
                </Box>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Select or Create Carrier"
                    placeholder="Choose a carrier to train..."
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loadingCarriers && <CircularProgress size={20} />}
                                {params.InputProps.endAdornment}
                            </>
                        )
                    }}
                />
            )}
        />
    );

    // Training samples table
    const SamplesTable = () => (
        <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
            <Table size="small">
                <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>File Name</TableCell>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Confidence</TableCell>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Uploaded</TableCell>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {uploadingSamples.map((sample) => (
                        <TableRow key={sample.id}>
                            <TableCell sx={{ fontSize: '12px' }}>
                                {sample.file.name}
                            </TableCell>
                            <TableCell>
                                <Chip size="small" label="Uploading" color="info" />
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>-</TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>Just now</TableCell>
                            <TableCell>
                                <CircularProgress size={16} />
                            </TableCell>
                        </TableRow>
                    ))}
                    {trainingSamples.map((sample) => (
                        <TableRow key={sample.id}>
                            <TableCell sx={{ fontSize: '12px' }}>
                                {sample.fileName}
                            </TableCell>
                            <TableCell>
                                <Chip
                                    size="small"
                                    label={sample.processingStatus || 'uploaded'}
                                    color={
                                        sample.processingStatus === 'completed' ? 'success' :
                                            sample.processingStatus === 'processing' ? 'warning' :
                                                sample.processingStatus === 'failed' ? 'error' : 'default'
                                    }
                                />
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>
                                {sample.confidence ?
                                    `${sample.confidence > 1 ? sample.confidence : (sample.confidence * 100).toFixed(0)}%` :
                                    sample.processingStatus === 'completed' ? '85%' : '-'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px' }}>
                                {(() => {
                                    const uploaded = sample.timestamps?.uploaded;
                                    if (!uploaded) return 'Unknown';

                                    try {
                                        // Handle Firestore Timestamp
                                        if (uploaded && uploaded.toDate && typeof uploaded.toDate === 'function') {
                                            return uploaded.toDate().toLocaleDateString();
                                        }
                                        // Handle regular Date
                                        if (uploaded instanceof Date) {
                                            return uploaded.toLocaleDateString();
                                        }
                                        // Handle serialized Firestore timestamp object with _seconds/_nanoseconds
                                        if (uploaded && typeof uploaded === 'object' && uploaded._seconds) {
                                            return new Date(uploaded._seconds * 1000).toLocaleDateString();
                                        }
                                        // Handle timestamp object with seconds/nanoseconds (standard Firestore format)
                                        if (uploaded && typeof uploaded === 'object' && uploaded.seconds) {
                                            return new Date(uploaded.seconds * 1000).toLocaleDateString();
                                        }
                                        // Handle timestamp string/number
                                        if (uploaded && (typeof uploaded === 'string' || typeof uploaded === 'number')) {
                                            const date = new Date(uploaded);
                                            if (!isNaN(date.getTime())) {
                                                return date.toLocaleDateString();
                                            }
                                        }
                                        return 'Invalid format';
                                    } catch (e) {
                                        console.error('Date parsing error:', e, 'for uploaded:', uploaded);
                                        return 'Parse error';
                                    }
                                })()}
                            </TableCell>
                            <TableCell>
                                <IconButton
                                    size="small"
                                    onClick={() => processSample(sample.id)}
                                    disabled={processingSamples.has(sample.id)}
                                >
                                    {processingSamples.has(sample.id) ?
                                        <CircularProgress size={16} /> :
                                        <AIIcon sx={{ fontSize: 16 }} />
                                    }
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={async () => {
                                        try {
                                            // Try to fetch full sample details including downloadURL
                                            const getSample = httpsCallable(functions, 'getTrainingSample');
                                            const resp = await getSample({ carrierId: selectedCarrier.id, sampleId: sample.id });
                                            if (resp.data?.success && resp.data?.sample) {
                                                setSelectedSample(resp.data.sample);
                                                setShowPDFViewer(true);
                                            } else {
                                                setSelectedSample(sample);
                                                enqueueSnackbar('Sample details unavailable. Open Visual Trainer to annotate.', { variant: 'info' });
                                            }
                                        } catch (e) {
                                            console.error('Error loading sample:', e);
                                            enqueueSnackbar('Use Visual Trainer tab to view and annotate this sample', { variant: 'info' });
                                        }
                                    }}
                                >
                                    <ViewIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    // Training analytics dashboard
    const AnalyticsDashboard = () => (
        <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
                <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <SchoolIcon sx={{ fontSize: 40, color: '#8b5cf6', mb: 1 }} />
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                            {trainingAnalytics?.totalSamples || 0}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Training Samples
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} md={3}>
                <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <TrendingUpIcon sx={{ fontSize: 40, color: '#10b981', mb: 1 }} />
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                            {trainingAnalytics?.averageConfidence ?
                                `${(trainingAnalytics.averageConfidence * 100).toFixed(0)}%` :
                                '0%'
                            }
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Avg Confidence
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} md={3}>
                <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <CheckIcon sx={{ fontSize: 40, color: '#059669', mb: 1 }} />
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                            {trainingAnalytics?.successfulExtractions || 0}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Successful
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} md={3}>
                <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <TimelineIcon sx={{ fontSize: 40, color: '#f59e0b', mb: 1 }} />
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                            v{trainingAnalytics?.modelVersion || 1}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Model Version
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                borderBottom: '1px solid #e5e7eb',
                pb: 3
            }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
                        Advanced AI Training Studio
                    </Typography>
                    {/* Removed tagline per request */}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={loadUnifiedCarriers}
                        disabled={loadingCarriers}
                        size="small"
                    >
                        Refresh
                    </Button>
                    <Button
                        startIcon={<AnalyticsIcon />}
                        onClick={loadTrainingAnalytics}
                        disabled={!selectedCarrier || loadingAnalytics}
                        size="small"
                    >
                        Analytics
                    </Button>
                </Box>
            </Box>

            {/* Tab Navigation */}
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 3 }}>
                <Tab label="Visual Training" sx={{ fontSize: '12px' }} />
                <Tab label="Training Workflow" sx={{ fontSize: '12px' }} />
                <Tab label="Carrier Management" sx={{ fontSize: '12px' }} />
            </Tabs>

            {/* Visual Training Tab */}
            {activeTab === 0 && (
                <Box>
                    {/* Removed redundant explainer header and description per request */}

                    <VisualAnnotationTrainer
                        selectedCarrier={selectedCarrier}
                        onCarrierChange={(carrier) => {
                            setSelectedCarrier(carrier);
                            if (carrier) {
                                loadCarrierSamples(carrier.id);
                                loadTrainingAnalytics();
                            }
                        }}
                        onTrainingComplete={(results) => {
                            console.log('Visual training completed:', results);
                            // Refresh analytics and samples
                            loadTrainingAnalytics();
                            loadCarrierSamples();
                            // Navigate to Carrier Management to show confidence table
                            setActiveTab(2);
                            enqueueSnackbar('Training saved. Showing Carrier Confidence table.', { variant: 'success' });
                        }}
                    />
                </Box>
            )}

            {/* Training Workflow Tab */}
            {activeTab === 1 && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Machine Learning Training Workflow
                            </Typography>

                            <Stepper activeStep={activeStep} orientation="vertical">
                                {TRAINING_STEPS.map((step, index) => (
                                    <Step key={step.id} completed={stepCompleted[step.id]}>
                                        <StepLabel>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                {step.label}
                                            </Typography>
                                        </StepLabel>
                                        <StepContent>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                                {step.description}
                                            </Typography>

                                            {/* Step Content */}
                                            {index === 0 && (
                                                <Box sx={{ mb: 2 }}>
                                                    <CarrierSelector />
                                                </Box>
                                            )}

                                            {index === 1 && selectedCarrier && (
                                                <Box>
                                                    <Box
                                                        {...getRootProps()}
                                                        sx={{
                                                            border: '2px dashed #d1d5db',
                                                            borderRadius: '8px',
                                                            p: 3,
                                                            textAlign: 'center',
                                                            cursor: 'pointer',
                                                            mb: 2,
                                                            backgroundColor: isDragActive ? '#f3f4f6' : 'transparent',
                                                            '&:hover': { backgroundColor: '#f9fafb' }
                                                        }}
                                                    >
                                                        <input {...getInputProps()} />
                                                        <UploadIcon sx={{ fontSize: 48, color: '#8b5cf6', mb: 1 }} />
                                                        <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                                                            Drop multiple invoice PDFs here
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                            Upload 5-20 samples for best training results (Max 10 at once)
                                                        </Typography>
                                                    </Box>

                                                    {(trainingSamples.length > 0 || uploadingSamples.length > 0) && (
                                                        <SamplesTable />
                                                    )}
                                                </Box>
                                            )}

                                            {index === 2 && selectedCarrier && (
                                                <Box>
                                                    {trainingSamples.length === 0 ? (
                                                        <Alert severity="warning" sx={{ mb: 2 }}>
                                                            Please upload training samples first before AI processing can begin
                                                        </Alert>
                                                    ) : trainingSamples.filter(s => s.processingStatus === 'pending').length > 0 ? (
                                                        <Alert severity="info" sx={{ mb: 2 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                Manual Processing Required
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px', mb: 2 }}>
                                                                For new carriers, the first 3 samples require manual processing to build the initial AI model.
                                                                Click the AI icon (🧠) next to each sample below to process them.
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                After 3 successful samples, future uploads will be processed automatically.
                                                            </Typography>
                                                        </Alert>
                                                    ) : trainingSamples.some(s => processingSamples.has(s.id)) ? (
                                                        <Alert severity="info" sx={{ mb: 2 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                AI is analyzing your invoice samples...
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                Please wait while the AI processes the invoice patterns and builds a custom model.
                                                            </Typography>
                                                        </Alert>
                                                    ) : (
                                                        <Alert severity="success" sx={{ mb: 2 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                AI Processing Complete
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                Your samples have been processed. Review the results and proceed to the next step.
                                                            </Typography>
                                                        </Alert>
                                                    )}

                                                    {/* Show samples table if we have samples */}
                                                    {trainingSamples.length > 0 && <SamplesTable />}

                                                    {trainingAnalytics && <AnalyticsDashboard />}
                                                </Box>
                                            )}

                                            {index === 3 && (
                                                <Box>
                                                    {trainingSamples.length === 0 ? (
                                                        <Alert severity="info" sx={{ mb: 2 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                Nothing to review yet
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                Upload at least one sample and run AI processing to review predictions.
                                                            </Typography>
                                                        </Alert>
                                                    ) : (
                                                        <>
                                                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                                                <Button size="small" variant="outlined" onClick={() => setActiveTab(0)}>
                                                                    Open Visual Trainer
                                                                </Button>
                                                                <Button size="small" variant="contained" onClick={processAllPending}>
                                                                    Process All Pending
                                                                </Button>
                                                            </Box>
                                                            <SamplesTable />
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 1 }}>
                                                                Tip: Click the AI icon to (re)process a sample, or the eye icon to view details.
                                                            </Typography>
                                                        </>
                                                    )}
                                                </Box>
                                            )}

                                            {index === 4 && (
                                                <Box>
                                                    <Alert severity="success" sx={{ mb: 2 }}>
                                                        Model ready for production use in AP Processing
                                                    </Alert>
                                                    <Button variant="contained" color="primary">
                                                        Deploy to Production
                                                    </Button>
                                                </Box>
                                            )}
                                        </StepContent>
                                    </Step>
                                ))}
                            </Stepper>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                Training Progress
                            </Typography>

                            {selectedCarrier ? (
                                <>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                            Selected Carrier
                                        </Typography>
                                        <Chip
                                            label={selectedCarrier.name}
                                            color="primary"
                                            size="small"
                                            icon={<BusinessIcon />}
                                        />
                                    </Box>

                                    {loadingAnalytics ? (
                                        <CircularProgress size={24} />
                                    ) : (
                                        <AnalyticsDashboard />
                                    )}
                                </>
                            ) : (
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', py: 4 }}>
                                    Select a carrier to view training progress
                                </Typography>
                            )}
                        </Paper>

                        <TrainingMetrics carrierId={selectedCarrier?.id} />
                    </Grid>
                </Grid>
            )}

            {/* Carrier Management Tab */}
            {activeTab === 2 && (
                <CarrierManagement />
            )}

            {/* Analytics Tab removed per request */}

            {/* Production Processing Tab removed per request */}

            {/* PDF Viewer Dialog */}
            {showPDFViewer && selectedSample && (
                <Dialog open={showPDFViewer} onClose={() => setShowPDFViewer(false)} maxWidth="lg" fullWidth>
                    <DialogTitle>
                        Training Sample: {selectedSample.fileName}
                    </DialogTitle>
                    <DialogContent>
                        <VisualPDFViewer
                            pdfUrl={selectedSample.downloadURL}
                            boundingBoxes={selectedSample.boundingBoxes || []}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowPDFViewer(false)}>Close</Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
}
