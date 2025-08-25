import React, { useState, useEffect, useCallback } from 'react';
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
    Divider
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Visibility as ViewIcon,
    Edit as EditIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    Save as SaveIcon,
    AutoFixHigh as AIIcon,
    Psychology as BrainIcon,
    Business as BusinessIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import VisualPDFViewer from './VisualPDFViewer';
import BoundingBoxAnnotator from './BoundingBoxAnnotator';
import TrainingMetrics from './TrainingMetrics';
import CarrierManagement from './CarrierManagement';

const TRAINING_STEPS = [
    {
        id: 'upload',
        label: 'Upload Invoice',
        description: 'Select a carrier and upload invoice PDF'
    },
    {
        id: 'analyze',
        label: 'AI Analysis',
        description: 'AI analyzes layout and extracts components'
    },
    {
        id: 'review',
        label: 'Review & Correct',
        description: 'Review annotations and make corrections'
    },
    {
        id: 'finalize',
        label: 'Finalize Training',
        description: 'Save template and apply learnings'
    }
];

const CARRIER_OPTIONS = [
    { id: 'purolator', name: 'Purolator' },
    { id: 'canadapost', name: 'Canada Post' },
    { id: 'fedex', name: 'FedEx' },
    { id: 'ups', name: 'UPS' },
    { id: 'canpar', name: 'Canpar' },
    { id: 'dhl', name: 'DHL' },
    { id: 'landliner', name: 'Landliner Inc' }
];

export default function VisualInvoiceTraining() {
    const { enqueueSnackbar } = useSnackbar();

    // Tab management
    const [activeTab, setActiveTab] = useState(0);

    // Step management
    const [activeStep, setActiveStep] = useState(0);
    const [stepCompleted, setStepCompleted] = useState({});

    // Training data
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [boundingBoxes, setBoundingBoxes] = useState([]);
    const [corrections, setCorrections] = useState([]);

    // UI state
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [showPDFViewer, setShowPDFViewer] = useState(false);
    const [analysisId, setAnalysisId] = useState(null);

    // Training metrics
    const [trainingMetrics, setTrainingMetrics] = useState(null);

    const onDrop = useCallback(async (acceptedFiles) => {
        if (!selectedCarrier) {
            enqueueSnackbar('Please select a carrier first', { variant: 'warning' });
            return;
        }

        const file = acceptedFiles[0];
        if (file?.type !== 'application/pdf') {
            enqueueSnackbar('Please upload a PDF file', { variant: 'error' });
            return;
        }

        setUploadedFile(file);
        setStepCompleted(prev => ({ ...prev, upload: true }));
        setActiveStep(1);

        // Auto-start analysis
        setTimeout(() => {
            startAIAnalysis(file);
        }, 500);
    }, [selectedCarrier, enqueueSnackbar]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false
    });

    const startAIAnalysis = async (file) => {
        setIsAnalyzing(true);

        try {
            // Convert file to base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result.split(',')[1];
                    resolve(result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Upload to storage first
            const uploadFn = httpsCallable(functions, 'uploadTrainingSamples');
            const uploadResult = await uploadFn({
                carrierId: selectedCarrier.id,
                samples: [{
                    fileName: file.name,
                    base64: base64
                }]
            });

            if (!uploadResult.data.success) {
                throw new Error(uploadResult.data.message || 'Upload failed');
            }

            const exampleId = uploadResult.data.results[0].exampleId;
            const pdfUrl = uploadResult.data.results[0].downloadURL;

            setPdfUrl(pdfUrl);

            // Start visual analysis
            const analyzeFn = httpsCallable(functions, 'analyzeInvoiceWithVision');
            const analysisResult = await analyzeFn({
                carrierId: selectedCarrier.id,
                exampleId: exampleId,
                pdfUrl: pdfUrl
            });

            if (!analysisResult.data.success) {
                throw new Error(analysisResult.data.error || 'Analysis failed');
            }

            setAnalysisData(analysisResult.data.data);
            setBoundingBoxes(analysisResult.data.data.boundingBoxes || []);
            setAnalysisId(analysisResult.data.data.analysisId);

            setStepCompleted(prev => ({ ...prev, analyze: true }));
            setActiveStep(2);
            setShowPDFViewer(true);

            enqueueSnackbar(
                `AI analysis complete! Found ${analysisResult.data.data.boundingBoxes?.length || 0} components.`,
                { variant: 'success' }
            );

        } catch (error) {
            console.error('Analysis failed:', error);
            enqueueSnackbar(`Analysis failed: ${error.message}`, { variant: 'error' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleBoundingBoxCorrection = (correctionData) => {
        setCorrections(prev => [...prev, correctionData]);

        // Update the bounding boxes immediately for visual feedback
        setBoundingBoxes(prev =>
            prev.map(box =>
                box.id === correctionData.boundingBoxId
                    ? { ...box, ...correctionData.updates, corrected: true }
                    : box
            )
        );
    };

    const saveCorrections = async () => {
        if (!corrections.length) {
            enqueueSnackbar('No corrections to save', { variant: 'info' });
            setStepCompleted(prev => ({ ...prev, review: true }));
            setActiveStep(3);
            return;
        }

        setIsSaving(true);

        try {
            const updateFn = httpsCallable(functions, 'updateTrainingFromCorrections');
            const result = await updateFn({
                analysisId: analysisId,
                corrections: corrections,
                userFeedback: {
                    satisfactionRating: 5, // Could be collected from user
                    comments: 'Corrections applied via visual training interface'
                }
            });

            if (!result.data.success) {
                throw new Error(result.data.error || 'Failed to save corrections');
            }

            enqueueSnackbar(
                `Training updated! Applied ${corrections.length} corrections.`,
                { variant: 'success' }
            );

            setStepCompleted(prev => ({ ...prev, review: true }));
            setActiveStep(3);

            // Update metrics
            if (result.data.data.learningInsights) {
                setTrainingMetrics(result.data.data);
            }

        } catch (error) {
            console.error('Save failed:', error);
            enqueueSnackbar(`Failed to save: ${error.message}`, { variant: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const finalizeTraining = async () => {
        try {
            // Mark training as complete
            setStepCompleted(prev => ({ ...prev, finalize: true }));

            enqueueSnackbar(
                'Training completed! The AI will now use these learnings for future invoice processing.',
                { variant: 'success' }
            );

            // Reset for next training session
            setTimeout(() => {
                resetTrainingSession();
            }, 2000);

        } catch (error) {
            console.error('Finalization failed:', error);
            enqueueSnackbar(`Failed to finalize: ${error.message}`, { variant: 'error' });
        }
    };

    const resetTrainingSession = () => {
        setActiveStep(0);
        setStepCompleted({});
        setSelectedCarrier(null);
        setUploadedFile(null);
        setAnalysisData(null);
        setBoundingBoxes([]);
        setCorrections([]);
        setPdfUrl(null);
        setShowPDFViewer(false);
        setAnalysisId(null);
        setTrainingMetrics(null);
    };

    const getStepIcon = (stepIndex) => {
        if (stepCompleted[TRAINING_STEPS[stepIndex]?.id]) {
            return <CheckIcon sx={{ color: '#4CAF50' }} />;
        }

        switch (stepIndex) {
            case 0: return <UploadIcon />;
            case 1: return isAnalyzing ? <CircularProgress size={24} /> : <AIIcon />;
            case 2: return <EditIcon />;
            case 3: return <BrainIcon />;
            default: return stepIndex + 1;
        }
    };

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
                    <Typography variant="h5" fontWeight={600} color="#111827">
                        AI Invoice Training System
                    </Typography>
                    <Typography variant="body2" color="#6b7280" fontSize="12px">
                        Production-ready AI training for global scale invoice processing
                    </Typography>
                </Box>
            </Box>

            {/* Tabs */}
            <Paper
                elevation={0}
                sx={{
                    mb: 3,
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                }}
            >
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    sx={{
                        px: 2,
                        '& .MuiTab-root': {
                            fontSize: '12px',
                            textTransform: 'none',
                            minHeight: '48px'
                        }
                    }}
                >
                    <Tab
                        icon={<AIIcon />}
                        label="Visual Training"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<BusinessIcon />}
                        label="Carrier Management"
                        iconPosition="start"
                    />
                </Tabs>
            </Paper>

            {/* Tab Content */}
            {activeTab === 0 && (
                <Box>

                    <Grid container spacing={3}>
                        {/* Left Panel - Training Steps */}
                        <Grid item xs={12} md={4}>
                            <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600, mb: 3 }}>
                                    Training Progress
                                </Typography>

                                <Stepper activeStep={activeStep} orientation="vertical">
                                    {TRAINING_STEPS.map((step, index) => (
                                        <Step key={step.id} completed={stepCompleted[step.id]}>
                                            <StepLabel icon={getStepIcon(index)}>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                    {step.label}
                                                </Typography>
                                            </StepLabel>
                                            <StepContent>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                                    {step.description}
                                                </Typography>

                                                {/* Step 1: Upload */}
                                                {index === 0 && (
                                                    <Box>
                                                        <Autocomplete
                                                            size="small"
                                                            options={CARRIER_OPTIONS}
                                                            getOptionLabel={(option) => option.name}
                                                            value={selectedCarrier}
                                                            onChange={(_, value) => setSelectedCarrier(value)}
                                                            renderInput={(params) => (
                                                                <TextField
                                                                    {...params}
                                                                    label="Select Carrier"
                                                                    sx={{ mb: 2 }}
                                                                />
                                                            )}
                                                        />

                                                        <Box
                                                            {...getRootProps()}
                                                            sx={{
                                                                p: 3,
                                                                border: '2px dashed #d1d5db',
                                                                borderRadius: '8px',
                                                                textAlign: 'center',
                                                                cursor: 'pointer',
                                                                backgroundColor: isDragActive ? '#f3f4f6' : 'transparent',
                                                                transition: 'all 0.2s ease-in-out',
                                                                '&:hover': {
                                                                    borderColor: '#9ca3af',
                                                                    backgroundColor: '#f9fafb'
                                                                }
                                                            }}
                                                        >
                                                            <input {...getInputProps()} />
                                                            <UploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 1 }} />
                                                            <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                                                                {isDragActive
                                                                    ? 'Drop PDF here...'
                                                                    : 'Drag & drop invoice PDF or click to browse'
                                                                }
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                )}

                                                {/* Step 2: Analysis */}
                                                {index === 1 && (
                                                    <Box>
                                                        {isAnalyzing ? (
                                                            <Alert severity="info" sx={{ mb: 2 }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                    <CircularProgress size={20} />
                                                                    <Typography sx={{ fontSize: '14px' }}>
                                                                        AI is analyzing your invoice...
                                                                    </Typography>
                                                                </Box>
                                                            </Alert>
                                                        ) : analysisData ? (
                                                            <Alert severity="success" sx={{ mb: 2 }}>
                                                                <Typography sx={{ fontSize: '14px' }}>
                                                                    ✅ Found {boundingBoxes.length} components with{' '}
                                                                    {Math.round(analysisData.confidence * 100)}% confidence
                                                                </Typography>
                                                            </Alert>
                                                        ) : null}

                                                        {analysisData && (
                                                            <Button
                                                                variant="contained"
                                                                size="small"
                                                                onClick={() => setShowPDFViewer(true)}
                                                                startIcon={<ViewIcon />}
                                                            >
                                                                View Results
                                                            </Button>
                                                        )}
                                                    </Box>
                                                )}

                                                {/* Step 3: Review */}
                                                {index === 2 && analysisData && (
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', mb: 2 }}>
                                                            Review the AI's annotations and make corrections:
                                                        </Typography>

                                                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                                            <Chip
                                                                label={`${boundingBoxes.length} Components`}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                            <Chip
                                                                label={`${corrections.length} Corrections`}
                                                                size="small"
                                                                color="primary"
                                                                variant={corrections.length > 0 ? "filled" : "outlined"}
                                                            />
                                                        </Box>

                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            onClick={saveCorrections}
                                                            disabled={isSaving}
                                                            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
                                                            sx={{ mr: 1 }}
                                                        >
                                                            Save Corrections
                                                        </Button>

                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() => setShowPDFViewer(true)}
                                                            startIcon={<ViewIcon />}
                                                        >
                                                            Review PDF
                                                        </Button>
                                                    </Box>
                                                )}

                                                {/* Step 4: Finalize */}
                                                {index === 3 && (
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', mb: 2 }}>
                                                            Complete the training to apply all learnings to the AI model.
                                                        </Typography>

                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            onClick={finalizeTraining}
                                                            startIcon={<CheckIcon />}
                                                            color="success"
                                                        >
                                                            Complete Training
                                                        </Button>
                                                    </Box>
                                                )}
                                            </StepContent>
                                        </Step>
                                    ))}
                                </Stepper>
                            </Paper>

                            {/* Training Metrics */}
                            {trainingMetrics && (
                                <Box sx={{ mt: 3 }}>
                                    <TrainingMetrics metrics={trainingMetrics} />
                                </Box>
                            )}
                        </Grid>

                        {/* Right Panel - PDF Viewer & Annotations */}
                        <Grid item xs={12} md={8}>
                            {showPDFViewer && pdfUrl ? (
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                                    <VisualPDFViewer
                                        pdfUrl={pdfUrl}
                                        boundingBoxes={boundingBoxes}
                                        onBoundingBoxUpdate={handleBoundingBoxCorrection}
                                        editable={activeStep === 2}
                                    />
                                </Paper>
                            ) : (
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 6,
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '12px',
                                        textAlign: 'center',
                                        minHeight: '400px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Box sx={{ opacity: 0.5 }}>
                                        <ViewIcon sx={{ fontSize: 80, color: '#9ca3af', mb: 2 }} />
                                        <Typography variant="h6" sx={{ color: '#6b7280', mb: 1 }}>
                                            PDF Viewer
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', color: '#9ca3af' }}>
                                            Upload an invoice to see the visual training interface
                                        </Typography>
                                    </Box>
                                </Paper>
                            )}
                        </Grid>
                    </Grid>

                    {/* Floating Action Button */}
                    {showPDFViewer && activeStep > 0 && (
                        <Zoom in={true}>
                            <Fab
                                color="secondary"
                                sx={{ position: 'fixed', bottom: 24, right: 24 }}
                                onClick={resetTrainingSession}
                            >
                                <Badge badgeContent={corrections.length} color="primary">
                                    <CloseIcon />
                                </Badge>
                            </Fab>
                        </Zoom>
                    )}
                </Box>
            )}

            {/* Carrier Management Tab */}
            {activeTab === 1 && (
                <CarrierManagement />
            )}
        </Box>
    );
}
