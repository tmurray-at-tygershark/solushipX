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
    NavigateBefore as NavigateBeforeIcon
} from '@mui/icons-material';
import { collection, doc, getDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, functions } from '../../../firebase';
import Papa from 'papaparse';
import { useSnackbar } from 'notistack';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';

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
            setCsvFile(file);
            Papa.parse(file, {
                header: true,
                preview: 5,
                complete: async (results) => {
                    setCsvHeaders(results.meta.fields);
                    setCsvSample(results.data);
                    try {
                        setLoading(true);
                        const apiBaseUrl = getApiBaseUrl();
                        const response = await fetch(`${apiBaseUrl}/generateEdiMapping`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                carrierName,
                                csvHeadersString: results.meta.fields.join(','),
                                sampleDataRows: results.data.slice(0, 5),
                                prompt: carrierPrompt
                            })
                        });
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(errorText || 'Failed to get AI mapping suggestion');
                        }
                        const aiMapping = await response.json();
                        setMappings(aiMapping.fieldMappings || []);
                        setPromptUsedForGeneration(aiMapping.prompt || carrierPrompt);
                    } catch (err) {
                        setError('Failed to get AI mapping suggestion. ' + (err.message || 'Please check your prompt or try again.'));
                    } finally {
                        setLoading(false);
                    }
                }
            });
        }
    };

    const handleSave = async () => {
        if (!mappings.length) {
            setError('No mapping available to save. Please generate a mapping first.');
            return;
        }

        setLoading(true);
        try {
            const carrierId = carrierName.toLowerCase().replace(/\s+/g, '_');
            const carrierRef = doc(db, 'ediMappings', carrierId);

            // Update carrier document
            await setDoc(carrierRef, {
                name: carrierName,
                description: carrierDescription,
                prompt: promptUsedForGeneration,
                updatedAt: new Date(),
                ...(carrierId ? {} : { createdAt: new Date() }) // Only set createdAt for new carriers
            });

            // Update mapping document
            const mappingRef = doc(carrierRef, 'default', 'mapping');
            await setDoc(mappingRef, {
                carrierName: carrierName.toUpperCase(),
                fileType: 'text/csv',
                headerHash: generateHeaderHash(csvHeaders),
                parsingOptions: {
                    csvDelimiter: ',',
                    dateFormat: 'YYYYMMDD'
                },
                fieldMappings: mappings,
                prompt: promptUsedForGeneration,
                defaultValues: {
                    carrier: carrierName.toUpperCase(),
                    recordType: 'shipment'
                },
                updatedAt: new Date(),
                ...(carrierId ? {} : { createdAt: new Date() }) // Only set createdAt for new mappings
            });

            setSuccess('Carrier mapping saved successfully!');
            enqueueSnackbar('Carrier mapping saved successfully!', { variant: 'success' });
            setTimeout(() => {
                navigate('/admin/billing/edi-mapping');
            }, 2000);
        } catch (error) {
            console.error('Error saving carrier mapping:', error);
            setError('Failed to save carrier mapping. Please try again.');
            enqueueSnackbar('Failed to save carrier mapping', { variant: 'error' });
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
        setDragActive(true);
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
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Prompt Editor
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={12}
                            value={carrierPrompt}
                            onChange={(e) => setCarrierPrompt(e.target.value)}
                            error={!!validationErrors.prompt}
                            helperText={validationErrors.prompt}
                            sx={{ mb: 2 }}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleTestPrompt}
                            disabled={isGeneratingMapping || loading}
                            startIcon={(isGeneratingMapping || loading) ? <CircularProgress size={20} color="inherit" /> : <NavigateNextIcon />}
                        >
                            Test Prompt
                        </Button>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Test Results
                        </Typography>
                        {testResult?.fieldMappings?.length > 0 ? (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>CSV Header</TableCell>
                                            <TableCell>JSON Path</TableCell>
                                            <TableCell>Data Type</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {testResult.fieldMappings.map((mapping, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{mapping.csvHeader}</TableCell>
                                                <TableCell>{mapping.jsonKeyPath}</TableCell>
                                                <TableCell>{mapping.dataType}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
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
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Carrier Details
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Carrier Name"
                                    value={carrierName}
                                    onChange={(e) => setCarrierName(e.target.value)}
                                    error={!!validationErrors.carrierName}
                                    helperText={validationErrors.carrierName}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Description"
                                    value={carrierDescription}
                                    onChange={(e) => setCarrierDescription(e.target.value)}
                                    error={!!validationErrors.carrierDescription}
                                    helperText={validationErrors.carrierDescription}
                                    multiline
                                    rows={3}
                                    required
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                );
            case 1:
                return (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Upload Sample CSV
                        </Typography>
                        <Box
                            sx={{
                                border: dragActive ? '2px solid #1976d2' : '2px dashed #ccc',
                                borderRadius: 2,
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: dragActive ? 'rgba(25, 118, 210, 0.04)' : 'inherit',
                                transition: 'background 0.2s',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                },
                            }}
                            onClick={() => document.getElementById('csv-upload').click()}
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
                            />
                            <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                {csvFile ? csvFile.name : dragActive ? 'Drop your CSV file here' : 'Click or drag CSV file to upload'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Upload a sample CSV file with headers and a few rows of data
                            </Typography>
                        </Box>
                    </Paper>
                );
            case 2:
                return (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Accept Headers
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Review the detected headers from your CSV file
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                            {csvHeaders.map((header) => (
                                <Chip
                                    key={header}
                                    label={header}
                                    color="primary"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    setHeadersAccepted(true);
                                    navigateToStep(3);
                                }}
                                disabled={!csvHeaders.length}
                            >
                                Accept Headers
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => {
                                    setCsvFile(null);
                                    setCsvHeaders([]);
                                    setCsvSample([]);
                                    setHeadersAccepted(false);
                                    navigateToStep(1);
                                }}
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
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Review & Save
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Review and edit the generated mapping before saving
                        </Typography>
                        {mappings && mappings.length > 0 ? (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>CSV Header</TableCell>
                                            <TableCell>JSON Path</TableCell>
                                            <TableCell>Data Type</TableCell>
                                            <TableCell>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {mappings.map((mapping, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{mapping.csvHeader}</TableCell>
                                                <TableCell>
                                                    {editingMapping === index ? (
                                                        <TextField
                                                            fullWidth
                                                            value={mapping.jsonKeyPath}
                                                            onChange={(e) => handleMappingChange(index, 'jsonKeyPath', e.target.value)}
                                                            size="small"
                                                        />
                                                    ) : (
                                                        mapping.jsonKeyPath
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingMapping === index ? (
                                                        <FormControl fullWidth size="small">
                                                            <Select
                                                                value={mapping.dataType}
                                                                onChange={(e) => handleMappingChange(index, 'dataType', e.target.value)}
                                                            >
                                                                <MenuItem value="string">String</MenuItem>
                                                                <MenuItem value="number">Number</MenuItem>
                                                                <MenuItem value="boolean">Boolean</MenuItem>
                                                                <MenuItem value="date">Date</MenuItem>
                                                                <MenuItem value="object">Object</MenuItem>
                                                                <MenuItem value="array">Array</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                    ) : (
                                                        mapping.dataType
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingMapping === index ? (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleSaveMapping(index)}
                                                            color="primary"
                                                        >
                                                            <CheckCircleIcon />
                                                        </IconButton>
                                                    ) : (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditMapping(index)}
                                                        >
                                                            <NavigateNextIcon />
                                                        </IconButton>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Alert severity="info">
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
        <Box sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        {carrierId ? 'Edit Carrier Mapping' : 'Add New Carrier Mapping'}
                    </Typography>
                    <Breadcrumbs>
                        <Link color="inherit" href="/admin">
                            Admin
                        </Link>
                        <Link color="inherit" href="/admin/billing">
                            Billing
                        </Link>
                        <Link color="inherit" href="/admin/billing/edi-mapping">
                            EDI Mapping
                        </Link>
                        <Typography color="text.primary">
                            {carrierId ? 'Edit' : 'Add New'}
                        </Typography>
                    </Breadcrumbs>
                </Box>
            </Stack>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 3 }}>
                    {success}
                </Alert>
            )}

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {STEPS.map((step, index) => (
                    <Step key={step.path}>
                        <StepLabel>{step.label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {renderStepContent(activeStep)}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button
                    onClick={() => navigate('/admin/billing/edi-mapping')}
                    startIcon={<NavigateBeforeIcon />}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Box>
                    {activeStep > 0 && (
                        <Button
                            onClick={() => navigateToStep(activeStep - 1)}
                            startIcon={<NavigateBeforeIcon />}
                            disabled={loading}
                            sx={{ mr: 1 }}
                        >
                            Back
                        </Button>
                    )}
                    {activeStep < STEPS.length - 1 ? (
                        <Button
                            onClick={() => navigateToStep(activeStep + 1)}
                            variant="contained"
                            endIcon={<NavigateNextIcon />}
                            disabled={loading || (activeStep === 0 && !carrierName) || (activeStep === 1 && !csvFile)}
                        >
                            Next
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSave}
                            variant="contained"
                            startIcon={<CheckCircleIcon />}
                            disabled={loading || !mappings.length}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Save'}
                        </Button>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default AddCarrierMapping; 