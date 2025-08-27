import React, { useState, useCallback } from 'react';
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    TextField,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Divider
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    PlayArrow as ProcessIcon,
    Visibility as ViewIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    Schedule as PendingIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';

export default function ProductionProcessing({ availableCarriers = [], onProcessInvoice }) {
    const { enqueueSnackbar } = useSnackbar();

    // File management
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [processingFiles, setProcessingFiles] = useState(new Set());
    const [processingResults, setProcessingResults] = useState([]);

    // Processing options
    const [selectedCarrier, setSelectedCarrier] = useState('auto-detect');
    const [autoUpdateCharges, setAutoUpdateCharges] = useState(false);
    const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);

    // UI state
    const [processing, setProcessing] = useState(false);

    // File upload handling
    const onDrop = useCallback(async (acceptedFiles) => {
        const newFiles = [];

        for (const file of acceptedFiles) {
            if (file.type !== 'application/pdf') {
                enqueueSnackbar(`${file.name} is not a PDF file`, { variant: 'warning' });
                continue;
            }

            // Convert to base64
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                const fileData = {
                    id: `${Date.now()}-${Math.random()}`,
                    file,
                    fileName: file.name,
                    base64,
                    size: file.size,
                    uploadedAt: new Date(),
                    status: 'uploaded'
                };
                newFiles.push(fileData);

                if (newFiles.length === acceptedFiles.filter(f => f.type === 'application/pdf').length) {
                    setUploadedFiles(prev => [...prev, ...newFiles]);
                }
            };
            reader.readAsDataURL(file);
        }
    }, [enqueueSnackbar]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true,
        maxFiles: 5
    });

    // Process single file
    const processFile = async (fileData) => {
        if (!onProcessInvoice) {
            enqueueSnackbar('Processing function not available', { variant: 'error' });
            return;
        }

        setProcessingFiles(prev => new Set([...prev, fileData.id]));

        try {
            const processingData = {
                ...fileData,
                carrierId: selectedCarrier === 'auto-detect' ? null : selectedCarrier,
                autoUpdateCharges,
                confidenceThreshold
            };

            const result = await onProcessInvoice(processingData);

            // Update file status
            setUploadedFiles(prev =>
                prev.map(f => f.id === fileData.id
                    ? { ...f, status: 'completed', result }
                    : f
                )
            );

            // Add to results
            setProcessingResults(prev => [...prev, {
                ...result,
                fileName: fileData.fileName,
                processedAt: new Date()
            }]);

        } catch (error) {
            // Update file status to error
            setUploadedFiles(prev =>
                prev.map(f => f.id === fileData.id
                    ? { ...f, status: 'error', error: error.message }
                    : f
                )
            );
        } finally {
            setProcessingFiles(prev => {
                const next = new Set(prev);
                next.delete(fileData.id);
                return next;
            });
        }
    };

    // Process all files
    const processAllFiles = async () => {
        const pendingFiles = uploadedFiles.filter(f => f.status === 'uploaded');
        if (pendingFiles.length === 0) {
            enqueueSnackbar('No files to process', { variant: 'warning' });
            return;
        }

        setProcessing(true);

        for (const file of pendingFiles) {
            await processFile(file);
        }

        setProcessing(false);
    };

    // Remove file
    const removeFile = (fileId) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    };

    // Clear all files
    const clearAllFiles = () => {
        setUploadedFiles([]);
        setProcessingResults([]);
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <SuccessIcon color="success" />;
            case 'error': return <ErrorIcon color="error" />;
            case 'processing': return <PendingIcon color="primary" />;
            default: return <PendingIcon color="disabled" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'success';
            case 'error': return 'error';
            case 'processing': return 'primary';
            default: return 'default';
        }
    };

    const carrierOptions = [
        { id: 'auto-detect', name: 'Auto-Detect (Recommended)' },
        ...availableCarriers.map(c => ({ id: c.id, name: c.name }))
    ];

    return (
        <Box>
            {/* Upload Section */}
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb', mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                    Upload Invoice Documents
                </Typography>

                {/* Drag & Drop Area */}
                <Box
                    {...getRootProps()}
                    sx={{
                        border: '2px dashed #d1d5db',
                        borderRadius: 2,
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: isDragActive ? '#f3f4f6' : 'transparent',
                        '&:hover': { backgroundColor: '#f9fafb' }
                    }}
                >
                    <input {...getInputProps()} />
                    <UploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                    <Typography variant="body1" sx={{ fontSize: '14px', mb: 1 }}>
                        {isDragActive ? 'Drop the PDFs here...' : 'Drag & drop invoice PDFs here, or click to select'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Maximum 5 files, PDF format only
                    </Typography>
                </Box>

                {/* Processing Options */}
                <Accordion sx={{ mt: 3 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600 }}>
                            Processing Options
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Carrier Selection</InputLabel>
                                    <Select
                                        value={selectedCarrier}
                                        onChange={(e) => setSelectedCarrier(e.target.value)}
                                        label="Carrier Selection"
                                    >
                                        {carrierOptions.map(option => (
                                            <MenuItem key={option.id} value={option.id}>
                                                {option.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Confidence Threshold"
                                    type="number"
                                    value={confidenceThreshold}
                                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                                    inputProps={{ min: 0.1, max: 1.0, step: 0.1 }}
                                    helperText="Minimum confidence level for automatic processing"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={autoUpdateCharges}
                                            onChange={(e) => setAutoUpdateCharges(e.target.checked)}
                                        />
                                    }
                                    label="Automatically update shipment charges"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Paper>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
                <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb', mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Uploaded Files ({uploadedFiles.length})
                        </Typography>
                        <Box>
                            <Button
                                variant="contained"
                                startIcon={<ProcessIcon />}
                                onClick={processAllFiles}
                                disabled={processing || uploadedFiles.every(f => f.status !== 'uploaded')}
                                size="small"
                                sx={{ mr: 1 }}
                            >
                                Process All
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={clearAllFiles}
                                size="small"
                            >
                                Clear All
                            </Button>
                        </Box>
                    </Box>

                    <List>
                        {uploadedFiles.map((file, index) => (
                            <React.Fragment key={file.id}>
                                <ListItem>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                                        {getStatusIcon(file.status)}
                                    </Box>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <Typography sx={{ fontSize: '14px', mr: 2 }}>
                                                    {file.fileName}
                                                </Typography>
                                                <Chip
                                                    label={file.status}
                                                    size="small"
                                                    color={getStatusColor(file.status)}
                                                    sx={{ fontSize: '11px' }}
                                                />
                                            </Box>
                                        }
                                        secondary={
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                                {file.error && ` • Error: ${file.error}`}
                                            </Typography>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <Box>
                                            {file.status === 'uploaded' && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => processFile(file)}
                                                    disabled={processingFiles.has(file.id)}
                                                >
                                                    <ProcessIcon />
                                                </IconButton>
                                            )}
                                            <IconButton
                                                size="small"
                                                onClick={() => removeFile(file.id)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                    </ListItemSecondaryAction>
                                </ListItem>
                                {index < uploadedFiles.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                </Paper>
            )}

            {/* Processing Results */}
            {processingResults.length > 0 && (
                <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                    <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                        Processing Results
                    </Typography>

                    {processingResults.map((result, index) => (
                        <Alert
                            key={index}
                            severity="success"
                            sx={{ mb: 2 }}
                            action={
                                <Button size="small" startIcon={<ViewIcon />}>
                                    View Details
                                </Button>
                            }
                        >
                            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                {result.fileName}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', mt: 0.5 }}>
                                Processed successfully • {result.extractedData?.shipments?.length || 0} shipments found
                            </Typography>
                        </Alert>
                    ))}
                </Paper>
            )}
        </Box>
    );
}
