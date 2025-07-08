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
    Switch,
    Tabs,
    Tab,
    Divider
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
    Build as ServiceIcon,
    Speed as SpeedIcon,
    Category as CategoryIcon,
    List as ListIcon,
    ColorLens as ColorIcon
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../../firebase/firebase';

const SystemConfiguration = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const db = getFirestore(app);
    const functions = getFunctions();

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

    // Service Levels State
    const [serviceLevels, setServiceLevels] = useState([]);
    const [serviceLevelsLoading, setServiceLevelsLoading] = useState(false);
    const [serviceLevelDialogOpen, setServiceLevelDialogOpen] = useState(false);
    const [editingServiceLevel, setEditingServiceLevel] = useState(null);
    const [serviceLevelForm, setServiceLevelForm] = useState({
        type: 'freight',
        code: '',
        label: '',
        description: '',
        enabled: true,
        sortOrder: 0
    });

    // Shipment Statuses State
    const [activeTab, setActiveTab] = useState('master');
    const [masterStatuses, setMasterStatuses] = useState([]);
    const [shipmentStatuses, setShipmentStatuses] = useState([]);
    const [statusesLoading, setStatusesLoading] = useState(false);
    const [masterStatusDialogOpen, setMasterStatusDialogOpen] = useState(false);
    const [shipmentStatusDialogOpen, setShipmentStatusDialogOpen] = useState(false);
    const [editingMasterStatus, setEditingMasterStatus] = useState(null);
    const [editingShipmentStatus, setEditingShipmentStatus] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [masterStatusForm, setMasterStatusForm] = useState({
        label: '',
        displayLabel: '',
        description: '',
        color: '#6b7280',
        sortOrder: 0,
        enabled: true
    });
    const [shipmentStatusForm, setShipmentStatusForm] = useState({
        masterStatus: '',
        statusLabel: '',
        statusValue: '',
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
            await Promise.all([
                loadAdditionalServices(),
                loadServiceLevels(),
                loadMasterStatuses(),
                loadShipmentStatuses()
            ]);
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

    const loadServiceLevels = async () => {
        try {
            setServiceLevelsLoading(true);
            const serviceLevelsQuery = query(
                collection(db, 'serviceLevels'),
                orderBy('type'),
                orderBy('sortOrder'),
                orderBy('label')
            );

            const serviceLevelsSnapshot = await getDocs(serviceLevelsQuery);
            const levels = serviceLevelsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setServiceLevels(levels);
        } catch (error) {
            console.error('Error loading service levels:', error);
            enqueueSnackbar('Failed to load service levels', { variant: 'error' });
        } finally {
            setServiceLevelsLoading(false);
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

    const handleServiceLevelFormChange = (field, value) => {
        setServiceLevelForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddServiceLevel = () => {
        setEditingServiceLevel(null);
        setServiceLevelForm({
            type: 'freight',
            code: '',
            label: '',
            description: '',
            enabled: true,
            sortOrder: serviceLevels.length
        });
        setServiceLevelDialogOpen(true);
    };

    const handleEditServiceLevel = (serviceLevel) => {
        setEditingServiceLevel(serviceLevel);
        setServiceLevelForm({
            type: serviceLevel.type || 'freight',
            code: serviceLevel.code || '',
            label: serviceLevel.label || '',
            description: serviceLevel.description || '',
            enabled: serviceLevel.enabled !== false,
            sortOrder: serviceLevel.sortOrder || 0
        });
        setServiceLevelDialogOpen(true);
    };

    const handleSaveServiceLevel = async () => {
        try {
            setSaving(true);

            // Validate required fields
            if (!serviceLevelForm.code.trim() || !serviceLevelForm.label.trim()) {
                enqueueSnackbar('Code and Label are required fields', { variant: 'error' });
                return;
            }

            // Check for duplicate codes (excluding current service level if editing)
            const duplicateServiceLevel = serviceLevels.find(level =>
                level.code === serviceLevelForm.code.trim() &&
                level.type === serviceLevelForm.type &&
                level.id !== editingServiceLevel?.id
            );

            if (duplicateServiceLevel) {
                enqueueSnackbar(`A ${serviceLevelForm.type} service level with code "${serviceLevelForm.code}" already exists`, { variant: 'error' });
                return;
            }

            const serviceLevelData = {
                type: serviceLevelForm.type,
                code: serviceLevelForm.code.trim().toUpperCase(),
                label: serviceLevelForm.label.trim(),
                description: serviceLevelForm.description.trim(),
                enabled: serviceLevelForm.enabled,
                sortOrder: parseInt(serviceLevelForm.sortOrder) || 0,
                updatedAt: serverTimestamp()
            };

            if (editingServiceLevel) {
                // Update existing service level
                await updateDoc(doc(db, 'serviceLevels', editingServiceLevel.id), serviceLevelData);
                enqueueSnackbar('Service level updated successfully', { variant: 'success' });
            } else {
                // Create new service level
                serviceLevelData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'serviceLevels'), serviceLevelData);
                enqueueSnackbar('Service level created successfully', { variant: 'success' });
            }

            setServiceLevelDialogOpen(false);
            await loadServiceLevels();
        } catch (error) {
            console.error('Error saving service level:', error);
            enqueueSnackbar('Failed to save service level', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteServiceLevel = async (serviceLevel) => {
        if (!window.confirm(`Are you sure you want to delete the service level "${serviceLevel.label}"? This action cannot be undone.`)) {
            return;
        }

        try {
            setSaving(true);
            await deleteDoc(doc(db, 'serviceLevels', serviceLevel.id));
            enqueueSnackbar('Service level deleted successfully', { variant: 'success' });
            await loadServiceLevels();
        } catch (error) {
            console.error('Error deleting service level:', error);
            enqueueSnackbar('Failed to delete service level', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        loadConfiguration();
        enqueueSnackbar('Configuration refreshed', { variant: 'info' });
    };

    // Shipment Status Functions
    const loadMasterStatuses = async () => {
        try {
            setStatusesLoading(true);
            const getMasterStatusesFunction = httpsCallable(functions, 'getMasterStatuses');
            const result = await getMasterStatusesFunction();
            if (result.data?.success) {
                setMasterStatuses(result.data.data || []);
            }
        } catch (error) {
            console.error('Error loading master statuses:', error);
            enqueueSnackbar('Failed to load master statuses', { variant: 'error' });
        } finally {
            setStatusesLoading(false);
        }
    };

    const loadShipmentStatuses = async () => {
        try {
            setStatusesLoading(true);
            const getShipmentStatusesFunction = httpsCallable(functions, 'getShipmentStatuses');
            const result = await getShipmentStatusesFunction();
            if (result.data?.success) {
                setShipmentStatuses(result.data.data || []);
            }
        } catch (error) {
            console.error('Error loading shipment statuses:', error);
            enqueueSnackbar('Failed to load shipment statuses', { variant: 'error' });
        } finally {
            setStatusesLoading(false);
        }
    };

    const handleMasterStatusFormChange = (field, value) => {
        setMasterStatusForm(prev => ({ ...prev, [field]: value }));
    };

    const handleShipmentStatusFormChange = (field, value) => {
        setShipmentStatusForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAddMasterStatus = () => {
        setEditingMasterStatus(null);
        setMasterStatusForm({
            label: '',
            displayLabel: '',
            description: '',
            color: '#6b7280',
            sortOrder: masterStatuses.length,
            enabled: true
        });
        setMasterStatusDialogOpen(true);
    };

    const handleEditMasterStatus = (status) => {
        setEditingMasterStatus(status);
        setMasterStatusForm({
            label: status.label || '',
            displayLabel: status.displayLabel || '',
            description: status.description || '',
            color: status.color || '#6b7280',
            sortOrder: status.sortOrder || 0,
            enabled: status.enabled !== false
        });
        setMasterStatusDialogOpen(true);
    };

    const handleSaveMasterStatus = async () => {
        try {
            setSaving(true);

            if (!masterStatusForm.label.trim() || !masterStatusForm.displayLabel.trim()) {
                enqueueSnackbar('Label and Display Label are required', { variant: 'error' });
                return;
            }

            const statusData = {
                label: masterStatusForm.label.trim().toLowerCase(),
                displayLabel: masterStatusForm.displayLabel.trim(),
                description: masterStatusForm.description.trim(),
                color: masterStatusForm.color,
                sortOrder: parseInt(masterStatusForm.sortOrder) || 0,
                enabled: masterStatusForm.enabled
            };

            if (editingMasterStatus) {
                const updateFunction = httpsCallable(functions, 'updateMasterStatus');
                await updateFunction({ id: editingMasterStatus.id, ...statusData });
                enqueueSnackbar('Master status updated successfully', { variant: 'success' });
            } else {
                const createFunction = httpsCallable(functions, 'createMasterStatus');
                await createFunction(statusData);
                enqueueSnackbar('Master status created successfully', { variant: 'success' });
            }

            setMasterStatusDialogOpen(false);
            await loadMasterStatuses();
        } catch (error) {
            console.error('Error saving master status:', error);
            enqueueSnackbar('Failed to save master status', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleAddShipmentStatus = () => {
        setEditingShipmentStatus(null);
        setShipmentStatusForm({
            masterStatus: '',
            statusLabel: '',
            statusValue: '',
            description: '',
            enabled: true,
            sortOrder: shipmentStatuses.length
        });
        setShipmentStatusDialogOpen(true);
    };

    const handleEditShipmentStatus = (status) => {
        setEditingShipmentStatus(status);
        setShipmentStatusForm({
            masterStatus: status.masterStatus || '',
            statusLabel: status.statusLabel || '',
            statusValue: status.statusValue || '',
            description: status.description || '',
            enabled: status.enabled !== false,
            sortOrder: status.sortOrder || 0
        });
        setShipmentStatusDialogOpen(true);
    };

    const handleSaveShipmentStatus = async () => {
        try {
            setSaving(true);

            if (!shipmentStatusForm.masterStatus || !shipmentStatusForm.statusLabel.trim() || !shipmentStatusForm.statusValue.trim()) {
                enqueueSnackbar('Master Status, Status Label, and Status Value are required', { variant: 'error' });
                return;
            }

            const statusData = {
                masterStatus: shipmentStatusForm.masterStatus,
                statusLabel: shipmentStatusForm.statusLabel.trim(),
                statusValue: shipmentStatusForm.statusValue.trim().toLowerCase(),
                description: shipmentStatusForm.description.trim(),
                enabled: shipmentStatusForm.enabled,
                sortOrder: parseInt(shipmentStatusForm.sortOrder) || 0
            };

            if (editingShipmentStatus) {
                const updateFunction = httpsCallable(functions, 'updateShipmentStatus');
                await updateFunction({ id: editingShipmentStatus.id, ...statusData });
                enqueueSnackbar('Shipment status updated successfully', { variant: 'success' });
            } else {
                const createFunction = httpsCallable(functions, 'createShipmentStatus');
                await createFunction(statusData);
                enqueueSnackbar('Shipment status created successfully', { variant: 'success' });
            }

            setShipmentStatusDialogOpen(false);
            await loadShipmentStatuses();
        } catch (error) {
            console.error('Error saving shipment status:', error);
            enqueueSnackbar('Failed to save shipment status', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (type, item) => {
        setDeleteTarget({ type, item });
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        try {
            setSaving(true);
            const { type, item } = deleteTarget;

            if (type === 'master') {
                const deleteFunction = httpsCallable(functions, 'deleteMasterStatus');
                await deleteFunction({ id: item.id });
                enqueueSnackbar('Master status deleted successfully', { variant: 'success' });
                await loadMasterStatuses();
            } else {
                const deleteFunction = httpsCallable(functions, 'deleteShipmentStatus');
                await deleteFunction({ id: item.id });
                enqueueSnackbar('Shipment status deleted successfully', { variant: 'success' });
                await loadShipmentStatuses();
            }

            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        } catch (error) {
            console.error('Error deleting status:', error);
            enqueueSnackbar('Failed to delete status', { variant: 'error' });
        } finally {
            setSaving(false);
        }
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
                {/* Service Levels Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SpeedIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Service Levels
                                </Typography>
                                <Chip
                                    label={`${serviceLevels.length} levels`}
                                    size="small"
                                    sx={{ fontSize: '10px', ml: 1 }}
                                    color="secondary"
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Manage service levels available for freight and courier shipments
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddServiceLevel}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Add Service Level
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
                                        {serviceLevelsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3 }}>
                                                    <CircularProgress size={24} />
                                                </TableCell>
                                            </TableRow>
                                        ) : serviceLevels.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                    No service levels configured. Click "Add Service Level" to get started.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            serviceLevels.map((level) => (
                                                <TableRow key={level.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Chip
                                                            label={level.type === 'freight' ? 'Freight' : 'Courier'}
                                                            size="small"
                                                            color={level.type === 'freight' ? 'primary' : 'secondary'}
                                                            sx={{ fontSize: '10px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {level.code}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {level.label}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        {level.description || '-'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Chip
                                                            label={level.enabled ? 'Enabled' : 'Disabled'}
                                                            size="small"
                                                            color={level.enabled ? 'success' : 'default'}
                                                            sx={{ fontSize: '10px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                            <Tooltip title="Edit Service Level">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleEditServiceLevel(level)}
                                                                    sx={{ color: '#6b7280' }}
                                                                >
                                                                    <EditIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete Service Level">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleDeleteServiceLevel(level)}
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

                {/* Additional Services Section */}
                <Grid item xs={12}>
                    <Accordion>
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



                {/* Shipment Statuses Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ShippingIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Shipment Statuses
                                </Typography>
                                <Chip
                                    label={`${masterStatuses.length} master, ${shipmentStatuses.length} statuses`}
                                    size="small"
                                    sx={{ fontSize: '10px', ml: 1 }}
                                    color="primary"
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                                Configure master statuses and detailed shipment statuses for comprehensive status tracking.
                            </Typography>

                            {/* Tabs for Master Statuses and Shipment Statuses */}
                            <Box sx={{ width: '100%' }}>
                                <Tabs
                                    value={activeTab}
                                    onChange={(e, newValue) => setActiveTab(newValue)}
                                    sx={{
                                        mb: 3,
                                        '& .MuiTab-root': {
                                            fontSize: '12px',
                                            textTransform: 'none',
                                            fontWeight: 500
                                        }
                                    }}
                                >
                                    <Tab
                                        label={`Master Statuses (${masterStatuses.length})`}
                                        value="master"
                                        icon={<CategoryIcon sx={{ fontSize: 16 }} />}
                                        iconPosition="start"
                                    />
                                    <Tab
                                        label={`Shipment Statuses (${shipmentStatuses.length})`}
                                        value="shipment"
                                        icon={<ListIcon sx={{ fontSize: 16 }} />}
                                        iconPosition="start"
                                    />
                                </Tabs>

                                {/* Master Statuses Tab */}
                                {activeTab === 'master' && (
                                    <Box>
                                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Master statuses define high-level shipment states with colors and sorting
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                startIcon={<AddIcon />}
                                                onClick={handleAddMasterStatus}
                                                size="small"
                                                sx={{ fontSize: '12px' }}
                                            >
                                                Add Master Status
                                            </Button>
                                        </Box>

                                        <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Color</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Label</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Display Label</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Description</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Order</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '120px' }}>Actions</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {statusesLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3 }}>
                                                                <CircularProgress size={24} />
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : masterStatuses.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                                No master statuses configured. Click "Add Master Status" to get started.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        masterStatuses.map((status) => (
                                                            <TableRow key={status.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                                <TableCell sx={{ fontSize: '12px' }}>
                                                                    <Box
                                                                        sx={{
                                                                            width: 20,
                                                                            height: 20,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: status.color,
                                                                            border: '1px solid #e5e7eb'
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                                    {status.label}
                                                                </TableCell>
                                                                <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {status.displayLabel}
                                                                </TableCell>
                                                                <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                    {status.description || '-'}
                                                                </TableCell>
                                                                <TableCell sx={{ fontSize: '12px' }}>
                                                                    {status.sortOrder}
                                                                </TableCell>
                                                                <TableCell sx={{ fontSize: '12px' }}>
                                                                    <Chip
                                                                        label={status.enabled ? 'Enabled' : 'Disabled'}
                                                                        size="small"
                                                                        color={status.enabled ? 'success' : 'default'}
                                                                        sx={{ fontSize: '10px' }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell sx={{ fontSize: '12px' }}>
                                                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                                        <Tooltip title="Edit Master Status">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => handleEditMasterStatus(status)}
                                                                                sx={{ color: '#6b7280' }}
                                                                            >
                                                                                <EditIcon sx={{ fontSize: 16 }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        <Tooltip title="Delete Master Status">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => handleDeleteClick('master', status)}
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
                                    </Box>
                                )}

                                {/* Shipment Statuses Tab */}
                                {activeTab === 'shipment' && (
                                    <Box>
                                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Detailed shipment statuses that map to master statuses for granular tracking
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                startIcon={<AddIcon />}
                                                onClick={handleAddShipmentStatus}
                                                size="small"
                                                sx={{ fontSize: '12px' }}
                                            >
                                                Add Shipment Status
                                            </Button>
                                        </Box>

                                        <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Master Status</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status Label</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status Value</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Description</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Order</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '120px' }}>Actions</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {statusesLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3 }}>
                                                                <CircularProgress size={24} />
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : shipmentStatuses.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                                No shipment statuses configured. Click "Add Shipment Status" to get started.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        shipmentStatuses.map((status) => {
                                                            const masterStatus = masterStatuses.find(ms => ms.label === status.masterStatus);
                                                            return (
                                                                <TableRow key={status.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            {masterStatus && (
                                                                                <Box
                                                                                    sx={{
                                                                                        width: 12,
                                                                                        height: 12,
                                                                                        borderRadius: '50%',
                                                                                        backgroundColor: masterStatus.color,
                                                                                        border: '1px solid #e5e7eb'
                                                                                    }}
                                                                                />
                                                                            )}
                                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                {masterStatus?.displayLabel || status.masterStatus}
                                                                            </Typography>
                                                                        </Box>
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                        {status.statusLabel}
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                                        {status.statusValue}
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                        {status.description || '-'}
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                                        {status.sortOrder}
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                                        <Chip
                                                                            label={status.enabled ? 'Enabled' : 'Disabled'}
                                                                            size="small"
                                                                            color={status.enabled ? 'success' : 'default'}
                                                                            sx={{ fontSize: '10px' }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                                            <Tooltip title="Edit Shipment Status">
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => handleEditShipmentStatus(status)}
                                                                                    sx={{ color: '#6b7280' }}
                                                                                >
                                                                                    <EditIcon sx={{ fontSize: 16 }} />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                            <Tooltip title="Delete Shipment Status">
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => handleDeleteClick('shipment', status)}
                                                                                    sx={{ color: '#ef4444' }}
                                                                                >
                                                                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        </Box>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </Box>
                                )}
                            </Box>
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

            {/* Service Level Dialog */}
            <Dialog
                open={serviceLevelDialogOpen}
                onClose={() => setServiceLevelDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingServiceLevel ? 'Edit Service Level' : 'Add Service Level'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service Type</InputLabel>
                                <Select
                                    value={serviceLevelForm.type}
                                    onChange={(e) => handleServiceLevelFormChange('type', e.target.value)}
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
                                value={serviceLevelForm.code}
                                onChange={(e) => handleServiceLevelFormChange('code', e.target.value.toUpperCase())}
                                size="small"
                                required
                                placeholder="e.g., LTL_STANDARD"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Unique identifier for this service level"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Service Level Label"
                                value={serviceLevelForm.label}
                                onChange={(e) => handleServiceLevelFormChange('label', e.target.value)}
                                size="small"
                                required
                                placeholder="e.g., LTL Standard"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Display name for this service level"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={serviceLevelForm.description}
                                onChange={(e) => handleServiceLevelFormChange('description', e.target.value)}
                                size="small"
                                multiline
                                rows={2}
                                placeholder="Optional description of this service level"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Optional additional information about this service level"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Sort Order"
                                type="number"
                                value={serviceLevelForm.sortOrder}
                                onChange={(e) => handleServiceLevelFormChange('sortOrder', e.target.value)}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', opacity: 0.6 }
                                }}
                                helperText="Order in which this service level appears"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={serviceLevelForm.enabled}
                                        onChange={(e) => handleServiceLevelFormChange('enabled', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Service Level Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setServiceLevelDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveServiceLevel}
                        variant="contained"
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Saving...' : 'Save Service Level'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Master Status Dialog */}
            <Dialog
                open={masterStatusDialogOpen}
                onClose={() => setMasterStatusDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingMasterStatus ? 'Edit Master Status' : 'Add Master Status'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Status Label"
                                value={masterStatusForm.label}
                                onChange={(e) => handleMasterStatusFormChange('label', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                size="small"
                                required
                                placeholder="e.g., in_transit"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="Internal identifier (lowercase, underscores)"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Display Label"
                                value={masterStatusForm.displayLabel}
                                onChange={(e) => handleMasterStatusFormChange('displayLabel', e.target.value)}
                                size="small"
                                required
                                placeholder="e.g., In Transit"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="User-friendly display name"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={masterStatusForm.description}
                                onChange={(e) => handleMasterStatusFormChange('description', e.target.value)}
                                size="small"
                                multiline
                                rows={2}
                                placeholder="Optional description of this master status"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                    Status Color
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 1,
                                            backgroundColor: masterStatusForm.color,
                                            border: '1px solid #e5e7eb',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'color';
                                            input.value = masterStatusForm.color;
                                            input.onchange = (e) => handleMasterStatusFormChange('color', e.target.value);
                                            input.click();
                                        }}
                                    />
                                    <TextField
                                        value={masterStatusForm.color}
                                        onChange={(e) => handleMasterStatusFormChange('color', e.target.value)}
                                        size="small"
                                        sx={{
                                            flex: 1,
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                        placeholder="#6b7280"
                                    />
                                </Box>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="Sort Order"
                                type="number"
                                value={masterStatusForm.sortOrder}
                                onChange={(e) => handleMasterStatusFormChange('sortOrder', e.target.value)}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={masterStatusForm.enabled}
                                        onChange={(e) => handleMasterStatusFormChange('enabled', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setMasterStatusDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveMasterStatus}
                        variant="contained"
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Saving...' : 'Save Master Status'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Shipment Status Dialog */}
            <Dialog
                open={shipmentStatusDialogOpen}
                onClose={() => setShipmentStatusDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingShipmentStatus ? 'Edit Shipment Status' : 'Add Shipment Status'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel sx={{ fontSize: '12px' }}>Master Status</InputLabel>
                                <Select
                                    value={shipmentStatusForm.masterStatus}
                                    onChange={(e) => handleShipmentStatusFormChange('masterStatus', e.target.value)}
                                    label="Master Status"
                                    sx={{
                                        fontSize: '12px',
                                        '& .MuiSelect-select': { fontSize: '12px' }
                                    }}
                                >
                                    {masterStatuses.map((status) => (
                                        <MenuItem key={status.id} value={status.label} sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box
                                                    sx={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        backgroundColor: status.color,
                                                        border: '1px solid #e5e7eb'
                                                    }}
                                                />
                                                {status.displayLabel}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Status Label"
                                value={shipmentStatusForm.statusLabel}
                                onChange={(e) => handleShipmentStatusFormChange('statusLabel', e.target.value)}
                                size="small"
                                required
                                placeholder="e.g., In Customs"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="User-friendly status name"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Status Value"
                                value={shipmentStatusForm.statusValue}
                                onChange={(e) => handleShipmentStatusFormChange('statusValue', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                size="small"
                                required
                                placeholder="e.g., in_customs"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="Internal identifier (lowercase, underscores)"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={shipmentStatusForm.description}
                                onChange={(e) => handleShipmentStatusFormChange('description', e.target.value)}
                                size="small"
                                multiline
                                rows={2}
                                placeholder="Optional description of this shipment status"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Sort Order"
                                type="number"
                                value={shipmentStatusForm.sortOrder}
                                onChange={(e) => handleShipmentStatusFormChange('sortOrder', e.target.value)}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={shipmentStatusForm.enabled}
                                        onChange={(e) => handleShipmentStatusFormChange('enabled', e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setShipmentStatusDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveShipmentStatus}
                        variant="contained"
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Saving...' : 'Save Shipment Status'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteIcon sx={{ color: '#ef4444' }} />
                    Confirm Deletion
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '14px', mb: 2 }}>
                        Are you sure you want to delete this {deleteTarget?.type === 'master' ? 'master status' : 'shipment status'}?
                    </Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                        {deleteTarget?.item?.displayLabel || deleteTarget?.item?.statusLabel}
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#ef4444', mt: 2 }}>
                        ⚠️ This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} /> : <DeleteIcon />}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SystemConfiguration; 