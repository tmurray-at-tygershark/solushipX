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
    Checkbox,
    Avatar,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    CloudUpload as CloudUploadIcon,
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    FileDownload as ExportIcon,
    Close as CloseIcon,
    LocalShipping as CarrierIcon,
    Visibility as ViewIcon,
    ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
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
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Checkbox disabled />
                            Carrier
                        </Box>
                    </TableCell>
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
                                <Checkbox disabled />
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
    const [selected, setSelected] = useState([]);

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
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [carrierIdError, setCarrierIdError] = useState('');

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        carrierID: '',
        accountNumber: '',
        type: 'courier',
        enabled: true,
        hostURL: '',
        apiCredentials: {},
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

    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = carriers.map(carrier => carrier.id);
            setSelected(newSelected);
            return;
        }
        setSelected([]);
    };

    const handleSelect = (id) => {
        const selectedIndex = selected.indexOf(id);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1),
            );
        }

        setSelected(newSelected);
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
                carrierID: carrier.carrierID || '',
                accountNumber: carrier.apiCredentials?.accountNumber || carrier.accountNumber || '',
                type: carrier.type || 'courier',
                enabled: carrier.enabled ?? true,
                hostURL: carrier.apiCredentials?.hostURL || carrier.hostURL || '',
                apiCredentials: carrier.apiCredentials || {},
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
        } else {
            setSelectedCarrier(null);
            setFormData({
                name: '',
                carrierID: '',
                accountNumber: '',
                type: 'courier',
                enabled: true,
                hostURL: '',
                apiCredentials: {},
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
        }
        setLogoFile(null);
        setCarrierIdError('');
        setOpenDialog(true);
        handleActionMenuClose();
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedCarrier(null);
        setLogoFile(null);
        setLogoPreview('');
        setUploadProgress(0);
        setUploadError(null);
        setCarrierIdError('');
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ExportIcon />}
                            sx={{ fontSize: '12px' }}
                        >
                            Export
                        </Button>
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
                        <Tab label={
                            <Badge badgeContent={stats.enabled} color="success" sx={{ '& .MuiBadge-badge': { fontSize: '10px' } }}>
                                Enabled
                            </Badge>
                        } value="enabled" />
                        <Tab label={
                            <Badge badgeContent={stats.disabled} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '10px' } }}>
                                Disabled
                            </Badge>
                        } value="disabled" />
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
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Checkbox
                                                indeterminate={selected.length > 0 && selected.length < carriers.length}
                                                checked={carriers.length > 0 && selected.length === carriers.length}
                                                onChange={handleSelectAll}
                                                size="small"
                                            />
                                            Carrier
                                        </Box>
                                    </TableCell>
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
                                                <Checkbox
                                                    checked={selected.indexOf(carrier.id) !== -1}
                                                    onChange={() => handleSelect(carrier.id)}
                                                    size="small"
                                                />
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

            {/* Carrier Form Dialog - Simplified for now */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    {selectedCarrier ? 'Edit Carrier' : 'Add New Carrier'}
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Carrier configuration dialog will be implemented with full form fields.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleCloseDialog}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={openDeleteConfirm}
                onClose={() => setOpenDeleteConfirm(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete carrier <strong>{selectedCarrier?.name}</strong>?
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setOpenDeleteConfirm(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminCarriers; 
