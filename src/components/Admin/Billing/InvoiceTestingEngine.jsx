import React, { useState, useCallback, useEffect, useRef } from 'react';
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
    Autocomplete,
    TextField,
    IconButton,
    Tooltip,
    Badge,
    CircularProgress,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondary,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    PlayArrow as TestIcon,
    Assessment as AnalyticsIcon,
    History as HistoryIcon,
    CheckCircle as SuccessIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Visibility as ViewIcon,
    Download as DownloadIcon,
    Refresh as RefreshIcon,
    TrendingUp as TrendingUpIcon,
    School as SchoolIcon,
    Speed as SpeedIcon,
    BugReport as BugIcon,
    Lightbulb as RecommendationIcon,
    ExpandMore as ExpandMoreIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import TestResultsComparison from './TestResultsComparison';
import TestingMetrics from './TestingMetrics';
import TestingHistory from './TestingHistory';

export default function InvoiceTestingEngine({
    carriers = [],
    selectedCarrier,
    onCarrierChange,
    onTestCompleted
}) {
    const { enqueueSnackbar } = useSnackbar();

    // Testing state
    const [activeTestingTab, setActiveTestingTab] = useState(0);
    const [isTestingInProgress, setIsTestingInProgress] = useState(false);
    const [testResults, setTestResults] = useState(null);
    const [testingHistory, setTestingHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // File upload state
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadedFileData, setUploadedFileData] = useState(null);

    // Expected results state (for accuracy testing)
    const [expectedResults, setExpectedResults] = useState({
        carrier: '',
        invoiceNumber: '',
        totalAmount: '',
        shipmentIds: []
    });
    const [useExpectedResults, setUseExpectedResults] = useState(false);

    // Dialog state
    const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
    const [expectedResultsDialogOpen, setExpectedResultsDialogOpen] = useState(false);

    // Cloud functions
    const testCarrierModel = httpsCallable(functions, 'testCarrierModel');
    const getCarrierTestingHistory = httpsCallable(functions, 'getCarrierTestingHistory');

    // File upload configuration
    const onDrop = useCallback((acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            enqueueSnackbar('Please upload only PDF files', { variant: 'error' });
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            enqueueSnackbar('File size must be less than 10MB', { variant: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setUploadedFileData(e.target.result);
            setUploadedFile(file);
            enqueueSnackbar('Test invoice uploaded successfully', { variant: 'success' });
        };
        reader.readAsDataURL(file);
    }, [enqueueSnackbar]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        },
        multiple: false
    });

    // Load testing history when carrier changes
    useEffect(() => {
        if (selectedCarrier?.id) {
            loadTestingHistory();
        }
    }, [selectedCarrier]);

    const loadTestingHistory = async () => {
        if (!selectedCarrier?.id) return;

        setLoadingHistory(true);
        try {
            const result = await getCarrierTestingHistory({
                carrierId: selectedCarrier.id,
                limit: 20
            });

            if (result.data.success) {
                setTestingHistory(result.data.tests || []);
            } else {
                console.error('Failed to load testing history:', result.data.error);
            }
        } catch (error) {
            console.error('Error loading testing history:', error);
            enqueueSnackbar('Failed to load testing history', { variant: 'error' });
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleRunTest = async () => {
        if (!selectedCarrier) {
            enqueueSnackbar('Please select a carrier first', { variant: 'error' });
            return;
        }

        if (!uploadedFile || !uploadedFileData) {
            enqueueSnackbar('Please upload a test invoice first', { variant: 'error' });
            return;
        }

        setIsTestingInProgress(true);

        try {
            const base64Data = uploadedFileData.split(',')[1]; // Remove data:application/pdf;base64, prefix

            const testData = {
                carrierId: selectedCarrier.id,
                fileName: uploadedFile.name,
                base64Data,
                testType: useExpectedResults ? 'accuracy_test' : 'quality_test',
                expectedResults: useExpectedResults ? expectedResults : null,
                metadata: {
                    fileSize: uploadedFile.size,
                    uploadedAt: new Date().toISOString(),
                    testMode: useExpectedResults ? 'accuracy' : 'quality'
                }
            };

            const result = await testCarrierModel(testData);

            if (result.data.success) {
                setTestResults(result.data.testResults);
                setResultsDialogOpen(true);
                await loadTestingHistory(); // Refresh history

                if (onTestCompleted) {
                    onTestCompleted(result.data.testResults);
                }

                enqueueSnackbar('Test completed successfully!', { variant: 'success' });
            } else {
                throw new Error(result.data.error || 'Test failed');
            }

        } catch (error) {
            console.error('Testing error:', error);
            enqueueSnackbar(`Test failed: ${error.message}`, { variant: 'error' });
        } finally {
            setIsTestingInProgress(false);
        }
    };

    const getAccuracyColor = (accuracy) => {
        if (accuracy >= 0.9) return 'success';
        if (accuracy >= 0.7) return 'warning';
        return 'error';
    };

    const getConfidenceIcon = (confidence) => {
        if (confidence >= 0.9) return <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />;
        if (confidence >= 0.7) return <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />;
        return <ErrorIcon sx={{ color: '#ef4444', fontSize: 16 }} />;
    };

    const renderTestingInterface = () => (
        <Grid container spacing={3}>
            {/* Upload Section */}
            <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, border: '1px solid #e5e7eb', height: 'fit-content' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Upload Test Invoice
                    </Typography>

                    {/* Carrier Selection */}
                    <Autocomplete
                        value={selectedCarrier}
                        onChange={(_, newValue) => onCarrierChange(newValue)}
                        options={carriers}
                        getOptionLabel={(option) => option.name || ''}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Select Carrier"
                                size="small"
                                sx={{ mb: 2, fontSize: '12px' }}
                                helperText={carriers.length === 0 ? "No trained carriers available. Complete training workflow first." : ""}
                            />
                        )}
                        size="small"
                        disabled={carriers.length === 0}
                        noOptionsText="No trained carriers available"
                    />

                    {/* File Upload Area */}
                    <Box
                        {...getRootProps()}
                        sx={{
                            border: '2px dashed #d1d5db',
                            borderRadius: 2,
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            bgcolor: isDragActive ? '#f3f4f6' : '#fafafa',
                            '&:hover': {
                                bgcolor: '#f3f4f6',
                                borderColor: '#9ca3af'
                            },
                            mb: 2
                        }}
                    >
                        <input {...getInputProps()} />
                        <UploadIcon sx={{ fontSize: 48, color: '#6b7280', mb: 2 }} />
                        <Typography sx={{ fontSize: '14px', color: '#374151' }}>
                            {isDragActive
                                ? 'Drop the PDF here...'
                                : uploadedFile
                                    ? `Uploaded: ${uploadedFile.name}`
                                    : 'Drag & drop a test invoice PDF, or click to select'
                            }
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 1 }}>
                            Max file size: 10MB • PDF format only
                        </Typography>
                    </Box>

                    {/* Expected Results Toggle */}
                    <Box sx={{ mb: 2 }}>
                        <Button
                            variant={useExpectedResults ? "contained" : "outlined"}
                            size="small"
                            onClick={() => setUseExpectedResults(!useExpectedResults)}
                            sx={{ fontSize: '12px' }}
                        >
                            {useExpectedResults ? 'Using Expected Results' : 'Quality Test Only'}
                        </Button>
                        <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 1 }}>
                            {useExpectedResults
                                ? 'Accuracy testing with comparison to expected results'
                                : 'Quality testing without expected results comparison'
                            }
                        </Typography>
                    </Box>

                    {/* Expected Results Input */}
                    {useExpectedResults && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setExpectedResultsDialogOpen(true)}
                            sx={{ fontSize: '12px', mb: 2 }}
                        >
                            Set Expected Results
                        </Button>
                    )}

                    {/* Test Button */}
                    <Button
                        variant="contained"
                        fullWidth
                        onClick={handleRunTest}
                        disabled={!selectedCarrier || !uploadedFile || isTestingInProgress}
                        startIcon={isTestingInProgress ? <CircularProgress size={16} /> : <TestIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        {isTestingInProgress ? 'Running Test...' : 'Run AI Test'}
                    </Button>
                </Paper>
            </Grid>

            {/* Quick Stats */}
            <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, border: '1px solid #e5e7eb', height: 'fit-content' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                        Testing Overview
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Card sx={{ p: 2, textAlign: 'center' }}>
                                <SpeedIcon sx={{ fontSize: 32, color: '#3b82f6', mb: 1 }} />
                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                    {testingHistory.length}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    Total Tests
                                </Typography>
                            </Card>
                        </Grid>
                        <Grid item xs={6}>
                            <Card sx={{ p: 2, textAlign: 'center' }}>
                                <TrendingUpIcon sx={{ fontSize: 32, color: '#10b981', mb: 1 }} />
                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                    {testingHistory.length > 0
                                        ? `${Math.round((testingHistory[0]?.accuracyMetrics?.overall || 0) * 100)}%`
                                        : 'N/A'
                                    }
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    Last Accuracy
                                </Typography>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Recent Test Results */}
                    {testingHistory.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                                Recent Tests
                            </Typography>
                            <List sx={{ p: 0 }}>
                                {testingHistory.slice(0, 3).map((test, index) => (
                                    <ListItem key={test.id || index} sx={{ px: 0, py: 1 }}>
                                        <ListItemIcon sx={{ minWidth: 24 }}>
                                            {getConfidenceIcon(test.accuracyMetrics?.confidence || 0)}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={test.fileName}
                                            secondary={`Accuracy: ${Math.round((test.accuracyMetrics?.overall || 0) * 100)}%`}
                                            sx={{
                                                '& .MuiListItemText-primary': { fontSize: '12px' },
                                                '& .MuiListItemText-secondary': { fontSize: '11px' }
                                            }}
                                        />
                                        <Chip
                                            label={test.accuracyMetrics?.extractionQuality || 'N/A'}
                                            size="small"
                                            color={getAccuracyColor(test.accuracyMetrics?.overall || 0)}
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}
                </Paper>
            </Grid>
        </Grid>
    );

    return (
        <Box>
            {/* Tab Navigation */}
            <Tabs value={activeTestingTab} onChange={(_, value) => setActiveTestingTab(value)} sx={{ mb: 3 }}>
                <Tab
                    icon={<TestIcon />}
                    label="Run Test"
                    sx={{ fontSize: '12px' }}
                    iconPosition="start"
                />
                <Tab
                    icon={<AnalyticsIcon />}
                    label="Metrics"
                    sx={{ fontSize: '12px' }}
                    iconPosition="start"
                />
                <Tab
                    icon={<HistoryIcon />}
                    label="History"
                    sx={{ fontSize: '12px' }}
                    iconPosition="start"
                />
            </Tabs>

            {/* Tab Content */}
            {activeTestingTab === 0 && renderTestingInterface()}

            {activeTestingTab === 1 && (
                <TestingMetrics
                    carrierId={selectedCarrier?.id}
                    testingHistory={testingHistory}
                    isLoading={loadingHistory}
                />
            )}

            {activeTestingTab === 2 && (
                <TestingHistory
                    carrierId={selectedCarrier?.id}
                    testingHistory={testingHistory}
                    isLoading={loadingHistory}
                    onRefresh={loadTestingHistory}
                />
            )}

            {/* Expected Results Dialog */}
            <Dialog
                open={expectedResultsDialogOpen}
                onClose={() => setExpectedResultsDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Set Expected Results
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                        Provide the expected extraction results to measure AI accuracy
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Expected Carrier Name"
                                value={expectedResults.carrier}
                                onChange={(e) => setExpectedResults(prev => ({ ...prev, carrier: e.target.value }))}
                                size="small"
                                sx={{ mb: 2 }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Expected Invoice Number"
                                value={expectedResults.invoiceNumber}
                                onChange={(e) => setExpectedResults(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                                size="small"
                                sx={{ mb: 2 }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Expected Total Amount"
                                value={expectedResults.totalAmount}
                                onChange={(e) => setExpectedResults(prev => ({ ...prev, totalAmount: e.target.value }))}
                                size="small"
                                sx={{ mb: 2 }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Expected Shipment IDs (comma-separated)"
                                value={expectedResults.shipmentIds.join(', ')}
                                onChange={(e) => setExpectedResults(prev => ({
                                    ...prev,
                                    shipmentIds: e.target.value.split(',').map(id => id.trim()).filter(id => id)
                                }))}
                                size="small"
                                sx={{ mb: 2 }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExpectedResultsDialogOpen(false)} size="small">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => setExpectedResultsDialogOpen(false)}
                        variant="contained"
                        size="small"
                    >
                        Save Expected Results
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Test Results Dialog */}
            <Dialog
                open={resultsDialogOpen}
                onClose={() => setResultsDialogOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    Test Results
                    <IconButton onClick={() => setResultsDialogOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {testResults && (
                        <TestResultsComparison
                            testResults={testResults}
                            expectedResults={useExpectedResults ? expectedResults : null}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
