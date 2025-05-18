import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Typography,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Alert,
    CircularProgress,
    Paper,
    Divider
} from '@mui/material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

const MappingTest = ({ carrierId, onMappingValidated }) => {
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [sampleData, setSampleData] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        fetchTemplates();
        if (carrierId) {
            fetchVersions(carrierId);
        }
    }, [carrierId]);

    const fetchTemplates = async () => {
        try {
            const response = await axios.get('/api/edi-mapping/templates');
            const templatesData = response.data || [];
            setTemplates(templatesData);
            if (templatesData.length > 0) {
                setSelectedTemplate(templatesData[0].id);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            enqueueSnackbar('Failed to fetch templates', { variant: 'error' });
            setTemplates([]);
        }
    };

    const fetchVersions = async (carrier) => {
        try {
            const response = await axios.get(`/api/edi-mapping/versions/${carrier}`);
            const versionsData = response.data || [];
            setVersions(versionsData);
            if (versionsData.length > 0) {
                setSelectedVersion(versionsData[0].version);
            }
        } catch (error) {
            console.error('Error fetching versions:', error);
            enqueueSnackbar('Failed to fetch versions', { variant: 'error' });
            setVersions([]);
        }
    };

    const handleTest = async () => {
        if (!sampleData.trim()) {
            enqueueSnackbar('Please provide sample data', { variant: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/edi-mapping/test', {
                carrierId: selectedTemplate,
                sampleData,
                version: selectedVersion
            });

            const result = response.data || {};
            setTestResult(result);

            if (result.success) {
                enqueueSnackbar('Mapping test successful', { variant: 'success' });
                if (onMappingValidated) {
                    onMappingValidated(result.result);
                }
            } else {
                enqueueSnackbar('Mapping test failed: ' + (result.error || 'Unknown error'), { variant: 'error' });
            }
        } catch (error) {
            console.error('Error testing mapping:', error);
            enqueueSnackbar('Failed to test mapping: ' + (error.message || 'Unknown error'), { variant: 'error' });
            setTestResult({ success: false, error: error.message || 'Unknown error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Test EDI Mapping
                </Typography>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Template</InputLabel>
                            <Select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                label="Template"
                            >
                                {Array.isArray(templates) && templates.map((template) => (
                                    <MenuItem key={template.id} value={template.id}>
                                        {template.name} (v{template.version})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Version</InputLabel>
                            <Select
                                value={selectedVersion}
                                onChange={(e) => setSelectedVersion(e.target.value)}
                                label="Version"
                            >
                                {Array.isArray(versions) && versions.map((version) => (
                                    <MenuItem key={version.version} value={version.version}>
                                        v{version.version} ({new Date(version.timestamp).toLocaleDateString()})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            multiline
                            rows={6}
                            label="Sample Data"
                            value={sampleData}
                            onChange={(e) => setSampleData(e.target.value)}
                            placeholder="Paste your sample CSV data here..."
                            margin="normal"
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleTest}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={20} /> : null}
                        >
                            Test Mapping
                        </Button>
                    </Grid>

                    {testResult && (
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                Test Results
                            </Typography>

                            {testResult.success ? (
                                <Paper elevation={2} sx={{ p: 2, bgcolor: 'success.light' }}>
                                    <Typography variant="subtitle1" color="success.dark">
                                        Mapping Test Successful
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                        Version: {testResult.metadata?.version || 'N/A'}
                                    </Typography>
                                    <Typography variant="body2">
                                        Timestamp: {testResult.metadata?.timestamp ? new Date(testResult.metadata.timestamp).toLocaleString() : 'N/A'}
                                    </Typography>
                                </Paper>
                            ) : (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    {testResult.error || 'Unknown error occurred'}
                                </Alert>
                            )}

                            {testResult.success && testResult.result && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Validation Results:
                                    </Typography>
                                    <pre style={{
                                        backgroundColor: '#f5f5f5',
                                        padding: '1rem',
                                        borderRadius: '4px',
                                        overflow: 'auto',
                                        maxHeight: '300px'
                                    }}>
                                        {JSON.stringify(testResult.result, null, 2)}
                                    </pre>
                                </Box>
                            )}
                        </Grid>
                    )}
                </Grid>
            </CardContent>
        </Card>
    );
};

export default MappingTest; 