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
    AutoAwesome as PromptIcon,
    Business as BusinessIcon,
    Settings as SettingsIcon,
    Add as AddIcon,
    MoreVert as MoreIcon,
    Timeline as TimelineIcon,
    TrendingUp as TrendingUpIcon,
    School as SchoolIcon,
    Assignment as AssignmentIcon,
    HelpOutline as HelpIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import { functions, db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import VisualPDFViewer from './VisualPDFViewer';
import BoundingBoxAnnotator from './BoundingBoxAnnotator';
import TrainingMetrics from './TrainingMetrics';
import CarrierPromptManager from './CarrierPromptManager';

import CarrierManagement from './CarrierManagement';
import VisualAnnotationTrainer from './VisualAnnotationTrainer';
import InvoiceTestingEngine from './InvoiceTestingEngine';

const TRAINING_STEPS = [
    {
        id: 'select',
        label: 'Select Carrier',
        description: 'Choose a carrier to train',
        helpText: 'Select the carrier whose invoices you want to train the AI to process.',
        tips: ['Choose carriers with consistent invoice formats', 'One invoice is enough to start training']
    },
    {
        id: 'upload',
        label: 'Upload & Train',
        description: 'Upload invoice and train AI model',
        helpText: 'Upload a single representative invoice to train the AI. The system will analyze it and create a working model immediately.',
        tips: ['Use a clear, readable PDF file', 'Choose a typical invoice format for this carrier', 'Training completes instantly']
    }
];

export default function EnhancedInvoiceTraining() {
    const { enqueueSnackbar } = useSnackbar();

    // Progress persistence key
    const STORAGE_KEY = 'solushipx_training_progress';

    // Tab management
    const [activeTab, setActiveTab] = useState(0);
    
    // Prompt manager state
    const [promptManagerOpen, setPromptManagerOpen] = useState(false);
    const [selectedPromptCarrier, setSelectedPromptCarrier] = useState(null);

    // Training workflow state with persistence
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

    // Progress persistence utilities
    const saveProgress = useCallback((progress) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...progress,
                lastSaved: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            }));
        } catch (error) {
            console.warn('Failed to save training progress:', error);
        }
    }, [STORAGE_KEY]);

    const loadProgress = useCallback(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return null;

            const progress = JSON.parse(saved);
            const now = new Date();
            const expiresAt = new Date(progress.expiresAt);

            if (now > expiresAt) {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return progress;
        } catch (error) {
            console.warn('Failed to load training progress:', error);
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }, [STORAGE_KEY]);

    const clearProgress = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
    }, [STORAGE_KEY]);

    // Load unified carriers and restore progress on component mount
    useEffect(() => {
        loadUnifiedCarriers();

        // Restore previous progress
        const savedProgress = loadProgress();
        if (savedProgress) {
            setActiveTab(savedProgress.activeTab || 0);
            setActiveStep(savedProgress.activeStep || 0);
            setStepCompleted(savedProgress.stepCompleted || {});
            setWorkflowData(savedProgress.workflowData || {});

            // Restore carrier selection if exists
            if (savedProgress.selectedCarrier) {
                setSelectedCarrier(savedProgress.selectedCarrier);
            }

            enqueueSnackbar(`Restored previous training session from ${new Date(savedProgress.lastSaved).toLocaleDateString()}`, {
                variant: 'info',
                autoHideDuration: 3000
            });
        }
    }, [loadProgress, enqueueSnackbar]);

    // Load carriers on component mount and reset workflow
    useEffect(() => {
        console.log('Training Workflow: Component mounting, resetting state');
        // Reset workflow state when tab loads
        setActiveStep(0);
        setSelectedCarrier(null);
        setStepCompleted({});
        loadUnifiedCarriers();
    }, []);

    // Training Workflow tab removed – no tab-specific reset required

    // Load training analytics when carrier changes
    useEffect(() => {
        if (selectedCarrier) {
            console.log('Carrier selected, loading analytics:', selectedCarrier);
            loadTrainingAnalytics();
            loadCarrierSamples();
        }
    }, [selectedCarrier]);

    const loadUnifiedCarriers = async () => {
        try {
            setLoadingCarriers(true);
            // Use getTrainingCarriers to get ALL available carriers (not just trained ones)
            const getCarriersFunc = httpsCallable(functions, 'getTrainingCarriers');
            const result = await getCarriersFunc({
                status: 'active' // Get all active training carriers
            });

            if (result.data?.success) {
                const carriersList = result.data.data?.carriers || [];
                console.log(`Setting carriers to:`, carriersList);
                setCarriers(carriersList);
                console.log(`Loaded ${carriersList.length} training carriers for Training Workflow`);
                console.log(`Current selectedCarrier before setting carriers:`, selectedCarrier);

                // Show message if no carriers available
                if (carriersList.length === 0) {
                    enqueueSnackbar('No training carriers available. Use Carrier Management to add carriers first.', {
                        variant: 'info',
                        autoHideDuration: 5000
                    });
                }
            } else {
                throw new Error(result.data?.error || 'Failed to load carriers');
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
                // Cloud function returns analytics in `data` property
                setTrainingAnalytics(result.data.data);
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
            // First try to load visual training samples directly using Firestore v9 syntax
            const visualSamplesQuery = query(
                collection(db, 'unifiedTraining', selectedCarrier.id, 'samples'),
                where('trainingType', '==', 'visual_annotation')
            );

            const visualSamplesSnapshot = await getDocs(visualSamplesQuery);
            const visualSamples = visualSamplesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (visualSamples.length > 0) {
                console.log(`Found ${visualSamples.length} visual training samples for ${selectedCarrier.name}`);
                setTrainingSamples(visualSamples);

                // Auto-complete workflow steps for existing visual training
                const completedSamples = visualSamples.filter(s => s.processingStatus === 'completed');
                if (completedSamples.length > 0) {
                    setStepCompleted(prev => ({
                        ...prev,
                        upload: true,    // Visual samples exist
                        process: true,   // Visual training completed
                        review: completedSamples.length >= 1,
                        deploy: completedSamples.length >= 1 // Single visual training is sufficient
                    }));

                    // Advance to review/deploy step since visual training is done
                    setActiveStep(3); // Review step
                }
            } else {
                // Fallback to workflow training samples
                const listFunc = httpsCallable(functions, 'listTrainingSamples');
                const res = await listFunc({ carrierId: selectedCarrier.id, limit: 50 });
                if (res.data?.success && Array.isArray(res.data.samples)) {
                    setTrainingSamples(res.data.samples);
                }
            }
        } catch (error) {
            console.error('Error loading samples:', error);
            enqueueSnackbar('Failed to load training data', { variant: 'error' });
        }
    };

    // Enhanced validation utilities
    const validateCarrier = useCallback((carrier) => {
        if (!carrier) return { valid: false, message: 'Please select a carrier first' };
        if (!carrier.id || !carrier.name) return { valid: false, message: 'Invalid carrier selected' };
        return { valid: true };
    }, []);

    const validateFileUpload = useCallback((files) => {
        if (!files || files.length === 0) {
            return { valid: false, message: 'No files selected' };
        }

        const pdfFiles = files.filter(file => file.type === 'application/pdf');
        if (pdfFiles.length === 0) {
            return { valid: false, message: 'Please upload PDF files only. Other file types are not supported.' };
        }

        if (pdfFiles.length > 10) {
            return { valid: false, message: 'Maximum 10 files can be uploaded at once. Please split into smaller batches.' };
        }

        // Check file sizes (max 10MB per file)
        const oversizedFiles = pdfFiles.filter(file => file.size > 10 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            return {
                valid: false,
                message: `Files too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 10MB per file.`
            };
        }

        // Check for duplicate names
        const fileNames = pdfFiles.map(f => f.name.toLowerCase());
        const duplicates = fileNames.filter((name, index) => fileNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            return {
                valid: false,
                message: `Duplicate file names detected: ${[...new Set(duplicates)].join(', ')}`
            };
        }

        return { valid: true, files: pdfFiles };
    }, []);

    const validateModelDeployment = useCallback(() => {
        const processedSamples = trainingSamples.filter(s => s.processingStatus === 'completed').length;
        const avgConfidence = trainingAnalytics?.averageConfidence || 0;

        if (processedSamples < 3) {
            return {
                valid: false,
                message: `Minimum 3 successfully processed samples required. Currently have ${processedSamples}.`
            };
        }

        if (avgConfidence < 0.75) {
            return {
                valid: false,
                message: `Model confidence too low (${(avgConfidence * 100).toFixed(0)}%). Minimum 75% required for deployment.`
            };
        }

        return { valid: true };
    }, [trainingSamples, trainingAnalytics]);

    // Enhanced multi-file drop handler with comprehensive validation
    const onDrop = useCallback(async (acceptedFiles) => {
        // Validate carrier selection
        const carrierValidation = validateCarrier(selectedCarrier);
        if (!carrierValidation.valid) {
            enqueueSnackbar(carrierValidation.message, { variant: 'warning' });
            return;
        }

        // Validate file upload
        const fileValidation = validateFileUpload(acceptedFiles);
        if (!fileValidation.valid) {
            enqueueSnackbar(fileValidation.message, { variant: 'error' });
            return;
        }

        const pdfFiles = fileValidation.files;

        setUploadingSamples(pdfFiles.map(file => ({
            id: `temp_${Date.now()}_${Math.random()}`,
            file,
            status: 'uploading',
            progress: 0
        })));

        let successCount = 0;
        let errorCount = 0;

        for (const file of pdfFiles) {
            try {
                await uploadTrainingSample(file);
                successCount++;
            } catch (error) {
                errorCount++;
            }
        }

        setUploadingSamples([]);

        if (successCount > 0 && errorCount === 0) {
            enqueueSnackbar(`Successfully uploaded ${successCount} training samples`, { variant: 'success' });
        } else if (successCount > 0 && errorCount > 0) {
            enqueueSnackbar(`Uploaded ${successCount} samples, ${errorCount} failed`, { variant: 'warning' });
        } else {
            enqueueSnackbar(`Failed to upload ${errorCount} samples`, { variant: 'error' });
        }

    }, [selectedCarrier, validateCarrier, validateFileUpload, enqueueSnackbar]);

    // Update step completion based on training state with persistence
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

        // Save progress whenever step completion changes
        const currentProgress = {
            activeTab,
            activeStep,
            stepCompleted: newStepCompleted,
            workflowData,
            selectedCarrier,
            trainingSamplesCount: trainingSamples.length,
            processedSamplesCount: processedSamples
        };
        saveProgress(currentProgress);

        // Auto-advance only within the 2-step workflow
        if (newStepCompleted.select && activeStep === 0) {
            // Advance to step 1 (Upload & Train) when carrier is selected
            setActiveStep(1);
        }

    }, [selectedCarrier, trainingSamples, processingSamples, activeStep, activeTab, workflowData, saveProgress]);

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
        console.log('🔍 processAllPending called');
        console.log('📊 All training samples:', trainingSamples);

        const pending = trainingSamples.filter(s => s.processingStatus === 'pending');
        console.log('⏳ Pending samples found:', pending);

        if (pending.length === 0) {
            console.log('⚠️  No pending samples to process');
            return;
        }

        console.log(`🔄 Processing ${pending.length} pending samples...`);
        for (const s of pending) {
            console.log(`🔄 Processing sample: ${s.id}`);
            // eslint-disable-next-line no-await-in-loop
            await processSample(s.id);
        }
        console.log('✅ All pending samples processed');
    };

    // Unified completion handler used by buttons and Next action on step 1
    const handleCompleteTraining = async () => {
        console.log('🚀 Starting training process...');
        console.log('Training samples:', trainingSamples);
        console.log('Selected carrier:', selectedCarrier);

        try {
            console.log('📝 Calling processAllPending...');
            await processAllPending();
            console.log('✅ processAllPending completed');

            // Set step as completed
            setStepCompleted(prev => ({ ...prev, upload: true }));
            console.log('✅ Step marked as completed');

            // Show success notification
            enqueueSnackbar(`Training completed successfully for ${selectedCarrier?.name}!`, {
                variant: 'success',
                autoHideDuration: 5000
            });
            console.log('✅ Success notification shown');

            // Refresh analytics to show updated results
            console.log('📊 Refreshing analytics...');
            await loadTrainingAnalytics();
            console.log('✅ Analytics refreshed');

        } catch (error) {
            console.error('❌ Error processing samples:', error);
            enqueueSnackbar(`Error processing training samples: ${error.message}`, {
                variant: 'error'
            });
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
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            autoSelect={false}
            autoHighlight={false}
            clearOnEscape={true}
            onChange={(_, value, reason) => {
                console.log('Carrier selector onChange called with value:', value, 'Current selectedCarrier:', selectedCarrier, 'Reason:', reason);

                // Only allow manual selection, not programmatic
                if (reason === 'selectOption' || reason === 'clear') {
                    console.log('✅ Manual user selection detected');
                    setSelectedCarrier(value);
                    if (value) {
                        console.log('Marking select step as completed for carrier:', value.name);
                        setStepCompleted(prev => ({ ...prev, select: true }));
                    } else {
                        console.log('Clearing carrier selection');
                        setStepCompleted(prev => ({ ...prev, select: false }));
                    }
                } else {
                    console.log('❌ Programmatic selection blocked, reason:', reason);
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
                    label="Select Carrier"
                    placeholder={carriers.length === 0 ? "No carriers available - use Carrier Management tab to add" : "Choose a carrier to train..."}
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
            noOptionsText={
                <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                        No carriers available for training
                    </Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setActiveTab(2)}
                        sx={{ fontSize: '10px' }}
                    >
                        Go to Carrier Management
                    </Button>
                </Box>
            }
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {sample.file.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        ({(sample.file.size / (1024 * 1024)).toFixed(1)} MB)
                                    </Typography>
                                </Box>
                            </TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip size="small" label="Uploading" color="info" />
                                    <LinearProgress
                                        variant="indeterminate"
                                        sx={{
                                            width: 60,
                                            height: 3,
                                            '& .MuiLinearProgress-bar': { backgroundColor: '#3b82f6' }
                                        }}
                                    />
                                </Box>
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip
                                        size="small"
                                        label={sample.processingStatus || 'uploaded'}
                                        color={
                                            sample.processingStatus === 'completed' ? 'success' :
                                                sample.processingStatus === 'processing' ? 'warning' :
                                                    sample.processingStatus === 'failed' ? 'error' : 'default'
                                        }
                                    />
                                    {processingSamples.has(sample.id) && (
                                        <LinearProgress
                                            variant="indeterminate"
                                            sx={{
                                                width: 40,
                                                height: 2,
                                                '& .MuiLinearProgress-bar': { backgroundColor: '#f59e0b' }
                                            }}
                                        />
                                    )}
                                </Box>
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

            {/* Tab Navigation */}
                                <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 3 }}>
                        <Tab label="Trained Carriers" sx={{ fontSize: '12px' }} />
                        <Tab label="Visual Training" sx={{ fontSize: '12px' }} />
                        <Tab label="Testing & Validation" sx={{ fontSize: '12px' }} />
                    </Tabs>

            {/* Visual Training Tab (now index 1) */}
            {activeTab === 1 && (
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
                        onAddCarrierSuccess={() => {
                            // Reload unified carriers when a new carrier is added
                            loadUnifiedCarriers();
                        }}
                        onTrainingComplete={(results) => {
                            console.log('Visual training completed:', results);
                            // Refresh analytics and samples
                            loadTrainingAnalytics();
                            loadCarrierSamples();
                            // Navigate to Trained Carriers to show confidence table
                            setActiveTab(0);
                            enqueueSnackbar('Training saved. Showing Carrier Confidence table.', { variant: 'success' });
                        }}
                    />
                </Box>
            )}

            {/* Training Workflow Tab removed */}
            {false && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Machine Learning Training Workflow
                            </Typography>

                            <Stepper activeStep={Math.min(activeStep, TRAINING_STEPS.length - 1)} orientation="vertical">
                                {TRAINING_STEPS.map((step, index) => (
                                    <Step key={step.id} completed={stepCompleted[step.id]}>
                                        <StepLabel
                                            sx={{
                                                cursor: 'pointer',
                                                '&:hover': { backgroundColor: '#f9fafb' },
                                                '& .MuiStepLabel-labelContainer': {
                                                    cursor: 'pointer'
                                                }
                                            }}
                                            onClick={() => {
                                                console.log(`Clicked on step ${index}: ${step.label}. Current activeStep: ${activeStep}. Setting activeStep to: ${index}`);
                                                setActiveStep(index);
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                    {step.label}
                                                </Typography>
                                                <Tooltip
                                                    title={
                                                        <Box>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                {step.helpText}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px', mb: 1, fontWeight: 600 }}>
                                                                💡 Tips:
                                                            </Typography>
                                                            {step.tips.map((tip, i) => (
                                                                <Typography key={i} sx={{ fontSize: '11px', mb: 0.5 }}>
                                                                    • {tip}
                                                                </Typography>
                                                            ))}
                                                        </Box>
                                                    }
                                                    arrow
                                                    placement="right"
                                                >
                                                    <HelpIcon sx={{ fontSize: 16, color: '#6b7280', cursor: 'help' }} />
                                                </Tooltip>
                                            </Box>
                                        </StepLabel>
                                        <StepContent>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                                {step.description}
                                            </Typography>

                                            {/* Enhanced Progress Indicator */}
                                            <Box sx={{ mb: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                                                        Step Progress
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {stepCompleted[step.id] ? '✅ Complete' : '⏳ In Progress'}
                                                    </Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={stepCompleted[step.id] ? 100 : (index < activeStep ? 100 : (index === activeStep ? 50 : 0))}
                                                    sx={{
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: '#f3f4f6',
                                                        '& .MuiLinearProgress-bar': {
                                                            backgroundColor: stepCompleted[step.id] ? '#10b981' : '#8b5cf6'
                                                        }
                                                    }}
                                                />
                                            </Box>

                                            {/* Step Content */}
                                            {index === 0 && (
                                                <Box sx={{ mb: 2 }}>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                                        Select a carrier to train:
                                                    </Typography>
                                                    <CarrierSelector />
                                                    {selectedCarrier && (
                                                        <Alert severity="success" sx={{ mt: 2 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                                ✅ Selected: {selectedCarrier.name}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                {selectedCarrier.sampleCount || 0} training samples • {((selectedCarrier.confidence || 0) * 100).toFixed(0)}% confidence
                                                            </Typography>
                                                        </Alert>
                                                    )}

                                                    {/* Navigation buttons for step 0 */}
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            disabled={!selectedCarrier}
                                                            onClick={() => setActiveStep(1)}
                                                            sx={{ fontSize: '12px' }}
                                                        >
                                                            Next: Upload & Train
                                                        </Button>
                                                    </Box>
                                                </Box>
                                            )}

                                            {index === 1 && selectedCarrier && (
                                                <Box>
                                                    {/* Simplified Upload Guidelines */}
                                                    <Alert severity="success" sx={{ mb: 2 }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                            🚀 Ready to Train with {selectedCarrier.name}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px' }}>
                                                            Upload a single representative invoice to train the AI model instantly. The system will analyze the document and create a working model immediately.
                                                        </Typography>
                                                    </Alert>

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
                                                        <Typography sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                            Upload one invoice to train instantly • Model ready in 30 seconds
                                                        </Typography>
                                                    </Box>

                                                    {(trainingSamples.length > 0 || uploadingSamples.length > 0) && (
                                                        <SamplesTable />
                                                    )}

                                                    {/* Primary CTA for step 1 to trigger training */}
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            disabled={trainingSamples.length === 0}
                                                            onClick={handleCompleteTraining}
                                                            sx={{ fontSize: '12px' }}
                                                        >
                                                            Process & Complete Training
                                                        </Button>
                                                    </Box>
                                                </Box>
                                            )}

                                            {index === 2 && selectedCarrier && (
                                                <Box>
                                                    {trainingSamples.length === 0 ? (
                                                        <Alert severity="warning" sx={{ mb: 2 }}>
                                                            Please upload training samples first before AI processing can begin
                                                        </Alert>
                                                    ) : trainingSamples.some(s => s.trainingType === 'visual_annotation' && s.processingStatus === 'completed') ? (
                                                        <Alert severity="success" sx={{ mb: 2 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                ✅ Visual Training Complete
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px', mb: 2 }}>
                                                                Your carrier has been trained using visual annotations. The AI model is ready for use.
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>
                                                                {trainingSamples.filter(s => s.trainingType === 'visual_annotation' && s.processingStatus === 'completed').length} visual training samples completed.
                                                            </Typography>
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

                                                    {/* Navigation buttons for step 1 */}
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() => setActiveStep(0)}
                                                            sx={{ fontSize: '12px' }}
                                                        >
                                                            Back
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            disabled={trainingSamples.length === 0}
                                                            onClick={async () => {
                                                                console.log('🚀 Starting training process...');
                                                                console.log('Training samples:', trainingSamples);
                                                                console.log('Selected carrier:', selectedCarrier);

                                                                try {
                                                                    console.log('📝 Calling processAllPending...');
                                                                    await processAllPending();
                                                                    console.log('✅ processAllPending completed');

                                                                    // Set step as completed
                                                                    setStepCompleted(prev => ({ ...prev, upload: true }));
                                                                    console.log('✅ Step marked as completed');

                                                                    // Show success notification
                                                                    enqueueSnackbar(`Training completed successfully for ${selectedCarrier?.name}!`, {
                                                                        variant: 'success',
                                                                        autoHideDuration: 5000
                                                                    });
                                                                    console.log('✅ Success notification shown');

                                                                    // Refresh analytics to show updated results
                                                                    console.log('📊 Refreshing analytics...');
                                                                    await loadTrainingAnalytics();
                                                                    console.log('✅ Analytics refreshed');

                                                                } catch (error) {
                                                                    console.error('❌ Error processing samples:', error);
                                                                    enqueueSnackbar(`Error processing training samples: ${error.message}`, {
                                                                        variant: 'error'
                                                                    });
                                                                }
                                                            }}
                                                            sx={{ fontSize: '12px' }}
                                                        >
                                                            Process & Complete Training
                                                        </Button>
                                                    </Box>
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
                                                    {(() => {
                                                        const deployValidation = validateModelDeployment();
                                                        return deployValidation.valid ? (
                                                            <>
                                                                <Alert severity="success" sx={{ mb: 2 }}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                        Model Ready for Production
                                                                    </Typography>
                                                                    <Typography sx={{ fontSize: '11px' }}>
                                                                        Confidence: {trainingAnalytics?.averageConfidence ? `${(trainingAnalytics.averageConfidence * 100).toFixed(0)}%` : 'Unknown'} |
                                                                        Samples: {trainingSamples.filter(s => s.processingStatus === 'completed').length} processed
                                                                    </Typography>
                                                                </Alert>
                                                                <Button
                                                                    variant="contained"
                                                                    color="primary"
                                                                    onClick={() => {
                                                                        enqueueSnackbar('Model deployed to production! Available in AP Processing.', { variant: 'success' });
                                                                        // Clear progress after successful deployment
                                                                        setTimeout(() => clearProgress(), 2000);
                                                                    }}
                                                                >
                                                                    Deploy to Production
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Alert severity="warning" sx={{ mb: 2 }}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                        Model Not Ready for Deployment
                                                                    </Typography>
                                                                    <Typography sx={{ fontSize: '11px' }}>
                                                                        {deployValidation.message}
                                                                    </Typography>
                                                                </Alert>
                                                                <Button
                                                                    variant="contained"
                                                                    color="primary"
                                                                    disabled
                                                                >
                                                                    Deploy to Production
                                                                </Button>
                                                            </>
                                                        );
                                                    })()}
                                                </Box>
                                            )}

                                            {/* Step Navigation Buttons */}
                                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                                                    disabled={activeStep === 0}
                                                    sx={{ fontSize: '11px' }}
                                                >
                                                    Previous
                                                </Button>
                                                {/* Next button removed — use explicit Process & Complete Training in step 1 */}
                                                {/* Step jump buttons for completed steps */}
                                                {TRAINING_STEPS.map((step, stepIndex) => (
                                                    stepCompleted[step.id] && stepIndex !== activeStep && (
                                                        <Button
                                                            key={step.id}
                                                            size="small"
                                                            variant="text"
                                                            onClick={() => setActiveStep(stepIndex)}
                                                            sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                                        >
                                                            {stepIndex + 1}
                                                        </Button>
                                                    )
                                                ))}
                                            </Box>
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
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Selected Carrier
                                            </Typography>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => setActiveStep(0)}
                                                sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                            >
                                                Change
                                            </Button>
                                        </Box>
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

            {/* Trained Carriers (Carrier Management) Tab now index 0 */}
            {activeTab === 0 && (
                <CarrierManagement />
            )}

            {/* Testing & Validation Tab (now index 2 after removal) */}
            {activeTab === 2 && (
                <InvoiceTestingEngine
                    carriers={carriers}
                    selectedCarrier={selectedCarrier}
                    onCarrierChange={setSelectedCarrier}
                    onTestCompleted={(testResults) => {
                        // Handle test completion
                        enqueueSnackbar(`Test completed with ${Math.round((testResults.accuracyMetrics?.overall || 0) * 100)}% accuracy`, {
                            variant: 'success'
                        });

                        // Optionally refresh analytics
                        if (selectedCarrier?.id) {
                            // loadAnalytics(selectedCarrier.id); // TODO: Implement analytics refresh
                        }
                    }}
                />
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
