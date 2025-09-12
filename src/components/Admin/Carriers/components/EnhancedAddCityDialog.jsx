/**
 * Enhanced Add City Dialog Component
 * Integrates system zones and custom carrier zones for rapid city selection
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Tabs,
    Tab,
    TextField,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Checkbox,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    CardHeader,
    FormControlLabel,
    Switch,
    Alert,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemButton,
    IconButton,
    Divider,
    Grid,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    Search as SearchIcon,
    Public as PublicIcon,
    LocationCity as CityIcon,
    Map as MapIcon,
    Label as ZoneIcon,
    ExpandMore as ExpandMoreIcon,
    Visibility as ViewIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import useGeographicData from '../../../../hooks/useGeographicData';
import CustomZoneManager from './CustomZoneManager';
import SystemZoneSelector from './SystemZoneSelector';
import SystemZoneSetSelector from './SystemZoneSetSelector';
import CarrierZoneSelector from './CarrierZoneSelector';
import CarrierZoneSetSelector from './CarrierZoneSetSelector';
import CarrierZoneDialog from './CarrierZoneDialog';
import CarrierZoneSetDialog from './CarrierZoneSetDialog';
import {
    addCitiesToCarrier,
    addSystemZonesToCarrier,
    addSystemZoneSetsToCarrier,
    addCustomZonesToCarrier,
    addCustomZoneSetsToCarrier
} from '../../../../services/carrierZoneManagementService';

const EnhancedAddCityDialog = ({
    open,
    onClose,
    onCityAdd,
    carrierId,
    carrierName,
    zoneCategory,
    existingCityIds
}) => {
    const { searchCities, getCityByPostalCode } = useGeographicData();
    const { enqueueSnackbar } = useSnackbar();

    // Tab state
    const [selectedTab, setSelectedTab] = useState(0);

    // Quick Add tab state (existing functionality)
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedCities, setSelectedCities] = useState([]);

    // System Zones tab state (now includes both zones and zone sets)
    const [systemSubTab, setSystemSubTab] = useState(0); // 0 = Individual Zones, 1 = Zone Sets
    const [systemZones, setSystemZones] = useState([]);
    const [selectedSystemZones, setSelectedSystemZones] = useState([]);
    const [systemZoneSets, setSystemZoneSets] = useState([]);
    const [selectedSystemZoneSets, setSelectedSystemZoneSets] = useState([]);
    const [expandedSystemZoneCities, setExpandedSystemZoneCities] = useState([]);
    const [expandedSystemCities, setExpandedSystemCities] = useState([]);

    // Custom Zone Sets tab state
    const [customSubTab, setCustomSubTab] = useState(0); // 0 = Individual Zones, 1 = Zone Sets
    const [customZones, setCustomZones] = useState([]);
    const [customZoneSets, setCustomZoneSets] = useState([]);
    const [selectedCustomZones, setSelectedCustomZones] = useState([]);
    const [selectedCustomZoneSets, setSelectedCustomZoneSets] = useState([]);
    const [customZoneLoading, setCustomZoneLoading] = useState(false);
    const [showCustomZoneManager, setShowCustomZoneManager] = useState(false);
    const [expandedCustomCities, setExpandedCustomCities] = useState([]);
    const [customZonePreview, setCustomZonePreview] = useState(false);
    const [editingCustomZoneSet, setEditingCustomZoneSet] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingZoneSet, setDeletingZoneSet] = useState(null);

    // Loading state for zone expansion
    const [expandingZones, setExpandingZones] = useState(false);

    // Carrier zone configuration for filtering
    const [carrierZoneConfig, setCarrierZoneConfig] = useState(null);
    const [enabledZoneIds, setEnabledZoneIds] = useState([]);
    const [enabledZoneSetIds, setEnabledZoneSetIds] = useState([]);

    // New carrier zone/zone set dialogs
    const [showCarrierZoneDialog, setShowCarrierZoneDialog] = useState(false);
    const [showCarrierZoneSetDialog, setShowCarrierZoneSetDialog] = useState(false);
    const [editingCarrierZone, setEditingCarrierZone] = useState(null);

    // Load carrier zone configuration to get enabled zones
    const loadCarrierZoneConfiguration = useCallback(async () => {
        if (!carrierId) return;

        try {
            const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
            const carrierConfigDoc = await getDoc(carrierConfigRef);

            if (carrierConfigDoc.exists()) {
                const config = carrierConfigDoc.data();
                setCarrierZoneConfig(config);

                // Extract enabled zone IDs from zoneReferences
                const systemZoneIds = config.zoneConfig?.zoneReferences?.system_zones?.map(z => z.id) || [];
                const systemZoneSetIds = config.zoneConfig?.zoneReferences?.system_zone_sets?.map(zs => zs.id) || [];

                setEnabledZoneIds(systemZoneIds);
                setEnabledZoneSetIds(systemZoneSetIds);

                console.log('🔍 Loaded carrier zone filter:', {
                    carrierId,
                    enabledZones: systemZoneIds.length,
                    enabledZoneSets: systemZoneSetIds.length,
                    zoneIds: systemZoneIds,
                    zoneSetIds: systemZoneSetIds
                });
            }
        } catch (error) {
            console.error('Error loading carrier zone configuration:', error);
        }
    }, [carrierId]);

    // Load carrier zone configuration when dialog opens
    useEffect(() => {
        if (open && carrierId) {
            loadCarrierZoneConfiguration();
        }
    }, [open, carrierId, loadCarrierZoneConfiguration]);

    // System zones and zone sets are now loaded by their respective components

    // Load custom carrier zones and zone sets
    const loadCustomZones = useCallback(async () => {
        if (!carrierId) return;

        setCustomZoneLoading(true);
        try {
            const getCarrierZoneSets = httpsCallable(functions, 'getCarrierCustomZoneSets');
            const result = await getCarrierZoneSets({ carrierId });

            if (result.data.success) {
                const zoneSets = result.data.zoneSets || [];
                setCustomZoneSets(zoneSets);

                // Extract individual zones from zone sets
                const allZones = [];
                zoneSets.forEach(zoneSet => {
                    if (zoneSet.zones && Array.isArray(zoneSet.zones)) {
                        zoneSet.zones.forEach(zone => {
                            allZones.push({
                                ...zone,
                                zoneSetId: zoneSet.id,
                                zoneSetName: zoneSet.name
                            });
                        });
                    }
                });
                setCustomZones(allZones);
            }
        } catch (error) {
            console.error('Error loading custom zones:', error);
            enqueueSnackbar('Failed to load custom zones', { variant: 'error' });
        } finally {
            setCustomZoneLoading(false);
        }
    }, [carrierId, enqueueSnackbar]);

    // Alias for backward compatibility
    const loadCustomZoneSets = loadCustomZones;

    // Load data when dialog opens
    useEffect(() => {
        if (open) {
            loadCustomZones();
        }
    }, [open, loadCustomZones]);

    // Quick Add search functionality (existing)
    const handleQuickSearch = useCallback(async () => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        setSearchLoading(true);
        try {
            const isPostalCode = /^[A-Za-z]\d[A-Za-z]|^\d{5}/.test(searchTerm.trim());
            let results = [];

            if (isPostalCode) {
                const postalResults = await getCityByPostalCode(searchTerm.trim());
                results = postalResults || [];
            } else {
                results = await searchCities(searchTerm.trim());
            }

            // Filter out existing cities
            const filteredResults = results.filter(city => {
                const cityId = city.searchKey || city.id;
                return !existingCityIds.has(cityId);
            });

            console.log('🔍 Manual search results for comparison:', filteredResults.map(c => ({
                city: c.city,
                latitude: c.latitude,
                longitude: c.longitude,
                hasCoords: !!(c.latitude && c.longitude),
                id: c.id,
                searchKey: c.searchKey
            })));

            setSearchResults(filteredResults);
        } catch (error) {
            console.error('Search error:', error);
            enqueueSnackbar('Search failed', { variant: 'error' });
        } finally {
            setSearchLoading(false);
        }
    }, [searchTerm, searchCities, getCityByPostalCode, existingCityIds, enqueueSnackbar]);

    // Auto-search when term changes
    useEffect(() => {
        const timer = setTimeout(handleQuickSearch, 300);
        return () => clearTimeout(timer);
    }, [handleQuickSearch]);

    // Handle system zone selection (individual zones)
    const handleSystemZoneToggle = useCallback(async (zone) => {
        const isSelected = selectedSystemZones.some(z => z.id === zone.id);

        if (isSelected) {
            // Remove from selection
            setSelectedSystemZones(prev => prev.filter(z => z.id !== zone.id));
            setExpandedSystemZoneCities(prev => prev.filter(city => !city.zoneId || city.zoneId !== zone.id));
        } else {
            // Add to selection and expand cities
            setSelectedSystemZones(prev => [...prev, zone]);

            // Expand zone to cities
            const cities = [];
            if (zone.cities && Array.isArray(zone.cities)) {
                zone.cities.forEach(city => {
                    cities.push({
                        ...city,
                        zoneId: zone.id,
                        zoneName: zone.zoneName || zone.name
                    });
                });
            }

            // Filter out existing cities
            const filteredCities = cities.filter(city => {
                const cityId = city.searchKey || city.id;
                return !existingCityIds.has(cityId);
            });

            setExpandedSystemZoneCities(prev => [...prev, ...filteredCities]);

            enqueueSnackbar(`Expanded ${filteredCities.length} cities from ${zone.zoneName || zone.name}`, {
                variant: 'success'
            });
        }
    }, [selectedSystemZones, existingCityIds, enqueueSnackbar]);

    // Handle system zone set selection
    const handleSystemZoneSetToggle = useCallback(async (zoneSet) => {
        const isSelected = selectedSystemZoneSets.some(z => z.id === zoneSet.id);

        if (isSelected) {
            // Remove from selection
            setSelectedSystemZoneSets(prev => prev.filter(z => z.id !== zoneSet.id));
            setExpandedSystemCities(prev => prev.filter(city => !city.zoneSetId || city.zoneSetId !== zoneSet.id));
        } else {
            // Add to selection and expand cities
            setSelectedSystemZoneSets(prev => [...prev, zoneSet]);

            // Expand zone set to cities
            try {
                const expandZoneSet = httpsCallable(functions, 'expandZoneSetToCities');
                const result = await expandZoneSet({ zoneSetId: zoneSet.id });

                if (result.data.success) {
                    const cities = result.data.cities.map(city => ({
                        ...city,
                        zoneSetId: zoneSet.id,
                        zoneSetName: zoneSet.name
                    }));

                    // Filter out existing cities
                    const filteredCities = cities.filter(city => {
                        const cityId = city.searchKey || city.id;
                        return !existingCityIds.has(cityId);
                    });

                    setExpandedSystemCities(prev => [...prev, ...filteredCities]);

                    enqueueSnackbar(`Expanded ${filteredCities.length} cities from ${zoneSet.name}`, {
                        variant: 'success'
                    });
                }
            } catch (error) {
                console.error('Error expanding zone set:', error);
                enqueueSnackbar('Failed to expand zone set', { variant: 'error' });
                // Remove from selection if expansion failed
                setSelectedSystemZoneSets(prev => prev.filter(z => z.id !== zoneSet.id));
            }
        }
    }, [selectedSystemZoneSets, existingCityIds, enqueueSnackbar]);

    // Handle city selection (for quick add)
    const handleCitySelect = useCallback((city) => {
        setSelectedCities(prev => {
            const cityKey = city.searchKey || city.id;
            const cityName = city.city;
            const cityState = city.provinceState || city.state;
            const cityCountry = city.country;

            // More robust matching - use the same key logic as rendering
            const existingIndex = prev.findIndex(c => {
                const selectedKey = c.searchKey || c.id;
                const selectedName = c.city;
                const selectedState = c.provinceState || c.state;
                const selectedCountry = c.country;

                // Exact key match (primary)
                if (selectedKey === cityKey) return true;

                // Name + State + Country match (fallback)
                if (selectedName === cityName &&
                    selectedState === cityState &&
                    selectedCountry === cityCountry) return true;

                return false;
            });

            if (existingIndex !== -1) {
                return prev.filter((_, index) => index !== existingIndex);
            } else {
                return [...prev, city];
            }
        });
    }, []);

    // Handle select all for quick add
    const handleSelectAll = useCallback(() => {
        const visibleResults = searchResults.slice(0, 50);
        const allSelected = selectedCities.length === visibleResults.length && visibleResults.length > 0;
        if (allSelected) {
            setSelectedCities([]);
        } else {
            setSelectedCities([...visibleResults]);
        }
    }, [selectedCities.length, searchResults]);

    // Handle custom zone set selection
    const handleCustomZoneSetToggle = useCallback(async (zoneSet) => {
        const isSelected = selectedCustomZoneSets.some(z => z.id === zoneSet.id);

        if (isSelected) {
            // Remove from selection
            setSelectedCustomZoneSets(prev => prev.filter(z => z.id !== zoneSet.id));
            setExpandedCustomCities(prev => prev.filter(city => !city.zoneSetId || city.zoneSetId !== zoneSet.id));
        } else {
            // Add to selection and expand cities
            setSelectedCustomZoneSets(prev => [...prev, zoneSet]);

            // Expand custom zone set to cities
            try {
                const cities = [];
                if (zoneSet.zones && Array.isArray(zoneSet.zones)) {
                    zoneSet.zones.forEach(zone => {
                        if (zone.cities && Array.isArray(zone.cities)) {
                            zone.cities.forEach(city => {
                                cities.push({
                                    ...city,
                                    zoneSetId: zoneSet.id,
                                    zoneSetName: zoneSet.name,
                                    zoneName: zone.name
                                });
                            });
                        }
                    });
                }

                // Filter out existing cities
                const filteredCities = cities.filter(city => {
                    const cityId = city.searchKey || city.id;
                    return !existingCityIds.has(cityId);
                });

                setExpandedCustomCities(prev => [...prev, ...filteredCities]);

                enqueueSnackbar(`Expanded ${filteredCities.length} cities from ${zoneSet.name}`, {
                    variant: 'success'
                });
            } catch (error) {
                console.error('Error expanding custom zone set:', error);
                enqueueSnackbar('Failed to expand zone set', { variant: 'error' });
                // Remove from selection if expansion failed
                setSelectedCustomZoneSets(prev => prev.filter(z => z.id !== zoneSet.id));
            }
        }
    }, [selectedCustomZoneSets, existingCityIds, enqueueSnackbar]);

    // Handle custom zone set edit
    const handleEditCustomZoneSet = useCallback((zoneSet) => {
        setEditingCustomZoneSet(zoneSet);
        setShowCustomZoneManager(true);
    }, []);

    // Handle custom zone set delete
    const handleDeleteCustomZoneSet = useCallback(async (zoneSet) => {
        setDeletingZoneSet(zoneSet);
        setShowDeleteConfirm(true);
    }, []);

    // Confirm delete custom zone set
    const confirmDeleteCustomZoneSet = useCallback(async () => {
        if (!deletingZoneSet) return;

        try {
            const deleteCustomZoneSet = httpsCallable(functions, 'deleteCarrierCustomZoneSet');
            const result = await deleteCustomZoneSet({
                carrierId,
                zoneSetId: deletingZoneSet.id
            });

            if (result.data.success) {
                enqueueSnackbar('Custom zone set deleted successfully', { variant: 'success' });
                loadCustomZoneSets(); // Reload the list
            } else {
                enqueueSnackbar('Failed to delete zone set', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error deleting custom zone set:', error);
            enqueueSnackbar('Error deleting zone set', { variant: 'error' });
        } finally {
            setShowDeleteConfirm(false);
            setDeletingZoneSet(null);
        }
    }, [deletingZoneSet, carrierId, enqueueSnackbar, loadCustomZoneSets]);

    // Handle adding selected cities
    const handleAddSelectedCities = useCallback(async () => {
        try {
            let result = null;

            if (selectedTab === 0) {
                // Quick Add tab - Add individual cities
                if (selectedCities.length === 0) {
                    enqueueSnackbar('No cities selected', { variant: 'warning' });
                    return;
                }

                result = await addCitiesToCarrier(carrierId, carrierName, selectedCities, zoneCategory);

            } else if (selectedTab === 1) {
                // System Zones tab (check sub-tab)
                if (systemSubTab === 0) {
                    // Individual system zones - use expanded cities instead of zone objects
                    if (expandedSystemZoneCities.length === 0) {
                        enqueueSnackbar('No cities to add from selected zones', { variant: 'warning' });
                        return;
                    }

                    result = await addCitiesToCarrier(carrierId, carrierName, expandedSystemZoneCities, zoneCategory);

                } else {
                    // System zone sets
                    if (selectedSystemZoneSets.length === 0) {
                        enqueueSnackbar('No zone sets selected', { variant: 'warning' });
                        return;
                    }

                    result = await addSystemZoneSetsToCarrier(carrierId, carrierName, selectedSystemZoneSets, zoneCategory);
                }

            } else if (selectedTab === 2) {
                // Custom Zones tab (check sub-tab)
                if (customSubTab === 0) {
                    // Individual custom zones
                    if (selectedCustomZones.length === 0) {
                        enqueueSnackbar('No zones selected', { variant: 'warning' });
                        return;
                    }

                    result = await addCustomZonesToCarrier(carrierId, carrierName, selectedCustomZones, zoneCategory);

                } else {
                    // Custom zone sets
                    if (selectedCustomZoneSets.length === 0) {
                        enqueueSnackbar('No zone sets selected', { variant: 'warning' });
                        return;
                    }

                    result = await addCustomZoneSetsToCarrier(carrierId, carrierName, selectedCustomZoneSets, zoneCategory);
                }
            }

            if (result && result.success) {
                enqueueSnackbar(result.message, { variant: 'success' });

                // Notify parent component with the actual cities that were added
                const allCities = [];
                if (selectedTab === 0) {
                    allCities.push(...selectedCities);
                } else if (selectedTab === 1) {
                    allCities.push(...(systemSubTab === 0 ? expandedSystemZoneCities : expandedSystemCities));
                } else if (selectedTab === 2) {
                    allCities.push(...expandedCustomCities);
                }

                onCityAdd(allCities);

                // Close dialog and reset state
                setSelectedTab(0);
                setSystemSubTab(0);
                setCustomSubTab(0);
                setSearchTerm('');
                setSearchResults([]);
                setSelectedCities([]);
                setSelectedSystemZones([]);
                setExpandedSystemZoneCities([]);
                setSelectedSystemZoneSets([]);
                setExpandedSystemCities([]);
                setSelectedCustomZoneSets([]);
                setExpandedCustomCities([]);
                setEditingCustomZoneSet(null);
                setShowDeleteConfirm(false);
                setDeletingZoneSet(null);
                setShowCarrierZoneDialog(false);
                setShowCarrierZoneSetDialog(false);
                setEditingCarrierZone(null);
                setExpandingZones(false);
                onClose();
            } else {
                enqueueSnackbar('Failed to add cities', { variant: 'error' });
            }

        } catch (error) {
            console.error('Error adding cities:', error);
            enqueueSnackbar(error.message || 'Failed to add cities', { variant: 'error' });
        }
    }, [
        selectedTab, systemSubTab, selectedCities, selectedSystemZones, selectedSystemZoneSets,
        selectedCustomZones, selectedCustomZoneSets, expandedSystemZoneCities, expandedSystemCities,
        expandedCustomCities, carrierId, carrierName, zoneCategory, onCityAdd, enqueueSnackbar
    ]);

    // Handle dialog close
    const handleClose = useCallback(() => {
        // Reset all state
        setSelectedTab(0);
        setSystemSubTab(0);
        setCustomSubTab(0);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedCities([]);
        setSelectedSystemZones([]);
        setExpandedSystemZoneCities([]);
        setSelectedSystemZoneSets([]);
        setExpandedSystemCities([]);
        setSelectedCustomZoneSets([]);
        setExpandedCustomCities([]);
        setEditingCustomZoneSet(null);
        setShowDeleteConfirm(false);
        setDeletingZoneSet(null);
        setShowCarrierZoneDialog(false);
        setShowCarrierZoneSetDialog(false);
        setEditingCarrierZone(null);
        setExpandingZones(false);
        onClose();
    }, [onClose]);

    // Get total cities count for current tab
    const getTotalCitiesCount = () => {
        if (selectedTab === 0) return selectedCities.length;
        if (selectedTab === 1) {
            // System Zones tab (check sub-tab)
            if (systemSubTab === 0) {
                return expandedSystemZoneCities.length; // Individual zones
            } else {
                return expandedSystemCities.length; // Zone sets
            }
        }
        if (selectedTab === 2) return expandedCustomCities.length; // Custom zones
        return 0;
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            sx={{ '& .MuiDialog-paper': { height: '90vh' } }}
        >
            <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CityIcon sx={{ mr: 1, color: '#7c3aed' }} />
                        Add Cities to {zoneCategory === 'pickupZones' ? 'Pickup' : 'Delivery'} Locations
                    </Box>
                    {carrierId && (
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            {carrierName}
                        </Typography>
                    )}
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Tab Navigation */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
                    <Tabs
                        value={selectedTab}
                        onChange={(e, newValue) => setSelectedTab(newValue)}
                        sx={{
                            '& .MuiTab-root': {
                                fontSize: '11px',
                                textTransform: 'none',
                                minHeight: 40
                            }
                        }}
                    >
                        <Tab
                            icon={<SearchIcon />}
                            label="Quick Add"
                            iconPosition="start"
                        />
                        <Tab
                            icon={<PublicIcon />}
                            label="System Zones"
                            iconPosition="start"
                        />
                        <Tab
                            icon={<MapIcon />}
                            label="Custom Zones"
                            iconPosition="start"
                        />
                    </Tabs>
                </Box>

                <Box sx={{ p: 3, height: 'calc(90vh - 160px)', overflow: 'auto' }}>
                    {/* Quick Add Tab */}
                    {selectedTab === 0 && (
                        <Box>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search cities by name, postal code, or zip code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                    startAdornment: <SearchIcon sx={{ color: '#9ca3af', mr: 1 }} />,
                                    sx: { fontSize: '12px' }
                                }}
                                sx={{ mb: 2 }}
                            />

                            {/* Results Summary - Show when there are results */}
                            {searchResults.length > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#374151' }}>
                                        Found {searchResults.length} cities • {selectedCities.length} selected
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleSelectAll}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        {selectedCities.length === searchResults.length ? 'Deselect All' : `Select All (${searchResults.length})`}
                                    </Button>
                                </Box>
                            )}

                            {/* Cities Table - Always show */}
                            <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid #e5e7eb' }}>
                                <Table size="small" stickyHeader key={`cities-table-${selectedCities.length}`}>
                                    <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                                        <TableRow>
                                            <TableCell
                                                padding="checkbox"
                                                sx={{ backgroundColor: '#f8fafc', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (searchResults.length > 0) {
                                                        handleSelectAll();
                                                    }
                                                }}
                                            >
                                                <Checkbox
                                                    indeterminate={selectedCities.length > 0 && selectedCities.length < searchResults.slice(0, 50).length}
                                                    checked={searchResults.slice(0, 50).length > 0 && selectedCities.length >= searchResults.slice(0, 50).length}
                                                    size="small"
                                                    disabled={searchResults.length === 0}
                                                    sx={{ pointerEvents: 'none' }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f8fafc' }}>City</TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f8fafc' }}>Province/State</TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f8fafc' }}>Country</TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f8fafc' }}>Postal/Zip</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {searchLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography sx={{ mt: 1, fontSize: '12px', color: '#6b7280' }}>
                                                        Searching...
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : searchResults.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                                    {searchTerm ? `No cities found matching "${searchTerm}"` : 'Enter a city name, postal code, or zip code above to search'}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            searchResults.slice(0, 50).map((city, index) => {
                                                const cityKey = city.searchKey || city.id;
                                                const cityName = city.city;
                                                const cityState = city.provinceState || city.state;
                                                const cityCountry = city.country;

                                                // More robust matching - check multiple ways cities might match
                                                const isSelected = selectedCities.some(c => {
                                                    const selectedKey = c.searchKey || c.id;
                                                    const selectedName = c.city;
                                                    const selectedState = c.provinceState || c.state;
                                                    const selectedCountry = c.country;

                                                    // Exact ID match
                                                    if (selectedKey === cityKey) return true;

                                                    // Name + State + Country match (fallback)
                                                    if (selectedName === cityName &&
                                                        selectedState === cityState &&
                                                        selectedCountry === cityCountry) return true;

                                                    return false;
                                                });
                                                return (
                                                    <TableRow
                                                        key={`${cityKey}-${selectedCities.length}-${isSelected}`}
                                                        hover
                                                        onClick={() => handleCitySelect(city)}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        <TableCell
                                                            padding="checkbox"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCitySelect(city);
                                                            }}
                                                            sx={{ cursor: 'pointer' }}
                                                        >
                                                            <Checkbox
                                                                key={`checkbox-${cityKey}-${isSelected}`}
                                                                checked={isSelected}
                                                                size="small"
                                                                sx={{ pointerEvents: 'none' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{city.city}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>{city.provinceState}</TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            {city.country === 'CA' ? '🇨🇦 Canada' : city.country === 'US' ? '🇺🇸 United States' : city.country}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                            {city.postalZipCode || city.postalCode || city.zipCode || 'N/A'}
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

                    {/* System Zones Tab (with sub-tabs) */}
                    {selectedTab === 1 && (
                        <Box>
                            {/* Sub-tabs for Individual Zones vs Zone Sets */}
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                <Tabs
                                    value={systemSubTab}
                                    onChange={(e, newValue) => setSystemSubTab(newValue)}
                                    sx={{
                                        '& .MuiTab-root': {
                                            fontSize: '11px',
                                            textTransform: 'none',
                                            minHeight: 36
                                        }
                                    }}
                                >
                                    <Tab label="Individual Zones" />
                                    <Tab label="Zone Sets" />
                                </Tabs>
                            </Box>

                            {/* Individual Zones Sub-tab */}
                            {systemSubTab === 0 && (
                                <SystemZoneSelector
                                    onZoneSelection={async (zones) => {
                                        console.log('🔄 System zones selected:', zones);
                                        setSelectedSystemZones(zones);

                                        if (zones.length === 0) {
                                            setExpandedSystemZoneCities([]);
                                            return;
                                        }

                                        // Set loading state
                                        setExpandingZones(true);

                                        try {
                                            // System zones need to be expanded via cloud function
                                            const allCities = [];

                                            for (const zone of zones) {
                                                console.log('🔍 Processing zone:', zone);
                                                console.log('🏙️ Zone cities:', zone.cities);

                                                if (zone.cities && Array.isArray(zone.cities) && zone.cities.length > 0) {
                                                    // Zone has cities directly
                                                    zone.cities.forEach(city => {
                                                        allCities.push({
                                                            ...city,
                                                            zoneId: zone.id,
                                                            zoneName: zone.zoneName || zone.name
                                                        });
                                                    });
                                                } else {
                                                    // Need to expand zone via cloud function
                                                    console.log('🚀 Calling cloud function for zone:', zone.id, zone.zoneName);
                                                    try {
                                                        const expandZone = httpsCallable(functions, 'expandSystemZoneToCities');
                                                        const result = await expandZone({ zoneId: zone.id });
                                                        console.log('🔥 Cloud function response:', result.data);

                                                        if (result.data.success && result.data.cities) {
                                                            console.log('🌍 Cloud function returned cities:', result.data.cities.map(c => ({
                                                                city: c.city,
                                                                latitude: c.latitude,
                                                                longitude: c.longitude,
                                                                hasCoords: !!(c.latitude && c.longitude)
                                                            })));

                                                            result.data.cities.forEach(city => {
                                                                allCities.push({
                                                                    ...city,
                                                                    zoneId: zone.id,
                                                                    zoneName: zone.zoneName || zone.name
                                                                });
                                                            });
                                                        } else {
                                                            console.warn('🚨 Cloud function failed or returned no cities:', result.data);
                                                        }
                                                    } catch (error) {
                                                        console.error('Error expanding zone:', error);
                                                        enqueueSnackbar(`Error expanding zone ${zone.zoneName || zone.name}`, { variant: 'error' });
                                                    }
                                                }
                                            }

                                            // Filter out existing cities with detailed logging
                                            console.log('🔍 Checking for duplicates:', {
                                                existingCityIds: Array.from(existingCityIds),
                                                newCityIds: allCities.map(c => c.searchKey || c.id)
                                            });

                                            const filteredCities = allCities.filter(city => {
                                                const cityId = city.searchKey || city.id;
                                                const isDuplicate = existingCityIds.has(cityId);
                                                console.log(`  ${city.city}: ${isDuplicate ? 'DUPLICATE' : 'NEW'} (ID: ${cityId})`);
                                                return !isDuplicate;
                                            });

                                            console.log('✅ Total expanded cities:', filteredCities);
                                            setExpandedSystemZoneCities(filteredCities);

                                            if (filteredCities.length > 0) {
                                                enqueueSnackbar(`Expanded ${filteredCities.length} cities from ${zones.length} zones`, {
                                                    variant: 'success'
                                                });
                                            } else {
                                                enqueueSnackbar('No new cities found in selected zones', { variant: 'info' });
                                            }
                                        } catch (error) {
                                            console.error('Error processing zones:', error);
                                            enqueueSnackbar('Error processing zones', { variant: 'error' });
                                        } finally {
                                            setExpandingZones(false);
                                        }
                                    }}
                                    selectedZoneIds={selectedSystemZones.map(z => z.id)}
                                    embedded={true}
                                    enabledZoneIds={enabledZoneIds}
                                />
                            )}

                            {/* Zone Sets Sub-tab */}
                            {systemSubTab === 1 && (
                                <SystemZoneSetSelector
                                    onZoneSetSelection={async (zoneSets) => {
                                        setSelectedSystemZoneSets(zoneSets);

                                        if (zoneSets.length === 0) {
                                            setExpandedSystemCities([]);
                                            return;
                                        }

                                        // Set loading state
                                        setExpandingZones(true);

                                        try {
                                            // Expand zone sets to cities
                                            const allCities = [];
                                            for (const zoneSet of zoneSets) {
                                                try {
                                                    const expandZoneSet = httpsCallable(functions, 'expandZoneSetToCities');
                                                    const result = await expandZoneSet({ zoneSetId: zoneSet.id });

                                                    if (result.data.success) {
                                                        const cities = result.data.cities.map(city => ({
                                                            ...city,
                                                            zoneSetId: zoneSet.id,
                                                            zoneSetName: zoneSet.name
                                                        }));
                                                        allCities.push(...cities);
                                                    }
                                                } catch (error) {
                                                    console.error('Error expanding zone set:', error);
                                                    enqueueSnackbar(`Error expanding zone set ${zoneSet.name}`, { variant: 'error' });
                                                }
                                            }

                                            // Filter out existing cities
                                            const filteredCities = allCities.filter(city => {
                                                const cityId = city.searchKey || city.id;
                                                return !existingCityIds.has(cityId);
                                            });

                                            setExpandedSystemCities(filteredCities);

                                            if (filteredCities.length > 0) {
                                                enqueueSnackbar(`Expanded ${filteredCities.length} cities from ${zoneSets.length} zone sets`, {
                                                    variant: 'success'
                                                });
                                            } else {
                                                enqueueSnackbar('No new cities found in selected zone sets', { variant: 'info' });
                                            }
                                        } catch (error) {
                                            console.error('Error processing zone sets:', error);
                                            enqueueSnackbar('Error processing zone sets', { variant: 'error' });
                                        } finally {
                                            setExpandingZones(false);
                                        }
                                    }}
                                    selectedZoneSetIds={selectedSystemZoneSets.map(z => z.id)}
                                    embedded={true}
                                    enabledZoneSetIds={enabledZoneSetIds}
                                />
                            )}
                        </Box>
                    )}

                    {/* Custom Zones Tab */}
                    {selectedTab === 2 && (
                        <Box>
                            {/* Sub-tabs for Zones vs Zone Sets */}
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                <Tabs
                                    value={customSubTab}
                                    onChange={(e, newValue) => setCustomSubTab(newValue)}
                                    sx={{
                                        '& .MuiTab-root': {
                                            fontSize: '11px',
                                            textTransform: 'none',
                                            minHeight: 36
                                        }
                                    }}
                                >
                                    <Tab label="Individual Zones" />
                                    <Tab label="Zone Sets" />
                                </Tabs>
                            </Box>

                            {/* Individual Zones Sub-tab */}
                            {customSubTab === 0 && (
                                <CarrierZoneSelector
                                    carrierId={carrierId}
                                    carrierName={carrierName}
                                    onZoneSelection={async (zones) => {
                                        setSelectedCustomZones(zones);

                                        if (zones.length === 0) {
                                            setExpandedCustomCities([]);
                                            return;
                                        }

                                        // Set loading state
                                        setExpandingZones(true);

                                        try {
                                            // Expand zones to cities
                                            const cities = [];
                                            zones.forEach(zone => {
                                                if (zone.cities && Array.isArray(zone.cities)) {
                                                    zone.cities.forEach(city => {
                                                        cities.push({
                                                            ...city,
                                                            zoneId: zone.zoneId,
                                                            zoneName: zone.name,
                                                            zoneSetName: zone.zoneSetName
                                                        });
                                                    });
                                                }
                                            });

                                            setExpandedCustomCities(cities);

                                            if (cities.length > 0) {
                                                enqueueSnackbar(`Expanded ${cities.length} cities from ${zones.length} custom zones`, {
                                                    variant: 'success'
                                                });
                                            }
                                        } catch (error) {
                                            console.error('Error processing custom zones:', error);
                                            enqueueSnackbar('Error processing custom zones', { variant: 'error' });
                                        } finally {
                                            setExpandingZones(false);
                                        }
                                    }}
                                    selectedZoneIds={selectedCustomZones.map(z => z.zoneId)}
                                    embedded={true}
                                    showActions={true}
                                    onCreateZone={() => {
                                        setEditingCarrierZone(null);
                                        setShowCarrierZoneDialog(true);
                                    }}
                                />
                            )}

                            {/* Zone Sets Sub-tab */}
                            {customSubTab === 1 && (
                                <CarrierZoneSetSelector
                                    carrierId={carrierId}
                                    carrierName={carrierName}
                                    onZoneSetSelection={async (zoneSets) => {
                                        setSelectedCustomZoneSets(zoneSets);

                                        if (zoneSets.length === 0) {
                                            setExpandedCustomCities([]);
                                            return;
                                        }

                                        // Set loading state
                                        setExpandingZones(true);

                                        try {
                                            // Expand zone sets to cities
                                            const cities = [];
                                            zoneSets.forEach(zoneSet => {
                                                if (zoneSet.zones && Array.isArray(zoneSet.zones)) {
                                                    zoneSet.zones.forEach(zone => {
                                                        if (zone.cities && Array.isArray(zone.cities)) {
                                                            zone.cities.forEach(city => {
                                                                cities.push({
                                                                    ...city,
                                                                    zoneSetId: zoneSet.id,
                                                                    zoneSetName: zoneSet.name,
                                                                    zoneName: zone.name
                                                                });
                                                            });
                                                        }
                                                    });
                                                }
                                            });

                                            // Filter out existing cities
                                            const filteredCities = cities.filter(city => {
                                                const cityId = city.searchKey || city.id;
                                                return !existingCityIds.has(cityId);
                                            });

                                            setExpandedCustomCities(filteredCities);

                                            if (filteredCities.length > 0) {
                                                enqueueSnackbar(`Expanded ${filteredCities.length} cities from ${zoneSets.length} custom zone sets`, {
                                                    variant: 'success'
                                                });
                                            } else {
                                                enqueueSnackbar('No new cities found in selected custom zone sets', { variant: 'info' });
                                            }
                                        } catch (error) {
                                            console.error('Error processing custom zone sets:', error);
                                            enqueueSnackbar('Error processing custom zone sets', { variant: 'error' });
                                        } finally {
                                            setExpandingZones(false);
                                        }
                                    }}
                                    selectedZoneSetIds={selectedCustomZoneSets.map(z => z.id)}
                                    embedded={true}
                                    showActions={true}
                                    onCreateZoneSet={() => {
                                        setEditingCustomZoneSet(null);
                                        setShowCarrierZoneSetDialog(true);
                                    }}
                                />
                            )}
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        {expandingZones ? (
                            <>
                                <CircularProgress size={12} sx={{ mr: 1 }} />
                                Expanding zones...
                            </>
                        ) : (
                            `${getTotalCitiesCount()} cities selected`
                        )}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={handleClose}
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleAddSelectedCities}
                            disabled={getTotalCitiesCount() === 0 && !expandingZones}
                            sx={{ fontSize: '12px' }}
                            startIcon={expandingZones ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {expandingZones ? 'Expanding Zones...' : `Add ${getTotalCitiesCount()} Cities`}
                        </Button>
                    </Box>
                </Box>
            </DialogActions>

            {/* Custom Zone Manager Dialog (legacy) */}
            <CustomZoneManager
                open={showCustomZoneManager}
                onClose={() => setShowCustomZoneManager(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                onZoneSetCreated={(zoneSetId) => {
                    // Reload custom zone sets
                    loadCustomZones();
                    enqueueSnackbar('Custom zone set created successfully', { variant: 'success' });
                }}
            />

            {/* Carrier Zone Dialog (new) */}
            <CarrierZoneDialog
                open={showCarrierZoneDialog}
                onClose={() => setShowCarrierZoneDialog(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                editingZone={editingCarrierZone}
                onZoneCreated={() => {
                    // Reload custom zones
                    loadCustomZones();
                    enqueueSnackbar('Custom zone created successfully', { variant: 'success' });
                }}
            />

            {/* Carrier Zone Set Dialog (new) */}
            <CarrierZoneSetDialog
                open={showCarrierZoneSetDialog}
                onClose={() => setShowCarrierZoneSetDialog(false)}
                carrierId={carrierId}
                carrierName={carrierName}
                editingZoneSet={editingCustomZoneSet}
                onZoneSetCreated={() => {
                    // Reload custom zone sets
                    loadCustomZones();
                    enqueueSnackbar('Custom zone set created successfully', { variant: 'success' });
                }}
            />
        </Dialog>
    );
};

export default EnhancedAddCityDialog;
