import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Button,
    Alert,
    Grid,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Toolbar,
    Tooltip,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Autocomplete,
    TextField,
    Stack
} from '@mui/material';
import {
    CheckCircle as CompleteIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    CropFree as SelectIcon,
    Business as CarrierIcon,
    Receipt as InvoiceIcon,
    LocalShipping as ShipmentIcon,
    AttachMoney as ChargesIcon,
    Calculate as TotalIcon,
    Visibility as PreviewIcon,
    Save as SaveIcon,
    PlayArrow as TrainIcon,
    Add as AddIcon
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import { functions } from '../../../firebase/firebase';
import { httpsCallable } from 'firebase/functions';

// Configure PDF.js to use a locally hosted worker that matches react-pdf's bundled pdfjs-dist version
// This avoids CORS issues and version mismatches
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const ANNOTATION_STEPS = [
    {
        id: 'carrier',
        label: 'Carrier Information',
        description: 'Draw a box around the carrier logo or company name',
        icon: CarrierIcon,
        color: '#2563eb',
        examples: ['Company logo in header', 'Carrier name at top', 'Letterhead company info']
    },
    {
        id: 'invoice_number',
        label: 'Invoice Number',
        description: 'Highlight the invoice number or reference ID',
        icon: InvoiceIcon,
        color: '#dc2626',
        examples: ['Invoice #12345', 'Ref: ABC-123', 'Bill Number: 67890'],
        allowMultiple: true
    },
    {
        id: 'shipment_ids',
        label: 'Shipment IDs',
        description: 'Select all shipment/tracking numbers (can select multiple)',
        icon: ShipmentIcon,
        color: '#059669',
        examples: ['Tracking: 1Z123456', 'PRO: 789456123', 'Shipment ID: SHP-001'],
        allowMultiple: true
    },
    {
        id: 'charges',
        label: 'Line Item Charges',
        description: 'Highlight the charges table or line items section',
        icon: ChargesIcon,
        color: '#7c3aed',
        examples: ['Freight charges table', 'Service fees list', 'Itemized costs'],
        allowMultiple: true
    },
    {
        id: 'total',
        label: 'Total Amount',
        description: 'Select the final total amount to be charged',
        icon: TotalIcon,
        color: '#ea580c',
        examples: ['Total: $1,234.56', 'Amount Due: $567.89', 'Grand Total: $999.00']
    }
];

export default function VisualAnnotationTrainer({ selectedCarrier, onTrainingComplete, onCarrierChange }) {
    const { enqueueSnackbar } = useSnackbar();

    // Local carrier management state
    const [availableCarriers, setAvailableCarriers] = useState([]);
    const [loadingCarriers, setLoadingCarriers] = useState(true);
    const [localSelectedCarrier, setLocalSelectedCarrier] = useState(selectedCarrier);
    const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
    const [newCarrierName, setNewCarrierName] = useState('');

    // File and PDF state
    const [uploadedFile, setUploadedFile] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfScale, setPdfScale] = useState(1.0);
    const [pdfLoading, setPdfLoading] = useState(false);

    // Training state
    const [activeStep, setActiveStep] = useState(0);
    const [annotations, setAnnotations] = useState({});
    const [isAnnotating, setIsAnnotating] = useState(false);
    const [currentAnnotationSubType, setCurrentAnnotationSubType] = useState(null);
    const [currentAnnotationType, setCurrentAnnotationType] = useState(null);
    const [isTraining, setIsTraining] = useState(false);
    const [trainingResults, setTrainingResults] = useState(null);
    const trainButtonRef = useRef(null);

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState(null);
    const [currentBox, setCurrentBox] = useState(null);
    const canvasRef = useRef(null);
    const pdfContainerRef = useRef(null);

    // Load carriers on component mount
    useEffect(() => {
        loadCarriers();
    }, []);

    // Sync local selected carrier with prop
    useEffect(() => {
        setLocalSelectedCarrier(selectedCarrier);
    }, [selectedCarrier]);

    // Load available carriers
    const loadCarriers = async () => {
        try {
            setLoadingCarriers(true);
            const getCarriers = httpsCallable(functions, 'getUnifiedTrainingCarriers');
            const result = await getCarriers();

            if (result.data?.success) {
                setAvailableCarriers(result.data.carriers || []);
            } else {
                throw new Error(result.data?.error || 'Failed to load carriers');
            }
        } catch (error) {
            console.error('Error loading carriers:', error);
            enqueueSnackbar('Failed to load carriers', { variant: 'error' });
        } finally {
            setLoadingCarriers(false);
        }
    };

    // Add new carrier
    const handleAddCarrier = async () => {
        if (!newCarrierName.trim()) {
            enqueueSnackbar('Please enter a carrier name', { variant: 'warning' });
            return;
        }

        try {
            const addCarrier = httpsCallable(functions, 'addUnifiedTrainingCarrier');
            const result = await addCarrier({ name: newCarrierName.trim() });

            if (result.data?.success) {
                await loadCarriers(); // Refresh list
                setNewCarrierName('');
                setCarrierDialogOpen(false);
                enqueueSnackbar(`Carrier "${newCarrierName}" added successfully`, { variant: 'success' });
            } else {
                throw new Error(result.data?.error || 'Failed to add carrier');
            }
        } catch (error) {
            console.error('Error adding carrier:', error);
            enqueueSnackbar(`Failed to add carrier: ${error.message}`, { variant: 'error' });
        }
    };

    // Handle carrier selection
    const handleCarrierChange = (event, newValue) => {
        setLocalSelectedCarrier(newValue);
        if (onCarrierChange) {
            onCarrierChange(newValue);
        }
    };

    // Dropzone for file upload
    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploadedFile(file);
        setPdfLoading(true);

        try {
            // Create object URL for PDF display
            const url = URL.createObjectURL(file);
            setPdfUrl(url);
            setCurrentPage(1);
            setAnnotations({});
            setActiveStep(0);
            enqueueSnackbar(`Loaded ${file.name} - Ready for annotation!`, { variant: 'success' });
        } catch (error) {
            console.error('Error loading PDF:', error);
            enqueueSnackbar('Failed to load PDF file', { variant: 'error' });
        } finally {
            setPdfLoading(false);
        }
    }, [enqueueSnackbar]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false
    });

    // Start annotation for specific step
    const startAnnotation = useCallback((stepId, subTypeOverride = null) => {
        const step = ANNOTATION_STEPS.find(s => s.id === stepId);
        if (!step) return;

        setCurrentAnnotationType(stepId);
        // Default sub-type selection for complex steps
        if (stepId === 'charges') {
            setCurrentAnnotationSubType(subTypeOverride || 'amount');
        } else if (stepId === 'invoice_number') {
            // default to number if not specified
            setCurrentAnnotationSubType(subTypeOverride || 'number');
        } else {
            setCurrentAnnotationSubType(null);
        }
        setIsAnnotating(true);
        enqueueSnackbar(`Click and drag to select ${step.label}`, { variant: 'info' });
    }, [enqueueSnackbar]);

    // Mouse event handlers for drawing
    const handleMouseDown = useCallback((e) => {
        if (!isAnnotating || !pdfContainerRef.current) return;

        const containerRect = pdfContainerRef.current.getBoundingClientRect();
        const canvasEl = pdfContainerRef.current.querySelector('canvas');
        const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : containerRect;
        const baseLeft = canvasRect.left ?? containerRect.left;
        const baseTop = canvasRect.top ?? containerRect.top;
        const x = (e.clientX - baseLeft) / pdfScale;
        const y = (e.clientY - baseTop) / pdfScale;

        setIsDrawing(true);
        setStartPoint({ x, y });
        setCurrentBox({ x, y, width: 0, height: 0 });
    }, [isAnnotating, pdfScale]);

    const handleMouseMove = useCallback((e) => {
        if (!isDrawing || !startPoint || !pdfContainerRef.current) return;

        const containerRect = pdfContainerRef.current.getBoundingClientRect();
        const canvasEl = pdfContainerRef.current.querySelector('canvas');
        const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : containerRect;
        const baseLeft = canvasRect.left ?? containerRect.left;
        const baseTop = canvasRect.top ?? containerRect.top;
        const x = (e.clientX - baseLeft) / pdfScale;
        const y = (e.clientY - baseTop) / pdfScale;

        const width = x - startPoint.x;
        const height = y - startPoint.y;

        setCurrentBox({
            x: width < 0 ? x : startPoint.x,
            y: height < 0 ? y : startPoint.y,
            width: Math.abs(width),
            height: Math.abs(height)
        });
    }, [isDrawing, startPoint, pdfScale]);

    const handleMouseUp = useCallback(() => {
        if (!isDrawing || !currentBox || !currentAnnotationType) return;

        // Only save if box has meaningful size
        if (currentBox.width > 10 && currentBox.height > 10) {
            const step = ANNOTATION_STEPS.find(s => s.id === currentAnnotationType);
            const newAnnotation = {
                ...currentBox,
                page: currentPage,
                type: currentAnnotationType,
                label: step.label,
                color: step.color,
                subType: currentAnnotationSubType || undefined,
                timestamp: new Date().toISOString()
            };

            setAnnotations(prev => {
                const updated = { ...prev };
                if (step.allowMultiple) {
                    // For multi-select fields, store as array; for invoice_number, keep one per subType
                    if (!updated[currentAnnotationType]) {
                        updated[currentAnnotationType] = [];
                    }
                    if (currentAnnotationType === 'invoice_number' && newAnnotation.subType) {
                        // replace existing of same subType
                        const arr = updated[currentAnnotationType];
                        const idx = arr.findIndex(a => a.subType === newAnnotation.subType);
                        if (idx >= 0) {
                            arr[idx] = newAnnotation;
                        } else {
                            arr.push(newAnnotation);
                        }
                    } else {
                        updated[currentAnnotationType].push(newAnnotation);
                    }
                } else {
                    // For single-select fields, replace existing
                    updated[currentAnnotationType] = newAnnotation;
                }
                return updated;
            });

            enqueueSnackbar(`${step.label} annotation saved!`, { variant: 'success' });

            // Auto-advance to next step for single-select steps (keep invoice_number on step)
            if (!step.allowMultiple) {
                const currentIndex = ANNOTATION_STEPS.findIndex(s => s.id === step.id);
                setTimeout(() => setActiveStep(Math.min(currentIndex + 1, ANNOTATION_STEPS.length - 1)), 150);
            }
        }

        setIsDrawing(false);
        setStartPoint(null);
        setCurrentBox(null);
        setIsAnnotating(false);
        setCurrentAnnotationType(null);
    }, [isDrawing, currentBox, currentAnnotationType, currentPage, enqueueSnackbar]);

    // Remove annotation
    const removeAnnotation = useCallback((stepId, index = null) => {
        setAnnotations(prev => {
            const updated = { ...prev };
            if (index !== null && Array.isArray(updated[stepId])) {
                // Remove specific item from array
                updated[stepId].splice(index, 1);
                if (updated[stepId].length === 0) {
                    delete updated[stepId];
                }
            } else {
                // Remove entire annotation
                delete updated[stepId];
            }
            return updated;
        });
    }, []);

    // Helper to advance to next step
    const advanceToNextStep = useCallback((currentIndex) => {
        setActiveStep(prev => Math.min((currentIndex ?? prev) + 1, ANNOTATION_STEPS.length - 1));
    }, []);

    // Jump to any step (allows going back to completed selections)
    const goToStep = useCallback((stepIdOrIndex) => {
        if (typeof stepIdOrIndex === 'number') {
            setActiveStep(Math.max(0, Math.min(stepIdOrIndex, ANNOTATION_STEPS.length - 1)));
            return;
        }
        const idx = ANNOTATION_STEPS.findIndex(s => s.id === stepIdOrIndex);
        if (idx >= 0) setActiveStep(idx);
    }, []);

    // Get completion status for each step
    const getStepStatus = useCallback((stepId) => {
        const annotation = annotations[stepId];
        if (!annotation) return 'pending';
        if (Array.isArray(annotation)) {
            return annotation.length > 0 ? 'completed' : 'pending';
        }
        return 'completed';
    }, [annotations]);

    // Process training with annotations
    const handleTrainModel = useCallback(async () => {
        if (!uploadedFile || !selectedCarrier) {
            enqueueSnackbar('Please select a carrier and upload a file', { variant: 'error' });
            return;
        }

        const completedSteps = ANNOTATION_STEPS.filter(step => getStepStatus(step.id) === 'completed');
        if (completedSteps.length < 3) {
            enqueueSnackbar('Please annotate at least 3 fields before training', { variant: 'warning' });
            return;
        }

        setIsTraining(true);

        try {
            // Convert file to base64
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(uploadedFile);
            });

            // Prepare training data with annotations
            const trainingData = {
                carrierId: selectedCarrier.id,
                fileName: uploadedFile.name,
                base64Data,
                annotations,
                metadata: {
                    annotationMethod: 'visual_training',
                    totalStepsCompleted: completedSteps.length,
                    fileSize: uploadedFile.size,
                    trainingType: 'single_shot'
                }
            };

            // Call the training function
            const trainFunc = httpsCallable(functions, 'processVisualTrainingSample');
            const result = await trainFunc(trainingData);

            if (result.data?.success) {
                setTrainingResults(result.data);
                enqueueSnackbar('Training completed! Review the extracted data below.', { variant: 'success' });

                // Advance to next step or completion
                if (activeStep < ANNOTATION_STEPS.length) {
                    setActiveStep(ANNOTATION_STEPS.length); // Move to results step
                }

                if (onTrainingComplete) {
                    onTrainingComplete(result.data);
                }
            } else {
                throw new Error(result.data?.error || 'Training failed');
            }

        } catch (error) {
            console.error('Training error:', error);
            enqueueSnackbar(`Training failed: ${error.message}`, { variant: 'error' });
        } finally {
            setIsTraining(false);
        }
    }, [uploadedFile, selectedCarrier, annotations, getStepStatus, activeStep, onTrainingComplete, enqueueSnackbar]);

    // Render annotation overlays
    const renderAnnotations = () => {
        if (!pdfContainerRef.current) return null;

        const overlays = [];

        // Compute canvas offset inside container so overlays align with PDF canvas (centering, margins)
        const containerRect = pdfContainerRef.current.getBoundingClientRect();
        const canvasEl = pdfContainerRef.current.querySelector('canvas');
        const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : containerRect;
        const offsetX = (canvasRect.left ?? containerRect.left) - containerRect.left;
        const offsetY = (canvasRect.top ?? containerRect.top) - containerRect.top;

        // Render saved annotations
        Object.entries(annotations).forEach(([stepId, annotation]) => {
            const step = ANNOTATION_STEPS.find(s => s.id === stepId);
            if (!step) return;

            const annotationArray = Array.isArray(annotation) ? annotation : [annotation];

            annotationArray.forEach((ann, index) => {
                if (ann.page === currentPage) {
                    overlays.push(
                        <Box
                            key={`${stepId}-${index}`}
                            sx={{
                                position: 'absolute',
                                left: offsetX + ann.x * pdfScale,
                                top: offsetY + ann.y * pdfScale,
                                width: ann.width * pdfScale,
                                height: ann.height * pdfScale,
                                border: `2px solid ${step.color}`,
                                backgroundColor: `${step.color}20`,
                                pointerEvents: 'none',
                                borderRadius: '4px'
                            }}
                        />
                    );

                    // Label
                    overlays.push(
                        <Chip
                            key={`${stepId}-label-${index}`}
                            label={step.label}
                            size="small"
                            sx={{
                                position: 'absolute',
                                left: offsetX + ann.x * pdfScale,
                                top: offsetY + (ann.y - 30) * pdfScale,
                                backgroundColor: step.color,
                                color: 'white',
                                fontSize: '10px',
                                height: '20px',
                                pointerEvents: 'none'
                            }}
                        />
                    );
                }
            });
        });

        // Render current drawing box
        if (currentBox && isDrawing) {
            const step = ANNOTATION_STEPS.find(s => s.id === currentAnnotationType);
            if (step) {
                overlays.push(
                    <Box
                        key="current-drawing"
                        sx={{
                            position: 'absolute',
                            left: ((canvasRect?.left ?? containerRect.left) - containerRect.left) + currentBox.x * pdfScale,
                            top: ((canvasRect?.top ?? containerRect.top) - containerRect.top) + currentBox.y * pdfScale,
                            width: currentBox.width * pdfScale,
                            height: currentBox.height * pdfScale,
                            border: `2px dashed ${step.color}`,
                            backgroundColor: `${step.color}10`,
                            pointerEvents: 'none',
                            borderRadius: '4px'
                        }}
                    />
                );
            }
        }

        return overlays;
    };

    // Carrier Selection Section (always visible at top)
    const renderCarrierSelection = () => (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb', mb: 3 }}>
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                Select Carrier for Training
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
                <Autocomplete
                    value={localSelectedCarrier}
                    onChange={handleCarrierChange}
                    options={availableCarriers}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    loading={loadingCarriers}
                    sx={{
                        minWidth: 300,
                        flex: 1,
                        '& .MuiInputBase-input': { fontSize: '12px' },
                        '& .MuiInputLabel-root': { fontSize: '12px' },
                        '& .MuiFormLabel-root': { fontSize: '12px' },
                        '& .MuiAutocomplete-input': { fontSize: '12px' },
                        '& .MuiAutocomplete-inputRoot': { fontSize: '12px' }
                    }}
                    ListboxProps={{ sx: { fontSize: '12px' } }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Select Carrier"
                            size="small"
                            sx={{ fontSize: '12px' }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{
                                ...params.InputProps,
                                sx: { fontSize: '12px' }
                            }}
                        />
                    )}
                />
                <Button
                    startIcon={<AddIcon />}
                    onClick={() => setCarrierDialogOpen(true)}
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Add Carrier
                </Button>
            </Stack>
            {!localSelectedCarrier && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: '12px' }}>
                        Please select a carrier to begin visual training, or add a new carrier if needed.
                    </Typography>
                </Alert>
            )}
        </Paper>
    );

    if (!uploadedFile) {
        return (
            <Box>
                {renderCarrierSelection()}

                {localSelectedCarrier ? (
                    <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                        <Box
                            {...getRootProps()}
                            sx={{
                                border: '2px dashed #d1d5db',
                                borderRadius: '8px',
                                p: 4,
                                cursor: 'pointer',
                                backgroundColor: isDragActive ? '#f3f4f6' : 'transparent',
                                '&:hover': { backgroundColor: '#f9fafb' }
                            }}
                        >
                            <input {...getInputProps()} />
                            <Typography sx={{ fontSize: '14px', color: '#374151' }}>
                                {isDragActive ? 'Drop the PDF here...' : 'Click or drag a PDF invoice here'}
                            </Typography>
                        </Box>
                    </Paper>
                ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                        <CarrierIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Select a carrier above to begin training
                        </Typography>
                    </Paper>
                )}

                {/* Add Carrier Dialog */}
                <Dialog open={carrierDialogOpen} onClose={() => setCarrierDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Add New Carrier</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Carrier Name"
                            fullWidth
                            variant="outlined"
                            value={newCarrierName}
                            onChange={(e) => setNewCarrierName(e.target.value)}
                            size="small"
                            sx={{ fontSize: '12px' }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddCarrier();
                                }
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCarrierDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddCarrier} variant="contained" size="small" sx={{ fontSize: '12px' }}>
                            Add Carrier
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        );
    }

    return (
        <Box>
            {renderCarrierSelection()}

            <Grid container spacing={3}>
                {/* PDF Viewer */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2, border: '1px solid #e5e7eb' }}>
                        {/* Toolbar */}
                        <Toolbar sx={{ minHeight: '48px !important', px: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '12px', flexGrow: 1 }}>
                                {uploadedFile.name} - Page {currentPage} of {numPages}
                            </Typography>

                            <IconButton size="small" onClick={() => setPdfScale(Math.max(0.5, pdfScale - 0.1))}>
                                <ZoomOutIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ fontSize: '12px', mx: 1 }}>
                                {Math.round(pdfScale * 100)}%
                            </Typography>
                            <IconButton size="small" onClick={() => setPdfScale(Math.min(2.0, pdfScale + 0.1))}>
                                <ZoomInIcon fontSize="small" />
                            </IconButton>

                            {numPages > 1 && (
                                <>
                                    <Button
                                        size="small"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        sx={{ ml: 2, fontSize: '11px' }}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        size="small"
                                        disabled={currentPage >= numPages}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Next
                                    </Button>
                                </>
                            )}
                        </Toolbar>

                        {/* PDF Display */}
                        <Box
                            ref={pdfContainerRef}
                            sx={{
                                position: 'relative',
                                overflow: 'auto',
                                maxHeight: '600px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                cursor: isAnnotating ? 'crosshair' : 'default'
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                        >
                            <Document
                                file={pdfUrl}
                                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                onLoadError={(error) => {
                                    console.error('PDF load error:', error);
                                    enqueueSnackbar('Failed to load PDF', { variant: 'error' });
                                }}
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={pdfScale}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                />
                            </Document>

                            {/* Annotation Overlays */}
                            {renderAnnotations()}
                        </Box>
                    </Paper>
                </Grid>

                {/* Training Steps Panel */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                            Annotation Steps
                        </Typography>

                        <Stepper orientation="vertical" activeStep={activeStep}>
                            {ANNOTATION_STEPS.map((step, index) => {
                                const StepIcon = step.icon;
                                const status = getStepStatus(step.id);
                                const annotations_for_step = annotations[step.id];

                                return (
                                    <Step key={step.id} completed={status === 'completed'}>
                                        <StepLabel
                                            icon={<StepIcon sx={{ color: step.color, fontSize: 20 }} />}
                                            onClick={() => goToStep(step.id)}
                                        >
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                {step.label}
                                                {status === 'completed' && (
                                                    <Chip
                                                        label={Array.isArray(annotations_for_step)
                                                            ? `${annotations_for_step.length} selected`
                                                            : 'Selected'}
                                                        size="small"
                                                        sx={{ ml: 1, height: '20px', fontSize: '10px' }}
                                                        color="success"
                                                    />
                                                )}
                                            </Typography>
                                        </StepLabel>
                                        <StepContent>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                                {step.description}
                                            </Typography>

                                            {/* Examples */}
                                            <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 1 }}>
                                                Examples:
                                            </Typography>
                                            <List dense>
                                                {step.examples.map((example, i) => (
                                                    <ListItem key={i} sx={{ py: 0, px: 1 }}>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            • {example}
                                                        </Typography>
                                                    </ListItem>
                                                ))}
                                            </List>

                                            {/* Action Buttons */}
                                            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                                {(step.id === 'charges' || step.id === 'invoice_number') && (
                                                    <Stack direction="row" spacing={1} sx={{ mr: 1, flexWrap: 'wrap' }}>
                                                        {step.id === 'charges' ? (
                                                            <>
                                                                <Button size="small" variant={currentAnnotationSubType === 'name' ? 'contained' : 'outlined'} onClick={() => startAnnotation('charges', 'name')} sx={{ fontSize: '11px' }}>Fee Name</Button>
                                                                <Button size="small" variant={currentAnnotationSubType === 'qty' ? 'contained' : 'outlined'} onClick={() => startAnnotation('charges', 'qty')} sx={{ fontSize: '11px' }}>Qty</Button>
                                                                <Button size="small" variant={currentAnnotationSubType === 'rate' ? 'contained' : 'outlined'} onClick={() => startAnnotation('charges', 'rate')} sx={{ fontSize: '11px' }}>Rate</Button>
                                                                <Button size="small" variant={currentAnnotationSubType === 'amount' ? 'contained' : 'outlined'} onClick={() => startAnnotation('charges', 'amount')} sx={{ fontSize: '11px' }}>Amount</Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button size="small" variant={currentAnnotationSubType === 'number' ? 'contained' : 'outlined'} onClick={() => startAnnotation('invoice_number', 'number')} sx={{ fontSize: '11px' }}>Number</Button>
                                                                <Button size="small" variant={currentAnnotationSubType === 'date' ? 'contained' : 'outlined'} onClick={() => startAnnotation('invoice_number', 'date')} sx={{ fontSize: '11px' }}>Date</Button>
                                                                <Button size="small" variant={currentAnnotationSubType === 'terms' ? 'contained' : 'outlined'} onClick={() => startAnnotation('invoice_number', 'terms')} sx={{ fontSize: '11px' }}>Terms</Button>
                                                            </>
                                                        )}
                                                    </Stack>
                                                )}
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<SelectIcon />}
                                                    onClick={() => startAnnotation(step.id)}
                                                    disabled={isAnnotating}
                                                    sx={{
                                                        fontSize: '11px',
                                                        backgroundColor: step.color,
                                                        '&:hover': { backgroundColor: step.color + 'dd' }
                                                    }}
                                                >
                                                    {step.allowMultiple ? 'Add Selection' : 'Select Area'}
                                                </Button>

                                                {status === 'completed' && (
                                                    <>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            startIcon={<DeleteIcon />}
                                                            onClick={() => removeAnnotation(step.id)}
                                                            sx={{ fontSize: '11px' }}
                                                        >
                                                            Reset
                                                        </Button>
                                                        {!step.allowMultiple && (
                                                            <Button
                                                                variant="text"
                                                                size="small"
                                                                onClick={() => {
                                                                    const idx = ANNOTATION_STEPS.findIndex(s => s.id === step.id);
                                                                    const isLast = idx === ANNOTATION_STEPS.length - 1;
                                                                    if (isLast) {
                                                                        enqueueSnackbar('All steps completed. Click "Train & Extract Data" to continue.', { variant: 'success' });
                                                                        if (trainButtonRef.current) {
                                                                            try {
                                                                                trainButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                trainButtonRef.current.focus();
                                                                            } catch (_) { }
                                                                        }
                                                                    } else {
                                                                        setActiveStep(Math.min(idx + 1, ANNOTATION_STEPS.length - 1));
                                                                    }
                                                                }}
                                                                sx={{ fontSize: '11px' }}
                                                            >
                                                                Confirm
                                                            </Button>
                                                        )}
                                                    </>
                                                )}

                                                {step.allowMultiple && Array.isArray(annotations_for_step) && annotations_for_step.length > 0 && (
                                                    <Button
                                                        variant="text"
                                                        size="small"
                                                        onClick={() => {
                                                            const idx = ANNOTATION_STEPS.findIndex(s => s.id === step.id);
                                                            setActiveStep(Math.min(idx + 1, ANNOTATION_STEPS.length - 1));
                                                        }}
                                                        sx={{ fontSize: '11px' }}
                                                    >
                                                        Done Selecting
                                                    </Button>
                                                )}
                                            </Box>

                                            {/* Show current annotations for this step */}
                                            {annotations_for_step && (
                                                <Box sx={{ mt: 2 }}>
                                                    <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 1 }}>
                                                        Current Selections:
                                                    </Typography>
                                                    {Array.isArray(annotations_for_step) ? (
                                                        annotations_for_step.map((ann, i) => (
                                                            <Chip
                                                                key={i}
                                                                label={`Selection ${i + 1}`}
                                                                size="small"
                                                                onDelete={() => removeAnnotation(step.id, i)}
                                                                sx={{ mr: 0.5, mb: 0.5, fontSize: '10px' }}
                                                            />
                                                        ))
                                                    ) : (
                                                        <Chip
                                                            label="Selected"
                                                            size="small"
                                                            color="success"
                                                            sx={{ fontSize: '10px' }}
                                                        />
                                                    )}
                                                    <Box sx={{ mt: 1 }}>
                                                        <Button
                                                            variant="text"
                                                            size="small"
                                                            onClick={() => goToStep(step.id)}
                                                            sx={{ fontSize: '11px' }}
                                                        >
                                                            Edit This Step
                                                        </Button>
                                                    </Box>
                                                </Box>
                                            )}
                                        </StepContent>
                                    </Step>
                                );
                            })}
                        </Stepper>

                        {/* Training Actions */}
                        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e5e7eb' }}>
                            <Button
                                variant="contained"
                                fullWidth
                                startIcon={isTraining ? null : <TrainIcon />}
                                onClick={handleTrainModel}
                                disabled={isTraining || Object.keys(annotations).length < 2}
                                sx={{ fontSize: '12px' }}
                                ref={trainButtonRef}
                            >
                                {isTraining ? 'Training AI Model...' : 'Train & Extract Data'}
                            </Button>

                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 1, textAlign: 'center' }}>
                                {Object.keys(annotations).length} of {ANNOTATION_STEPS.length} steps completed
                            </Typography>
                        </Box>

                        {/* Training Results */}
                        {trainingResults && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                    AI Training Complete!
                                </Typography>
                                <Typography sx={{ fontSize: '11px' }}>
                                    Model confidence: {Math.round((trainingResults.confidence || 0.8) * 100)}%
                                    <br />
                                    Extracted {trainingResults.extractedFields || 0} fields
                                </Typography>
                            </Alert>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Add Carrier Dialog */}
            <Dialog open={carrierDialogOpen} onClose={() => setCarrierDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Add New Carrier</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Carrier Name"
                        fullWidth
                        variant="outlined"
                        value={newCarrierName}
                        onChange={(e) => setNewCarrierName(e.target.value)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                        InputProps={{ sx: { fontSize: '12px' } }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleAddCarrier();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCarrierDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button onClick={handleAddCarrier} variant="contained" size="small" sx={{ fontSize: '12px' }}>
                        Add Carrier
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
