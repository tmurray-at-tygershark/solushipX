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
    CircularProgress,
    Alert,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Breadcrumbs,
    Link as MuiLink, // Renamed to avoid conflict with react-router-dom Link
    FormControl,
    Select,
    MenuItem,
    IconButton,
    Stack
} from '@mui/material';
import {
    CheckCircleOutline as CheckCircleIcon,
    NavigateNext as NavigateNextIcon,
    NavigateBefore as NavigateBeforeIcon,
    Save as SaveIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import Papa from 'papaparse'; // For potential sample display, though headers/sample are loaded as is
import { useSnackbar } from 'notistack';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'; // Link from react-router-dom

const EDIT_STEPS = [
    { label: 'Carrier Details', path: 'details' },
    { label: 'View Sample Data', path: 'sample' },
    { label: 'View Headers', path: 'headers' },
    { label: 'Prompt Playground', path: 'prompt' },
    { label: 'Review & Save Mapping', path: 'review' }
];

const DEFAULT_PROMPT = `You are a highly specialized data extraction agent. Your task is to analyze the provided CSV Headers and Sample Data Rows to suggest a JSON mapping schema. For each CSV Header, determine: 1. The original 'csvHeader' name. 2. A suitable 'jsonKeyPath' for a structured JSON output. Use dot notation for nesting (e.g., 'destination.address.street', 'charges.fuelSurcharge'). Be comprehensive and logical in your nesting based on common EDI/shipping structures. 3. The inferred 'dataType' (e.g., "string", "number", "boolean", "date YYYY-MM-DD", "object", "array"). **OUTPUT REQUIREMENTS:** - Output ONLY a valid JSON array of objects. - Each object in the array MUST follow this exact structure: { "csvHeader": "...", "jsonKeyPath": "...", "dataType": "..." } - Ensure the 'jsonKeyPath' accurately reflects a sensible hierarchical structure. - For date fields in the sample data, if a format is discernible, specify it in the dataType (e.g., "date MM/DD/YYYY"). Here are the CSV Headers: {{csvHeadersString}} Here are some Sample Data Rows (to help infer data types and structure): {{sampleDataRows}} Based on these, generate the JSON array of mapping objects.`;

const EditCarrierMapping = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { carrierId, stepName } = useParams(); // Get carrierId and current stepName from URL
    const { enqueueSnackbar } = useSnackbar();

    const [activeStep, setActiveStep] = useState(0);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // Carrier and general mapping info
    const [carrierName, setCarrierName] = useState('');
    const [carrierDescription, setCarrierDescription] = useState('');
    const [carrierPrompt, setCarrierPrompt] = useState(''); // This will be the main editable prompt
    const [promptUsedForLastSuccessfulGeneration, setPromptUsedForLastSuccessfulGeneration] = useState('');

    // Data from the original CSV upload (read-only)
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvSample, setCsvSample] = useState([]); // Array of objects
    const [headerHash, setHeaderHash] = useState(null);

    // The actual field mappings [{ csvHeader, jsonKeyPath, dataType }, ...]
    const [mappings, setMappings] = useState([]);

    const [loading, setLoading] = useState(true); // For initial data load
    const [saving, setSaving] = useState(false); // For save operation
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false); // For prompt testing
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});
    const [testResult, setTestResult] = useState({ fieldMappings: [] }); // For prompt playground output
    const [editingMappingIndex, setEditingMappingIndex] = useState(null); // For Review & Save inline editing

    // Determine current step from URL path, fallback to 0
    useEffect(() => {
        const currentPathSuffix = location.pathname.split('/').pop();
        const stepIndex = EDIT_STEPS.findIndex(step => step.path === currentPathSuffix);
        if (stepIndex !== -1) {
            setActiveStep(stepIndex);
        } else {
            // If no specific step, or invalid, default to first step 'details'
            // And navigate to ensure URL consistency if needed (optional)
            const firstStepPath = EDIT_STEPS[0].path;
            if (currentPathSuffix !== firstStepPath && carrierId) {
                navigate(`/admin/billing/edi-mapping/edit/${carrierId}/${firstStepPath}`, { replace: true });
            }
            setActiveStep(0);
        }
    }, [location.pathname, carrierId, navigate]);

    const loadExistingMappingData = useCallback(async () => {
        if (!carrierId) {
            enqueueSnackbar('No Carrier ID provided for editing.', { variant: 'error' });
            navigate('/admin/billing/edi-mapping');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const carrierDocRef = doc(db, 'ediMappings', carrierId);
            const carrierDocSnap = await getDoc(carrierDocRef);

            if (!carrierDocSnap.exists()) {
                throw new Error('Carrier mapping configuration not found.');
            }
            const carrierData = carrierDocSnap.data();
            setCarrierName(carrierData.name || '');
            setCarrierDescription(carrierData.description || '');
            setCarrierPrompt(carrierData.prompt || DEFAULT_PROMPT); // Load saved prompt

            const mappingDocRef = doc(db, 'ediMappings', carrierId, 'default', 'mapping');
            const mappingDocSnap = await getDoc(mappingDocRef);

            if (!mappingDocSnap.exists()) {
                throw new Error('EDI mapping details not found.');
            }
            const mappingData = mappingDocSnap.data();
            setMappings(mappingData.fieldMappings || []);
            setCsvHeaders(mappingData.csvHeaders || []); // Assuming csvHeaders are stored
            setCsvSample(mappingData.csvSample || []);   // Assuming csvSample is stored
            setHeaderHash(mappingData.headerHash || null);
            setPromptUsedForLastSuccessfulGeneration(mappingData.promptUsedForLastSuccessfulGeneration || carrierData.prompt || DEFAULT_PROMPT);

            setIsDataLoaded(true);
        } catch (err) {
            console.error("Error loading existing EDI mapping data:", err);
            setError('Failed to load mapping data: ' + err.message);
            enqueueSnackbar('Error loading mapping data: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, navigate, enqueueSnackbar]);

    useEffect(() => {
        loadExistingMappingData();
    }, [loadExistingMappingData]);

    const navigateToStep = (stepIndex) => {
        // TODO: Add validation if needed before navigating certain steps
        if (stepIndex >= 0 && stepIndex < EDIT_STEPS.length) {
            setActiveStep(stepIndex);
            navigate(`/admin/billing/edi-mapping/edit/${carrierId}/${EDIT_STEPS[stepIndex].path}`);
        }
    };

    // Placeholder - actual implementation will be more complex
    const validateStep = (step) => {
        // Add validation logic for fields in the current step if necessary
        // For now, assume valid to proceed
        return true;
    };

    const getApiBaseUrl = () => {
        if (process.env.NODE_ENV === 'development') {
            return 'http://localhost:5001/solushipx/us-central1';
        }
        return 'https://us-central1-solushipx.cloudfunctions.net';
    };

    const handleTestPrompt = async () => {
        if (!csvHeaders.length || !csvSample.length) {
            setError('CSV headers and sample data are required to test prompt.');
            enqueueSnackbar('Missing CSV data for prompt testing.', { variant: 'warning' });
            return;
        }
        setIsGeneratingPrompt(true);
        setError(null);
        try {
            const apiBaseUrl = getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/generateEdiMapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    carrierName: carrierName, // Or just use carrierId
                    csvHeadersString: csvHeaders.join(','),
                    sampleDataRows: csvSample, // Send the loaded sample
                    prompt: carrierPrompt
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to get AI mapping suggestion');
            }
            const result = await response.json();
            if (Array.isArray(result)) { // Assuming function returns array of {csvHeader, jsonKeyPath, dataType}
                setMappings(result);
                setTestResult({ fieldMappings: result });
                setPromptUsedForLastSuccessfulGeneration(carrierPrompt); // Capture the prompt used
                enqueueSnackbar('Prompt test successful! Review results below and in Review & Save step.', { variant: 'success' });
            } else {
                throw new Error('AI suggestion was not in the expected format.');
            }
        } catch (err) {
            console.error('Test prompt error:', err);
            setError('Failed to test prompt: ' + err.message);
            enqueueSnackbar('Failed to test prompt: ' + err.message, { variant: 'error' });
            setTestResult({ fieldMappings: [] }); // Clear previous results on error
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const handleMappingChange = (index, field, value) => {
        const updatedMappings = [...mappings];
        updatedMappings[index] = { ...updatedMappings[index], [field]: value };
        setMappings(updatedMappings);
    };

    const handleEditFieldMapping = (index) => setEditingMappingIndex(index);
    const handleSaveFieldMapping = () => setEditingMappingIndex(null);


    const handleSaveEditedMapping = async () => {
        // Validation (example for carrier details)
        if (!carrierName.trim()) {
            enqueueSnackbar('Carrier Name is required.', { variant: 'warning' });
            setValidationErrors(prev => ({ ...prev, carrierName: 'Carrier Name is required.' }));
            setActiveStep(EDIT_STEPS.findIndex(s => s.path === 'details')); // Go to details step
            return;
        }
        if (!mappings || mappings.length === 0) {
            enqueueSnackbar('No field mappings defined. Please test a prompt or define mappings in the review step.', { variant: 'warning' });
            setActiveStep(EDIT_STEPS.findIndex(s => s.path === 'prompt')); // Go to prompt step
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const carrierDocRef = doc(db, 'ediMappings', carrierId);
            const mappingDocRef = doc(db, 'ediMappings', carrierId, 'default', 'mapping');

            const carrierDocPayload = {
                name: carrierName,
                description: carrierDescription,
                prompt: carrierPrompt, // Save the latest edited prompt
                updatedAt: serverTimestamp(),
            };
            // Not updating 'enabled' status here, that's handled on the list page

            const mappingDocPayload = {
                carrierName: carrierName.toUpperCase(), // Denormalize for consistency
                fileType: 'text/csv', // This would be from original upload, assume it doesn't change
                headerHash: headerHash, // This should not change from original upload
                csvHeaders: csvHeaders, // Store for reference
                csvSample: csvSample,   // Store for reference
                parsingOptions: {
                    csvDelimiter: ',',
                    dateFormat: 'YYYYMMDD',
                },
                fieldMappings: mappings,
                prompt: carrierPrompt, // Save the primary edited prompt here too
                promptUsedForLastSuccessfulGeneration: promptUsedForLastSuccessfulGeneration,
                defaultValues: {
                    carrier: carrierName.toUpperCase(),
                    recordType: 'shipment',
                },
                updatedAt: serverTimestamp(),
            };

            await updateDoc(carrierDocRef, carrierDocPayload); // Update main carrier doc
            await setDoc(mappingDocRef, mappingDocPayload, { merge: true }); // Overwrite/merge mapping sub-doc

            enqueueSnackbar('EDI Mapping updated successfully!', { variant: 'success' });
            navigate('/admin/billing/edi-mapping');

        } catch (err) {
            console.error("Error saving EDI mapping:", err);
            setError('Failed to save mapping: ' + err.message);
            enqueueSnackbar('Error saving mapping: ' + err.message, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // --- Render Step Content --- 
    function renderStepContent(step) {
        if (!isDataLoaded && step > 0) { // For steps other than details, ensure data is loaded
            return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /><Typography sx={{ mt: 1 }}>Loading mapping data...</Typography></Box>;
        }
        switch (EDIT_STEPS[step]?.path) {
            case 'details':
                return (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Carrier Details</Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Carrier Name"
                                    value={carrierName}
                                    onChange={(e) => {
                                        setCarrierName(e.target.value);
                                        if (validationErrors.carrierName) setValidationErrors(p => ({ ...p, carrierName: null }));
                                    }}
                                    error={!!validationErrors.carrierName}
                                    helperText={validationErrors.carrierName || "Unique name for this carrier mapping."}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Description"
                                    value={carrierDescription}
                                    onChange={(e) => setCarrierDescription(e.target.value)}
                                    multiline
                                    rows={3}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                );
            case 'sample':
                return (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>View Sample Data (Read-only)</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            This is the sample data extracted from the originally uploaded CSV file.
                        </Typography>
                        {csvSample.length > 0 ? (
                            <TableContainer component={Paper} elevation={0} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {csvHeaders.map(header => <TableCell key={header}>{header}</TableCell>)}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {csvSample.map((row, rowIndex) => (
                                            <TableRow key={rowIndex}>
                                                {csvHeaders.map(header => <TableCell key={`${rowIndex}-${header}`}>{row[header]}</TableCell>)}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : <Typography>No sample data available or loaded.</Typography>}
                    </Paper>
                );
            case 'headers':
                return (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>View Headers (Read-only)</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            These are the headers from the originally uploaded CSV file.
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {csvHeaders.length > 0 ? csvHeaders.map((header) => (
                                <Chip key={header} label={header} variant="outlined" />
                            )) : <Typography>No headers available or loaded.</Typography>}
                        </Box>
                    </Paper>
                );
            case 'prompt':
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>Prompt Editor</Typography>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={15}
                                    value={carrierPrompt}
                                    onChange={(e) => setCarrierPrompt(e.target.value)}
                                    sx={{ mb: 2 }}
                                    helperText="Edit the prompt to guide AI mapping generation. Use {{csvHeadersString}} and {{sampleDataRows}} placeholders if your cloud function supports them for this test."
                                />
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleTestPrompt}
                                    disabled={isGeneratingPrompt || loading || !csvHeaders.length}
                                    startIcon={(isGeneratingPrompt) ? <CircularProgress size={20} color="inherit" /> : <NavigateNextIcon />}
                                >
                                    Test Current Prompt
                                </Button>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>Test Results (Suggested Mapping)</Typography>
                                {isGeneratingPrompt && <Box sx={{ textAlign: 'center' }}><CircularProgress /><Typography>Generating...</Typography></Box>}
                                {testResult?.fieldMappings?.length > 0 ? (
                                    <TableContainer>
                                        <Table size="small">
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
                                    !isGeneratingPrompt && <Typography variant="body2" color="text.secondary">Test results will appear here.</Typography>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>
                );
            case 'review':
                return (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Review & Save Mapping</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Manually review and adjust the field mappings generated from the prompt or loaded from existing configuration.
                        </Typography>
                        {mappings && mappings.length > 0 ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ width: '30%' }}>CSV Header</TableCell>
                                            <TableCell sx={{ width: '35%' }}>JSON Key Path</TableCell>
                                            <TableCell sx={{ width: '25%' }}>Data Type</TableCell>
                                            <TableCell sx={{ width: '10%' }} align="right">Edit</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {mappings.map((mapping, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>{mapping.csvHeader}</TableCell>
                                                <TableCell>
                                                    {editingMappingIndex === index ? (
                                                        <TextField
                                                            fullWidth
                                                            value={mapping.jsonKeyPath}
                                                            onChange={(e) => handleMappingChange(index, 'jsonKeyPath', e.target.value)}
                                                            size="small"
                                                            variant="standard"
                                                        />
                                                    ) : (
                                                        mapping.jsonKeyPath
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingMappingIndex === index ? (
                                                        <FormControl fullWidth size="small" variant="standard">
                                                            <Select
                                                                value={mapping.dataType}
                                                                onChange={(e) => handleMappingChange(index, 'dataType', e.target.value)}
                                                            >
                                                                <MenuItem value="string">String</MenuItem>
                                                                <MenuItem value="number">Number</MenuItem>
                                                                <MenuItem value="boolean">Boolean</MenuItem>
                                                                <MenuItem value="date YYYY-MM-DD">Date (YYYY-MM-DD)</MenuItem>
                                                                <MenuItem value="date MM/DD/YYYY">Date (MM/DD/YYYY)</MenuItem>
                                                                {/* Add more date formats or other types */}
                                                                <MenuItem value="object">Object</MenuItem>
                                                                <MenuItem value="array">Array</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                    ) : (
                                                        mapping.dataType
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {editingMappingIndex === index ? (
                                                        <IconButton size="small" onClick={() => handleSaveFieldMapping()} color="primary">
                                                            <SaveIcon fontSize="inherit" />
                                                        </IconButton>
                                                    ) : (
                                                        <IconButton size="small" onClick={() => handleEditFieldMapping(index)}>
                                                            <EditIcon fontSize="inherit" />
                                                        </IconButton>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Alert severity="warning">No field mappings are currently defined. Go to the 'Prompt Playground' to generate them or ensure previous steps were completed.</Alert>
                        )}
                    </Paper>
                );
            default:
                return <Typography>Unknown step: {EDIT_STEPS[activeStep]?.label || activeStep}</Typography>;
        }
    }

    if (loading && !isDataLoaded) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /><Typography sx={{ ml: 2 }}>Loading mapping data...</Typography></Box>;
    }
    if (!isDataLoaded && carrierId) { // Still loading or failed before data loaded, but carrierId is present
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /><Typography sx={{ ml: 2 }}>Initializing editor...</Typography></Box>;
    }
    if (error && !isDataLoaded) { // Show critical load error prominently
        return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
    }

    return (
        <Box sx={{ p: 3 }} className="edit-carrier-mapping-page">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Edit EDI Carrier Mapping: {carrierName || 'Loading...'}
                    </Typography>
                    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                        <MuiLink component={Link} to="/admin" color="inherit" sx={{ display: 'flex', alignItems: 'center' }}>Admin</MuiLink>
                        <MuiLink component={Link} to="/admin/billing" color="inherit" sx={{ display: 'flex', alignItems: 'center' }}>Billing</MuiLink>
                        <MuiLink component={Link} to="/admin/billing/edi-mapping" color="inherit" sx={{ display: 'flex', alignItems: 'center' }}>EDI Mappings</MuiLink>
                        <Typography color="text.primary">Edit: {carrierName || carrierId}</Typography>
                    </Breadcrumbs>
                </Box>
            </Stack>

            {error && !loading && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            <Paper elevation={2} sx={{ p: 3 }}>
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {EDIT_STEPS.map((step, index) => (
                        <Step key={step.path} onClick={() => navigateToStep(index)} sx={{ cursor: 'pointer' }}>
                            <StepLabel>{step.label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Box sx={{ mt: 3, mb: 3, minHeight: '400px' }}>
                    {renderStepContent(activeStep)}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, borderTop: '1px solid #e0e0e0', pt: 2 }}>
                    <Button
                        onClick={() => navigate('/admin/billing/edi-mapping')} // Go back to list
                        startIcon={<NavigateBeforeIcon />}
                        disabled={saving || isGeneratingPrompt}
                    >
                        Cancel / Back to List
                    </Button>
                    <Box>
                        {activeStep > 0 && (
                            <Button
                                onClick={() => navigateToStep(activeStep - 1)}
                                startIcon={<NavigateBeforeIcon />}
                                disabled={saving || isGeneratingPrompt || activeStep === EDIT_STEPS.findIndex(s => s.path === 'sample')} // Cant go back from sample if its first editable
                                sx={{ mr: 1 }}
                            >
                                Back
                            </Button>
                        )}
                        {activeStep < EDIT_STEPS.length - 1 ? (
                            <Button
                                onClick={() => navigateToStep(activeStep + 1)}
                                variant="contained"
                                endIcon={<NavigateNextIcon />}
                                disabled={saving || isGeneratingPrompt}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSaveEditedMapping}
                                variant="contained"
                                color="primary"
                                startIcon={<SaveIcon />}
                                disabled={saving || isGeneratingPrompt || loading}
                            >
                                {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Mapping'}
                            </Button>
                        )}
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default EditCarrierMapping; 