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
    Divider,
    IconButton,
    Tooltip
} from '@mui/material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';

const PromptVersionManager = ({ carrierId }) => {
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [prompt, setPrompt] = useState('');
    const [newVersion, setNewVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        if (carrierId) {
            fetchVersions(carrierId);
        }
    }, [carrierId]);

    const fetchVersions = async (carrier) => {
        try {
            const response = await axios.get(`/api/edi-mapping/versions/${carrier}`);
            setVersions(response.data);
            if (response.data.length > 0) {
                setSelectedVersion(response.data[0].version);
                setPrompt(response.data[0].prompt);
            }
        } catch (error) {
            enqueueSnackbar('Failed to fetch versions', { variant: 'error' });
        }
    };

    const handleVersionChange = (version) => {
        setSelectedVersion(version);
        const versionData = versions.find(v => v.version === version);
        if (versionData) {
            setPrompt(versionData.prompt);
        }
    };

    const handleSaveVersion = async () => {
        if (!newVersion.trim()) {
            enqueueSnackbar('Please provide a version number', { variant: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/api/edi-mapping/versions/${carrierId}`, {
                prompt,
                version: newVersion,
                metadata: {
                    updatedBy: 'admin', // You might want to get this from your auth context
                    description: `Updated prompt for ${carrierId}`
                }
            });

            enqueueSnackbar('Version saved successfully', { variant: 'success' });
            fetchVersions(carrierId);
            setNewVersion('');
        } catch (error) {
            enqueueSnackbar('Failed to save version: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async () => {
        if (!selectedVersion) {
            enqueueSnackbar('Please select a version to rollback to', { variant: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/api/edi-mapping/versions/${carrierId}/rollback`, {
                version: selectedVersion
            });

            enqueueSnackbar('Successfully rolled back to version ' + selectedVersion, { variant: 'success' });
            fetchVersions(carrierId);
        } catch (error) {
            enqueueSnackbar('Failed to rollback: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Prompt Version Manager
                </Typography>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Version</InputLabel>
                            <Select
                                value={selectedVersion}
                                onChange={(e) => handleVersionChange(e.target.value)}
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

                    <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <TextField
                                label="New Version"
                                value={newVersion}
                                onChange={(e) => setNewVersion(e.target.value)}
                                placeholder="e.g., 1.0.1"
                                size="small"
                            />
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleSaveVersion}
                                disabled={loading || !newVersion.trim()}
                                startIcon={<SaveIcon />}
                            >
                                Save New Version
                            </Button>
                            <Tooltip title="Rollback to selected version">
                                <IconButton
                                    color="warning"
                                    onClick={handleRollback}
                                    disabled={loading || !selectedVersion}
                                >
                                    <RestoreIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            multiline
                            rows={12}
                            label="Prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            margin="normal"
                        />
                    </Grid>

                    {versions.length > 0 && (
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>
                                Version History
                            </Typography>
                            <Paper elevation={1} sx={{ p: 2 }}>
                                {versions.map((version) => (
                                    <Box
                                        key={version.version}
                                        sx={{
                                            p: 1,
                                            mb: 1,
                                            bgcolor: version.version === selectedVersion ? 'action.selected' : 'background.paper',
                                            borderRadius: 1
                                        }}
                                    >
                                        <Typography variant="body2">
                                            v{version.version} - {new Date(version.timestamp).toLocaleString()}
                                        </Typography>
                                        {version.metadata?.description && (
                                            <Typography variant="caption" color="text.secondary">
                                                {version.metadata.description}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            </CardContent>
        </Card>
    );
};

export default PromptVersionManager; 