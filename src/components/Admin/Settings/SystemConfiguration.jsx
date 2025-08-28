import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    CircularProgress,
    Tabs,
    Tab,
    Menu,
    MenuList,
    ListItemIcon,
    ListItemText,
    Tooltip,
    Popover,
    ClickAwayListener
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    DragIndicator as DragIcon,
    Category as CategoryIcon,
    List as ListIcon,
    Receipt as ReceiptIcon,
    MoreVert as MoreVertIcon,
    Settings as SettingsIcon,
    LocalShipping as ShipmentIcon,
    Close as CloseIcon,
    Refresh as RefreshIcon,
    Notifications as NotificationsIcon,
    Speed as SpeedIcon,
    Build as ServiceIcon,
    Assignment as TaskIcon,
    Construction as EquipmentIcon,
    CloudUpload as UploadIcon,
    Image as ImageIcon,
    Public as ShippingZoneIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    addDoc,
    query,
    orderBy,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import InvoiceStatusDialog from '../Configuration/dialogs/InvoiceStatusDialog';
import NotificationSettings from '../Configuration/NotificationSettings';
import ChargeTypesConfiguration from '../Configuration/ChargeTypesConfiguration';
import FollowUpTasksConfiguration from '../Configuration/FollowUpTasksConfiguration';
import ShippingZonesConfiguration from '../Configuration/ShippingZonesConfiguration';
import EnterpriseZoneManagement from '../Configuration/EnterpriseZoneManagement';
import SystemConfigurationSkeleton from './SystemConfigurationSkeleton';

const SystemConfiguration = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const db = getFirestore(app);
    const storage = getStorage(app);
    const functions = getFunctions();

    // Additional Services State
    const [additionalServices, setAdditionalServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(false);
    const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [serviceForm, setServiceForm] = useState({
        type: 'freight',
        serviceType: 'general',
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
    const [activeTab, setActiveTab] = useState('shipment');
    const [masterStatuses, setMasterStatuses] = useState([]);
    const [shipmentStatuses, setShipmentStatuses] = useState([]);
    const [statusesLoading, setStatusesLoading] = useState(false);
    const [masterStatusDialogOpen, setMasterStatusDialogOpen] = useState(false);
    const [shipmentStatusDialogOpen, setShipmentStatusDialogOpen] = useState(false);
    const [editingMasterStatus, setEditingMasterStatus] = useState(null);
    const [editingShipmentStatus, setEditingShipmentStatus] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Invoice Statuses State
    const [invoiceStatuses, setInvoiceStatuses] = useState([]);
    const [invoiceStatusDialogOpen, setInvoiceStatusDialogOpen] = useState(false);
    const [editingInvoiceStatus, setEditingInvoiceStatus] = useState(null);
    const [masterStatusForm, setMasterStatusForm] = useState({
        label: '',
        displayLabel: '',
        description: '',
        color: '#6b7280',
        fontColor: '#ffffff',
        enabled: true
    });
    const [colorPickerOpen, setColorPickerOpen] = useState(null); // 'background' or 'font'
    const [shipmentStatusForm, setShipmentStatusForm] = useState({
        masterStatus: '',
        statusLabel: '',
        statusValue: '',
        description: '',
        enabled: true
    });

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);
    const [contextMenuType, setContextMenuType] = useState(null); // 'master' or 'shipment'
    const [contextMenuData, setContextMenuData] = useState(null);

    // Equipment Types State
    const [equipmentTypes, setEquipmentTypes] = useState([]);
    const [equipmentLoading, setEquipmentLoading] = useState(false);
    const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState(null);
    const [equipmentForm, setEquipmentForm] = useState({
        name: '',
        category: 'Truck',
        code: '',
        description: '',
        imageUrl: ''
    });
    const [equipmentImageFile, setEquipmentImageFile] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [equipmentMenuAnchor, setEquipmentMenuAnchor] = useState(null);
    const [selectedEquipment, setSelectedEquipment] = useState(null);

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
                loadShipmentStatuses(),
                loadInvoiceStatuses(),
                loadEquipmentTypes()
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
            serviceType: service.serviceType || 'general',
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
                serviceType: serviceForm.serviceType,
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

    // Equipment Types Functions
    const loadEquipmentTypes = async () => {
        try {
            setEquipmentLoading(true);
            const equipmentQuery = query(
                collection(db, 'equipmentTypes'),
                orderBy('category'),
                orderBy('name')
            );

            const equipmentSnapshot = await getDocs(equipmentQuery);
            const equipment = equipmentSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setEquipmentTypes(equipment);
        } catch (error) {
            console.error('Error loading equipment types:', error);
            enqueueSnackbar('Failed to load equipment types', { variant: 'error' });
        } finally {
            setEquipmentLoading(false);
        }
    };

    const generateEquipmentCode = (name) => {
        // Remove special characters and spaces, convert to uppercase
        return name
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, '')
            .toUpperCase()
            .substring(0, 10); // Limit to 10 characters
    };

    const handleEquipmentFormChange = (field, value) => {
        setEquipmentForm(prev => {
            const updated = {
                ...prev,
                [field]: value
            };

            // Auto-generate code when name changes
            if (field === 'name' && value) {
                updated.code = generateEquipmentCode(value);
            }

            return updated;
        });
    };

    const handleAddEquipment = () => {
        setEditingEquipment(null);
        setEquipmentForm({
            name: '',
            category: 'Truck',
            code: '',
            description: '',
            imageUrl: ''
        });
        setEquipmentImageFile(null);
        setEquipmentDialogOpen(true);
    };

    const handleEditEquipment = (equipment) => {
        setEditingEquipment(equipment);
        setEquipmentForm({
            name: equipment.name || '',
            category: equipment.category || 'Truck',
            code: equipment.code || '',
            description: equipment.description || '',
            imageUrl: equipment.imageUrl || ''
        });
        setEquipmentImageFile(null);
        setEquipmentDialogOpen(true);
    };

    const handleUploadEquipmentImage = async () => {
        if (!equipmentImageFile) return null;

        try {
            setUploadingImage(true);
            const filename = `equipment-images/${Date.now()}-${equipmentImageFile.name}`;
            const imageRef = ref(storage, filename);

            await uploadBytes(imageRef, equipmentImageFile);
            const downloadURL = await getDownloadURL(imageRef);

            return downloadURL;
        } catch (error) {
            console.error('Error uploading image:', error);
            enqueueSnackbar('Failed to upload image', { variant: 'error' });
            throw error;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveEquipment = async () => {
        try {
            setSaving(true);

            // Validate required fields
            if (!equipmentForm.name.trim()) {
                enqueueSnackbar('Equipment name is required', { variant: 'error' });
                return;
            }

            // Check for duplicate codes (excluding current equipment if editing)
            const duplicateEquipment = equipmentTypes.find(equipment =>
                equipment.code === equipmentForm.code.trim() &&
                equipment.id !== editingEquipment?.id
            );

            if (duplicateEquipment) {
                enqueueSnackbar(`Equipment with code "${equipmentForm.code}" already exists`, { variant: 'error' });
                return;
            }

            // Upload image if selected
            let imageUrl = equipmentForm.imageUrl;
            if (equipmentImageFile) {
                imageUrl = await handleUploadEquipmentImage();
            }

            const equipmentData = {
                name: equipmentForm.name.trim(),
                category: equipmentForm.category,
                code: equipmentForm.code.trim().toUpperCase(),
                description: equipmentForm.description.trim(),
                imageUrl: imageUrl || '',
                updatedAt: serverTimestamp()
            };

            if (editingEquipment) {
                // Update existing equipment
                await updateDoc(doc(db, 'equipmentTypes', editingEquipment.id), equipmentData);
                enqueueSnackbar('Equipment type updated successfully', { variant: 'success' });
            } else {
                // Create new equipment
                equipmentData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'equipmentTypes'), equipmentData);
                enqueueSnackbar('Equipment type created successfully', { variant: 'success' });
            }

            setEquipmentDialogOpen(false);
            await loadEquipmentTypes();
        } catch (error) {
            console.error('Error saving equipment:', error);
            enqueueSnackbar('Failed to save equipment type', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEquipment = async (equipment) => {
        if (!window.confirm(`Are you sure you want to delete "${equipment.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            setSaving(true);

            // Delete image from storage if it exists
            if (equipment.imageUrl) {
                try {
                    const imageRef = ref(storage, equipment.imageUrl);
                    await deleteObject(imageRef);
                } catch (imageError) {
                    console.warn('Failed to delete equipment image:', imageError);
                    // Continue with equipment deletion even if image deletion fails
                }
            }

            await deleteDoc(doc(db, 'equipmentTypes', equipment.id));
            enqueueSnackbar('Equipment type deleted successfully', { variant: 'success' });
            await loadEquipmentTypes();
        } catch (error) {
            console.error('Error deleting equipment:', error);
            enqueueSnackbar('Failed to delete equipment type', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleEquipmentMenuOpen = (event, equipment) => {
        setEquipmentMenuAnchor(event.currentTarget);
        setSelectedEquipment(equipment);
    };

    const handleEquipmentMenuClose = () => {
        setEquipmentMenuAnchor(null);
        setSelectedEquipment(null);
    };

    const handleEquipmentMenuAction = (action) => {
        if (action === 'edit' && selectedEquipment) {
            handleEditEquipment(selectedEquipment);
        } else if (action === 'delete' && selectedEquipment) {
            handleDeleteEquipment(selectedEquipment);
        }
        handleEquipmentMenuClose();
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

    const loadInvoiceStatuses = async () => {
        try {
            setStatusesLoading(true);
            const getAllInvoiceStatusesFunction = httpsCallable(functions, 'getAllInvoiceStatuses');
            const result = await getAllInvoiceStatusesFunction();
            if (result.data?.success) {
                setInvoiceStatuses(result.data.invoiceStatuses || []);
            }
        } catch (error) {
            console.error('Error loading invoice statuses:', error);
            enqueueSnackbar('Failed to load invoice statuses', { variant: 'error' });
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
            fontColor: '#ffffff',
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
            fontColor: status.fontColor || '#ffffff',
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
                fontColor: masterStatusForm.fontColor,
                enabled: masterStatusForm.enabled
            };

            if (editingMasterStatus) {
                const updateFunction = httpsCallable(functions, 'updateMasterStatus');
                await updateFunction({ masterStatusId: editingMasterStatus.id, updates: statusData });
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
            enabled: true
        });
        setShipmentStatusDialogOpen(true);
    };

    const handleEditShipmentStatus = (status) => {
        setEditingShipmentStatus(status);
        setShipmentStatusForm({
            masterStatus: status.masterStatus || '',
            statusLabel: status.statusLabel || '',
            statusValue: status.statusValue || status.statusLabel || '', // Keep statusValue for display but map to statusLabel
            description: status.statusMeaning || status.description || '', // Map statusMeaning to description for form
            enabled: status.enabled !== false
        });
        setShipmentStatusDialogOpen(true);
    };

    const handleSaveShipmentStatus = async () => {
        try {
            setSaving(true);

            if (!shipmentStatusForm.masterStatus || !shipmentStatusForm.statusLabel.trim()) {
                enqueueSnackbar('Master Status and Status Label are required', { variant: 'error' });
                return;
            }

            const statusData = {
                masterStatus: shipmentStatusForm.masterStatus,
                statusLabel: shipmentStatusForm.statusLabel.trim(),
                statusMeaning: shipmentStatusForm.description.trim(), // Map description to statusMeaning for backend
                enabled: shipmentStatusForm.enabled
            };

            if (editingShipmentStatus) {
                const updateFunction = httpsCallable(functions, 'updateShipmentStatus');
                await updateFunction({ shipmentStatusId: editingShipmentStatus.id, updates: statusData });
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
            enqueueSnackbar(`Failed to save shipment status: ${error.message}`, { variant: 'error' });
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
                await deleteFunction({ masterStatusId: item.id });
                enqueueSnackbar('Master status deleted successfully', { variant: 'success' });
                await loadMasterStatuses();
            } else if (type === 'shipment') {
                const deleteFunction = httpsCallable(functions, 'deleteShipmentStatus');
                await deleteFunction({ shipmentStatusId: item.id });
                enqueueSnackbar('Shipment status deleted successfully', { variant: 'success' });
                await loadShipmentStatuses();
            } else if (type === 'invoice') {
                const deleteFunction = httpsCallable(functions, 'deleteInvoiceStatus');
                await deleteFunction({ invoiceStatusId: item.id });
                enqueueSnackbar('Invoice status deleted successfully', { variant: 'success' });
                await loadInvoiceStatuses();
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

    // Drag and Drop handlers
    const handleMasterStatusDragEnd = async (result) => {
        if (!result.destination) return;

        const items = Array.from(masterStatuses);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update local state immediately for better UX
        setMasterStatuses(items);

        try {
            // Update sort orders in batch
            const updatePromises = items.map((item, index) => {
                const updateFunction = httpsCallable(functions, 'updateMasterStatus');
                return updateFunction({
                    masterStatusId: item.id,
                    updates: { sortOrder: index }
                });
            });

            await Promise.all(updatePromises);
            enqueueSnackbar('Master status order updated successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error updating master status order:', error);
            enqueueSnackbar('Failed to update master status order', { variant: 'error' });
            // Reload to revert changes on error
            await loadMasterStatuses();
        }
    };

    const handleShipmentStatusDragEnd = async (result) => {
        if (!result.destination) return;

        const items = Array.from(shipmentStatuses);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update local state immediately for better UX
        setShipmentStatuses(items);

        try {
            // Update sort orders in batch
            const updatePromises = items.map((item, index) => {
                const updateFunction = httpsCallable(functions, 'updateShipmentStatus');
                return updateFunction({
                    shipmentStatusId: item.id,
                    updates: { sortOrder: index }
                });
            });

            await Promise.all(updatePromises);
            enqueueSnackbar('Shipment status order updated successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error updating shipment status order:', error);
            enqueueSnackbar('Failed to update shipment status order', { variant: 'error' });
            // Reload to revert changes on error
            await loadShipmentStatuses();
        }
    };

    // Context menu handlers
    const handleContextMenuOpen = (event, type, data) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
        });
        setContextMenuType(type);
        setContextMenuData(data);
    };

    const handleContextMenuClose = () => {
        setContextMenu(null);
        setContextMenuType(null);
        setContextMenuData(null);
    };

    const handleContextMenuAction = (action) => {
        if (action === 'edit') {
            if (contextMenuType === 'master') {
                handleEditMasterStatus(contextMenuData);
            } else if (contextMenuType === 'shipment') {
                handleEditShipmentStatus(contextMenuData);
            } else if (contextMenuType === 'invoice') {
                handleEditInvoiceStatus(contextMenuData);
            }
        } else if (action === 'delete') {
            handleDeleteClick(contextMenuType, contextMenuData);
        }
        handleContextMenuClose();
    };

    // Invoice Status Functions
    const handleAddInvoiceStatus = () => {
        setEditingInvoiceStatus(null);
        setInvoiceStatusDialogOpen(true);
    };

    const handleEditInvoiceStatus = (status) => {
        setEditingInvoiceStatus(status);
        setInvoiceStatusDialogOpen(true);
    };

    const handleSaveInvoiceStatus = async (formData) => {
        try {
            setSaving(true);

            const statusData = {
                statusLabel: formData.statusLabel.trim(),
                statusDescription: formData.statusDescription.trim(),
                color: formData.color,
                fontColor: formData.fontColor,
                sortOrder: formData.sortOrder,
                enabled: formData.enabled
            };

            if (editingInvoiceStatus) {
                const updateFunction = httpsCallable(functions, 'updateInvoiceStatus');
                await updateFunction({ invoiceStatusId: editingInvoiceStatus.id, updates: statusData });
                enqueueSnackbar('Invoice status updated successfully', { variant: 'success' });
            } else {
                const createFunction = httpsCallable(functions, 'createInvoiceStatus');
                await createFunction(statusData);
                enqueueSnackbar('Invoice status created successfully', { variant: 'success' });
            }

            setInvoiceStatusDialogOpen(false);
            await loadInvoiceStatuses();
        } catch (error) {
            console.error('Error saving invoice status:', error);
            enqueueSnackbar(`Failed to save invoice status: ${error.message}`, { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <SystemConfigurationSkeleton />;
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
                {/* Notification Settings Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <NotificationsIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Notification Settings
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <NotificationSettings />
                        </AccordionDetails>
                    </Accordion>
                </Grid>

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
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Shipment Type</TableCell>
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
                                                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3 }}>
                                                    <CircularProgress size={24} />
                                                </TableCell>
                                            </TableRow>
                                        ) : additionalServices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
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
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Typography
                                                            sx={{
                                                                fontSize: '12px',
                                                                fontWeight: 500,
                                                                color: service.serviceType === 'pickup' ? '#7c3aed' :
                                                                    service.serviceType === 'delivery' ? '#0ea5e9' : '#374151',
                                                                px: 1,
                                                                py: 0.5,
                                                                borderRadius: '4px',
                                                                bgcolor: service.serviceType === 'pickup' ? '#f3f4f6' :
                                                                    service.serviceType === 'delivery' ? '#f0f9ff' : '#f9fafb',
                                                                display: 'inline-block',
                                                                minWidth: '60px',
                                                                textAlign: 'center'
                                                            }}
                                                        >
                                                            {service.serviceType ? service.serviceType.charAt(0).toUpperCase() + service.serviceType.slice(1) : 'General'}
                                                        </Typography>
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
                                <ShipmentIcon sx={{ color: '#6b7280' }} />
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
                                        label={`Shipment Statuses (${shipmentStatuses.length})`}
                                        value="shipment"
                                        icon={<ListIcon sx={{ fontSize: 16 }} />}
                                        iconPosition="start"
                                    />
                                    <Tab
                                        label={`Master Statuses (${masterStatuses.length})`}
                                        value="master"
                                        icon={<CategoryIcon sx={{ fontSize: 16 }} />}
                                        iconPosition="start"
                                    />
                                </Tabs>

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
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '80px' }}>Actions</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                {statusesLoading ? (
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3 }}>
                                                                <CircularProgress size={24} />
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                ) : shipmentStatuses.length === 0 ? (
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                                No shipment statuses configured. Click "Add Shipment Status" to get started.
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                ) : (
                                                    <DragDropContext onDragEnd={handleShipmentStatusDragEnd}>
                                                        <Droppable droppableId="shipmentStatuses">
                                                            {(provided, snapshot) => (
                                                                <TableBody
                                                                    ref={provided.innerRef}
                                                                    {...provided.droppableProps}
                                                                >
                                                                    {shipmentStatuses.map((status, index) => (
                                                                        <Draggable
                                                                            key={status.id}
                                                                            draggableId={status.id}
                                                                            index={index}
                                                                        >
                                                                            {(provided, snapshot) => (
                                                                                <TableRow
                                                                                    ref={provided.innerRef}
                                                                                    {...provided.draggableProps}
                                                                                    sx={{
                                                                                        '&:hover': { bgcolor: '#f8fafc' },
                                                                                        backgroundColor: masterStatuses.find(ms => ms.id === status.masterStatus)?.color ? `${masterStatuses.find(ms => ms.id === status.masterStatus).color}08` : 'transparent',
                                                                                        cursor: 'grab',
                                                                                        '&:active': { cursor: 'grabbing' }
                                                                                    }}
                                                                                >
                                                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                            <Box {...provided.dragHandleProps}>
                                                                                                <DragIcon sx={{ fontSize: 16, color: '#6b7280', cursor: 'grab' }} />
                                                                                            </Box>
                                                                                            {masterStatuses.find(ms => ms.id === status.masterStatus) ? (
                                                                                                <Chip
                                                                                                    label={masterStatuses.find(ms => ms.id === status.masterStatus).displayLabel}
                                                                                                    size="small"
                                                                                                    sx={{
                                                                                                        fontSize: '10px',
                                                                                                        backgroundColor: masterStatuses.find(ms => ms.id === status.masterStatus).color,
                                                                                                        color: masterStatuses.find(ms => ms.id === status.masterStatus).fontColor || '#ffffff',
                                                                                                        border: `1px solid ${masterStatuses.find(ms => ms.id === status.masterStatus).color}`,
                                                                                                        '& .MuiChip-label': {
                                                                                                            fontSize: '10px',
                                                                                                            fontWeight: 500
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                            ) : (
                                                                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                                                    {status.masterStatus}
                                                                                                </Typography>
                                                                                            )}
                                                                                        </Box>
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                        {status.statusLabel}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                                                        {status.statusValue}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                                        {status.statusMeaning || status.description || '-'}
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
                                                                                        <IconButton
                                                                                            size="small"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleContextMenuOpen(e, 'shipment', status);
                                                                                            }}
                                                                                            sx={{ color: '#6b7280' }}
                                                                                        >
                                                                                            <MoreVertIcon sx={{ fontSize: 16 }} />
                                                                                        </IconButton>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            )}
                                                                        </Draggable>
                                                                    ))}
                                                                    {provided.placeholder}
                                                                </TableBody>
                                                            )}
                                                        </Droppable>
                                                    </DragDropContext>
                                                )}
                                            </Table>
                                        </TableContainer>
                                    </Box>
                                )}

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
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Display Label</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status Code</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Description</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Enabled</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '80px' }}>Actions</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                {statusesLoading ? (
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3 }}>
                                                                <CircularProgress size={24} />
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                ) : masterStatuses.length === 0 ? (
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                                No master statuses configured. Click "Add Master Status" to get started.
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                ) : (
                                                    <DragDropContext onDragEnd={handleMasterStatusDragEnd}>
                                                        <Droppable droppableId="masterStatuses">
                                                            {(provided, snapshot) => (
                                                                <TableBody
                                                                    ref={provided.innerRef}
                                                                    {...provided.droppableProps}
                                                                >
                                                                    {masterStatuses.map((status, index) => (
                                                                        <Draggable
                                                                            key={status.id}
                                                                            draggableId={status.id}
                                                                            index={index}
                                                                        >
                                                                            {(provided, snapshot) => (
                                                                                <TableRow
                                                                                    ref={provided.innerRef}
                                                                                    {...provided.draggableProps}
                                                                                    sx={{
                                                                                        '&:hover': { bgcolor: '#f8fafc' },
                                                                                        cursor: 'grab',
                                                                                        '&:active': { cursor: 'grabbing' }
                                                                                    }}
                                                                                >
                                                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                            <Box {...provided.dragHandleProps}>
                                                                                                <DragIcon sx={{ fontSize: 16, color: '#6b7280', cursor: 'grab' }} />
                                                                                            </Box>
                                                                                            <Box
                                                                                                sx={{
                                                                                                    width: 20,
                                                                                                    height: 20,
                                                                                                    borderRadius: '50%',
                                                                                                    backgroundColor: status.color,
                                                                                                    border: '1px solid #e5e7eb'
                                                                                                }}
                                                                                            />
                                                                                        </Box>
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                        {status.displayLabel}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                                                        {status.label}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                                        {status.description || '-'}
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
                                                                                        <IconButton
                                                                                            size="small"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleContextMenuOpen(e, 'master', status);
                                                                                            }}
                                                                                            sx={{ color: '#6b7280' }}
                                                                                        >
                                                                                            <MoreVertIcon sx={{ fontSize: 16 }} />
                                                                                        </IconButton>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            )}
                                                                        </Draggable>
                                                                    ))}
                                                                    {provided.placeholder}
                                                                </TableBody>
                                                            )}
                                                        </Droppable>
                                                    </DragDropContext>
                                                )}
                                            </Table>
                                        </TableContainer>
                                    </Box>
                                )}
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Invoice Statuses Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ReceiptIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Invoice Statuses
                                </Typography>
                                <Chip
                                    label={`${invoiceStatuses.length} statuses`}
                                    size="small"
                                    sx={{ fontSize: '10px', ml: 1 }}
                                    color="primary"
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                                Configure invoice statuses for comprehensive billing and payment tracking.
                            </Typography>

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Manage billing status labels, colors, and ordering for invoice tracking
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => handleAddInvoiceStatus()}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Add Invoice Status
                                </Button>
                            </Box>

                            {statusesLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : invoiceStatuses.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4, color: '#6b7280' }}>
                                    <ReceiptIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                    <Typography sx={{ fontSize: '12px' }}>
                                        No invoice statuses configured. Click "Add Invoice Status" to get started.
                                    </Typography>
                                </Box>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Status Label
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Description
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Color
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Status Code
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Enabled
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: 80 }}>
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {invoiceStatuses.map((status, index) => (
                                            <TableRow key={status.id} hover>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <ReceiptIcon sx={{ fontSize: 16, color: status.color || '#6b7280' }} />
                                                        {status.statusLabel}
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', maxWidth: 200 }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                        {status.statusDescription || 'No description'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box
                                                            sx={{
                                                                width: 16,
                                                                height: 16,
                                                                borderRadius: '50%',
                                                                backgroundColor: status.color || '#6b7280',
                                                                border: '1px solid #e5e7eb'
                                                            }}
                                                        />
                                                        <Typography sx={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                                            {status.color || '#6b7280'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>
                                                        {status.statusCode}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Chip
                                                        label={status.enabled ? 'Enabled' : 'Disabled'}
                                                        color={status.enabled ? 'success' : 'default'}
                                                        size="small"
                                                        sx={{ fontSize: '11px' }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleContextMenuOpen(e, 'invoice', status)}
                                                    >
                                                        <MoreVertIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Follow-up Tasks Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TaskIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Follow-up Tasks
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <FollowUpTasksConfiguration />
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Charge Types Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ReceiptIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Charge Types
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <ChargeTypesConfiguration />
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Equipment Types Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EquipmentIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Equipment Types
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            {/* Header with Add Button */}
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 2
                            }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Manage equipment types for courier, shipping, and trucking operations
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddEquipment}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    Equipment
                                </Button>
                            </Box>

                            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Name</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Code</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Category</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Description</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '120px' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {equipmentLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                                    <CircularProgress size={20} />
                                                </TableCell>
                                            </TableRow>
                                        ) : equipmentTypes.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 3, fontSize: '12px', color: '#6b7280' }}>
                                                    No equipment types configured yet. Click "+ Equipment" to add one.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            equipmentTypes.map((equipment) => (
                                                <TableRow key={equipment.id} hover>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {equipment.imageUrl ? (
                                                                <img
                                                                    src={equipment.imageUrl}
                                                                    alt={equipment.name}
                                                                    style={{
                                                                        width: 24,
                                                                        height: 24,
                                                                        borderRadius: '4px',
                                                                        objectFit: 'cover'
                                                                    }}
                                                                />
                                                            ) : (
                                                                <EquipmentIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                                            )}
                                                            {equipment.name}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Chip
                                                            label={equipment.code}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontSize: '11px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Chip
                                                            label={equipment.category}
                                                            size="small"
                                                            sx={{
                                                                fontSize: '11px',
                                                                bgcolor: equipment.category === 'Truck' ? '#fef3c7' :
                                                                    equipment.category === 'Air' ? '#dbeafe' :
                                                                        equipment.category === 'Ocean' ? '#d1fae5' :
                                                                            equipment.category === 'Rail' ? '#fce7f3' :
                                                                                equipment.category === 'Courier' ? '#e0f2fe' :
                                                                                    '#f3f4f6',
                                                                color: equipment.category === 'Truck' ? '#92400e' :
                                                                    equipment.category === 'Air' ? '#1e40af' :
                                                                        equipment.category === 'Ocean' ? '#065f46' :
                                                                            equipment.category === 'Rail' ? '#be185d' :
                                                                                equipment.category === 'Courier' ? '#0277bd' :
                                                                                    '#374151'
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', maxWidth: 200 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                            {equipment.description || '-'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => handleEquipmentMenuOpen(e, equipment)}
                                                        >
                                                            <MoreVertIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
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

                {/* Shipping Zones Section */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ShippingZoneIcon sx={{ color: '#6b7280' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Zone Management
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <EnterpriseZoneManagement />
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
                                <InputLabel sx={{ fontSize: '12px' }}>Shipment Type</InputLabel>
                                <Select
                                    value={serviceForm.type}
                                    onChange={(e) => handleServiceFormChange('type', e.target.value)}
                                    label="Shipment Type"
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
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service Category</InputLabel>
                                <Select
                                    value={serviceForm.serviceType}
                                    onChange={(e) => handleServiceFormChange('serviceType', e.target.value)}
                                    label="Service Category"
                                    sx={{
                                        fontSize: '12px',
                                        '& .MuiSelect-select': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                >
                                    <MenuItem value="general" sx={{ fontSize: '12px' }}>General</MenuItem>
                                    <MenuItem value="pickup" sx={{ fontSize: '12px' }}>Pickup</MenuItem>
                                    <MenuItem value="delivery" sx={{ fontSize: '12px' }}>Delivery</MenuItem>
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
                        <Grid item xs={12}>
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
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Status Code"
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
                        <Grid item xs={12} md={6}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                    Background Color
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        id="background-color-button"
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 1,
                                            backgroundColor: masterStatusForm.color,
                                            border: '1px solid #e5e7eb',
                                            cursor: 'pointer',
                                            position: 'relative'
                                        }}
                                        onClick={(e) => setColorPickerOpen(colorPickerOpen === 'background' ? null : 'background')}
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
                        <Grid item xs={12} md={6}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                    Font Color
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        id="font-color-button"
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 1,
                                            backgroundColor: masterStatusForm.fontColor,
                                            border: '1px solid #e5e7eb',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative'
                                        }}
                                        onClick={(e) => setColorPickerOpen(colorPickerOpen === 'font' ? null : 'font')}
                                    >
                                        <Typography sx={{ fontSize: '10px', color: masterStatusForm.fontColor === '#ffffff' ? '#000' : '#fff', fontWeight: 600 }}>
                                            Aa
                                        </Typography>
                                    </Box>
                                    <TextField
                                        value={masterStatusForm.fontColor}
                                        onChange={(e) => handleMasterStatusFormChange('fontColor', e.target.value)}
                                        size="small"
                                        sx={{
                                            flex: 1,
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                        placeholder="#ffffff"
                                    />
                                </Box>
                            </Box>
                        </Grid>
                        <Grid item xs={12}>
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
                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2, p: 2, border: '1px solid #e5e7eb', borderRadius: 1, backgroundColor: '#f8fafc' }}>
                                <Typography sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                    Preview
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Chip
                                        label={masterStatusForm.displayLabel || 'Preview'}
                                        size="small"
                                        sx={{
                                            fontSize: '10px',
                                            backgroundColor: masterStatusForm.color,
                                            color: masterStatusForm.fontColor,
                                            border: `1px solid ${masterStatusForm.color}`,
                                            '& .MuiChip-label': {
                                                fontSize: '10px',
                                                fontWeight: 500
                                            }
                                        }}
                                    />
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        This is how the status will appear in tables and lists
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>

                    {/* Background Color Picker Popover */}
                    <Popover
                        open={colorPickerOpen === 'background'}
                        anchorEl={document.getElementById('background-color-button')}
                        onClose={() => setColorPickerOpen(null)}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                    >
                        <ClickAwayListener onClickAway={() => setColorPickerOpen(null)}>
                            <Box sx={{ p: 2, width: 250 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                    Select Background Color
                                </Typography>
                                <Box sx={{ mb: 2 }}>
                                    <input
                                        type="color"
                                        value={masterStatusForm.color}
                                        onChange={(e) => handleMasterStatusFormChange('color', e.target.value)}
                                        style={{
                                            width: '100%',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                                    {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#374151'].map((color) => (
                                        <Box
                                            key={color}
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                backgroundColor: color,
                                                borderRadius: 0.5,
                                                cursor: 'pointer',
                                                border: masterStatusForm.color === color ? '2px solid #000' : '1px solid #e5e7eb'
                                            }}
                                            onClick={() => handleMasterStatusFormChange('color', color)}
                                        />
                                    ))}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        onClick={() => setColorPickerOpen(null)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => setColorPickerOpen(null)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Set Color
                                    </Button>
                                </Box>
                            </Box>
                        </ClickAwayListener>
                    </Popover>

                    {/* Font Color Picker Popover */}
                    <Popover
                        open={colorPickerOpen === 'font'}
                        anchorEl={document.getElementById('font-color-button')}
                        onClose={() => setColorPickerOpen(null)}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                    >
                        <ClickAwayListener onClickAway={() => setColorPickerOpen(null)}>
                            <Box sx={{ p: 2, width: 250 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                    Select Font Color
                                </Typography>
                                <Box sx={{ mb: 2 }}>
                                    <input
                                        type="color"
                                        value={masterStatusForm.fontColor}
                                        onChange={(e) => handleMasterStatusFormChange('fontColor', e.target.value)}
                                        style={{
                                            width: '100%',
                                            height: '40px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                                    {['#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827', '#000000'].map((color) => (
                                        <Box
                                            key={color}
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                backgroundColor: color,
                                                borderRadius: 0.5,
                                                cursor: 'pointer',
                                                border: masterStatusForm.fontColor === color ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                                            }}
                                            onClick={() => handleMasterStatusFormChange('fontColor', color)}
                                        />
                                    ))}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        onClick={() => setColorPickerOpen(null)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => setColorPickerOpen(null)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Set Color
                                    </Button>
                                </Box>
                            </Box>
                        </ClickAwayListener>
                    </Popover>
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
                        Are you sure you want to delete this {deleteTarget?.type === 'master' ? 'master status' : deleteTarget?.type === 'invoice' ? 'invoice status' : 'shipment status'}?
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

            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={handleContextMenuClose}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
                slotProps={{
                    paper: {
                        sx: {
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            minWidth: '140px'
                        }
                    }
                }}
            >
                <MenuList sx={{ py: 1 }}>
                    <MenuItem
                        onClick={() => handleContextMenuAction('edit')}
                        sx={{
                            fontSize: '12px',
                            py: 1,
                            px: 2,
                            '&:hover': { backgroundColor: '#f8fafc' }
                        }}
                    >
                        <EditIcon sx={{ fontSize: 16, mr: 1, color: '#6b7280' }} />
                        Edit
                    </MenuItem>
                    <MenuItem
                        onClick={() => handleContextMenuAction('delete')}
                        sx={{
                            fontSize: '12px',
                            py: 1,
                            px: 2,
                            color: '#ef4444',
                            '&:hover': { backgroundColor: '#fef2f2' }
                        }}
                    >
                        <DeleteIcon sx={{ fontSize: 16, mr: 1, color: '#ef4444' }} />
                        Delete
                    </MenuItem>
                </MenuList>
            </Menu>

            {/* Equipment Action Menu */}
            <Menu
                anchorEl={equipmentMenuAnchor}
                open={Boolean(equipmentMenuAnchor)}
                onClose={handleEquipmentMenuClose}
                slotProps={{
                    paper: {
                        sx: {
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            minWidth: '140px'
                        }
                    }
                }}
            >
                <MenuList sx={{ py: 1 }}>
                    <MenuItem
                        onClick={() => handleEquipmentMenuAction('edit')}
                        sx={{
                            fontSize: '12px',
                            py: 1,
                            px: 2,
                            '&:hover': { backgroundColor: '#f8fafc' }
                        }}
                    >
                        <EditIcon sx={{ fontSize: 16, mr: 1, color: '#6b7280' }} />
                        Edit
                    </MenuItem>
                    <MenuItem
                        onClick={() => handleEquipmentMenuAction('delete')}
                        sx={{
                            fontSize: '12px',
                            py: 1,
                            px: 2,
                            color: '#ef4444',
                            '&:hover': { backgroundColor: '#fef2f2' }
                        }}
                    >
                        <DeleteIcon sx={{ fontSize: 16, mr: 1, color: '#ef4444' }} />
                        Delete
                    </MenuItem>
                </MenuList>
            </Menu>

            {/* Equipment Type Dialog */}
            <Dialog
                open={equipmentDialogOpen}
                onClose={() => setEquipmentDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingEquipment ? 'Edit Equipment Type' : 'Add Equipment Type'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Equipment Name"
                                value={equipmentForm.name}
                                onChange={(e) => handleEquipmentFormChange('name', e.target.value)}
                                size="small"
                                required
                                placeholder="e.g., 53' Truck, Dry Van, Cold Storage"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="Enter the equipment name (required)"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                                <Select
                                    value={equipmentForm.category}
                                    onChange={(e) => handleEquipmentFormChange('category', e.target.value)}
                                    label="Category"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="Truck" sx={{ fontSize: '12px' }}>Truck</MenuItem>
                                    <MenuItem value="Air" sx={{ fontSize: '12px' }}>Air</MenuItem>
                                    <MenuItem value="Ocean" sx={{ fontSize: '12px' }}>Ocean</MenuItem>
                                    <MenuItem value="Rail" sx={{ fontSize: '12px' }}>Rail</MenuItem>
                                    <MenuItem value="Courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Equipment Code"
                                value={equipmentForm.code}
                                onChange={(e) => handleEquipmentFormChange('code', e.target.value)}
                                size="small"
                                required
                                placeholder="Auto-generated"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="Unique identifier (auto-generated from name)"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={equipmentForm.description}
                                onChange={(e) => handleEquipmentFormChange('description', e.target.value)}
                                size="small"
                                multiline
                                rows={2}
                                placeholder="Optional description of the equipment type"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="Optional description (e.g., specifications, capacity)"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Box>
                                <Typography variant="body2" sx={{ fontSize: '12px', mb: 1, fontWeight: 600 }}>
                                    Equipment Image (Optional)
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Button
                                        variant="outlined"
                                        component="label"
                                        startIcon={<UploadIcon />}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Choose Image
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    setEquipmentImageFile(file);
                                                }
                                            }}
                                        />
                                    </Button>
                                    {equipmentImageFile && (
                                        <Chip
                                            label={equipmentImageFile.name}
                                            size="small"
                                            onDelete={() => setEquipmentImageFile(null)}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    )}
                                    {equipmentForm.imageUrl && !equipmentImageFile && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <img
                                                src={equipmentForm.imageUrl}
                                                alt="Current image"
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '4px',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                Current image
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280', mt: 1, display: 'block' }}>
                                    Upload an image to represent this equipment type (PNG, JPG, GIF)
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setEquipmentDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveEquipment}
                        variant="contained"
                        disabled={saving || uploadingImage}
                        startIcon={saving || uploadingImage ? <CircularProgress size={16} /> : <SaveIcon />}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Saving...' : uploadingImage ? 'Uploading...' : 'Save Equipment'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Invoice Status Dialog */}
            <InvoiceStatusDialog
                open={invoiceStatusDialogOpen}
                mode={editingInvoiceStatus ? 'edit' : 'create'}
                data={editingInvoiceStatus}
                onSave={handleSaveInvoiceStatus}
                onClose={() => setInvoiceStatusDialogOpen(false)}
            />
        </Box>
    );
};

export default SystemConfiguration; 