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
    Stack,
    CircularProgress
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
    LocationOn as LocationIcon,
    Inventory2 as PackageIcon,
    ViewList as GroupIcon,
    Visibility as PreviewIcon,
    Save as SaveIcon,
    PlayArrow as TrainIcon,
    Add as AddIcon,
    Info as InfoIcon,
    Check as CheckIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import { functions } from '../../../firebase/firebase';
import { httpsCallable } from 'firebase/functions';
import EnterprisePerformanceDashboard from './EnterprisePerformanceDashboard';

// Configure PDF.js to use a locally hosted worker that matches react-pdf's bundled pdfjs-dist version
// This avoids CORS issues and version mismatches
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Enhanced annotation steps with validation rules and accuracy metrics
const ANNOTATION_STEPS = [
    {
        id: 'carrier',
        label: 'Carrier Information',
        description: 'Draw a box around the carrier logo or company name',
        icon: CarrierIcon,
        color: '#2563eb',
        examples: ['Company logo in header', 'Carrier name at top', 'Letterhead company info'],
        required: true,
        minConfidence: 0.8,
        validationRules: {
            minWidth: 50,
            minHeight: 20,
            maxAnnotations: 3
        },
        hints: ['Usually located in the top section', 'Look for logos or bold company names', 'Avoid selecting addresses']
    },
    {
        id: 'invoice_number',
        label: 'Invoice Number',
        description: 'Highlight the invoice number or reference ID',
        icon: InvoiceIcon,
        color: '#dc2626',
        examples: ['Invoice #12345', 'Ref: ABC-123', 'Bill Number: 67890'],
        allowMultiple: true,
        required: true,
        minConfidence: 0.9,
        validationRules: {
            minWidth: 30,
            minHeight: 15,
            maxAnnotations: 8,
            expectedPatterns: [/INV-?\d+/i, /INVOICE\s*#?\s*\d+/i, /REF:?\s*[A-Z0-9-]+/i]
        },
        hints: ['Look for "Invoice", "INV", "Ref" keywords', 'Usually alphanumeric with dashes', 'May appear multiple times']
    },
    {
        id: 'shipment_ids',
        label: 'Shipment IDs',
        description: 'Select all shipment/tracking numbers (can select multiple)',
        icon: ShipmentIcon,
        color: '#059669',
        examples: ['Tracking: 1Z123456', 'PRO: 789456123', 'Shipment ID: SHP-001'],
        allowMultiple: true,
        required: false,
        minConfidence: 0.85,
        validationRules: {
            minWidth: 40,
            minHeight: 15,
            maxAnnotations: 20,
            expectedPatterns: [/1Z[A-Z0-9]{16}/i, /PRO:?\s*\d+/i, /[A-Z]{2,4}-\d+/i]
        },
        hints: ['Look for tracking numbers', 'PRO numbers', 'Shipment references', 'May be in a table format']
    },
    {
        id: 'charges',
        label: 'Line Item Charges',
        description: 'Highlight the charges table or line items section',
        icon: ChargesIcon,
        color: '#7c3aed',
        examples: ['Freight charges table', 'Service fees list', 'Itemized costs'],
        allowMultiple: true,
        required: true,
        minConfidence: 0.75,
        validationRules: {
            minWidth: 100,
            minHeight: 30,
            maxAnnotations: 15
        },
        hints: ['Select entire table sections', 'Include headers and amounts', 'Look for currency symbols']
    },
    {
        id: 'shipment_references',
        label: 'Shipment References',
        description: 'Select reference numbers, PO numbers, order numbers, and booking references',
        icon: ShipmentIcon,
        color: '#059669',
        examples: ['PO: 12345', 'Order: ORD-789', 'Booking: BK-ABC123', 'Ref: REF-456'],
        allowMultiple: true,
        required: false,
        minConfidence: 0.80,
        validationRules: {
            minWidth: 30,
            minHeight: 15,
            maxAnnotations: 15,
            expectedPatterns: [/PO:?\s*[A-Z0-9-]+/i, /ORDER:?\s*[A-Z0-9-]+/i, /REF:?\s*[A-Z0-9-]+/i, /BOOKING:?\s*[A-Z0-9-]+/i]
        },
        hints: ['Look for PO numbers', 'Order references', 'Booking confirmations', 'Customer reference numbers']
    },
    {
        id: 'shipper',
        label: 'Shipper (Ship From)',
        description: 'Select the shipper/sender company information and address',
        icon: LocationIcon,
        color: '#2563eb',
        examples: ['ABC Company\n123 Main St\nCity, State 12345', 'Shipper: XYZ Corp', 'From: Company Name'],
        allowMultiple: true,
        required: false,
        minConfidence: 0.75,
        validationRules: {
            minWidth: 80,
            minHeight: 40,
            maxAnnotations: 5
        },
        hints: ['Usually labeled "Ship From" or "Shipper"', 'Includes company name and address', 'May have contact info']
    },
    {
        id: 'consignee',
        label: 'Consignee (Ship To)',
        description: 'Select the consignee/receiver company information and address',
        icon: LocationIcon,
        color: '#7c3aed',
        examples: ['DEF Company\n456 Oak Ave\nCity, State 67890', 'Consignee: ABC Corp', 'To: Company Name'],
        allowMultiple: true,
        required: false,
        minConfidence: 0.75,
        validationRules: {
            minWidth: 80,
            minHeight: 40,
            maxAnnotations: 5
        },
        hints: ['Usually labeled "Ship To" or "Consignee"', 'Includes company name and address', 'May have contact info']
    },
    {
        id: 'package_details',
        label: 'Package Weight & Dimensions',
        description: 'Select package weights, dimensions, quantities, and descriptions',
        icon: PackageIcon,
        color: '#16a34a',
        examples: ['2 pallets, 400 lbs each', '48"x40"x60", 800 lbs', 'Qty: 5, Weight: 150 lbs'],
        allowMultiple: true,
        required: false,
        minConfidence: 0.70,
        validationRules: {
            minWidth: 60,
            minHeight: 20,
            maxAnnotations: 20,
            expectedPatterns: [/\d+\s*(lbs?|kg|pounds?|kilos?)/i, /\d+["']?\s*x\s*\d+["']?\s*x\s*\d+["']?/i, /qty:?\s*\d+/i]
        },
        hints: ['Look for weight in lbs/kg', 'Dimensions like 48x40x60', 'Package quantities', 'Package descriptions']
    },
    {
        id: 'shipment_grouping',
        label: 'Shipment Grouping',
        description: 'Select entire rows or sections that represent individual shipments (for multi-shipment invoices)',
        icon: GroupIcon,
        color: '#dc2626',
        examples: ['Entire table row for one shipment', 'Section containing all details for one shipment', 'Grouped shipment data'],
        allowMultiple: true,
        required: false,
        minConfidence: 0.65,
        validationRules: {
            minWidth: 200,
            minHeight: 30,
            maxAnnotations: 10
        },
        hints: ['Select entire rows in shipment tables', 'Group related shipment information', 'Helps AI understand shipment boundaries', 'Useful for invoices with multiple shipments'],
        specialMode: 'grouping' // Special mode for larger area selection
    },
    {
        id: 'total',
        label: 'Total Amount',
        description: 'Select the final total amount to be charged',
        icon: TotalIcon,
        color: '#ea580c',
        examples: ['Total: $1,234.56', 'Amount Due: $567.89', 'Grand Total: $999.00'],
        required: true,
        minConfidence: 0.95,
        validationRules: {
            minWidth: 40,
            minHeight: 15,
            maxAnnotations: 3,
            expectedPatterns: [/\$[\d,]+\.?\d*/i, /TOTAL:?\s*\$?[\d,]+\.?\d*/i]
        },
        hints: ['Usually the largest amount', 'Look for "Total", "Amount Due"', 'Often highlighted or bold']
    }
];

export default function VisualAnnotationTrainer({ selectedCarrier, onTrainingComplete, onCarrierChange, onAddCarrierSuccess }) {
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

    // Auto-save state
    const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // 'saving', 'saved', 'error'
    const [lastSaved, setLastSaved] = useState(null);
    const autoSaveTimeoutRef = useRef(null);

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState(null);
    const [currentBox, setCurrentBox] = useState(null);
    const [isMoving, setIsMoving] = useState(false);
    const [movingAnnotation, setMovingAnnotation] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });
    const movingAnnotationRef = useRef(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const canvasRef = useRef(null);
    const pdfContainerRef = useRef(null);

    // Enterprise QA & Enhancement state
    const [annotationHistory, setAnnotationHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [validationErrors, setValidationErrors] = useState({});
    const [annotationMetrics, setAnnotationMetrics] = useState({});
    const [performanceStats, setPerformanceStats] = useState({
        renderTime: 0,
        annotationTime: 0,
        totalAnnotations: 0,
        accuracy: 0
    });
    const [errorRecovery, setErrorRecovery] = useState({
        attempts: 0,
        lastError: null,
        autoRetry: true
    });

    // Load carriers on component mount
    useEffect(() => {
        loadCarriers();
    }, []);

    // Sync local selected carrier with prop
    useEffect(() => {
        setLocalSelectedCarrier(selectedCarrier);
    }, [selectedCarrier]);

    // Auto-save utilities (moved here to fix hoisting issue)
    const AUTO_SAVE_KEY = 'solushipx_visual_annotations';
    const AUTO_SAVE_DELAY = 2000; // 2 seconds

    const saveAnnotationsToLocal = useCallback((annotationsData, carrierData, fileData) => {
        try {
            const saveData = {
                annotations: annotationsData,
                carrier: carrierData,
                fileName: fileData?.name,
                activeStep,
                savedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            };
            localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(saveData));
            setAutoSaveStatus('saved');
            setLastSaved(new Date());
        } catch (error) {
            console.warn('Failed to auto-save annotations:', error);
            setAutoSaveStatus('error');
        }
    }, [activeStep]);

    const triggerAutoSave = useCallback(() => {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        setAutoSaveStatus('saving');

        autoSaveTimeoutRef.current = setTimeout(() => {
            if (localSelectedCarrier && uploadedFile && Object.keys(annotations).length > 0) {
                saveAnnotationsToLocal(annotations, localSelectedCarrier, uploadedFile);
            }
        }, AUTO_SAVE_DELAY);
    }, [annotations, localSelectedCarrier, uploadedFile, saveAnnotationsToLocal]);

    // Auto-save on annotations change
    useEffect(() => {
        if (Object.keys(annotations).length > 0) {
            triggerAutoSave();
        }
    }, [annotations, triggerAutoSave]);

    // Cleanup auto-save timeout and global listeners on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
            // Cleanup any remaining global event listeners
            document.removeEventListener('mousemove', () => { });
            document.removeEventListener('mouseup', () => { });
        };
    }, []);

    // Get completion status for each step (moved here to fix hoisting issue)
    const getStepStatus = useCallback((stepId) => {
        const annotation = annotations[stepId];
        if (!annotation) return 'pending';
        if (Array.isArray(annotation)) {
            return annotation.length > 0 ? 'completed' : 'pending';
        }
        return 'completed';
    }, [annotations]);

    // Enterprise validation functions
    const validateAnnotation = useCallback((stepId, annotation) => {
        const step = ANNOTATION_STEPS.find(s => s.id === stepId);
        if (!step) return { valid: false, errors: ['Invalid step'] };

        const errors = [];
        const { validationRules } = step;

        if (validationRules) {
            // Size validation
            if (annotation.width < validationRules.minWidth) {
                errors.push(`Annotation too narrow (min: ${validationRules.minWidth}px)`);
            }
            if (annotation.height < validationRules.minHeight) {
                errors.push(`Annotation too short (min: ${validationRules.minHeight}px)`);
            }

            // Pattern validation for text-based fields
            if (validationRules.expectedPatterns && annotation.extractedText) {
                const matchesPattern = validationRules.expectedPatterns.some(pattern =>
                    pattern.test(annotation.extractedText)
                );
                if (!matchesPattern) {
                    errors.push('Content doesn\'t match expected format');
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }, []);

    // Undo/Redo functionality
    const saveToHistory = useCallback((newAnnotations) => {
        setAnnotationHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(JSON.parse(JSON.stringify(newAnnotations)));
            return newHistory.slice(-50); // Keep last 50 states
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setAnnotations(annotationHistory[historyIndex - 1] || {});
            enqueueSnackbar('Undid last annotation', { variant: 'info' });
        }
    }, [historyIndex, annotationHistory, enqueueSnackbar]);

    const redo = useCallback(() => {
        if (historyIndex < annotationHistory.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setAnnotations(annotationHistory[historyIndex + 1] || {});
            enqueueSnackbar('Redid annotation', { variant: 'info' });
        }
    }, [historyIndex, annotationHistory, enqueueSnackbar]);

    // Performance monitoring
    const trackPerformance = useCallback((metric, value) => {
        setPerformanceStats(prev => ({
            ...prev,
            [metric]: value,
            totalAnnotations: prev.totalAnnotations + (metric === 'annotationTime' ? 1 : 0)
        }));
    }, []);

    // Error recovery
    const handleError = useCallback((error, context = '') => {
        console.error(`Visual Training Error (${context}):`, error);
        setErrorRecovery(prev => ({
            ...prev,
            attempts: prev.attempts + 1,
            lastError: error.message || error
        }));

        if (errorRecovery.autoRetry && errorRecovery.attempts < 3) {
            enqueueSnackbar(`Retrying... (${errorRecovery.attempts + 1}/3)`, { variant: 'warning' });
            // Auto-retry logic would go here
        } else {
            enqueueSnackbar('Operation failed. Please try again manually.', { variant: 'error' });
        }
    }, [errorRecovery, enqueueSnackbar]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Prevent shortcuts if user is typing in an input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Don't interfere with browser shortcuts
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            switch (event.key) {
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                    event.preventDefault();
                    const stepIndex = parseInt(event.key) - 1;
                    if (stepIndex < ANNOTATION_STEPS.length) {
                        setActiveStep(stepIndex);
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    if (isMoving) {
                        // Cancel moving annotation
                        setIsMoving(false);
                        setMovingAnnotation(null);
                        setDragOffset({ x: 0, y: 0 });
                        movingAnnotationRef.current = null;
                        dragOffsetRef.current = { x: 0, y: 0 };
                        // Remove global listeners
                        document.removeEventListener('mousemove', () => { });
                        document.removeEventListener('mouseup', () => { });
                        enqueueSnackbar('Move cancelled', { variant: 'info' });
                    } else {
                        setIsAnnotating(false);
                        setCurrentAnnotationType(null);
                        setCurrentAnnotationSubType(null);
                        enqueueSnackbar('Annotation cancelled', { variant: 'info' });
                    }
                    break;
                case 'Enter':
                    event.preventDefault();
                    if (getStepStatus(ANNOTATION_STEPS[activeStep].id) === 'completed' && activeStep < ANNOTATION_STEPS.length - 1) {
                        setActiveStep(activeStep + 1);
                    }
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    if (activeStep > 0) {
                        setActiveStep(activeStep - 1);
                    }
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    if (activeStep < ANNOTATION_STEPS.length - 1) {
                        setActiveStep(activeStep + 1);
                    }
                    break;
                case 'Delete':
                case 'Backspace':
                    event.preventDefault();
                    if (activeStep < ANNOTATION_STEPS.length) {
                        const stepId = ANNOTATION_STEPS[activeStep].id;
                        const stepAnnotations = annotations[stepId];
                        if (stepAnnotations) {
                            if (Array.isArray(stepAnnotations) && stepAnnotations.length > 0) {
                                // Remove last annotation
                                const newAnnotations = { ...annotations };
                                newAnnotations[stepId] = stepAnnotations.slice(0, -1);
                                if (newAnnotations[stepId].length === 0) {
                                    delete newAnnotations[stepId];
                                }
                                setAnnotations(newAnnotations);
                            } else if (!Array.isArray(stepAnnotations)) {
                                // Remove single annotation
                                const newAnnotations = { ...annotations };
                                delete newAnnotations[stepId];
                                setAnnotations(newAnnotations);
                            }
                        }
                    }
                    break;
                case 'z':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        if (event.shiftKey) {
                            redo();
                        } else {
                            undo();
                        }
                    }
                    break;
                case 'y':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        redo();
                    }
                    break;
                case 's':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        triggerAutoSave();
                        enqueueSnackbar('Annotations saved manually', { variant: 'success' });
                    }
                    break;
                case 'v':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        // Validate current annotations
                        const currentStep = ANNOTATION_STEPS[activeStep];
                        if (currentStep && annotations[currentStep.id]) {
                            const stepAnnotations = Array.isArray(annotations[currentStep.id])
                                ? annotations[currentStep.id]
                                : [annotations[currentStep.id]];

                            let allValid = true;
                            stepAnnotations.forEach(ann => {
                                const validation = validateAnnotation(currentStep.id, ann);
                                if (!validation.valid) {
                                    allValid = false;
                                    enqueueSnackbar(`Validation error: ${validation.errors.join(', ')}`, { variant: 'error' });
                                }
                            });

                            if (allValid) {
                                enqueueSnackbar('All annotations valid!', { variant: 'success' });
                            }
                        }
                    }
                    break;
                case '?':
                    event.preventDefault();
                    enqueueSnackbar('Shortcuts: 1-5 (steps), Enter (next), ←→ (navigate), Esc (cancel), Del (remove), Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+S (save), Ctrl+V (validate)', {
                        variant: 'info',
                        autoHideDuration: 8000
                    });
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeStep, annotations, getStepStatus, setActiveStep, setIsAnnotating, setCurrentAnnotationType, setCurrentAnnotationSubType, setAnnotations, enqueueSnackbar]);



    // Load available carriers (including untrained ones for training purposes)
    const loadCarriers = async () => {
        try {
            setLoadingCarriers(true);
            const getCarriers = httpsCallable(functions, 'getTrainingCarriers');
            const result = await getCarriers({
                status: 'active' // Get all active training carriers
            });

            if (result.data?.success) {
                console.log('Loaded carriers for Visual Training:', result.data.data?.carriers);
                setAvailableCarriers(result.data.data?.carriers || []);

                // Show message if no carriers available
                if ((result.data.data?.carriers || []).length === 0) {
                    enqueueSnackbar('No training carriers available. Use "Add Carrier" to create carriers for training.', {
                        variant: 'info',
                        autoHideDuration: 4000
                    });
                } else {
                    console.log(`Found ${result.data.data.carriers.length} carriers for Visual Training`);
                }
            } else {
                console.error('Failed to load carriers:', result.data?.error);
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
            const addCarrier = httpsCallable(functions, 'createTrainingCarrier');
            const result = await addCarrier({
                name: newCarrierName.trim(),
                category: 'invoice',
                description: `Invoice training carrier for ${newCarrierName.trim()}`
            });

            if (result.data?.success) {
                console.log('Carrier created successfully:', result.data);
                await loadCarriers(); // Refresh list
                setNewCarrierName('');
                setCarrierDialogOpen(false);
                enqueueSnackbar(`Carrier "${newCarrierName}" added successfully`, { variant: 'success' });

                // Notify parent component
                if (onAddCarrierSuccess) {
                    onAddCarrierSuccess();
                }
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
    const handleAnnotationMouseDown = useCallback((e, stepId, index, annotation) => {
        e.stopPropagation();
        e.preventDefault();

        const containerRect = pdfContainerRef.current.getBoundingClientRect();
        const canvasEl = pdfContainerRef.current.querySelector('canvas');
        const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : containerRect;
        const baseLeft = canvasRect.left ?? containerRect.left;
        const baseTop = canvasRect.top ?? containerRect.top;

        const initialDragOffset = {
            x: e.clientX - (baseLeft + (annotation.x * pdfScale) - scrollPosition.left),
            y: e.clientY - (baseTop + (annotation.y * pdfScale) - scrollPosition.top)
        };

        const initialMovingAnnotation = { stepId, index, annotation };

        // Update refs with current values
        movingAnnotationRef.current = initialMovingAnnotation;
        dragOffsetRef.current = initialDragOffset;

        setIsMoving(true);
        setMovingAnnotation(initialMovingAnnotation);
        setDragOffset(initialDragOffset);

        // Add global event listeners for mouse move and up
        const handleGlobalMouseMove = (globalE) => {
            if (!pdfContainerRef.current || !movingAnnotationRef.current) return;

            const globalContainerRect = pdfContainerRef.current.getBoundingClientRect();
            const globalCanvasEl = pdfContainerRef.current.querySelector('canvas');
            const globalCanvasRect = globalCanvasEl ? globalCanvasEl.getBoundingClientRect() : globalContainerRect;
            const globalBaseLeft = globalCanvasRect.left ?? globalContainerRect.left;
            const globalBaseTop = globalCanvasRect.top ?? globalContainerRect.top;

            const currentScrollLeft = pdfContainerRef.current.scrollLeft || 0;
            const currentScrollTop = pdfContainerRef.current.scrollTop || 0;

            const newX = ((globalE.clientX - globalBaseLeft - dragOffsetRef.current.x) + currentScrollLeft) / pdfScale;
            const newY = ((globalE.clientY - globalBaseTop - dragOffsetRef.current.y) + currentScrollTop) / pdfScale;

            const updatedAnnotation = {
                ...movingAnnotationRef.current.annotation,
                x: newX,
                y: newY
            };

            const updatedMovingAnnotation = {
                ...movingAnnotationRef.current,
                annotation: updatedAnnotation
            };

            // Update refs
            movingAnnotationRef.current = updatedMovingAnnotation;

            // Update state
            setMovingAnnotation(updatedMovingAnnotation);
        };

        const handleGlobalMouseUp = () => {
            // Remove global event listeners
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);

            // Save the moved annotation using ref value
            if (movingAnnotationRef.current) {
                try {
                    const { stepId: moveStepId, index: moveIndex, annotation: finalAnnotation } = movingAnnotationRef.current;

                    setAnnotations(prev => {
                        const updated = { ...prev };

                        if (Array.isArray(updated[moveStepId])) {
                            updated[moveStepId][moveIndex] = finalAnnotation;
                        } else {
                            updated[moveStepId] = finalAnnotation;
                        }

                        return updated;
                    });

                    enqueueSnackbar('Annotation moved successfully', { variant: 'success' });
                    triggerAutoSave();
                } catch (error) {
                    console.error('Error saving moved annotation:', error);
                    enqueueSnackbar('Error moving annotation', { variant: 'error' });
                }
            }

            // Always clean up state
            setIsMoving(false);
            setMovingAnnotation(null);
            setDragOffset({ x: 0, y: 0 });
            movingAnnotationRef.current = null;
            dragOffsetRef.current = { x: 0, y: 0 };
        };

        // Add global event listeners
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
    }, [pdfScale, scrollPosition, enqueueSnackbar, triggerAutoSave]);

    const handleMouseDown = useCallback((e) => {
        if (!isAnnotating || !pdfContainerRef.current || isMoving) return;

        const containerRect = pdfContainerRef.current.getBoundingClientRect();
        const canvasEl = pdfContainerRef.current.querySelector('canvas');
        const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : containerRect;
        const baseLeft = canvasRect.left ?? containerRect.left;
        const baseTop = canvasRect.top ?? containerRect.top;

        // Account for scroll position
        const scrollLeft = pdfContainerRef.current.scrollLeft || 0;
        const scrollTop = pdfContainerRef.current.scrollTop || 0;

        const x = ((e.clientX - baseLeft) + scrollLeft) / pdfScale;
        const y = ((e.clientY - baseTop) + scrollTop) / pdfScale;

        setIsDrawing(true);
        setStartPoint({ x, y });
        setCurrentBox({ x, y, width: 0, height: 0 });
    }, [isAnnotating, pdfScale, isMoving]);

    const handleMouseMove = useCallback((e) => {
        if (!pdfContainerRef.current) return;

        // Only handle drawing new annotations here (moving is handled by global listeners)
        if (isDrawing && startPoint && !isMoving) {
            const containerRect = pdfContainerRef.current.getBoundingClientRect();
            const canvasEl = pdfContainerRef.current.querySelector('canvas');
            const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : containerRect;
            const baseLeft = canvasRect.left ?? containerRect.left;
            const baseTop = canvasRect.top ?? containerRect.top;

            const scrollLeft = pdfContainerRef.current.scrollLeft || 0;
            const scrollTop = pdfContainerRef.current.scrollTop || 0;

            const x = ((e.clientX - baseLeft) + scrollLeft) / pdfScale;
            const y = ((e.clientY - baseTop) + scrollTop) / pdfScale;

            const width = x - startPoint.x;
            const height = y - startPoint.y;

            setCurrentBox({
                x: width < 0 ? x : startPoint.x,
                y: width < 0 ? y : startPoint.y,
                width: Math.abs(width),
                height: Math.abs(height)
            });
        }
    }, [isDrawing, isMoving, startPoint, pdfScale]);

    const handleMouseUp = useCallback(() => {
        // Moving is now handled by global listeners, only handle drawing completion here
        if (!isDrawing || !currentBox || !currentAnnotationType || isMoving) return;

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

            // Validate annotation before saving
            const validation = validateAnnotation(currentAnnotationType, newAnnotation);
            if (!validation.valid) {
                enqueueSnackbar(`Validation warning: ${validation.errors.join(', ')}`, { variant: 'warning' });
                // Allow saving with warnings, but track for metrics
                setValidationErrors(prev => ({
                    ...prev,
                    [currentAnnotationType]: validation.errors
                }));
            } else {
                // Clear any previous validation errors
                setValidationErrors(prev => {
                    const cleaned = { ...prev };
                    delete cleaned[currentAnnotationType];
                    return cleaned;
                });
            }

            setAnnotations(prev => {
                const updated = { ...prev };
                if (step.allowMultiple) {
                    // Check max annotations limit
                    const currentCount = Array.isArray(updated[currentAnnotationType])
                        ? updated[currentAnnotationType].length
                        : 0;

                    if (step.validationRules?.maxAnnotations && currentCount >= step.validationRules.maxAnnotations) {
                        enqueueSnackbar(`Maximum ${step.validationRules.maxAnnotations} annotations allowed for ${step.label}`, {
                            variant: 'warning'
                        });
                        return prev; // Don't add if at limit
                    }

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

                // Save to history for undo/redo
                saveToHistory(updated);

                // Track performance metrics
                trackPerformance('annotationTime', Date.now());

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
                carrierName: selectedCarrier.name,
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

        // Use tracked scroll position for better consistency
        const scrollLeft = scrollPosition.left;
        const scrollTop = scrollPosition.top;

        // Render saved annotations
        Object.entries(annotations).forEach(([stepId, annotation]) => {
            const step = ANNOTATION_STEPS.find(s => s.id === stepId);
            if (!step) return;

            const annotationArray = Array.isArray(annotation) ? annotation : [annotation];

            annotationArray.forEach((ann, index) => {
                if (ann.page === currentPage) {
                    // Use moving annotation position if this annotation is being moved
                    const displayAnnotation = (isMoving && movingAnnotation?.stepId === stepId && movingAnnotation?.index === index)
                        ? movingAnnotation.annotation
                        : ann;

                    overlays.push(
                        <Box
                            key={`${stepId}-${index}`}
                            onMouseDown={(e) => handleAnnotationMouseDown(e, stepId, index, ann)}
                            sx={{
                                position: 'absolute',
                                left: offsetX + (displayAnnotation.x * pdfScale) - scrollLeft,
                                top: offsetY + (displayAnnotation.y * pdfScale) - scrollTop,
                                width: displayAnnotation.width * pdfScale,
                                height: displayAnnotation.height * pdfScale,
                                border: step.specialMode === 'grouping' ? `3px dashed ${step.color}` : `2px solid ${step.color}`,
                                backgroundColor: step.specialMode === 'grouping' ? `${step.color}15` : `${step.color}20`,
                                borderRadius: step.specialMode === 'grouping' ? '4px' : '2px',
                                pointerEvents: 'auto',
                                cursor: 'move',
                                opacity: (isMoving && movingAnnotation?.stepId === stepId && movingAnnotation?.index === index) ? 0.7 : 1,
                                '&:hover': {
                                    backgroundColor: step.specialMode === 'grouping' ? `${step.color}25` : `${step.color}30`,
                                    border: step.specialMode === 'grouping' ? `3px dashed ${step.color}` : `3px solid ${step.color}`
                                }
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
                            left: ((canvasRect?.left ?? containerRect.left) - containerRect.left) + (currentBox.x * pdfScale) - scrollLeft,
                            top: ((canvasRect?.top ?? containerRect.top) - containerRect.top) + (currentBox.y * pdfScale) - scrollTop,
                            width: currentBox.width * pdfScale,
                            height: currentBox.height * pdfScale,
                            border: step.specialMode === 'grouping' ? `3px dashed ${step.color}` : `2px dashed ${step.color}`,
                            backgroundColor: step.specialMode === 'grouping' ? `${step.color}10` : `${step.color}15`,
                            borderRadius: step.specialMode === 'grouping' ? '4px' : '2px',
                            pointerEvents: 'none'
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Select Carrier for Training
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                {/* Auto-save status indicator and keyboard shortcuts */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip
                        title={
                            <Box>
                                <Typography sx={{ fontSize: '11px', fontWeight: 600, mb: 1 }}>
                                    ⌨️ Keyboard Shortcuts
                                </Typography>
                                <Typography sx={{ fontSize: '10px', mb: 0.5 }}>• 1-5: Jump to step</Typography>
                                <Typography sx={{ fontSize: '10px', mb: 0.5 }}>• Enter: Next step</Typography>
                                <Typography sx={{ fontSize: '10px', mb: 0.5 }}>• ←→: Navigate steps</Typography>
                                <Typography sx={{ fontSize: '10px', mb: 0.5 }}>• Esc: Cancel annotation</Typography>
                                <Typography sx={{ fontSize: '10px', mb: 0.5 }}>• Del: Remove annotation</Typography>
                                <Typography sx={{ fontSize: '10px' }}>• ?: Show this help</Typography>
                            </Box>
                        }
                        arrow
                    >
                        <Chip
                            size="small"
                            icon={<InfoIcon sx={{ fontSize: 12 }} />}
                            label="Shortcuts"
                            variant="outlined"
                            sx={{ fontSize: '10px', cursor: 'help' }}
                        />
                    </Tooltip>

                    {autoSaveStatus === 'saving' && (
                        <Chip
                            size="small"
                            icon={<CircularProgress size={12} />}
                            label="Saving..."
                            variant="outlined"
                            sx={{ fontSize: '10px' }}
                        />
                    )}
                    {autoSaveStatus === 'saved' && lastSaved && (
                        <Chip
                            size="small"
                            icon={<CheckIcon sx={{ fontSize: 12 }} />}
                            label={`Saved ${lastSaved.toLocaleTimeString()}`}
                            color="success"
                            variant="outlined"
                            sx={{ fontSize: '10px' }}
                        />
                    )}
                    {autoSaveStatus === 'error' && (
                        <Chip
                            size="small"
                            icon={<CloseIcon sx={{ fontSize: 12 }} />}
                            label="Save failed"
                            color="error"
                            variant="outlined"
                            sx={{ fontSize: '10px' }}
                        />
                    )}
                </Box>
            </Box>
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

                            {/* Zoom controls disabled */}

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
                            onScroll={(e) => {
                                const container = e.target;
                                const newScrollPosition = {
                                    left: container.scrollLeft || 0,
                                    top: container.scrollTop || 0
                                };
                                setScrollPosition(newScrollPosition);
                                // Force re-render of annotations on scroll to maintain sync
                                setCurrentBox(prev => prev ? { ...prev } : null);
                            }}
                            sx={{
                                position: 'relative',
                                overflow: 'auto',
                                height: 'calc(100vh - 280px)', // Full page height minus header/toolbar space
                                minHeight: '800px', // Ensure minimum height for full page viewing
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                cursor: isMoving ? 'grabbing' : (isAnnotating ? 'crosshair' : 'default')
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

                {/* Enterprise Performance Dashboard */}
                <Grid item xs={12} md={4}>
                    <EnterprisePerformanceDashboard
                        performanceStats={performanceStats}
                        validationErrors={validationErrors}
                        annotationHistory={annotationHistory}
                        historyIndex={historyIndex}
                        autoSaveStatus={autoSaveStatus}
                        errorRecovery={errorRecovery}
                        onUndo={undo}
                        onRedo={redo}
                        onManualSave={() => {
                            triggerAutoSave();
                            enqueueSnackbar('Annotations saved manually', { variant: 'success' });
                        }}
                        onValidate={() => {
                            // Validate all current annotations
                            let totalErrors = 0;
                            Object.keys(annotations).forEach(stepId => {
                                const stepAnnotations = Array.isArray(annotations[stepId])
                                    ? annotations[stepId]
                                    : [annotations[stepId]];

                                stepAnnotations.forEach(ann => {
                                    const validation = validateAnnotation(stepId, ann);
                                    if (!validation.valid) {
                                        totalErrors += validation.errors.length;
                                    }
                                });
                            });

                            if (totalErrors === 0) {
                                enqueueSnackbar('All annotations are valid!', { variant: 'success' });
                            } else {
                                enqueueSnackbar(`Found ${totalErrors} validation issues`, { variant: 'warning' });
                            }
                        }}
                    />
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
