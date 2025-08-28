/**
 * Shipping Zones Configuration Component
 * Manages hierarchical geographic zones: Country > State/Province > City
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
    Collapse,
    Grid,
    Autocomplete
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Public as CountryIcon,
    Map as StateIcon,
    LocationCity as CityIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Flag as FlagIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { useSnackbar } from 'notistack';

const ShippingZonesConfiguration = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [zones, setZones] = useState([]);
    const [hierarchy, setHierarchy] = useState({});
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingZone, setEditingZone] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingZone, setDeletingZone] = useState(null);
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedZone, setSelectedZone] = useState(null);
    const [expandedCountries, setExpandedCountries] = useState({});
    const [expandedStates, setExpandedStates] = useState({});
    const [viewMode, setViewMode] = useState('hierarchical'); // 'hierarchical' or 'table'

    // Form state
    const [formData, setFormData] = useState({
        country: '',
        stateProvince: '',
        city: '',
        zoneName: '',
        zoneCode: '',
        description: '',
        enabled: true
    });

    // Country and state/province options
    const countries = [
        { code: 'US', name: 'United States' },
        { code: 'CA', name: 'Canada' },
        { code: 'MX', name: 'Mexico' }
    ];

    const canadianProvinces = [
        { code: 'ON', name: 'Ontario' },
        { code: 'QC', name: 'Quebec' },
        { code: 'BC', name: 'British Columbia' },
        { code: 'AB', name: 'Alberta' },
        { code: 'MB', name: 'Manitoba' },
        { code: 'SK', name: 'Saskatchewan' },
        { code: 'NS', name: 'Nova Scotia' },
        { code: 'NB', name: 'New Brunswick' },
        { code: 'PE', name: 'Prince Edward Island' },
        { code: 'NL', name: 'Newfoundland and Labrador' },
        { code: 'NU', name: 'Nunavut' },
        { code: 'NT', name: 'Northwest Territories' },
        { code: 'YT', name: 'Yukon' }
    ];

    const usStates = [
        { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
        { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
        { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
        { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
        { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
        { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
        { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
        { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
        { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
        { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
        { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
        { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
        { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
        { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
        { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
        { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
        { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
        { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
        { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
        { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
        { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
        { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
        { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
        { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
        { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
    ];

    // Load shipping zones
    const loadZones = useCallback(async () => {
        setLoading(true);
        try {
            const getShippingZones = httpsCallable(functions, 'getShippingZones');
            const result = await getShippingZones();

            if (result.data.success) {
                setZones(result.data.zones || []);
                setHierarchy(result.data.hierarchy || {});
            } else {
                enqueueSnackbar('Failed to load shipping zones', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading shipping zones:', error);
            enqueueSnackbar('Error loading shipping zones', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        loadZones();
    }, [loadZones]);

    // Handle add zone
    const handleAddZone = () => {
        setEditingZone(null);
        setFormData({
            country: '',
            stateProvince: '',
            city: '',
            zoneName: '',
            zoneCode: '',
            description: '',
            enabled: true
        });
        setDialogOpen(true);
    };

    // Handle edit zone
    const handleEditZone = (zone) => {
        setEditingZone(zone);
        setFormData({
            country: zone.country || '',
            stateProvince: zone.stateProvince || '',
            city: zone.city || '',
            zoneName: zone.zoneName || '',
            zoneCode: zone.zoneCode || '',
            description: zone.description || '',
            enabled: zone.enabled !== false
        });
        setDialogOpen(true);
        handleCloseActionMenu();
    };

    // Handle save zone
    const handleSaveZone = async () => {
        if (!formData.country) {
            enqueueSnackbar('Country is required', { variant: 'error' });
            return;
        }

        try {
            if (editingZone) {
                const updateShippingZone = httpsCallable(functions, 'updateShippingZone');
                await updateShippingZone({
                    zoneId: editingZone.id,
                    ...formData
                });
                enqueueSnackbar('Shipping zone updated successfully', { variant: 'success' });
            } else {
                const createShippingZone = httpsCallable(functions, 'createShippingZone');
                await createShippingZone(formData);
                enqueueSnackbar('Shipping zone created successfully', { variant: 'success' });
            }

            setDialogOpen(false);
            loadZones();
        } catch (error) {
            console.error('Error saving shipping zone:', error);
            enqueueSnackbar(error.message || 'Failed to save shipping zone', { variant: 'error' });
        }
    };

    // Handle delete zone
    const handleDeleteZone = (zone) => {
        setDeletingZone(zone);
        setDeleteConfirmOpen(true);
        handleCloseActionMenu();
    };

    const confirmDeleteZone = async () => {
        if (!deletingZone) return;

        try {
            const deleteShippingZone = httpsCallable(functions, 'deleteShippingZone');
            await deleteShippingZone({ zoneId: deletingZone.id });
            enqueueSnackbar('Shipping zone deleted successfully', { variant: 'success' });
            setDeleteConfirmOpen(false);
            setDeletingZone(null);
            loadZones();
        } catch (error) {
            console.error('Error deleting shipping zone:', error);
            enqueueSnackbar(error.message || 'Failed to delete shipping zone', { variant: 'error' });
        }
    };

    // Action menu handlers
    const handleOpenActionMenu = (event, zone) => {
        setActionMenuAnchor(event.currentTarget);
        setSelectedZone(zone);
    };

    const handleCloseActionMenu = () => {
        setActionMenuAnchor(null);
        setSelectedZone(null);
    };

    // Get available states/provinces based on selected country
    const getStateProvinceOptions = () => {
        if (formData.country === 'CA') {
            return canadianProvinces;
        } else if (formData.country === 'US') {
            return usStates;
        }
        return [];
    };

    // Toggle country expansion
    const toggleCountryExpansion = (countryCode) => {
        setExpandedCountries(prev => ({
            ...prev,
            [countryCode]: !prev[countryCode]
        }));
    };

    // Toggle state expansion
    const toggleStateExpansion = (countryCode, stateCode) => {
        const key = `${countryCode}-${stateCode}`;
        setExpandedStates(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Get zone icon based on type
    const getZoneIcon = (zone) => {
        if (zone.city) return <CityIcon sx={{ fontSize: '16px', color: '#10b981' }} />;
        if (zone.stateProvince) return <StateIcon sx={{ fontSize: '16px', color: '#3b82f6' }} />;
        return <CountryIcon sx={{ fontSize: '16px', color: '#8b5cf6' }} />;
    };

    // Get zone type label
    const getZoneTypeLabel = (zone) => {
        if (zone.city) return 'City';
        if (zone.stateProvince) return 'State/Province';
        return 'Country';
    };

    // Render hierarchical view
    const renderHierarchicalView = () => {
        return (
            <Box>
                {Object.entries(hierarchy).map(([countryCode, countryData]) => (
                    <Paper key={countryCode} sx={{ mb: 2, border: '1px solid #e5e7eb' }}>
                        {/* Country Level */}
                        <Box
                            sx={{
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor: '#f8fafc',
                                cursor: 'pointer'
                            }}
                            onClick={() => toggleCountryExpansion(countryCode)}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {expandedCountries[countryCode] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                <FlagIcon sx={{ color: '#8b5cf6' }} />
                                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                                    {countryData.name} ({countryCode})
                                </Typography>
                                <Chip
                                    label={`${Object.keys(countryData.states).length} states/provinces`}
                                    size="small"
                                    sx={{ fontSize: '11px' }}
                                />
                            </Box>
                        </Box>

                        <Collapse in={expandedCountries[countryCode]}>
                            {Object.entries(countryData.states).map(([stateCode, stateData]) => (
                                <Box key={stateCode} sx={{ ml: 3 }}>
                                    {/* State/Province Level */}
                                    <Box
                                        sx={{
                                            p: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: '1px solid #f3f4f6',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => toggleStateExpansion(countryCode, stateCode)}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {expandedStates[`${countryCode}-${stateCode}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                            <StateIcon sx={{ color: '#3b82f6' }} />
                                            <Typography sx={{ fontSize: '13px' }}>
                                                {stateData.name} ({stateCode})
                                            </Typography>
                                            <Chip
                                                label={`${Object.keys(stateData.cities).length} cities`}
                                                size="small"
                                                sx={{ fontSize: '10px' }}
                                            />
                                        </Box>
                                    </Box>

                                    <Collapse in={expandedStates[`${countryCode}-${stateCode}`]}>
                                        {Object.entries(stateData.cities).map(([cityCode, cityData]) => (
                                            <Box
                                                key={cityCode}
                                                sx={{
                                                    p: 1,
                                                    ml: 3,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    borderBottom: '1px solid #f9fafb'
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CityIcon sx={{ color: '#10b981' }} />
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        {cityData.name}
                                                    </Typography>
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        const zone = zones.find(z => z.id === cityData.zoneId);
                                                        if (zone) handleOpenActionMenu(e, zone);
                                                    }}
                                                >
                                                    <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Collapse>
                                </Box>
                            ))}
                        </Collapse>
                    </Paper>
                ))}
            </Box>
        );
    };

    // Render table view
    const renderTableView = () => {
        return (
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Country</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>State/Province</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>City</TableCell>
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
                        ) : zones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                        No shipping zones configured. Add a zone to get started.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            zones.map((zone) => (
                                <TableRow key={zone.id}>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {getZoneIcon(zone)}
                                            {zone.zoneName}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{zone.zoneCode}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={getZoneTypeLabel(zone)}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{zone.country}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{zone.stateProvince || '-'}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{zone.city || '-'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={zone.enabled ? 'Active' : 'Inactive'}
                                            color={zone.enabled ? 'success' : 'default'}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleOpenActionMenu(e, zone)}
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
        );
    };

    return (
        <Box>
            {/* Header with Add Button and View Toggle */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Manage geographic zones for rate card configurations and shipping calculations
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <FormControl size="small">
                        <Select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value)}
                            sx={{ fontSize: '12px', minWidth: 120 }}
                        >
                            <MenuItem value="hierarchical" sx={{ fontSize: '12px' }}>Hierarchical</MenuItem>
                            <MenuItem value="table" sx={{ fontSize: '12px' }}>Table View</MenuItem>
                        </Select>
                    </FormControl>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddZone}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Zone
                    </Button>
                </Box>
            </Box>

            {/* Content */}
            {viewMode === 'hierarchical' ? renderHierarchicalView() : renderTableView()}

            {/* Add/Edit Zone Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingZone ? 'Edit Shipping Zone' : 'Add Shipping Zone'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                <Select
                                    value={formData.country}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        country: e.target.value,
                                        stateProvince: '' // Reset state when country changes
                                    }))}
                                    label="Country"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {countries.map((country) => (
                                        <MenuItem key={country.code} value={country.code} sx={{ fontSize: '12px' }}>
                                            {country.name} ({country.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>State/Province</InputLabel>
                                <Select
                                    value={formData.stateProvince}
                                    onChange={(e) => setFormData(prev => ({ ...prev, stateProvince: e.target.value }))}
                                    label="State/Province"
                                    disabled={!formData.country}
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {getStateProvinceOptions().map((state) => (
                                        <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                            {state.name} ({state.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="City"
                                value={formData.city}
                                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Enter city name"
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Zone Name"
                                value={formData.zoneName}
                                onChange={(e) => setFormData(prev => ({ ...prev, zoneName: e.target.value }))}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Auto-generated if empty"
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Zone Code"
                                value={formData.zoneCode}
                                onChange={(e) => setFormData(prev => ({ ...prev, zoneCode: e.target.value }))}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Auto-generated if empty"
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.enabled}
                                        onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                multiline
                                rows={2}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Optional description for this zone"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDialogOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveZone}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingZone ? 'Update' : 'Create'} Zone
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Delete Zone
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px', mb: 2 }}>
                        Are you sure you want to delete the zone "{deletingZone?.zoneName}"?
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#ef4444' }}>
                        This action cannot be undone. This zone will be removed from all rate card configurations.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteConfirmOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDeleteZone}
                        color="error"
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete Zone
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
                    <MenuItem onClick={() => handleEditZone(selectedZone)}>
                        <ListItemIcon>
                            <EditIcon sx={{ fontSize: '16px' }} />
                        </ListItemIcon>
                        <ListItemText>
                            <Typography sx={{ fontSize: '12px' }}>Edit</Typography>
                        </ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => handleDeleteZone(selectedZone)}>
                        <ListItemIcon>
                            <DeleteIcon sx={{ fontSize: '16px' }} />
                        </ListItemIcon>
                        <ListItemText>
                            <Typography sx={{ fontSize: '12px' }}>Delete</Typography>
                        </ListItemText>
                    </MenuItem>
                </MenuList>
            </Menu>
        </Box>
    );
};

export default ShippingZonesConfiguration;
