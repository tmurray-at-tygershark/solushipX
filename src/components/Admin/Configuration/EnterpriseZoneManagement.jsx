/**
 * Enterprise Zone Management Component
 * Implements the battle-tested zone architecture:
 * Regions → ZoneSets → Zone Maps → Carrier Bindings → Overrides
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
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
    Menu,
    MenuList,
    ListItemIcon,
    ListItemText,
    Alert,
    Tabs,
    Tab,
    Grid,
    Card,
    CardContent,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Public as RegionIcon,
    Map as ZoneSetIcon,
    Route as ZoneMapIcon,
    Link as BindingIcon,
    Override as OverrideIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { useSnackbar } from 'notistack';

const EnterpriseZoneManagement = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);

    // Regions state
    const [regions, setRegions] = useState([]);
    const [regionDialogOpen, setRegionDialogOpen] = useState(false);
    const [editingRegion, setEditingRegion] = useState(null);
    const [regionForm, setRegionForm] = useState({
        type: 'country',
        code: '',
        name: '',
        parentRegionId: '',
        patterns: [],
        enabled: true,
        metadata: {}
    });

    // Zone Sets state
    const [zoneSets, setZoneSets] = useState([]);
    const [zoneSetDialogOpen, setZoneSetDialogOpen] = useState(false);
    const [editingZoneSet, setEditingZoneSet] = useState(null);
    const [zoneSetForm, setZoneSetForm] = useState({
        name: '',
        geography: '',
        version: 1,
        description: '',
        zoneCount: 0,
        coverage: 'regional',
        serviceTypes: [],
        enabled: true
    });

    // Zone Maps state
    const [zoneMaps, setZoneMaps] = useState([]);
    const [zoneMapDialogOpen, setZoneMapDialogOpen] = useState(false);
    const [editingZoneMap, setEditingZoneMap] = useState(null);
    const [zoneMapForm, setZoneMapForm] = useState({
        zoneSetId: '',
        originRegionId: '',
        destinationRegionId: '',
        zoneCode: '',
        serviceType: '',
        enabled: true
    });

    // Carrier Bindings state
    const [carrierBindings, setCarrierBindings] = useState([]);
    const [carrierBindingDialogOpen, setCarrierBindingDialogOpen] = useState(false);
    const [editingCarrierBinding, setEditingCarrierBinding] = useState(null);
    const [carrierBindingForm, setCarrierBindingForm] = useState({
        carrierId: '',
        carrierName: '',
        zoneSetId: '',
        serviceTypes: [],
        effectiveFrom: null,
        effectiveTo: null,
        enabled: true
    });

    // Action menu state
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    // Region types
    const regionTypes = [
        { value: 'country', label: 'Country', description: 'National level (CA, US, MX)' },
        { value: 'state_province', label: 'State/Province', description: 'State or province level (ON, BC, NY, CA)' },
        { value: 'fsa', label: 'FSA', description: 'Canadian Forward Sortation Area (M5V, K1A)' },
        { value: 'zip3', label: 'ZIP3', description: 'US 3-digit ZIP code (902, 100)' },
        { value: 'city', label: 'City', description: 'Municipal level' }
    ];

    const coverageTypes = [
        { value: 'regional', label: 'Regional' },
        { value: 'national', label: 'National' },
        { value: 'cross_border', label: 'Cross Border' },
        { value: 'international', label: 'International' }
    ];

    const serviceTypes = [
        { value: 'courier', label: 'Courier' },
        { value: 'ltl', label: 'LTL' },
        { value: 'ftl', label: 'FTL' },
        { value: 'air', label: 'Air' },
        { value: 'ocean', label: 'Ocean' }
    ];

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 0) {
            loadRegions();
        } else if (activeTab === 1) {
            loadZoneSets();
        }
    }, [activeTab]);

    // Load regions
    const loadRegions = useCallback(async () => {
        setLoading(true);
        try {
            const getRegions = httpsCallable(functions, 'getRegions');
            const result = await getRegions();

            if (result.data.success) {
                setRegions(result.data.regions || []);
            } else {
                enqueueSnackbar('Failed to load regions', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading regions:', error);
            enqueueSnackbar('Error loading regions', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    // Load zone sets
    const loadZoneSets = useCallback(async () => {
        setLoading(true);
        try {
            const getZoneSets = httpsCallable(functions, 'getZoneSets');
            const result = await getZoneSets();

            if (result.data.success) {
                setZoneSets(result.data.zoneSets || []);
            } else {
                enqueueSnackbar('Failed to load zone sets', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading zone sets:', error);
            enqueueSnackbar('Error loading zone sets', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    // Handle add region
    const handleAddRegion = () => {
        setEditingRegion(null);
        setRegionForm({
            type: 'country',
            code: '',
            name: '',
            parentRegionId: '',
            patterns: [],
            enabled: true,
            metadata: {}
        });
        setRegionDialogOpen(true);
    };

    

    // Handle save region
    const handleSaveRegion = async () => {
        if (!regionForm.type || !regionForm.code || !regionForm.name) {
            enqueueSnackbar('Type, code, and name are required', { variant: 'error' });
            return;
        }

        try {
            const createRegion = httpsCallable(functions, 'createRegion');
            await createRegion(regionForm);
            enqueueSnackbar('Region created successfully', { variant: 'success' });
            setRegionDialogOpen(false);
            loadRegions();
        } catch (error) {
            console.error('Error saving region:', error);
            enqueueSnackbar(error.message || 'Failed to save region', { variant: 'error' });
        }
    };

    // Handle add zone set
    const handleAddZoneSet = () => {
        setEditingZoneSet(null);
        setZoneSetForm({
            name: '',
            geography: '',
            version: 1,
            description: '',
            zoneCount: 0,
            coverage: 'regional',
            serviceTypes: [],
            enabled: true
        });
        setZoneSetDialogOpen(true);
    };

    // Handle save zone set
    const handleSaveZoneSet = async () => {
        if (!zoneSetForm.name || !zoneSetForm.geography) {
            enqueueSnackbar('Name and geography are required', { variant: 'error' });
            return;
        }

        try {
            const createZoneSet = httpsCallable(functions, 'createZoneSet');
            await createZoneSet(zoneSetForm);
            enqueueSnackbar('Zone set created successfully', { variant: 'success' });
            setZoneSetDialogOpen(false);
            loadZoneSets();
        } catch (error) {
            console.error('Error saving zone set:', error);
            enqueueSnackbar(error.message || 'Failed to save zone set', { variant: 'error' });
        }
    };

    // Action menu handlers
    const handleOpenActionMenu = (event, item) => {
        setActionMenuAnchor(event.currentTarget);
        setSelectedItem(item);
    };

    const handleCloseActionMenu = () => {
        setActionMenuAnchor(null);
        setSelectedItem(null);
    };

    const handleEditItem = () => {
        if (selectedItem) {
            if (activeTab === 0) {
                // Edit Region
                setEditingRegion(selectedItem);
                setRegionForm({
                    type: selectedItem.type,
                    code: selectedItem.code,
                    name: selectedItem.name,
                    parentRegionId: selectedItem.parentRegionId || '',
                    patterns: selectedItem.patterns || [],
                    enabled: selectedItem.enabled !== false,
                    metadata: selectedItem.metadata || {}
                });
                setRegionDialogOpen(true);
            } else if (activeTab === 1) {
                // Edit Zone Set
                setEditingZoneSet(selectedItem);
                setZoneSetForm({
                    name: selectedItem.name,
                    geography: selectedItem.geography,
                    version: selectedItem.version || 1,
                    description: selectedItem.description || '',
                    zoneCount: selectedItem.zoneCount || 0,
                    coverage: selectedItem.coverage || 'regional',
                    serviceTypes: selectedItem.serviceTypes || [],
                    enabled: selectedItem.enabled !== false
                });
                setZoneSetDialogOpen(true);
            }
        }
        handleCloseActionMenu();
    };

    const handleDeleteItem = () => {
        if (selectedItem) {
            if (window.confirm(`Are you sure you want to delete ${selectedItem.name || selectedItem.code}?`)) {
                // TODO: Implement delete functionality
                enqueueSnackbar('Delete functionality coming soon', { variant: 'info' });
            }
        }
        handleCloseActionMenu();
    };

    // Zone Map handlers
    const handleAddZoneMap = () => {
        setEditingZoneMap(null);
        setZoneMapForm({
            zoneSetId: '',
            originRegionId: '',
            destinationRegionId: '',
            zoneCode: '',
            serviceType: '',
            enabled: true
        });
        setZoneMapDialogOpen(true);
    };

    // Carrier Binding handlers
    const handleAddCarrierBinding = () => {
        setEditingCarrierBinding(null);
        setCarrierBindingForm({
            carrierId: '',
            carrierName: '',
            zoneSetId: '',
            serviceTypes: [],
            effectiveFrom: null,
            effectiveTo: null,
            enabled: true
        });
        setCarrierBindingDialogOpen(true);
    };

    // Render regions tab
    const renderRegionsTab = () => (
        <Box>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Atomic geographic keys (FSA, ZIP3, state/province, country) for zone mapping
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddRegion}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Region
                </Button>
            </Box>

            {/* Info Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {regionTypes.slice(0, 4).map((type) => (
                    <Grid item xs={12} md={3} key={type.value}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <RegionIcon sx={{ fontSize: '16px', color: '#3b82f6' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        {type.label}
                                    </Typography>
                                </Box>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    {type.description}
                                </Typography>
                                <Chip
                                    label={`${regions.filter(r => r.type === type.value).length} regions`}
                                    size="small"
                                    sx={{ fontSize: '10px', mt: 1 }}
                                />
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Regions Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Parent</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '80px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                    <CircularProgress size={20} />
                                </TableCell>
                            </TableRow>
                        ) : regions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                        No regions configured. Add regions to get started.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            regions.map((region) => (
                                <TableRow key={region.id}>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={region.type.replace('_', ' ').toUpperCase()}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                        {region.code}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{region.name}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {region.parentRegionId ? (
                                            <Chip label="Has Parent" size="small" sx={{ fontSize: '10px' }} />
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={region.enabled ? 'Active' : 'Inactive'}
                                            color={region.enabled ? 'success' : 'default'}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleOpenActionMenu(e, region)}
                                        >
                                            <MoreVertIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    // Render zone sets tab
    const renderZoneSetsTab = () => (
        <Box>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Reusable zone templates that can be shared across multiple carriers
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddZoneSet}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Zone Set
                </Button>
            </Box>

            {/* Zone Sets Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Geography</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Version</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Coverage</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Services</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zones</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '80px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                                    <CircularProgress size={20} />
                                </TableCell>
                            </TableRow>
                        ) : zoneSets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                        No zone sets configured. Add zone sets to get started.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            zoneSets.map((zoneSet) => (
                                <TableRow key={zoneSet.id}>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                        {zoneSet.name}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                        {zoneSet.geography}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={`v${zoneSet.version}`}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={zoneSet.coverage}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zoneSet.serviceTypes.slice(0, 2).map(service => (
                                            <Chip
                                                key={service}
                                                label={service.toUpperCase()}
                                                size="small"
                                                sx={{ fontSize: '9px', mr: 0.5, mb: 0.5 }}
                                            />
                                        ))}
                                        {zoneSet.serviceTypes.length > 2 && (
                                            <Chip
                                                label={`+${zoneSet.serviceTypes.length - 2}`}
                                                size="small"
                                                sx={{ fontSize: '9px' }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zoneSet.zoneCount || 0} zones
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={zoneSet.enabled ? 'Active' : 'Inactive'}
                                            color={zoneSet.enabled ? 'success' : 'default'}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleOpenActionMenu(e, zoneSet)}
                                        >
                                            <MoreVertIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    const renderZoneMapsTab = () => (
        <Box>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Origin/destination zone mappings for rate calculation
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddZoneMap}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Zone Map
                </Button>
            </Box>

            <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                Zone Maps allow you to define how origin and destination regions map to specific zone codes for rate calculation.
                For example: "Ontario, Canada → Zone A" or "New York → Zone 1".
            </Alert>

            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Set</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Origin</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Destination</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Service Type</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', textAlign: 'center' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                No zone maps configured. Zone maps will be available once zone sets are created.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    const renderCarrierBindingsTab = () => (
        <Box>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Carrier associations with zone sets and effective date ranges
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddCarrierBinding}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Carrier Binding
                </Button>
            </Box>

            <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                Carrier Bindings link specific carriers to zone sets with effective date ranges.
                This allows different carriers to use different zone structures for the same geographic areas.
            </Alert>

            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Carrier</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Set</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Service Types</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Effective From</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Effective To</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', textAlign: 'center' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                No carrier bindings configured. Create zone sets first, then bind carriers to them.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    return (
        <Box>
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    sx={{
                        '& .MuiTab-root': {
                            fontSize: '12px',
                            textTransform: 'none',
                            minHeight: 40
                        }
                    }}
                >
                    <Tab
                        icon={<RegionIcon sx={{ fontSize: '16px' }} />}
                        label="Regions"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<ZoneSetIcon sx={{ fontSize: '16px' }} />}
                        label="Zone Sets"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<ZoneMapIcon sx={{ fontSize: '16px' }} />}
                        label="Zone Maps"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<BindingIcon sx={{ fontSize: '16px' }} />}
                        label="Carrier Bindings"
                        iconPosition="start"
                    />
                </Tabs>
            </Box>

            {/* Tab Content */}
            {activeTab === 0 && renderRegionsTab()}
            {activeTab === 1 && renderZoneSetsTab()}
            {activeTab === 2 && renderZoneMapsTab()}
            {activeTab === 3 && renderCarrierBindingsTab()}

            {/* Region Dialog */}
            <Dialog
                open={regionDialogOpen}
                onClose={() => setRegionDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingRegion ? 'Edit Region' : 'Add Region'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                                <Select
                                    value={regionForm.type}
                                    onChange={(e) => setRegionForm(prev => ({ ...prev, type: e.target.value }))}
                                    label="Type"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {regionTypes.map((type) => (
                                        <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                            {type.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Code"
                                value={regionForm.code}
                                onChange={(e) => setRegionForm(prev => ({ ...prev, code: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., CA, ON, M5V, 902"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Name"
                                value={regionForm.name}
                                onChange={(e) => setRegionForm(prev => ({ ...prev, name: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., Canada, Ontario, Downtown Toronto"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={regionForm.enabled}
                                        onChange={(e) => setRegionForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setRegionDialogOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveRegion}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingRegion ? 'Update' : 'Create'} Region
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Zone Set Dialog */}
            <Dialog
                open={zoneSetDialogOpen}
                onClose={() => setZoneSetDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingZoneSet ? 'Edit Zone Set' : 'Add Zone Set'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                fullWidth
                                label="Name"
                                value={zoneSetForm.name}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, name: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., CA-Courier-FSA v1"
                            />
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="Version"
                                type="number"
                                value={zoneSetForm.version}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, version: parseInt(e.target.value) || 1 }))}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                inputProps={{ min: 1 }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Geography"
                                value={zoneSetForm.geography}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, geography: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., CA_FSA, US_ZIP3, CA_US_CROSS_BORDER"
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Coverage</InputLabel>
                                <Select
                                    value={zoneSetForm.coverage}
                                    onChange={(e) => setZoneSetForm(prev => ({ ...prev, coverage: e.target.value }))}
                                    label="Coverage"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {coverageTypes.map((type) => (
                                        <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                            {type.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={zoneSetForm.description}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, description: e.target.value }))}
                                multiline
                                rows={2}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Optional description for this zone set"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={zoneSetForm.enabled}
                                        onChange={(e) => setZoneSetForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setZoneSetDialogOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveZoneSet}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingZoneSet ? 'Update' : 'Create'} Zone Set
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleCloseActionMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuList dense>
                    <MenuItem onClick={handleEditItem}>
                        <ListItemIcon>
                            <EditIcon sx={{ fontSize: '16px' }} />
                        </ListItemIcon>
                        <ListItemText>
                            <Typography sx={{ fontSize: '12px' }}>Edit</Typography>
                        </ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleDeleteItem}>
                        <ListItemIcon>
                            <DeleteIcon sx={{ fontSize: '16px' }} />
                        </ListItemIcon>
                        <ListItemText>
                            <Typography sx={{ fontSize: '12px' }}>Delete</Typography>
                        </ListItemText>
                    </MenuItem>
                </MenuList>
            </Menu>

            {/* Zone Map Dialog */}
            <Dialog
                open={zoneMapDialogOpen}
                onClose={() => setZoneMapDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingZoneMap ? 'Edit Zone Map' : 'Add Zone Map'}
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                        Zone Maps define how origin and destination regions map to specific zone codes for rate calculation.
                    </Alert>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                                <InputLabel sx={{ fontSize: '12px' }}>Zone Set</InputLabel>
                                <Select
                                    value={zoneMapForm.zoneSetId}
                                    label="Zone Set"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {zoneSets.map((zoneSet) => (
                                        <MenuItem key={zoneSet.id} value={zoneSet.id} sx={{ fontSize: '12px' }}>
                                            {zoneSet.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Zone Code"
                                value={zoneMapForm.zoneCode}
                                placeholder="e.g., Zone A, Zone 1"
                                sx={{ mt: 1, '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                Geographic Mapping
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Origin Region</InputLabel>
                                <Select
                                    value={zoneMapForm.originRegionId}
                                    label="Origin Region"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {regions.map((region) => (
                                        <MenuItem key={region.id} value={region.id} sx={{ fontSize: '12px' }}>
                                            {region.name} ({region.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Destination Region</InputLabel>
                                <Select
                                    value={zoneMapForm.destinationRegionId}
                                    label="Destination Region"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {regions.map((region) => (
                                        <MenuItem key={region.id} value={region.id} sx={{ fontSize: '12px' }}>
                                            {region.name} ({region.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setZoneMapDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" size="small" sx={{ fontSize: '12px' }}>
                        {editingZoneMap ? 'Update' : 'Create'} Zone Map
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Carrier Binding Dialog */}
            <Dialog
                open={carrierBindingDialogOpen}
                onClose={() => setCarrierBindingDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingCarrierBinding ? 'Edit Carrier Binding' : 'Add Carrier Binding'}
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                        Carrier Bindings link specific carriers to zone sets with effective date ranges.
                    </Alert>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Carrier Name"
                                value={carrierBindingForm.carrierName}
                                placeholder="e.g., FedEx, UPS, Purolator"
                                sx={{ mt: 1, '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                                <InputLabel sx={{ fontSize: '12px' }}>Zone Set</InputLabel>
                                <Select
                                    value={carrierBindingForm.zoneSetId}
                                    label="Zone Set"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {zoneSets.map((zoneSet) => (
                                        <MenuItem key={zoneSet.id} value={zoneSet.id} sx={{ fontSize: '12px' }}>
                                            {zoneSet.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                Service Types (Select multiple)
                            </Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Service Types</InputLabel>
                                <Select
                                    multiple
                                    value={carrierBindingForm.serviceTypes}
                                    label="Service Types"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {serviceTypes.map((service) => (
                                        <MenuItem key={service.value} value={service.value} sx={{ fontSize: '12px' }}>
                                            {service.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={<Switch checked={carrierBindingForm.enabled} size="small" />}
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCarrierBindingDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" size="small" sx={{ fontSize: '12px' }}>
                        {editingCarrierBinding ? 'Update' : 'Create'} Carrier Binding
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EnterpriseZoneManagement;
