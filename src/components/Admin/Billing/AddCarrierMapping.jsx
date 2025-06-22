import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Stepper,
    Step,
    StepLabel,
    Button,
    TextField,
    FormControl,
    Select,
    MenuItem,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Grid,
    Chip,
    Breadcrumbs,
    Link,
    Stack,
    Divider,
    List,
    ListItem,
    ListItemText,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import {
    CloudUpload as CloudUploadIcon,
    CheckCircleOutline as CheckCircleIcon,
    ErrorOutline as ErrorOutlineIcon,
    NavigateNext as NavigateNextIcon,
    NavigateBefore as NavigateBeforeIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { collection, doc, getDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, functions } from '../../../firebase';
import Papa from 'papaparse';
import { useSnackbar } from 'notistack';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import AdminBreadcrumb from '../AdminBreadcrumb';

const STEPS = [
    { label: 'Carrier Details', path: 'details' },
    { label: 'Upload Sample', path: 'upload' },
    { label: 'Accept Headers', path: 'headers' },
    { label: 'Prompt Playground', path: 'prompt' },
    { label: 'Review & Save', path: 'review' }
];

const DEFAULT_PROMPT = `You are an EDI mapping expert. Given the following CSV headers and sample data, suggest the best JSON mapping for each header, using nested paths where appropriate (e.g., destination.country for address fields). Output a JSON array of objects: [{ csvHeader, jsonKeyPath, dataType }].`;

const AddCarrierMapping = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { carrierId } = useParams();
    const [activeStep, setActiveStep] = useState(0);
    const [carrierName, setCarrierName] = useState('');
    const [carrierDescription, setCarrierDescription] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvSample, setCsvSample] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});
    const [carriersList, setCarriersList] = useState([]);
    const [carrierPrompt, setCarrierPrompt] = useState(DEFAULT_PROMPT);
    const [promptUsedForGeneration, setPromptUsedForGeneration] = useState(DEFAULT_PROMPT);
    const [testResult, setTestResult] = useState({ fieldMappings: [] });
    const { enqueueSnackbar } = useSnackbar();
    const [headersAccepted, setHeadersAccepted] = useState(false);
    const [isGeneratingMapping, setIsGeneratingMapping] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [editingMapping, setEditingMapping] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        fetchCarriers();
        if (carrierId) {
            loadExistingMapping();
        }
        // Set active step based on current route
        const currentPath = location.pathname.split('/').pop();
        const stepIndex = STEPS.findIndex(step => step.path === currentPath);
        if (stepIndex !== -1) {
            setActiveStep(stepIndex);
        }
    }, [location.pathname, carrierId]);

    useEffect(() => {
        console.log('[AddCarrierMapping] isGeneratingMapping state changed:', isGeneratingMapping);
    }, [isGeneratingMapping]);

    const fetchCarriers = async () => {
        try {
            const carriersRef = collection(db, 'ediMappings');
            const snapshot = await getDocs(carriersRef);
            setCarriersList(snapshot.docs.map(doc => doc.data().name?.toLowerCase() || ''));
        } catch (e) {
            setCarriersList([]);
        }
    };

    const loadExistingMapping = useCallback(async () => {
        try {
            setLoading(true);
            const carrierRef = doc(db, 'ediMappings', carrierId);
            const carrierDoc = await getDoc(carrierRef);

            if (!carrierDoc.exists()) {
                throw new Error('Carrier mapping not found');
            }

            const carrierData = carrierDoc.data();
            setCarrierName(carrierData.name);
            setCarrierDescription(carrierData.description || '');
            setCarrierPrompt(carrierData.prompt || DEFAULT_PROMPT);

            // Load the mapping data
            const mappingRef = doc(carrierRef, 'default', 'mapping');
            const mappingDoc = await getDoc(mappingRef);

            if (mappingDoc.exists()) {
                const mappingData = mappingDoc.data();
                setMappings(mappingData.fieldMappings || []);
                setPromptUsedForGeneration(mappingData.prompt || carrierData.prompt);

                // If we have headers, set them
                if (mappingData.headerHash) {
                    setHeadersAccepted(true);
                    // You might want to load the actual CSV file here if available
                }

                // Set the active step to the last completed step
                if (mappingData.fieldMappings?.length > 0) {
                    setActiveStep(4); // Review & Save step
                } else if (headersAccepted) {
                    setActiveStep(3); // Prompt Playground step
                } else if (csvFile) {
                    setActiveStep(2); // Accept Headers step
                } else if (carrierName) {
                    setActiveStep(1); // Upload Sample step
                }
            }

        } catch (error) {
            console.error('Error loading carrier mapping:', error);
            setError('Failed to load carrier mapping. Please try again.');
            enqueueSnackbar('Failed to load carrier mapping', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, enqueueSnackbar]);

    useEffect(() => {
        if (carrierId) {
            loadExistingMapping();
        }
    }, [carrierId, loadExistingMapping]);

    const navigateToStep = (stepIndex) => {
        if (validateStep(activeStep)) {
            setActiveStep(stepIndex);
            navigate(`/admin/billing/edi-mapping/new/${STEPS[stepIndex].path}`);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setIsUploading(true);
            setError(null);
            setSuccess(null);
            setCsvFile(file);
            console.log('Starting Papa.parse for file:', file.name);
            Papa.parse(file, {
                header: true,
                preview: 5,
                complete: async (results) => {
                    console.log('Papa.parse complete. Results:', results);
                    setCsvHeaders(results.meta.fields || []);
                    setCsvSample(results.data || []);

                    if (!results.meta.fields || results.meta.fields.length === 0) {
                        setError('Could not parse headers from CSV. Please check the file format.');
                        enqueueSnackbar('Could not parse CSV headers.', { variant: 'error' });
                        setIsUploading(false);
                        return;
                    }

                    console.log('CSV parsed, headers and sample set. User should proceed to next step.');
                    setHeadersAccepted(false);
                    setIsUploading(false);
                    enqueueSnackbar('File processed. Please review and accept headers.', { variant: 'info' });
                },
                error: (error) => {
                    console.error('Papa.parse error:', error);
                    setError('Failed to parse CSV file: ' + error.message);
                    enqueueSnackbar('Error parsing CSV file.', { variant: 'error' });
                    setIsUploading(false);
                }
            });
        }
    };

    const handleSave = async () => {
        if (!mappings.length && activeStep === STEPS.findIndex(step => step.path === 'review')) { // Only block save from review step if no mappings
            setError('No mapping available to save. Please generate or define mappings first.');
            enqueueSnackbar('No mapping available to save.', { variant: 'warning' });
            return;
        }
        if (!carrierName.trim()) {
            enqueueSnackbar('Carrier Name is required to save.', { variant: 'warning' });
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const finalCarrierDocId = carrierId || carrierName.toLowerCase().replace(/\s+/g, '_');
            const isNewMappingFlow = !carrierId;
            const carrierRef = doc(db, 'ediMappings', finalCarrierDocId);

            const carrierDocPayload = {
                name: carrierName,
                description: carrierDescription,
                prompt: carrierPrompt,
                updatedAt: serverTimestamp(),
                enabled: true, // Default to enabled when creating/saving
            };
            if (isNewMappingFlow) {
                carrierDocPayload.createdAt = serverTimestamp();
            }
            await setDoc(carrierRef, carrierDocPayload, { merge: !isNewMappingFlow });

            const mappingRef = doc(carrierRef, 'default', 'mapping');
            const mappingDocPayload = {
                carrierName: carrierName.toUpperCase(),
                fileType: 'text/csv',
                headerHash: csvHeaders.length > 0 ? generateHeaderHash(csvHeaders) : null,
                csvHeaders: csvHeaders,
                csvSample: csvSample,
                parsingOptions: {
                    csvDelimiter: ',',
                    dateFormat: 'YYYYMMDD',
                },
                fieldMappings: mappings,
                prompt: carrierPrompt,
                promptUsedForLastSuccessfulGeneration: promptUsedForGeneration,
                defaultValues: {
                    carrier: carrierName.toUpperCase(),
                    recordType: 'shipment',
                },
                updatedAt: serverTimestamp(),
            };

            const mappingDocSnap = await getDoc(mappingRef);
            if (!mappingDocSnap.exists() || isNewMappingFlow) {
                mappingDocPayload.createdAt = serverTimestamp();
            }
            await setDoc(mappingRef, mappingDocPayload, { merge: true });

            setSuccess('Carrier mapping saved successfully!');
            enqueueSnackbar('Carrier mapping saved successfully!', { variant: 'success' });

            setTimeout(() => {
                navigate('/admin/billing/edi-mapping');
            }, 1500);

        } catch (error) {
            console.error('Error saving carrier mapping:', error);
            setError('Failed to save carrier mapping. ' + error.message);
            enqueueSnackbar('Error saving carrier mapping: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const generateHeaderHash = (headers) => {
        const headerString = headers.sort().join(',');
        let hash = 0;
        for (let i = 0; i < headerString.length; i++) {
            const char = headerString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    };

    const getApiBaseUrl = () => {
        if (process.env.NODE_ENV === 'development') {
            return 'http://localhost:5001/solushipx/us-central1';
        }
        return 'https://us-central1-solushipx.cloudfunctions.net';
    };

    const validateStep = (step) => {
        const errors = {};
        switch (step) {
            case 0:
                if (!carrierName.trim()) {
                    errors.carrierName = 'Carrier name is required';
                } else if (carriersList.includes(carrierName.toLowerCase())) {
                    errors.carrierName = 'A carrier with this name already exists';
                }
                if (!carrierDescription.trim()) {
                    errors.carrierDescription = 'Description is required';
                }
                break;
            case 1:
                if (!csvFile) {
                    errors.csvFile = 'Please upload a CSV file';
                }
                break;
            case 2:
                if (!headersAccepted) {
                    errors.headers = 'Please accept or reject the headers';
                }
                break;
            case 3:
                if (!carrierPrompt.trim()) {
                    errors.prompt = 'Prompt is required';
                }
                break;
            case 4:
                if (!mappings.length) {
                    errors.mappings = 'No mappings available to save';
                }
                break;
            default:
                break;
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Drag and drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isUploading) {
            setDragActive(true);
        }
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };
    const handleDropFile = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (isUploading) return;

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const fakeEvent = { target: { files: e.dataTransfer.files } };
            handleFileUpload(fakeEvent);
        }
    };

    const handleTestPrompt = async () => {
        console.log('handleTestPrompt called');
        console.log('CSV Headers:', csvHeaders);
        console.log('CSV Sample:', csvSample);
        console.log('Current isGeneratingMapping state before test:', isGeneratingMapping);
        // Temporarily disable the check for isGeneratingMapping for this test if button is clickable but no action
        // if (isGeneratingMapping) {
        //     console.log('Exiting handleTestPrompt because isGeneratingMapping is true');
        //     return;
        // }

        if (!csvHeaders.length || !csvSample.length) {
            setError('Please upload a CSV file first');
            console.log('Exiting handleTestPrompt: No CSV headers or sample.');
            return;
        }
        setLoading(true);
        setIsGeneratingMapping(true); // Set generating true for this specific action
        console.log('Set loading to true, isGeneratingMapping to true');
        try {
            const apiBaseUrl = getApiBaseUrl();
            console.log('API Base URL for Test Prompt:', apiBaseUrl);
            const response = await fetch(`${apiBaseUrl}/generateEdiMapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    carrierName,
                    csvHeadersString: csvHeaders.join(','),
                    sampleDataRows: csvSample.slice(0, 5),
                    prompt: carrierPrompt
                })
            });
            console.log('Test prompt fetch response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Test prompt API error text:', errorText);
                throw new Error(errorText || 'Failed to test prompt');
            }
            const result = await response.json();
            console.log('Test result from API (should be an array):', result);
            setTestResult({ fieldMappings: Array.isArray(result) ? result : [] });
            setMappings(Array.isArray(result) ? result : []);
            enqueueSnackbar('Prompt test successful! Review results.', { variant: 'success' });
        } catch (err) {
            console.error('Test prompt error catch block:', err);
            setError('Failed to test prompt. ' + (err.message || 'Please check your prompt or try again.'));
            enqueueSnackbar('Failed to test prompt: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
            setIsGeneratingMapping(false); // Ensure this is set back to false
            console.log('Test prompt finally block: Set loading to false, isGeneratingMapping to false');
        }
    };

    const handleMappingChange = (index, field, value) => {
        const updatedMappings = [...mappings];
        updatedMappings[index] = {
            ...updatedMappings[index],
            [field]: value
        };
        setMappings(updatedMappings);
    };

    const handleEditMapping = (index) => {
        setEditingMapping(index);
    };

    const handleSaveMapping = (index) => {
        setEditingMapping(null);
    };

    const renderPromptPlayground = () => {
        console.log('[RenderPromptPlayground] Current testResult state:', testResult);
        console.log('[RenderPromptPlayground] testResult.fieldMappings:', testResult?.fieldMappings);
        console.log('[RenderPromptPlayground] testResult?.fieldMappings?.length > 0:', testResult?.fieldMappings?.length > 0);

        return (
            <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{
                        p: 3,
                        height: '100%',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                    }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Prompt Editor
                        </Typography>
                        <TextField
                            fullWidth
                            size="small"
                            multiline
                            rows={12}
                            value={carrierPrompt}
                            onChange={(e) => setCarrierPrompt(e.target.value)}
                            error={!!validationErrors.prompt}
                            helperText={validationErrors.prompt}
                            sx={{
                                mb: 2,
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                        <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            onClick={handleTestPrompt}
                            disabled={isGeneratingMapping || loading}
                            startIcon={(isGeneratingMapping || loading) ? <CircularProgress size={16} color="inherit" /> : <NavigateNextIcon />}
                            sx={{ fontSize: '12px' }}
                        >
                            Test Prompt
                        </Button>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{
                        p: 3,
                        height: '100%',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                    }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Test Results
                        </Typography>
                        {testResult?.fieldMappings?.length > 0 ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                CSV Header
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                JSON Path
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                Data Type
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {testResult.fieldMappings.map((mapping, index) => (
                                            <TableRow key={index}>
                                                <TableCell sx={{ fontSize: '12px' }}>{mapping.csvHeader}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{mapping.jsonKeyPath}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{mapping.dataType}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Test results will appear here after running the prompt
                            </Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        );
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Paper elevation={0} sx={{
                        p: 3,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                    }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Carrier Details
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Carrier Name"
                                    value={carrierName}
                                    onChange={(e) => setCarrierName(e.target.value)}
                                    error={!!validationErrors.carrierName}
                                    helperText={validationErrors.carrierName}
                                    required
                                    sx={{
                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiFormHelperText-root': { fontSize: '11px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Description"
                                    value={carrierDescription}
                                    onChange={(e) => setCarrierDescription(e.target.value)}
                                    error={!!validationErrors.carrierDescription}
                                    helperText={validationErrors.carrierDescription}
                                    multiline
                                    rows={3}
                                    required
                                    sx={{
                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiFormHelperText-root': { fontSize: '11px' }
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                );
            case 1:
                return (
                    <Paper elevation={0} sx={{
                        p: 3,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                    }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Upload Sample CSV
                        </Typography>
                        {isUploading ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, minHeight: 200 }}>
                                <CircularProgress sx={{ mb: 2 }} />
                                <Typography variant="body1" sx={{ fontSize: '12px' }}>Processing file, please wait...</Typography>
                            </Box>
                        ) : (
                            <Box
                                sx={{
                                    border: dragActive ? '2px solid #1976d2' : '2px dashed #e5e7eb',
                                    borderRadius: '8px',
                                    p: 3,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: dragActive ? 'rgba(25, 118, 210, 0.04)' : '#f8fafc',
                                    transition: 'background 0.2s',
                                    '&:hover': {
                                        borderColor: '#1976d2',
                                        backgroundColor: 'rgba(25, 118, 210, 0.02)'
                                    },
                                }}
                                onClick={() => !isUploading && document.getElementById('csv-upload').click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDropFile}
                            >
                                <input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                    disabled={isUploading}
                                />
                                <CloudUploadIcon sx={{ fontSize: 48, color: '#6b7280', mb: 2 }} />
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                    {csvFile && !isUploading ? csvFile.name : dragActive ? 'Drop your CSV file here' : 'Click or drag CSV file to upload'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Upload a sample CSV file with headers and a few rows of data
                                </Typography>
                            </Box>
                        )}
                        {error && <Alert severity="error" sx={{ mt: 2, '& .MuiAlert-message': { fontSize: '12px' } }}>{error}</Alert>}
                        {success && <Alert severity="success" sx={{ mt: 2, '& .MuiAlert-message': { fontSize: '12px' } }}>{success}</Alert>}
                    </Paper>
                );
            case 2:
                return (
                    <Paper elevation={0} sx={{
                        p: 3,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                    }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Accept Headers
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Review the detected headers from your CSV file
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                            {csvHeaders.map((header) => (
                                <Chip
                                    key={header}
                                    label={header}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                    sx={{ fontSize: '11px' }}
                                />
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                onClick={() => {
                                    setHeadersAccepted(true);
                                    navigateToStep(3);
                                }}
                                disabled={!csvHeaders.length}
                                sx={{ fontSize: '12px' }}
                            >
                                Accept Headers
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                onClick={() => {
                                    setCsvFile(null);
                                    setCsvHeaders([]);
                                    setCsvSample([]);
                                    setHeadersAccepted(false);
                                    navigateToStep(1);
                                }}
                                sx={{ fontSize: '12px' }}
                            >
                                Reject & Upload Different File
                            </Button>
                        </Box>
                    </Paper>
                );
            case 3:
                return renderPromptPlayground();
            case 4:
                console.log('Current mappings:', mappings);
                return (
                    <Paper elevation={0} sx={{
                        p: 3,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                    }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Review & Save
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Review and edit the generated mapping before saving
                        </Typography>
                        {mappings && mappings.length > 0 ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                CSV Header
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                JSON Path
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151'
                                            }}>
                                                Data Type
                                            </TableCell>
                                            <TableCell sx={{
                                                backgroundColor: '#f8fafc',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                color: '#374151',
                                                width: '100px'
                                            }}>
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {mappings.map((mapping, index) => (
                                            <TableRow key={index}>
                                                <TableCell sx={{ fontSize: '12px' }}>{mapping.csvHeader}</TableCell>
                                                <TableCell>
                                                    {editingMapping === index ? (
                                                        <TextField
                                                            fullWidth
                                                            value={mapping.jsonKeyPath}
                                                            onChange={(e) => handleMappingChange(index, 'jsonKeyPath', e.target.value)}
                                                            size="small"
                                                            sx={{
                                                                '& .MuiInputBase-input': { fontSize: '12px' }
                                                            }}
                                                        />
                                                    ) : (
                                                        <Typography sx={{ fontSize: '12px' }}>{mapping.jsonKeyPath}</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingMapping === index ? (
                                                        <FormControl fullWidth size="small">
                                                            <Select
                                                                value={mapping.dataType}
                                                                onChange={(e) => handleMappingChange(index, 'dataType', e.target.value)}
                                                                sx={{
                                                                    fontSize: '12px',
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                <MenuItem value="string" sx={{ fontSize: '12px' }}>String</MenuItem>
                                                                <MenuItem value="number" sx={{ fontSize: '12px' }}>Number</MenuItem>
                                                                <MenuItem value="boolean" sx={{ fontSize: '12px' }}>Boolean</MenuItem>
                                                                <MenuItem value="date" sx={{ fontSize: '12px' }}>Date</MenuItem>
                                                                <MenuItem value="object" sx={{ fontSize: '12px' }}>Object</MenuItem>
                                                                <MenuItem value="array" sx={{ fontSize: '12px' }}>Array</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                    ) : (
                                                        <Typography sx={{ fontSize: '12px' }}>{mapping.dataType}</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingMapping === index ? (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSaveMapping(index)}
                                                            color="primary"
                                                        >
                                                            <CheckCircleIcon sx={{ fontSize: '18px' }} />
                                                        </IconButton>
                                                    ) : (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditMapping(index)}
                                                        >
                                                            <EditIcon sx={{ fontSize: '18px' }} />
                                                        </IconButton>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '12px' } }}>
                                No mappings available. Please go back to the Prompt Playground step and generate mappings first.
                            </Alert>
                        )}
                    </Paper>
                );
            default:
                return null;
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827' }}>
                        {carrierId ? 'Edit Carrier Mapping' : 'Add New Carrier Mapping'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={() => navigate('/admin/billing/edi-mapping')}
                            variant="outlined"
                            size="small"
                            startIcon={<NavigateBeforeIcon />}
                            disabled={loading}
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        {activeStep === STEPS.length - 1 && (
                            <Button
                                onClick={handleSave}
                                variant="contained"
                                size="small"
                                startIcon={<CheckCircleIcon />}
                                disabled={loading || !mappings.length}
                                sx={{ fontSize: '12px' }}
                            >
                                {loading ? <CircularProgress size={16} /> : 'Save'}
                            </Button>
                        )}
                    </Box>
                </Box>
                {/* Breadcrumb */}
                <AdminBreadcrumb
                    currentPage={carrierId ? 'Edit' : 'Add New'}
                    parentPage="EDI Mapping"
                />
            </Box>

            {/* Content Area */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ p: 3 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3, '& .MuiAlert-message': { fontSize: '12px' } }}>
                            {error}
                        </Alert>
                    )}

                    {success && (
                        <Alert severity="success" sx={{ mb: 3, '& .MuiAlert-message': { fontSize: '12px' } }}>
                            {success}
                        </Alert>
                    )}

                    <Stepper activeStep={activeStep} sx={{
                        mb: 4,
                        '& .MuiStepLabel-label': { fontSize: '12px' }
                    }}>
                        {STEPS.map((step, index) => (
                            <Step key={step.path}>
                                <StepLabel>{step.label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {renderStepContent(activeStep)}

                    {/* Bottom Navigation */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                        <Box>
                            {activeStep > 0 && (
                                <Button
                                    onClick={() => navigateToStep(activeStep - 1)}
                                    startIcon={<NavigateBeforeIcon />}
                                    disabled={loading}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Back
                                </Button>
                            )}
                        </Box>
                        <Box>
                            {activeStep < STEPS.length - 1 && (
                                <Button
                                    onClick={() => navigateToStep(activeStep + 1)}
                                    variant="contained"
                                    size="small"
                                    endIcon={<NavigateNextIcon />}
                                    disabled={loading || (activeStep === 0 && !carrierName) || (activeStep === 1 && !csvFile)}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Next
                                </Button>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default AddCarrierMapping; 