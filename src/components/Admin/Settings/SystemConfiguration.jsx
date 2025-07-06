import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    IconButton,
    Tooltip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Settings as SettingsIcon,
    Save as SaveIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    LocalShipping as ShippingIcon,
    Build as ServiceIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { app } from '../../../firebase/firebase';

const SystemConfiguration = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const db = getFirestore(app);

    // Additional Services State
    const [additionalServices, setAdditionalServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(false);
    const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [serviceForm, setServiceForm] = useState({
        type: 'freight',
        code: '',
        label: '',
        description: '',
        enabled: true,
        sortOrder: 0
    });

    useEffect(() => {
        loadConfiguration();
    }, []);

    const loadConfiguration = async () => {
        try {
            setLoading(true);
            await loadAdditionalServices();
        } catch (error) {
            console.error('Error loading configuration:', error);
            enqueueSnackbar('Failed to load system configuration', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadAdditionalServices = async () => {
        try {
            setServicesLoading(true);
            const servicesQuery = query(
                collection(db, 'shipmentServices'),
                orderBy('type'),
                orderBy('sortOrder'),
                orderBy('label')
            );

            const servicesSnapshot = await getDocs(servicesQuery);
            const services = servicesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setAdditionalServices(services);
        } catch (error) {
            console.error('Error loading additional services:', error);
            enqueueSnackbar('Failed to load additional services', { variant: 'error' });
        } finally {
            setServicesLoading(false);
        }
    };

    const handleServiceFormChange = (field, value) => {
        setServiceForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddService = () => {
        setEditingService(null);
        setServiceForm({
            type: 'freight',
            code: '',
            label: '',
            description: '',
            enabled: true,
            sortOrder: additionalServices.length
        });
        setServiceDialogOpen(true);
    };

    const handleEditService = (service) => {
        setEditingService(service);
        setServiceForm({
            type: service.type || 'freight',
            code: service.code || '',
            label: service.label || '',
            description: service.description || '',
            enabled: service.enabled !== false,
            sortOrder: service.sortOrder || 0
        });
        setServiceDialogOpen(true);
    };

    const handleSaveService = async () => {
        try {
            setSaving(true);

            // Validate required fields
            if (!serviceForm.code.trim() || !serviceForm.label.trim()) {
                enqueueSnackbar('Code and Label are required fields', { variant: 'error' });
                return;
            }

            // Check for duplicate codes (excluding current service if editing)
            const duplicateService = additionalServices.find(service =>
                service.code === serviceForm.code.trim() &&
                service.type === serviceForm.type &&
                service.id !== editingService?.id
            );

            if (duplicateService) {
                enqueueSnackbar(`A ${serviceForm.type} service with code "${serviceForm.code}" already exists`, { variant: 'error' });
                return;
            }

            const serviceData = {
                type: serviceForm.type,
                code: serviceForm.code.trim().toUpperCase(),
                label: serviceForm.label.trim(),
                description: serviceForm.description.trim(),
                enabled: serviceForm.enabled,
                sortOrder: parseInt(serviceForm.sortOrder) || 0,
                updatedAt: serverTimestamp()
            };

            if (editingService) {
                // Update existing service
                await updateDoc(doc(db, 'shipmentServices', editingService.id), serviceData);
                enqueueSnackbar('Additional service updated successfully', { variant: 'success' });
            } else {
                // Create new service
                serviceData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'shipmentServices'), serviceData);
                enqueueSnackbar('Additional service created successfully', { variant: 'success' });
            }

            setServiceDialogOpen(false);
            await loadAdditionalServices();
        } catch (error) {
            console.error('Error saving service:', error);
            enqueueSnackbar('Failed to save additional service', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteService = async (service) => {
        if (!window.confirm(`Are you sure you want to delete the service "${service.label}"? This action cannot be undone.`)) {
            return;
        }

        try {
            setSaving(true);
            await deleteDoc(doc(db, 'shipmentServices', service.id));
            enqueueSnackbar('Additional service deleted successfully', { variant: 'success' });
            await loadAdditionalServices();
        } catch (error) {
            console.error('Error deleting service:', error);
            enqueueSnackbar('Failed to delete additional service', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        loadConfiguration();
        enqueueSnackbar('Configuration refreshed', { variant: 'info' });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                borderBottom: '1px solid #e5e7eb',
                pb: 2
            }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', fontSize: '20px' }}>
                        System Configuration
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mt: 0.5 }}>
                        Configure system components and additional services
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh Configuration">
                        <IconButton onClick={handleRefresh} size="small">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Configuration Sections */}
            <Grid container spacing={3}>
                {/* Additional Services Section */}
                <Grid item xs={12}>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ServiceIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Shipment Additional Services
                                </Typography>
                                <Chip
                                    label={`${additionalServices.length} services`}
                                    size="small"
                                    sx={{ fontSize: '10px', ml: 1 }}
                                    color="primary"
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Manage additional services available for freight and courier shipments
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddService}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Add Service
                                </Button>
                            </Box>

                            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Code</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Label</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Description</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '120px' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {servicesLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3 }}>
                                                    <CircularProgress size={24} />
                                                </TableCell>
                                            </TableRow>
                                        ) : additionalServices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                    No additional services configured. Click "Add Service" to get started.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            additionalServices.map((service) => (
                                                <TableRow key={service.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Chip
                                                            label={service.type === 'freight' ? 'Freight' : 'Courier'}
                                                            size="small"
                                                            color={service.type === 'freight' ? 'primary' : 'secondary'}
                                                            sx={{ fontSize: '10px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {service.code}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {service.label}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        {service.description || '-'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Chip
                                                            label={service.enabled ? 'Enabled' : 'Disabled'}
                                                            size="small"
                                                            color={service.enabled ? 'success' : 'default'}
                                                            sx={{ fontSize: '10px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                            <Tooltip title="Edit Service">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleEditService(service)}
                                                                    sx={{ color: '#6b7280' }}
                                                                >
                                                                    <EditIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete Service">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleDeleteService(service)}
                                                                    sx={{ color: '#ef4444' }}
                                                                >
                                                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Future Configuration Sections */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SettingsIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Future Configuration Options
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                Additional system configuration options will be added here in future updates.
                            </Typography>
                        </AccordionDetails>
                    </Accordion>
                </Grid>
            </Grid>

            {/* Service Dialog */}
            <Dialog
                open={serviceDialogOpen}
                onClose={() => setServiceDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingService ? 'Edit Additional Service' : 'Add Additional Service'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service Type</InputLabel>
                                <Select
                                    value={serviceForm.type}
                                    onChange={(e) => handleServiceFormChange('type', e.target.value)}
                                    label="Service Type"
                                    sx={{
                                        fontSize: '12px',
                                        '& .MuiSelect-select': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                >
                                    <MenuItem value="freight" sx={{ fontSize: '12px' }}>Freight</MenuItem>
                                    <MenuItem value="courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Service Code"
                                value={serviceForm.code}
                                onChange={(e) => handleServiceFormChange('code', e.target.value.toUpperCase())}
                                size="small"
                                required
                                placeholder="e.g., LIFTGATE"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Unique identifier for this service"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Service Label"
                                value={serviceForm.label}
                                onChange={(e) => handleServiceFormChange('label', e.target.value)}
                                size="small"
                                required
                                placeholder="e.g., Lift-Gate Service Pickup"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Display name for this service"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={serviceForm.description}
                                onChange={(e) => handleServiceFormChange('description', e.target.value)}
                                size="small"
                                multiline
                                rows={2}
                                placeholder="Optional description of this service"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Optional additional information about this service"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Sort Order"
                                type="number"
                                value={serviceForm.sortOrder}
                                onChange={(e) => handleServiceFormChange('sortOrder', e.target.value)}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Order in which this service appears"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={serviceForm.enabled}
                                        onChange={(e) => handleServiceFormChange('enabled', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Service Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setServiceDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveService}
                        variant="contained"
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Saving...' : 'Save Service'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SystemConfiguration; 