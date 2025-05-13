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
            setTemplates(response.data);
            if (response.data.length > 0) {
                setSelectedTemplate(response.data[0].id);
            }
        } catch (error) {
            enqueueSnackbar('Failed to fetch templates', { variant: 'error' });
        }
    };

    const fetchVersions = async (carrier) => {
        try {
            const response = await axios.get(`/api/edi-mapping/versions/${carrier}`);
            setVersions(response.data);
            if (response.data.length > 0) {
                setSelectedVersion(response.data[0].version);
            }
        } catch (error) {
            enqueueSnackbar('Failed to fetch versions', { variant: 'error' });
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

            setTestResult(response.data);
            if (response.data.success) {
                enqueueSnackbar('Mapping test successful', { variant: 'success' });
                if (onMappingValidated) {
                    onMappingValidated(response.data.result);
                }
            } else {
                enqueueSnackbar('Mapping test failed: ' + response.data.error, { variant: 'error' });
            }
        } catch (error) {
            enqueueSnackbar('Failed to test mapping: ' + error.message, { variant: 'error' });
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
                                {templates.map((template) => (
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
                                {versions.map((version) => (
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
                                        Version: {testResult.metadata.version}
                                    </Typography>
                                    <Typography variant="body2">
                                        Timestamp: {new Date(testResult.metadata.timestamp).toLocaleString()}
                                    </Typography>
                                </Paper>
                            ) : (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    {testResult.error}
                                </Alert>
                            )}

                            {testResult.success && (
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