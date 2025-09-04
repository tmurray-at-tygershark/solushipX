import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    TextField,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    Grid,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    AutoAwesome as AIIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    ExpandMore as ExpandMoreIcon,
    Refresh as RefreshIcon,
    Psychology as BrainIcon
} from '@mui/icons-material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSnackbar } from 'notistack';

const CarrierPromptManager = ({ carrierId, carrierName, onClose }) => {
    const [prompt, setPrompt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editedPrompt, setEditedPrompt] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState(null);
    
    const functions = getFunctions();
    const { enqueueSnackbar } = useSnackbar();

    // Load existing prompt
    const loadPrompt = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const generateCarrierPrompt = httpsCallable(functions, 'generateCarrierPrompt');
            const result = await generateCarrierPrompt({
                carrierId,
                regenerate: false
            });

            if (result.data.success) {
                setPrompt(result.data.prompt);
                setEditedPrompt(result.data.prompt.generatedPrompt || '');
            } else {
                setError(result.data.error);
            }
        } catch (err) {
            console.error('Error loading carrier prompt:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [carrierId, functions]);

    // Test training data
    const testTrainingData = useCallback(async () => {
        try {
            const testPromptGenerator = httpsCallable(functions, 'testPromptGenerator');
            const result = await testPromptGenerator({ carrierId });
            
            if (result.data) {
                console.log('🔍 Training Data Test Results:', result.data);
                
                // Log each test result individually for better visibility
                if (result.data.tests) {
                    result.data.tests.forEach((test, index) => {
                        console.log(`📋 Test ${index + 1}: ${test.test}`, test);
                        if (test.result) {
                            console.log(`  ✅ SUCCESS: Found ${test.count || 0} items`);
                            if (test.samples) {
                                console.log(`  📄 Samples:`, test.samples);
                            }
                        } else {
                            console.log(`  ❌ FAILED: ${test.error || 'No data found'}`);
                        }
                        console.log(`  📝 Details:`, test);
                    });
                }
                
                enqueueSnackbar('Test completed - check console for detailed breakdown', { variant: 'info' });
            } else {
                console.error('Test failed: No data returned');
                enqueueSnackbar('Test failed: No data returned', { variant: 'error' });
            }
        } catch (err) {
            console.error('Test error:', err);
            enqueueSnackbar(`Test error: ${err.message}`, { variant: 'error' });
        }
    }, [carrierId, functions, enqueueSnackbar]);

    // Generate new prompt
    const generatePrompt = useCallback(async () => {
        setGenerating(true);
        setError(null);
        
        try {
            const generateCarrierPrompt = httpsCallable(functions, 'generateCarrierPrompt');
            const result = await generateCarrierPrompt({
                carrierId,
                regenerate: true
            });

            if (result.data.success) {
                setPrompt(result.data.prompt);
                setEditedPrompt(result.data.prompt.generatedPrompt || '');
                enqueueSnackbar('AI-generated carrier prompt created successfully!', { variant: 'success' });
            } else {
                setError(result.data.error);
                enqueueSnackbar(`Failed to generate prompt: ${result.data.error}`, { variant: 'error' });
            }
        } catch (err) {
            console.error('Error generating carrier prompt:', err);
            setError(err.message);
            enqueueSnackbar(`Error generating prompt: ${err.message}`, { variant: 'error' });
        } finally {
            setGenerating(false);
        }
    }, [carrierId, functions, enqueueSnackbar]);

    // Save prompt modifications
    const savePromptModifications = useCallback(async () => {
        if (!editedPrompt.trim()) {
            enqueueSnackbar('Prompt cannot be empty', { variant: 'warning' });
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            const updateCarrierPrompt = httpsCallable(functions, 'updateCarrierPrompt');
            const result = await updateCarrierPrompt({
                carrierId,
                promptModifications: editedPrompt,
                notes: notes
            });

            if (result.data.success) {
                // Reload the prompt to get updated data
                await loadPrompt();
                setEditing(false);
                setNotes('');
                enqueueSnackbar('Carrier prompt updated successfully!', { variant: 'success' });
            } else {
                setError(result.data.error);
                enqueueSnackbar(`Failed to update prompt: ${result.data.error}`, { variant: 'error' });
            }
        } catch (err) {
            console.error('Error updating carrier prompt:', err);
            setError(err.message);
            enqueueSnackbar(`Error updating prompt: ${err.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, editedPrompt, notes, functions, enqueueSnackbar, loadPrompt]);

    useEffect(() => {
        loadPrompt();
    }, [loadPrompt]);

    const handleEditStart = () => {
        setEditing(true);
        setEditedPrompt(prompt?.generatedPrompt || '');
        setNotes('');
    };

    const handleEditCancel = () => {
        setEditing(false);
        setEditedPrompt(prompt?.generatedPrompt || '');
        setNotes('');
    };

    return (
        <Dialog 
            open={true} 
            onClose={onClose} 
            maxWidth="xl" 
            fullWidth
            sx={{ '& .MuiDialog-paper': { height: '90vh', maxHeight: '90vh' } }}
        >
            <DialogTitle sx={{ 
                fontSize: '18px', 
                fontWeight: 600,
                borderBottom: '1px solid #e5e7eb',
                pb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2
            }}>
                <BrainIcon sx={{ color: '#8b5cf6' }} />
                AI Prompt Manager - {carrierName}
            </DialogTitle>
            
            <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
                <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
                    {loading && !generating ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                            <CircularProgress />
                            <Typography sx={{ ml: 2, fontSize: '14px' }}>Loading carrier prompt...</Typography>
                        </Box>
                    ) : error ? (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    ) : (
                        <Grid container spacing={3}>
                            {/* Current Prompt Status */}
                            <Grid item xs={12}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                                Prompt Status
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                {prompt ? (
                                                    <Chip 
                                                        label={`Version ${prompt.version}`} 
                                                        color="primary" 
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                ) : null}
                                                {prompt?.isActive ? (
                                                    <Chip 
                                                        label="Active" 
                                                        color="success" 
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                ) : (
                                                    <Chip 
                                                        label="No Prompt" 
                                                        color="warning" 
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                )}
                                            </Box>
                                        </Box>
                                        
                                        {prompt ? (
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                        Training Data
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '14px' }}>
                                                        {prompt.trainingDataSummary?.sampleCount || 0} samples, {prompt.trainingDataSummary?.annotationTypes?.length || 0} annotation types
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                        Performance
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '14px' }}>
                                                        {prompt.performance?.testCount || 0} tests, {prompt.performance?.accuracy ? `${Math.round(prompt.performance.accuracy * 100)}% accuracy` : 'Not tested'}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        ) : (
                                            <Typography sx={{ fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
                                                No AI-generated prompt available. Generate one from your training data.
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Prompt Content */}
                            <Grid item xs={12}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                                Extraction Prompt
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                {prompt && !editing && (
                                                    <Button
                                                        startIcon={<EditIcon />}
                                                        size="small"
                                                        onClick={handleEditStart}
                                                        sx={{ fontSize: '12px' }}
                                                    >
                                                        Edit
                                                    </Button>
                                                )}
                                                {editing && (
                                                    <>
                                                        <Button
                                                            startIcon={<CancelIcon />}
                                                            size="small"
                                                            onClick={handleEditCancel}
                                                            sx={{ fontSize: '12px' }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            startIcon={<SaveIcon />}
                                                            size="small"
                                                            variant="contained"
                                                            onClick={savePromptModifications}
                                                            sx={{ fontSize: '12px' }}
                                                        >
                                                            Save
                                                        </Button>
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                        
                                        {editing ? (
                                            <Box>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={12}
                                                    value={editedPrompt}
                                                    onChange={(e) => setEditedPrompt(e.target.value)}
                                                    placeholder="Enter your custom extraction prompt..."
                                                    sx={{ mb: 2, fontSize: '12px' }}
                                                />
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={3}
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    placeholder="Add notes about your modifications..."
                                                    label="Modification Notes"
                                                    sx={{ fontSize: '12px' }}
                                                />
                                            </Box>
                                        ) : prompt ? (
                                            <Paper 
                                                elevation={0} 
                                                sx={{ 
                                                    p: 2, 
                                                    backgroundColor: '#f8fafc', 
                                                    border: '1px solid #e5e7eb',
                                                    maxHeight: '400px',
                                                    overflow: 'auto'
                                                }}
                                            >
                                                <Typography 
                                                    component="pre" 
                                                    sx={{ 
                                                        fontSize: '11px', 
                                                        fontFamily: 'monospace',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word'
                                                    }}
                                                >
                                                    {prompt.generatedPrompt}
                                                </Typography>
                                            </Paper>
                                        ) : (
                                            <Alert severity="info" sx={{ mb: 2 }}>
                                                Generate an AI prompt from your training data to get carrier-specific extraction instructions.
                                            </Alert>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* AI Analysis */}
                            {prompt?.analysisData && (
                                <Grid item xs={12}>
                                    <Accordion>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                AI Analysis & Patterns
                                            </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                        Detected Patterns
                                                    </Typography>
                                                    {prompt.analysisData.keyPatterns?.map((pattern, idx) => (
                                                        <Chip 
                                                            key={idx}
                                                            label={pattern}
                                                            size="small"
                                                            sx={{ fontSize: '10px', mr: 1, mb: 1 }}
                                                        />
                                                    ))}
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                        Field Locations
                                                    </Typography>
                                                    {Object.entries(prompt.analysisData.fieldLocations || {}).map(([field, location]) => (
                                                        <Typography key={field} sx={{ fontSize: '11px', mb: 0.5 }}>
                                                            <strong>{field}:</strong> {location}
                                                        </Typography>
                                                    ))}
                                                </Grid>
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </Box>
            </DialogContent>
            
            <DialogActions sx={{ borderTop: '1px solid #e5e7eb', p: 2 }}>
                <Button size="small" onClick={onClose} sx={{ fontSize: '12px' }}>
                    Close
                </Button>
                
                {generating ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography sx={{ fontSize: '12px' }}>Generating...</Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<BrainIcon />}
                            size="small"
                            onClick={testTrainingData}
                            sx={{ fontSize: '12px' }}
                        >
                            Test Training Data
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AIIcon />}
                            size="small"
                            onClick={generatePrompt}
                            sx={{ fontSize: '12px' }}
                        >
                            {prompt ? 'Regenerate AI Prompt' : 'Generate AI Prompt'}
                        </Button>
                    </Box>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default CarrierPromptManager;
