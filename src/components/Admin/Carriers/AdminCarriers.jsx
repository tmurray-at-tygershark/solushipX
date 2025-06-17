import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Switch,
    IconButton,
    Tooltip,
    Chip,
    CircularProgress,
    InputLabel,
    MenuItem,
    Select,
    FormControl,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Menu,
    ListItemIcon,
    ListItemText,
    Tabs,
    Tab,
    Badge,
    Collapse,
    Grid,
    Avatar,
    Alert,
    FormControlLabel,
    Checkbox,
    Checkbox as MuiCheckbox
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    Close as CloseIcon,
    LocalShipping as CarrierIcon,
    ContentCopy as ContentCopyIcon,
    Warning as WarningIcon,
    Block as BlockIcon,
    CloudUpload as CloudUploadIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

// Import reusable components that match ShipmentsX patterns
import ModalHeader from '../../common/ModalHeader';

const carrierTypes = [
    { value: 'courier', label: 'Courier' },
    { value: 'freight', label: 'Freight' },
    { value: 'hybrid', label: 'Hybrid' },
];

// Skeleton component for loading state
const CarriersTableSkeleton = () => {
    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier ID</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Account Number</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {[...Array(10)].map((_, index) => (
                    <TableRow key={index}>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}>
                                    <CarrierIcon sx={{ fontSize: '14px' }} />
                                </Avatar>
                                <Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} />
                            </Box>
                        </TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Chip label="Loading" size="small" sx={{ bgcolor: '#e5e7eb', color: 'transparent' }} /></TableCell>
                        <TableCell><Chip label="Loading" size="small" sx={{ bgcolor: '#e5e7eb', color: 'transparent' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '100px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '90px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell>
                            <IconButton size="small" disabled>
                                <MoreVertIcon />
                            </IconButton>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

// Custom pagination component matching ShipmentsX
const CarriersPagination = ({
    totalCount,
    currentPage,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange
}) => {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    const startItem = (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalCount);

    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderTop: '1px solid #e5e7eb',
            bgcolor: '#fafafa'
        }}>
            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalCount.toLocaleString()} carriers
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Rows per page:
                    </Typography>
                    <Select
                        size="small"
                        value={rowsPerPage}
                        onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                        sx={{ fontSize: '12px', minWidth: '60px' }}
                    >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                    </Select>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        First
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Prev
                    </Button>
                    <Typography variant="body2" sx={{ fontSize: '12px', px: 2, py: 1, bgcolor: '#f3f4f6', borderRadius: '4px' }}>
                        {currentPage} of {totalPages}
                    </Typography>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Next
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Last
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

const AdminCarriers = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    // Main data states
    const [carriers, setCarriers] = useState([]);
    const [allCarriers, setAllCarriers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Tab and filter states
    const [selectedTab, setSelectedTab] = useState('all');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);


    // Filter states
    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        enabled: 'all'
    });
    const [searchFields, setSearchFields] = useState({
        carrierName: '',
        carrierId: '',
        accountNumber: ''
    });
    const [filtersOpen, setFiltersOpen] = useState(false);

    // UI states
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialog states
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
    const [forceDelete, setForceDelete] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        carrierID: '',
        accountNumber: '',
        type: 'courier',
        enabled: true,
        hostURL: '',
        username: '',
        password: '',
        secret: '',
        logoFileName: '',
        logoURL: '',
    });
    const [endpoints, setEndpoints] = useState({
        rate: '',
        booking: '',
        tracking: '',
        cancel: '',
        labels: '',
        status: ''
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const [carrierIdError, setCarrierIdError] = useState('');
    const [formErrors, setFormErrors] = useState({});

    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({
            open: true,
            message,
            severity
        });
    }, []);

    // Calculate stats
    const stats = useMemo(() => {
        const total = allCarriers.length;
        const enabled = allCarriers.filter(c => c.enabled === true).length;
        const disabled = allCarriers.filter(c => c.enabled === false).length;
        const courier = allCarriers.filter(c => c.type === 'courier').length;
        const freight = allCarriers.filter(c => c.type === 'freight').length;
        const hybrid = allCarriers.filter(c => c.type === 'hybrid').length;

        return {
            total,
            enabled,
            disabled,
            courier,
            freight,
            hybrid
        };
    }, [allCarriers]);

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
        setPage(1); // Reset to first page when tab changes
    };



    // Action menu handlers
    const handleActionMenuOpen = (event, carrier) => {
        setSelectedCarrier(carrier);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedCarrier(null);
        setActionMenuAnchorEl(null);
    };

    // Copy to clipboard handler
    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`${label} copied to clipboard`, 'success');
        } catch (error) {
            showSnackbar(`Failed to copy ${label}`, 'error');
        }
    };

    // Fetch carriers data
    const fetchCarriers = async () => {
        setLoading(true);
        try {
            const carriersRef = collection(db, 'carriers');
            const q = query(carriersRef, orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            const carriersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter out deleted carriers
            const activeCarriers = carriersData.filter(carrier => carrier.status !== 'deleted');
            setAllCarriers(activeCarriers);
            setTotalCount(activeCarriers.length);
        } catch (error) {
            console.error('Error loading carriers:', error);
            showSnackbar('Failed to load carriers', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter and paginate carriers
    useEffect(() => {
        let filtered = [...allCarriers];

        // Apply tab filter
        if (selectedTab !== 'all') {
            switch (selectedTab) {
                case 'enabled':
                    filtered = filtered.filter(c => c.enabled === true);
                    break;
                case 'disabled':
                    filtered = filtered.filter(c => c.enabled === false);
                    break;
                case 'courier':
                    filtered = filtered.filter(c => c.type === 'courier');
                    break;
                case 'freight':
                    filtered = filtered.filter(c => c.type === 'freight');
                    break;
                case 'hybrid':
                    filtered = filtered.filter(c => c.type === 'hybrid');
                    break;
            }
        }

        // Apply search filters
        if (searchFields.carrierName) {
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(searchFields.carrierName.toLowerCase())
            );
        }
        if (searchFields.carrierId) {
            filtered = filtered.filter(c =>
                c.carrierID.toLowerCase().includes(searchFields.carrierId.toLowerCase())
            );
        }
        if (searchFields.accountNumber) {
            filtered = filtered.filter(c => {
                const accountNumber = c.apiCredentials?.accountNumber || c.accountNumber || '';
                return accountNumber.toLowerCase().includes(searchFields.accountNumber.toLowerCase());
            });
        }

        // Apply advanced filters
        if (filters.status !== 'all') {
            filtered = filtered.filter(c => c.status === filters.status);
        }
        if (filters.type !== 'all') {
            filtered = filtered.filter(c => c.type === filters.type);
        }
        if (filters.enabled !== 'all') {
            const isEnabled = filters.enabled === 'enabled';
            filtered = filtered.filter(c => c.enabled === isEnabled);
        }

        // Paginate
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedCarriers = filtered.slice(startIndex, endIndex);

        setCarriers(paginatedCarriers);
        setTotalCount(filtered.length);
    }, [allCarriers, selectedTab, searchFields, filters, page, rowsPerPage]);

    // Load data on component mount
    useEffect(() => {
        fetchCarriers();
    }, []);

    // Form handlers
    const handleOpenDialog = (carrier = null) => {
        if (carrier) {
            setSelectedCarrier(carrier);
            setFormData({
                name: carrier.name || '',
                carrierID: (carrier.carrierID || '').toUpperCase(),
                accountNumber: carrier.apiCredentials?.accountNumber || carrier.accountNumber || '',
                type: carrier.type || 'courier',
                enabled: carrier.enabled ?? true,
                hostURL: carrier.apiCredentials?.hostURL || carrier.hostURL || '',
                username: carrier.apiCredentials?.username || carrier.username || '',
                password: carrier.apiCredentials?.password || carrier.password || '',
                secret: carrier.apiCredentials?.secret || carrier.secret || '',
                logoFileName: carrier.logoFileName || '',
                logoURL: carrier.logoURL || '',
            });
            setEndpoints({
                rate: carrier.apiCredentials?.endpoints?.rate || '',
                booking: carrier.apiCredentials?.endpoints?.booking || '',
                tracking: carrier.apiCredentials?.endpoints?.tracking || '',
                cancel: carrier.apiCredentials?.endpoints?.cancel || '',
                labels: carrier.apiCredentials?.endpoints?.labels || '',
                status: carrier.apiCredentials?.endpoints?.status || ''
            });
            setLogoPreview(carrier.logoURL || '');
            setIsEditMode(true);
        } else {
            setSelectedCarrier(null);
            setFormData({
                name: '',
                carrierID: '',
                accountNumber: '',
                type: 'courier',
                enabled: true,
                hostURL: '',
                username: '',
                password: '',
                secret: '',
                logoFileName: '',
                logoURL: '',
            });
            setEndpoints({
                rate: '',
                booking: '',
                tracking: '',
                cancel: '',
                labels: '',
                status: ''
            });
            setLogoPreview('');
            setIsEditMode(false);
        }
        setLogoFile(null);
        setCarrierIdError('');
        setFormErrors({});
        setOpenDialog(true);
        handleActionMenuClose();
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedCarrier(null);
        setLogoFile(null);
        setLogoPreview('');
        setCarrierIdError('');
        setFormErrors({});
        setSaving(false);
        setIsEditMode(false);
    };

    // Form change handlers
    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;

        // Always convert carrier ID to uppercase
        if (name === 'carrierID') {
            newValue = newValue.toUpperCase();
        }

        setFormData(prev => ({ ...prev, [name]: newValue }));

        // Clear error for this field
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Check for carrier ID uniqueness when the field changes
        if (name === 'carrierID') {
            checkCarrierIdUniqueness(newValue);
        }
    };

    const handleEndpointChange = (e) => {
        const { name, value } = e.target;
        setEndpoints(prev => ({ ...prev, [name]: value }));
    };

    // Logo handling
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
            setFormData(prev => ({ ...prev, logoFileName: file.name }));
        }
    };

    const handleDropLogo = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
            setFormData(prev => ({ ...prev, logoFileName: file.name }));
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Validation
    const checkCarrierIdUniqueness = async (carrierId) => {
        if (!carrierId) {
            setCarrierIdError('');
            return;
        }

        try {
            const carriersRef = collection(db, 'carriers');
            // Always check against uppercase since that's how we store it
            const q = query(carriersRef, where('carrierID', '==', carrierId.toUpperCase()));
            const querySnapshot = await getDocs(q);

            const isDuplicate = querySnapshot.docs.some(doc =>
                !selectedCarrier || doc.id !== selectedCarrier.id
            );

            setCarrierIdError(isDuplicate ? 'This Carrier ID is already in use' : '');
        } catch (err) {
            console.error('Error checking carrier ID uniqueness:', err);
        }
    };

    const validateForm = () => {
        const errors = {};

        if (!formData.name.trim()) errors.name = 'Carrier name is required';
        if (!formData.carrierID.trim()) errors.carrierID = 'Carrier ID is required';
        if (!formData.accountNumber.trim()) errors.accountNumber = 'Account number is required';
        if (!formData.hostURL.trim()) errors.hostURL = 'Host URL is required';

        setFormErrors(errors);
        return Object.keys(errors).length === 0 && !carrierIdError;
    };

    // Save carrier
    const handleSaveCarrier = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            showSnackbar('Please fix the errors in the form', 'error');
            return;
        }

        setSaving(true);
        try {
            const carrierData = {
                name: formData.name.trim(),
                carrierID: formData.carrierID.trim().toUpperCase(),
                type: formData.type,
                enabled: formData.enabled,
                logoFileName: formData.logoFileName,
                logoURL: logoFile ? '' : formData.logoURL, // Will be updated if new logo uploaded
                apiCredentials: {
                    accountNumber: formData.accountNumber.trim(),
                    hostURL: formData.hostURL.trim(),
                    username: formData.username.trim(),
                    password: formData.password,
                    secret: formData.secret,
                    endpoints: endpoints
                },
                updatedAt: serverTimestamp(),
            };

            if (!isEditMode) {
                carrierData.createdAt = serverTimestamp();
                carrierData.status = 'active';
            }

            if (isEditMode && selectedCarrier) {
                await updateDoc(doc(db, 'carriers', selectedCarrier.id), carrierData);
                enqueueSnackbar('Carrier updated successfully.', { variant: 'success' });
            } else {
                await addDoc(collection(db, 'carriers'), carrierData);
                enqueueSnackbar('Carrier created successfully.', { variant: 'success' });
            }

            fetchCarriers();
            handleCloseDialog();
        } catch (err) {
            console.error('Error saving carrier:', err);
            showSnackbar('Error saving carrier: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleEnabled = async (carrier) => {
        try {
            await updateDoc(doc(db, 'carriers', carrier.id), {
                enabled: !carrier.enabled,
                updatedAt: serverTimestamp()
            });
            // Update local state
            setAllCarriers(prevCarriers => prevCarriers.map(c =>
                c.id === carrier.id ? { ...c, enabled: !carrier.enabled } : c
            ));
            enqueueSnackbar(`Carrier ${carrier.name} has been ${carrier.enabled ? 'disabled' : 'enabled'}.`, { variant: 'success' });
        } catch (err) {
            showSnackbar('Error updating carrier status: ' + err.message, 'error');
        }
    };

    // Soft delete handler
    const handleDeleteCarrier = async (forceDeleteRequested = false) => {
        if (!selectedCarrier) return;

        try {
            if (forceDeleteRequested && forceDelete) {
                // Soft delete - mark as deleted instead of removing
                await updateDoc(doc(db, 'carriers', selectedCarrier.id), {
                    status: 'deleted',
                    deletedAt: serverTimestamp(),
                    enabled: false // Also disable when deleting
                });

                // Remove from local state
                setAllCarriers(prevCarriers => prevCarriers.filter(c => c.id !== selectedCarrier.id));
                enqueueSnackbar(`Carrier ${selectedCarrier.name} has been deleted.`, { variant: 'success' });
            } else {
                // Just disable the carrier
                await updateDoc(doc(db, 'carriers', selectedCarrier.id), {
                    enabled: false,
                    updatedAt: serverTimestamp()
                });

                // Update local state
                setAllCarriers(prevCarriers => prevCarriers.map(c =>
                    c.id === selectedCarrier.id ? { ...c, enabled: false } : c
                ));
                enqueueSnackbar(`Carrier ${selectedCarrier.name} has been disabled instead of deleted.`, { variant: 'success' });
            }
        } catch (error) {
            console.error('Error deleting carrier:', error);
            showSnackbar('Failed to delete carrier: ' + error.message, 'error');
        } finally {
            setOpenDeleteConfirm(false);
            setSelectedCarrier(null);
            setForceDelete(false);
        }
    };

    // Get status chip color
    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'inactive':
                return { color: '#dc2626', bgcolor: '#fef2f2' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    // Get type chip color
    const getTypeColor = (type) => {
        switch (type) {
            case 'courier':
                return { color: '#3b82f6', bgcolor: '#eff6ff' };
            case 'freight':
                return { color: '#f59e0b', bgcolor: '#fffbeb' };
            case 'hybrid':
                return { color: '#8b5cf6', bgcolor: '#f5f3ff' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    // Render table view
    const renderTableView = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                            Carriers
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                            Manage carrier integrations and configurations
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog()}
                        sx={{ fontSize: '12px' }}
                    >
                        Add Carrier
                    </Button>
                </Box>

                {/* Tabs and Filters Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tabs
                        value={selectedTab}
                        onChange={handleTabChange}
                        sx={{
                            '& .MuiTab-root': {
                                fontSize: '11px',
                                minHeight: '36px',
                                textTransform: 'none',
                                fontWeight: 500,
                                padding: '6px 12px'
                            }
                        }}
                    >
                        <Tab label={`All (${stats.total})`} value="all" />
                        <Tab label={`Enabled (${stats.enabled})`} value="enabled" />
                        <Tab label={`Disabled (${stats.disabled})`} value="disabled" />
                        <Tab label={`Courier (${stats.courier})`} value="courier" />
                        <Tab label={`Freight (${stats.freight})`} value="freight" />
                        <Tab label={`Hybrid (${stats.hybrid})`} value="hybrid" />
                    </Tabs>

                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FilterListIcon />}
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        sx={{ fontSize: '12px' }}
                    >
                        Filters
                    </Button>
                </Box>

                {/* Filters Panel */}
                <Collapse in={filtersOpen}>
                    <Paper sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search carrier name..."
                                    value={searchFields.carrierName}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, carrierName: e.target.value }))}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '16px' }} />
                                            </InputAdornment>
                                        ),
                                        sx: { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search carrier ID..."
                                    value={searchFields.carrierId}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, carrierId: e.target.value }))}
                                    InputProps={{
                                        sx: { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search account number..."
                                    value={searchFields.accountNumber}
                                    onChange={(e) => setSearchFields(prev => ({ ...prev, accountNumber: e.target.value }))}
                                    InputProps={{
                                        sx: { fontSize: '12px' }
                                    }}
                                />
                            </Grid>
                        </Grid>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CloseIcon />}
                                onClick={() => {
                                    setSearchFields({ carrierName: '', carrierId: '', accountNumber: '' });
                                    setFilters({ status: 'all', type: 'all', enabled: 'all' });
                                }}
                                sx={{ fontSize: '12px' }}
                            >
                                Clear Filters
                            </Button>
                        </Box>
                    </Paper>
                </Collapse>
            </Box>

            {/* Table Section */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ width: '100%', px: 2 }}>
                    {loading ? (
                        <CarriersTableSkeleton />
                    ) : (
                        <Table sx={{ position: 'sticky', top: 0, zIndex: 100 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier ID</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Account Number</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {carriers.map((carrier) => (
                                    <TableRow key={carrier.id} hover sx={{ verticalAlign: 'top' }}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar
                                                    src={carrier.logoURL}
                                                    sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}
                                                >
                                                    <CarrierIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                                </Avatar>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#1f2937' }}>
                                                        {carrier.name}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                        <Switch
                                                            checked={carrier.enabled}
                                                            onChange={() => handleToggleEnabled(carrier)}
                                                            size="small"
                                                        />
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {carrier.enabled ? 'Enabled' : 'Disabled'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                    {carrier.carrierID}
                                                </Typography>
                                                <Tooltip title="Copy Carrier ID">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyToClipboard(carrier.carrierID, 'Carrier ID');
                                                        }}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={carrier.type}
                                                size="small"
                                                sx={{
                                                    backgroundColor: getTypeColor(carrier.type).bgcolor,
                                                    color: getTypeColor(carrier.type).color,
                                                    fontWeight: 500,
                                                    fontSize: '11px',
                                                    '& .MuiChip-label': { px: 1.5 }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={carrier.status || 'active'}
                                                size="small"
                                                sx={{
                                                    backgroundColor: getStatusColor(carrier.status || 'active').bgcolor,
                                                    color: getStatusColor(carrier.status || 'active').color,
                                                    fontWeight: 500,
                                                    fontSize: '11px',
                                                    '& .MuiChip-label': { px: 1.5 }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {carrier.apiCredentials?.accountNumber || carrier.accountNumber || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {carrier.createdAt ? new Date(carrier.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleActionMenuOpen(e, carrier)}
                                            >
                                                <MoreVertIcon sx={{ fontSize: '16px' }} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {carriers.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            <Box sx={{ py: 4 }}>
                                                <CarrierIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                                <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                    No carriers found
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                    Try adjusting your search criteria or create a new carrier
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </Box>
            </Box>

            {/* Pagination Section */}
            <Box sx={{ flexShrink: 0 }}>
                <CarriersPagination
                    totalCount={totalCount}
                    currentPage={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                />
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchorEl}
                open={Boolean(actionMenuAnchorEl)}
                onClose={handleActionMenuClose}
            >
                <MenuItem onClick={() => handleOpenDialog(selectedCarrier)}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Edit Carrier</Typography>
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                    setOpenDeleteConfirm(true);
                    handleActionMenuClose();
                }}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Delete Carrier</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );

    // Main render
    return (
        <Box sx={{
            backgroundColor: 'transparent',
            width: '100%',
            height: '100%'
        }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title="Carriers"
                    onClose={onClose}
                    showBackButton={false}
                    showCloseButton={showCloseButton}
                />
            )}

            {/* Main Content */}
            <Box sx={{
                width: '100%',
                height: isModal ? 'calc(100% - 64px)' : '100%',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {renderTableView()}
            </Box>

            {/* Comprehensive Carrier Form Dialog */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '90vh',
                        height: 'auto',
                        m: 2
                    }
                }}
            >
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#111827',
                    borderBottom: '1px solid #e5e7eb',
                    pb: 2,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                        {isEditMode ? 'Edit Carrier' : 'Add New Carrier'}
                    </Typography>
                    <IconButton
                        onClick={handleCloseDialog}
                        size="small"
                        sx={{
                            color: '#6b7280',
                            '&:hover': {
                                color: '#374151',
                                backgroundColor: '#f3f4f6'
                            }
                        }}
                    >
                        <CloseIcon sx={{ fontSize: '20px' }} />
                    </IconButton>
                </DialogTitle>

                <form onSubmit={handleSaveCarrier}>
                    <DialogContent sx={{ p: 3 }}>
                        <Grid container spacing={3}>
                            {/* Basic Information Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                    Basic Information
                                </Typography>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier Name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                    error={!!formErrors.name}
                                    helperText={formErrors.name}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier ID"
                                    name="carrierID"
                                    value={formData.carrierID}
                                    onChange={handleFormChange}
                                    required
                                    error={!!formErrors.carrierID || !!carrierIdError}
                                    helperText={formErrors.carrierID || carrierIdError}
                                    size="small"
                                    InputProps={{
                                        sx: {
                                            fontSize: '12px',
                                            '& input': {
                                                textTransform: 'uppercase'
                                            }
                                        }
                                    }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Account Number"
                                    name="accountNumber"
                                    value={formData.accountNumber}
                                    onChange={handleFormChange}
                                    required
                                    error={!!formErrors.accountNumber}
                                    helperText={formErrors.accountNumber}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth size="small" required>
                                    <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                                    <Select
                                        name="type"
                                        value={formData.type}
                                        label="Type"
                                        onChange={handleFormChange}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {carrierTypes.map(opt => (
                                            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '12px' }}>
                                                {opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Logo Upload Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, mt: 2, color: '#374151' }}>
                                    Carrier Logo
                                </Typography>
                                <Box
                                    sx={{
                                        border: '2px dashed #d1d5db',
                                        borderRadius: 2,
                                        p: 3,
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        bgcolor: '#f8fafc',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            borderColor: '#3b82f6',
                                            bgcolor: '#eff6ff'
                                        }
                                    }}
                                    onDrop={handleDropLogo}
                                    onDragOver={handleDragOver}
                                    onClick={() => document.getElementById('carrier-logo-upload').click()}
                                >
                                    <input
                                        id="carrier-logo-upload"
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleLogoChange}
                                    />
                                    {logoPreview ? (
                                        <Box>
                                            <img
                                                src={logoPreview}
                                                alt="Logo Preview"
                                                style={{
                                                    maxHeight: 80,
                                                    maxWidth: 200,
                                                    marginBottom: 12,
                                                    borderRadius: 4
                                                }}
                                            />
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Click to change logo
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Box>
                                            <CloudUploadIcon sx={{ fontSize: 40, color: '#6b7280', mb: 1 }} />
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Drag & drop or click to upload carrier logo
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af', mt: 1 }}>
                                                PNG, JPG up to 2MB
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Grid>

                            {/* API Configuration Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, mt: 2, color: '#374151' }}>
                                    API Configuration
                                </Typography>
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Host URL"
                                    name="hostURL"
                                    value={formData.hostURL}
                                    onChange={handleFormChange}
                                    required
                                    error={!!formErrors.hostURL}
                                    helperText={formErrors.hostURL}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    placeholder="https://api.carrier.com"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleFormChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Password"
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleFormChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="API Secret / Token"
                                    name="secret"
                                    value={formData.secret}
                                    onChange={handleFormChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            {/* API Endpoints Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, mt: 2, color: '#374151' }}>
                                    API Endpoints
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                                    Configure specific endpoint paths (will be appended to Host URL)
                                </Typography>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Rate Endpoint"
                                    name="rate"
                                    value={endpoints.rate}
                                    onChange={handleEndpointChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    placeholder="/api/rates"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Booking Endpoint"
                                    name="booking"
                                    value={endpoints.booking}
                                    onChange={handleEndpointChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    placeholder="/api/book"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Tracking Endpoint"
                                    name="tracking"
                                    value={endpoints.tracking}
                                    onChange={handleEndpointChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    placeholder="/api/track"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Cancel Endpoint"
                                    name="cancel"
                                    value={endpoints.cancel}
                                    onChange={handleEndpointChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    placeholder="/api/cancel"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Labels Endpoint"
                                    name="labels"
                                    value={endpoints.labels}
                                    onChange={handleEndpointChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    placeholder="/api/labels"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Status Endpoint"
                                    name="status"
                                    value={endpoints.status}
                                    onChange={handleEndpointChange}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    placeholder="/api/status"
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>

                    {/* Moved Action Buttons and Enable Toggle to Bottom */}
                    <DialogActions sx={{
                        px: 3,
                        pb: 3,
                        borderTop: '1px solid #e5e7eb',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    name="enabled"
                                    checked={formData.enabled}
                                    onChange={handleFormChange}
                                    size="small"
                                    color="primary"
                                />
                            }
                            label={
                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    Enable this carrier for rate quotes and bookings
                                </Typography>
                            }
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                onClick={handleCloseDialog}
                                size="small"
                                sx={{ fontSize: '12px' }}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                size="small"
                                startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
                                disabled={saving || !!carrierIdError}
                                sx={{ fontSize: '12px', minWidth: '100px' }}
                            >
                                {saving ? 'Saving...' : (isEditMode ? 'Save' : 'Create Carrier')}
                            </Button>
                        </Box>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Enhanced Delete Confirmation Dialog with High Side Effects Warning */}
            <Dialog
                open={openDeleteConfirm}
                onClose={() => {
                    setOpenDeleteConfirm(false);
                    setForceDelete(false);
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: '#dc2626'
                }}>
                    <WarningIcon color="error" />
                    Critical Action Required
                </DialogTitle>
                <DialogContent>
                    <Alert severity="error" sx={{ mb: 3 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                            High Side Effects Warning
                        </Typography>
                        <Typography sx={{ fontSize: '12px', mt: 1 }}>
                            Deleting carrier <strong>{selectedCarrier?.name}</strong> will have significant consequences:
                        </Typography>
                        <ul style={{ fontSize: '12px', marginTop: '8px', marginBottom: '8px' }}>
                            <li>All existing shipments using this carrier will lose carrier association</li>
                            <li>Future rate quotes will no longer include this carrier</li>
                            <li>API integrations and credentials will be permanently lost</li>
                            <li>Historical billing and tracking data may become inaccessible</li>
                            <li>Company carrier configurations will be broken</li>
                        </ul>
                    </Alert>

                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                            Recommended Alternative
                        </Typography>
                        <Typography sx={{ fontSize: '12px', mt: 1 }}>
                            Consider <strong>disabling</strong> the carrier instead of deleting it. This will:
                        </Typography>
                        <ul style={{ fontSize: '12px', marginTop: '8px' }}>
                            <li>Preserve all historical data and associations</li>
                            <li>Prevent new shipments from using this carrier</li>
                            <li>Allow you to re-enable the carrier later if needed</li>
                            <li>Maintain data integrity across the system</li>
                        </ul>
                    </Alert>

                    <Box sx={{ p: 2, bgcolor: '#fef2f2', borderRadius: 1, border: '1px solid #fecaca' }}>
                        <FormControlLabel
                            control={
                                <MuiCheckbox
                                    checked={forceDelete}
                                    onChange={(e) => setForceDelete(e.target.checked)}
                                    color="error"
                                />
                            }
                            label={
                                <Typography sx={{ fontSize: '12px', color: '#dc2626' }}>
                                    I understand the consequences and want to permanently delete this carrier
                                </Typography>
                            }
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => {
                            setOpenDeleteConfirm(false);
                            setForceDelete(false);
                        }}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handleDeleteCarrier(false)}
                        startIcon={<BlockIcon />}
                        variant="outlined"
                        color="warning"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Disable Instead
                    </Button>
                    <Button
                        onClick={() => handleDeleteCarrier(true)}
                        startIcon={<DeleteIcon />}
                        color="error"
                        variant="contained"
                        size="small"
                        disabled={!forceDelete}
                        sx={{ fontSize: '12px' }}
                    >
                        Force Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminCarriers; 
