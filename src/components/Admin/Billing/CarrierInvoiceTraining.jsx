import React, { useState, useEffect, useMemo } from 'react';
import { Box, Paper, Typography, Button, Grid, Chip, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Drawer, Autocomplete } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import { db } from '../../../firebase';
import { collection, getDocs, query, orderBy, limit as fbLimit } from 'firebase/firestore';

export default function CarrierInvoiceTraining() {
    const { enqueueSnackbar } = useSnackbar();
    const [carrierId, setCarrierId] = useState('');
    const [samples, setSamples] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [trained, setTrained] = useState([]);
    // Invoice carriers are NOT the same as system carriers. Use invoice-carrier identities.
    const invoiceCarriers = useMemo(() => ([
        { id: 'purolator', name: 'Purolator' },
        { id: 'canadapost', name: 'Canada Post' },
        { id: 'fedex', name: 'FedEx' },
        { id: 'ups', name: 'UPS' },
        { id: 'canpar', name: 'Canpar' },
        { id: 'dhl', name: 'DHL' },
        { id: 'tnt', name: 'TNT' },
        { id: 'landliner', name: 'Landliner Inc' },
        // Add more invoice carriers as needed. Auto-Detect is intentionally excluded for training selection.
    ]), []);

    // Merge static list with dynamically trained carriers
    const carrierOptions = useMemo(() => {
        const map = new Map();
        invoiceCarriers.forEach(c => map.set(c.id, { id: c.id, name: c.name }));
        (trained || []).forEach(row => {
            const id = row?.carrierId;
            if (!id) return;
            const name = row?.name || id;
            map.set(id, { id, name });
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [invoiceCarriers, trained]);
    const [templateName, setTemplateName] = useState('');
    const [templateThreshold, setTemplateThreshold] = useState(0.85);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [coverageByTemplate, setCoverageByTemplate] = useState({});
    const [previewSampleId, setPreviewSampleId] = useState('');

    const onDrop = async (acceptedFiles) => {
        if (!carrierId) {
            enqueueSnackbar('Select a carrier first', { variant: 'warning' });
            return;
        }
        setIsUploading(true);
        try {
            const filesPayload = await Promise.all(acceptedFiles.map(async (file) => {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                return { fileName: file.name, base64 };
            }));
            const uploadFn = httpsCallable(functions, 'uploadTrainingSamples');
            const res = await uploadFn({ carrierId, samples: filesPayload });
            if (res.data.success) {
                enqueueSnackbar(`Uploaded ${res.data.results.length} sample(s)`, { variant: 'success' });
                setSamples(prev => [...prev, ...res.data.results.map(r => ({ exampleId: r.exampleId, status: 'uploaded' }))]);
            } else {
                enqueueSnackbar(res.data.message || 'Upload failed', { variant: 'error' });
            }
        } catch (e) {
            enqueueSnackbar(e.message, { variant: 'error' });
        } finally {
            setIsUploading(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] } });

    const handleExtractFeatures = async () => {
        if (!carrierId || samples.length === 0) return;
        setIsExtracting(true);
        try {
            const extractFn = httpsCallable(functions, 'extractTrainingFeatures');
            let updated = 0;
            for (const s of samples) {
                if (!s.exampleId) continue;
                const res = await extractFn({ carrierId, exampleId: s.exampleId });
                if (res.data.success) {
                    updated += 1;
                }
            }
            enqueueSnackbar(`Extracted features for ${updated} sample(s)`, { variant: 'success' });
        } catch (e) {
            enqueueSnackbar(e.message, { variant: 'error' });
        } finally {
            setIsExtracting(false);
        }
    };

    const handleBuildTemplate = async () => {
        try {
            const exampleIds = samples.map(s => s.exampleId).filter(Boolean);
            if (!carrierId || exampleIds.length === 0) {
                enqueueSnackbar('Select a carrier and upload samples first', { variant: 'warning' });
                return;
            }
            const upsertFn = httpsCallable(functions, 'upsertCarrierTemplate');
            const res = await upsertFn({ carrierId, exampleIds, confidenceThreshold: Number(templateThreshold) || 0.85, templateName });
            if (res.data.success) {
                enqueueSnackbar('Template created/updated', { variant: 'success' });
                setTemplateName('');
                await handleRefreshLists();
                // Refresh global trained list so the directory shows immediately
                try {
                    const listTrained = httpsCallable(functions, 'listTrainedCarriers');
                    const trainedRes = await listTrained({});
                    if (trainedRes.data.success) setTrained(trainedRes.data.items || []);
                } catch { }
            } else {
                enqueueSnackbar(res.data.message || 'Template update failed', { variant: 'error' });
            }
        } catch (e) {
            enqueueSnackbar(e.message, { variant: 'error' });
        }
    };

    const handleRefreshLists = async () => {
        try {
            if (!carrierId) return;
            const listSamples = httpsCallable(functions, 'listTrainingSamples');
            const listTemplates = httpsCallable(functions, 'listCarrierTemplates');
            const [sRes, tRes] = await Promise.all([
                listSamples({ carrierId }),
                listTemplates({ carrierId })
            ]);
            if (sRes.data.success) setSamples(sRes.data.items.map(i => ({ exampleId: i.id, ...i })));
            if (tRes.data.success) setTemplates(tRes.data.items);
            // load coverage summary
            const summaryFn = httpsCallable(functions, 'getTrainingSummary');
            const sumRes = await summaryFn({ carrierId });
            if (sumRes.data.success) {
                const map = {};
                (sumRes.data.coverage || []).forEach(c => { map[c.templateId] = c.percent; });
                setCoverageByTemplate(map);
            }
        } catch (e) {
            enqueueSnackbar(e.message, { variant: 'error' });
        }
    };

    useEffect(() => {
        handleRefreshLists();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carrierId]);

    // Load carriers list and trained summary
    useEffect(() => {
        const load = async () => {
            try {
                const listTrained = httpsCallable(functions, 'listTrainedCarriers');
                const res = await listTrained({});
                if (res.data.success) setTrained(res.data.items || []);
            } catch (e) {
                // non-blocking
            }
        };
        load();
    }, []);

    const handleOpenTemplate = (t) => {
        setSelectedTemplate(t);
        setDrawerOpen(true);
    };

    const handleUpdateTemplateMeta = async () => {
        try {
            if (!selectedTemplate) return;
            const updateFn = httpsCallable(functions, 'updateCarrierTemplateMetadata');
            const res = await updateFn({ carrierId, templateId: selectedTemplate.id, name: selectedTemplate.name, confidenceThreshold: Number(selectedTemplate.confidenceThreshold) || 0.85 });
            if (res.data.success) {
                enqueueSnackbar('Template updated', { variant: 'success' });
                handleRefreshLists();
            } else {
                enqueueSnackbar(res.data.message || 'Update failed', { variant: 'error' });
            }
        } catch (e) {
            enqueueSnackbar(e.message, { variant: 'error' });
        }
    };

    return (
        <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>Invoice Training</Typography>
            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>Steps: 1) Pick a carrier 2) Upload invoices 3) Extract features 4) Name template & set threshold 5) Build/Update template</Typography>
            <Paper sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <Typography sx={{ fontSize: '12px', mb: 1 }}>Carrier</Typography>
                        <Autocomplete
                            size="small"
                            options={carrierOptions}
                            getOptionLabel={(o) => `${o.name} (${o.id})`}
                            value={carrierOptions.find(c => c.id === carrierId) || null}
                            onChange={(_, v) => setCarrierId(v?.id || '')}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Search carriers"
                                    size="small"
                                    InputProps={{
                                        ...params.InputProps,
                                        sx: { fontSize: '12px' }
                                    }}
                                    inputProps={{
                                        ...params.inputProps,
                                        style: { fontSize: '12px' }
                                    }}
                                />
                            )}
                            sx={{
                                '& .MuiAutocomplete-input': { fontSize: '12px' },
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiAutocomplete-option': { fontSize: '12px' }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={8}>
                        <Box {...getRootProps()} sx={{ p: 2, border: '1px dashed #9ca3af', borderRadius: 1, textAlign: 'center', cursor: 'pointer', backgroundColor: isDragActive ? '#f3f4f6' : 'transparent' }}>
                            <input {...getInputProps()} />
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Drag & drop PDF invoices here, or click to select files
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography sx={{ fontSize: '12px', mb: 1 }}>Template Name</Typography>
                        <TextField size="small" fullWidth value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g., Royal Layout v1" />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography sx={{ fontSize: '12px', mb: 1 }}>Confidence Threshold</Typography>
                        <TextField size="small" type="number" fullWidth value={templateThreshold} onChange={(e) => setTemplateThreshold(e.target.value)} inputProps={{ step: '0.01', min: '0', max: '1' }} />
                    </Grid>
                </Grid>
                {(isUploading || isExtracting) && <LinearProgress sx={{ mt: 2 }} />}
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={handleExtractFeatures} disabled={!samples.length}>Extract Features</Button>
                    <Button size="small" variant="contained" onClick={handleBuildTemplate} disabled={!samples.length}>Build/Update Template</Button>
                </Box>
            </Paper>
            <Paper sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>Trained Invoice Carriers</Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Carrier</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>ID</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Templates</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Avg Confidence</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Used</TableCell>
                                <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Last Used</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {trained.length === 0 ? (
                                <TableRow><TableCell colSpan={6} sx={{ fontSize: '12px', color: '#6b7280' }}>No trained carriers yet</TableCell></TableRow>
                            ) : trained.map(row => (
                                <TableRow key={row.carrierId} hover onClick={() => setCarrierId(row.carrierId)} sx={{ cursor: 'pointer' }}>
                                    <TableCell sx={{ fontSize: '12px' }}>{row.name}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{row.carrierId}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{row.templates}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{Math.round((row.avgConfidence || 0) * 100)}%</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{row.used || 0}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 2, border: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>Samples</Typography>
                            <Button size="small" onClick={handleRefreshLists}>Refresh</Button>
                        </Box>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Example ID</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Layout Hash</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Created</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {samples.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} sx={{ fontSize: '12px', color: '#6b7280' }}>No samples</TableCell>
                                        </TableRow>
                                    ) : samples.map(s => (
                                        <TableRow key={s.exampleId} hover>
                                            <TableCell sx={{ fontSize: '12px' }}>{s.exampleId}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{s.status || '-'}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{s.layoutHash || '-'}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 2, border: '1px solid #e5e7eb' }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>Templates</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {templates.length === 0 ? (
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No templates</Typography>
                            ) : templates.map(t => (
                                <Box key={t.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Button size="small" onClick={() => handleOpenTemplate(t)} sx={{ textTransform: 'none', fontSize: '12px' }}>v{t.version || 1} • {t.name || 'Unnamed'} • {t.layoutHash || 'default'}</Button>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {coverageByTemplate[t.id] !== undefined && (
                                            <Box sx={{ width: 80 }}>
                                                <LinearProgress variant="determinate" value={Math.round(coverageByTemplate[t.id] * 100)} sx={{ height: 6, borderRadius: 1 }} />
                                            </Box>
                                        )}
                                        <Chip size="small" label={`Conf ≥ ${Math.round((t.confidenceThreshold || 0.85) * 100)}%`} sx={{ fontSize: '10px' }} />
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
            <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <Box sx={{ width: 420, p: 2 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 1 }}>Template Details</Typography>
                    {selectedTemplate && (
                        <>
                            <TextField label="Name" size="small" fullWidth sx={{ mb: 1 }} value={selectedTemplate.name || ''} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })} />
                            <TextField label="Confidence Threshold" type="number" size="small" fullWidth sx={{ mb: 2 }} value={selectedTemplate.confidenceThreshold || 0.85} onChange={(e) => setSelectedTemplate({ ...selectedTemplate, confidenceThreshold: e.target.value })} />
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 0.5 }}>Preview</Typography>
                            <Autocomplete
                                size="small"
                                options={((() => {
                                    const hash = selectedTemplate.layoutHash;
                                    const byHash = hash ? samples.filter(s => s.layoutHash === hash) : samples;
                                    return (byHash && byHash.length > 0) ? byHash : samples;
                                })())}
                                getOptionLabel={(o) => o.exampleId}
                                value={samples.find(s => s.exampleId === previewSampleId) || null}
                                onChange={(_, v) => setPreviewSampleId(v?.exampleId || '')}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Select a sample"
                                        size="small"
                                        InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '12px' }
                                        }}
                                        inputProps={{
                                            ...params.inputProps,
                                            style: { fontSize: '12px' }
                                        }}
                                    />
                                )}
                                sx={{
                                    '& .MuiAutocomplete-input': { fontSize: '12px' },
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiAutocomplete-option': { fontSize: '12px' }
                                }}
                                sx={{ mb: 1 }}
                            />
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <Button size="small" variant="outlined" disabled={!previewSampleId} onClick={() => {
                                    const smp = samples.find(s => s.exampleId === previewSampleId);
                                    if (smp?.downloadURL) window.open(smp.downloadURL, '_blank');
                                }}>Open PDF</Button>
                                <Button size="small" variant="contained" disabled={!previewSampleId} onClick={async () => {
                                    try {
                                        const smp = samples.find(s => s.exampleId === previewSampleId);
                                        if (!smp) return;
                                        const fn = httpsCallable(functions, 'processPdfFile');
                                        await fn({ fileName: smp.fileName || `${smp.exampleId}.pdf`, uploadUrl: smp.downloadURL, carrier: carrierId, settings: { apMode: true } });
                                        enqueueSnackbar('Preview parsing started. Check AP Processing for results.', { variant: 'info' });
                                    } catch (e) {
                                        enqueueSnackbar(e.message, { variant: 'error' });
                                    }
                                }}>Run Parse Preview</Button>
                            </Box>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 0.5 }}>Header Tokens</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                {(selectedTemplate.anchors?.headerTokens || []).map((t, i) => (
                                    <Chip key={`${t}-${i}`} size="small" label={t} sx={{ fontSize: '10px' }} />
                                ))}
                            </Box>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 0.5 }}>Column Headers</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                {(selectedTemplate.anchors?.columnHeaders || []).map((t, i) => (
                                    <Chip key={`${t}-${i}`} size="small" label={t} sx={{ fontSize: '10px' }} />
                                ))}
                            </Box>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 0.5 }}>Table Schema</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Header</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Key</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Type</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(selectedTemplate.tableSchema || []).map((c, i) => (
                                        <TableRow key={`${c.key}-${i}`}>
                                            <TableCell sx={{ fontSize: '12px' }}>{c.header}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{c.key}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{c.type}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                <Button size="small" variant="contained" onClick={handleUpdateTemplateMeta}>Save</Button>
                                <Button size="small" variant="outlined" onClick={() => setDrawerOpen(false)}>Close</Button>
                            </Box>
                        </>
                    )}
                </Box>
            </Drawer>
        </Box>
    );
}


