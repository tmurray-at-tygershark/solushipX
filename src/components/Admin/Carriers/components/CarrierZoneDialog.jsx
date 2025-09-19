/**
 * Carrier Zone Dialog Component
 * Replicates the exact same UI as Enterprise Zone Management > Add Zone dialog
 * but for carrier-specific zone creation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    Typography,
    Box,
    Alert,
    InputAdornment,
    IconButton,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Chip,
    CircularProgress
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Add as AddIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import useGeographicData from '../../../../hooks/useGeographicData';

const CarrierZoneDialog = ({
    open,
    onClose,
    carrierId,
    carrierName,
    editingZone = null,
    onZoneCreated
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const { searchCities, getCityByPostalCode } = useGeographicData();

    // Form state
    const [zoneForm, setZoneForm] = useState({
        zoneCode: '',
        zoneName: '',
        description: '',
        cities: [],
        postalCodes: [],
        provinces: [],
        enabled: true
    });

    // Loading state for save operation
    const [saving, setSaving] = useState(false);

    // Zone coverage search
    const [zoneCoverageSearch, setZoneCoverageSearch] = useState('');
    const [zoneCoverageSuggestions, setZoneCoverageSuggestions] = useState([]);
    const [coverageSearchLoading, setCoverageSearchLoading] = useState(false);
    const zoneCoverageSearchTimeout = useRef(null);

    // Zone code generation
    const [generatingCode, setGeneratingCode] = useState(false);

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            if (editingZone) {
                setZoneForm({
                    zoneCode: editingZone.zoneCode || '',
                    zoneName: editingZone.zoneName || editingZone.name || '',
                    description: editingZone.description || '',
                    cities: editingZone.cities || [],
                    postalCodes: editingZone.postalCodes || [],
                    provinces: editingZone.provinces || [],
                    enabled: editingZone.enabled !== false
                });
            } else {
                setZoneForm({
                    zoneCode: '',
                    zoneName: '',
                    description: '',
                    cities: [],
                    postalCodes: [],
                    provinces: [],
                    enabled: true
                });
            }
            setZoneCoverageSearch('');
            setZoneCoverageSuggestions([]);
        }
    }, [open, editingZone]);

    // Auto-generate zone code based on zone name
    const generateZoneCode = useCallback(async (zoneName) => {
        if (!zoneName.trim() || !carrierId) return '';

        try {
            // Get existing carrier zones to check for duplicates
            const getCarrierZoneSets = httpsCallable(functions, 'getCarrierCustomZoneSets');
            const result = await getCarrierZoneSets({ carrierId });

            const existingZoneCodes = new Set();
            if (result.data.success) {
                const zoneSets = result.data.zoneSets || [];
                zoneSets.forEach(zoneSet => {
                    if (zoneSet.zones && Array.isArray(zoneSet.zones)) {
                        zoneSet.zones.forEach(zone => {
                            if (zone.zoneId || zone.zoneCode) {
                                existingZoneCodes.add((zone.zoneId || zone.zoneCode).toUpperCase());
                            }
                        });
                    }
                });
            }

            // Generate base code from zone name
            const baseCode = zoneName
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
                .replace(/\s+/g, '_') // Replace spaces with underscores
                .substring(0, 20); // Limit length

            // Find unique code
            let uniqueCode = baseCode;
            let counter = 1;

            while (existingZoneCodes.has(uniqueCode)) {
                uniqueCode = `${baseCode}${counter}`;
                counter++;
            }

            return uniqueCode;
        } catch (error) {
            console.error('Error generating zone code:', error);
            // Fallback to simple generation
            return zoneName
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 20);
        }
    }, [carrierId]);

    // Handle zone name change and auto-generate code
    const handleZoneNameChange = useCallback(async (name) => {
        setZoneForm(prev => ({ ...prev, zoneName: name }));

        // Auto-generate zone code if not editing existing zone
        if (!editingZone && name.trim()) {
            setGeneratingCode(true);
            try {
                const generatedCode = await generateZoneCode(name);
                setZoneForm(prev => ({ ...prev, zoneCode: generatedCode }));
            } catch (error) {
                console.error('Error generating zone code:', error);
            } finally {
                setGeneratingCode(false);
            }
        }
    }, [editingZone, generateZoneCode]);

    // Handle zone coverage search
    const handleZoneCoverageSearch = useCallback(async (searchTerm = zoneCoverageSearch) => {
        if (!searchTerm || searchTerm.length < 2) {
            setZoneCoverageSuggestions([]);
            return;
        }

        setCoverageSearchLoading(true);
        try {
            const isPostalCode = /^[A-Za-z]\d[A-Za-z]|^\d{5}/.test(searchTerm.trim());
            let results = [];

            if (isPostalCode) {
                const postalResults = await getCityByPostalCode(searchTerm.trim());
                results = postalResults || [];
            } else {
                results = await searchCities(searchTerm.trim());
            }

            // Format suggestions
            const suggestions = results.slice(0, 10).map(item => ({
                type: 'city',
                id: item.searchKey || item.id,
                displayText: `${item.city}, ${item.provinceState}`,
                location: item.country === 'CA' ? '🇨🇦 Canada' : item.country === 'US' ? '🇺🇸 United States' : item.country,
                data: item
            }));

            setZoneCoverageSuggestions(suggestions);
        } catch (error) {
            console.error('Zone coverage search error:', error);
        } finally {
            setCoverageSearchLoading(false);
        }
    }, [zoneCoverageSearch, searchCities, getCityByPostalCode]);

    // Handle adding zone coverage
    const handleAddZoneCoverage = useCallback((suggestion) => {
        if (suggestion.type === 'city') {
            const cityExists = zoneForm.cities.some(city =>
                city.searchKey === suggestion.data.searchKey || city.id === suggestion.data.id
            );

            if (!cityExists) {
                setZoneForm(prev => ({
                    ...prev,
                    cities: [...prev.cities, suggestion.data]
                }));
                enqueueSnackbar(`Added ${suggestion.data.city} to zone`, { variant: 'success' });
            } else {
                enqueueSnackbar(`${suggestion.data.city} is already in this zone`, { variant: 'warning' });
            }
        }

        setZoneCoverageSearch('');
        setZoneCoverageSuggestions([]);
    }, [zoneForm.cities, enqueueSnackbar]);

    // Handle removing zone coverage
    const handleRemoveZoneCoverage = useCallback((item, type) => {
        if (type === 'city') {
            setZoneForm(prev => ({
                ...prev,
                cities: prev.cities.filter(city =>
                    city.searchKey !== item.searchKey && city.id !== item.id
                )
            }));
        }
    }, []);

    // Handle save zone
    const handleSaveZone = useCallback(async () => {
        if (!zoneForm.zoneCode.trim() || !zoneForm.zoneName.trim()) {
            enqueueSnackbar('Zone code and zone name are required', { variant: 'error' });
            return;
        }

        if (zoneForm.cities.length === 0) {
            enqueueSnackbar('Zone must have at least one city', { variant: 'error' });
            return;
        }

        setSaving(true);
        try {
            // For carrier zones, we use the custom zone set creation/update functions
            if (editingZone) {
                // Update existing zone
                const updateCustomZone = httpsCallable(functions, 'updateCarrierCustomZone');
                const result = await updateCustomZone({
                    carrierId,
                    carrierName,
                    zoneId: editingZone.zoneId,
                    zoneCode: zoneForm.zoneCode,
                    zoneName: zoneForm.zoneName,
                    description: zoneForm.description,
                    cities: zoneForm.cities
                });

                if (result.data.success) {
                    enqueueSnackbar('Custom zone updated successfully', { variant: 'success' });
                    // Pass complete updated zone information to callback
                    const updatedZoneInfo = {
                        zoneId: editingZone.zoneId,
                        zoneCode: zoneForm.zoneCode,
                        zoneName: zoneForm.zoneName,
                        description: zoneForm.description,
                        cities: zoneForm.cities,
                        enabled: editingZone.enabled,
                        createdAt: editingZone.createdAt,
                        updatedAt: new Date()
                    };
                    onZoneCreated && onZoneCreated(updatedZoneInfo);
                    onClose();
                } else {
                    enqueueSnackbar('Failed to update zone', { variant: 'error' });
                }
            } else {
                // Create new individual zone
                const createCustomZone = httpsCallable(functions, 'createCarrierCustomZone');
                const result = await createCustomZone({
                    carrierId,
                    carrierName,
                    zoneCode: zoneForm.zoneCode,
                    zoneName: zoneForm.zoneName,
                    description: zoneForm.description,
                    cities: zoneForm.cities
                });

                if (result.data.success) {
                    enqueueSnackbar('Custom zone created successfully', { variant: 'success' });
                    // Pass complete zone information to callback
                    const zoneInfo = {
                        zoneId: result.data.zoneId,
                        zoneCode: zoneForm.zoneCode,
                        zoneName: zoneForm.zoneName,
                        description: zoneForm.description,
                        cities: zoneForm.cities,
                        enabled: true,
                        createdAt: new Date()
                    };
                    onZoneCreated && onZoneCreated(zoneInfo);
                    onClose();
                } else {
                    enqueueSnackbar('Failed to create zone', { variant: 'error' });
                }
            }
        } catch (error) {
            console.error('Error saving zone:', error);
            enqueueSnackbar(error.message || 'Failed to save zone', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    }, [zoneForm, carrierId, carrierName, editingZone, onZoneCreated, onClose, enqueueSnackbar]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            sx={{
                '& .MuiDialog-paper': {
                    minHeight: '600px' // Ensure consistent height
                }
            }}
        >
            <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                {editingZone ? 'Edit Custom Zone' : 'Create Custom Zone'} for {carrierName}
            </DialogTitle>
            <DialogContent sx={{ minHeight: '500px' }}>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={6} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Zone Name"
                            value={zoneForm.zoneName}
                            onChange={(e) => handleZoneNameChange(e.target.value)}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            placeholder="GTA Cities, Toronto Area, Western Ontario"
                            helperText="Descriptive name for this zone"
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            required
                        />
                    </Grid>
                    <Grid item xs={6} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Zone Code"
                            value={zoneForm.zoneCode}
                            onChange={(e) => setZoneForm(prev => ({ ...prev, zoneCode: e.target.value.toUpperCase() }))}
                            InputProps={{
                                sx: { fontSize: '12px' },
                                readOnly: !editingZone, // Auto-generated for new zones, editable for existing
                                endAdornment: generatingCode && (
                                    <InputAdornment position="end">
                                        <CircularProgress size={16} />
                                    </InputAdornment>
                                )
                            }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            placeholder="Auto-generated from zone name"
                            helperText={editingZone ? "Unique zone identifier" : "Auto-generated from zone name"}
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            required
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Description"
                            value={zoneForm.description}
                            onChange={(e) => setZoneForm(prev => ({ ...prev, description: e.target.value }))}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            placeholder="Greater Toronto Area cities including Toronto, Mississauga, Brampton..."
                            helperText="Detailed description of what this zone covers"
                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                            multiline
                            rows={2}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Zone Coverage (Add cities to this zone)
                        </Typography>

                        {/* City Search */}
                        <Box sx={{ mb: 2, position: 'relative' }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Type city name, postal/zip code, or province/state..."
                                value={zoneCoverageSearch}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setZoneCoverageSearch(value);

                                    // Trigger autocomplete search on typing (debounced)
                                    if (value.length >= 2) {
                                        clearTimeout(zoneCoverageSearchTimeout.current);
                                        zoneCoverageSearchTimeout.current = setTimeout(() => {
                                            handleZoneCoverageSearch(value);
                                        }, 300);
                                    } else {
                                        setZoneCoverageSuggestions([]);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (zoneCoverageSuggestions.length > 0) {
                                            handleAddZoneCoverage(zoneCoverageSuggestions[0]);
                                        }
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setZoneCoverageSuggestions([]);
                                    }
                                }}
                                onFocus={() => {
                                    if (zoneCoverageSearch.length >= 2 && zoneCoverageSuggestions.length === 0) {
                                        handleZoneCoverageSearch(zoneCoverageSearch);
                                    }
                                }}
                                onBlur={(e) => {
                                    // Delay hiding suggestions to allow clicking on them
                                    setTimeout(() => {
                                        if (!e.relatedTarget || !e.relatedTarget.closest('[data-suggestion-item]')) {
                                            setZoneCoverageSuggestions([]);
                                        }
                                    }, 150);
                                }}
                                InputProps={{
                                    sx: { fontSize: '12px' },
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ fontSize: '18px', color: '#666' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            {coverageSearchLoading && (
                                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                            )}
                                            {zoneCoverageSearch && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setZoneCoverageSearch('');
                                                        setZoneCoverageSuggestions([]);
                                                    }}
                                                    sx={{ p: 0.5, mr: 1 }}
                                                >
                                                    <ClearIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            )}
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={() => {
                                                    if (zoneCoverageSuggestions.length > 0) {
                                                        handleAddZoneCoverage(zoneCoverageSuggestions[0]);
                                                    } else if (zoneCoverageSearch.trim().length >= 2) {
                                                        handleZoneCoverageSearch();
                                                    }
                                                }}
                                                disabled={!zoneCoverageSearch.trim() || zoneCoverageSearch.trim().length < 2}
                                                sx={{
                                                    fontSize: '11px',
                                                    minWidth: 'auto',
                                                    px: 2
                                                }}
                                            >
                                                {zoneCoverageSuggestions.length > 0 ? 'Add' : 'Search'}
                                            </Button>
                                        </InputAdornment>
                                    )
                                }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                            />

                            {/* Search Suggestions */}
                            {zoneCoverageSuggestions.length > 0 && (
                                <Paper
                                    sx={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        zIndex: 1000,
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        border: '1px solid #e0e0e0'
                                    }}
                                >
                                    <List dense>
                                        {zoneCoverageSuggestions.map((suggestion, index) => (
                                            <ListItem
                                                key={suggestion.id}
                                                button
                                                onClick={() => handleAddZoneCoverage(suggestion)}
                                                sx={{ py: 0.5 }}
                                                data-suggestion-item="true"
                                            >
                                                <ListItemText
                                                    primary={suggestion.displayText}
                                                    secondary={suggestion.location}
                                                    primaryTypographyProps={{ fontSize: '12px' }}
                                                    secondaryTypographyProps={{ fontSize: '11px' }}
                                                />
                                                <ListItemSecondaryAction>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAddZoneCoverage(suggestion);
                                                        }}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        <AddIcon sx={{ fontSize: '14px' }} />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            )}
                        </Box>

                        {/* Current Zone Coverage */}
                        <Box sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: '#374151' }}>
                                Cities in Zone ({zoneForm.cities.length}):
                            </Typography>
                            <Box sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 0.5,
                                minHeight: '120px', // Ensure minimum height even when empty
                                maxHeight: '150px',
                                overflowY: 'auto',
                                p: 1,
                                border: '1px solid #e5e7eb',
                                borderRadius: 1,
                                bgcolor: '#f8fafc'
                            }}>
                                {zoneForm.cities.length > 0 ? (
                                    zoneForm.cities.map((city) => (
                                        <Chip
                                            key={city.searchKey || city.id}
                                            label={`${city.city}, ${city.provinceState}`}
                                            size="small"
                                            onDelete={() => handleRemoveZoneCoverage(city, 'city')}
                                            sx={{ fontSize: '11px' }}
                                            color="primary"
                                        />
                                    ))
                                ) : (
                                    <Typography sx={{
                                        fontSize: '12px',
                                        color: '#9ca3af',
                                        fontStyle: 'italic',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        height: '100px'
                                    }}>
                                        Search and add cities above to define this zone's coverage area
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        {/* Zone Summary - Only show when there's actual content */}
                        {(zoneForm.cities.length > 0 || zoneForm.postalCodes.length > 0 || zoneForm.provinces.length > 0) && (
                            <Alert severity="success" sx={{ fontSize: '12px', mt: 2 }}>
                                Zone Coverage: {zoneForm.cities.length} cities, {zoneForm.postalCodes.length} postal codes, {zoneForm.provinces.length} provinces
                            </Alert>
                        )}
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} size="small" sx={{ fontSize: '12px' }}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSaveZone}
                    variant="contained"
                    size="small"
                    sx={{ fontSize: '12px' }}
                    disabled={!zoneForm.zoneCode.trim() || !zoneForm.zoneName.trim() || zoneForm.cities.length === 0 || saving}
                    startIcon={saving ? <CircularProgress size={16} /> : null}
                >
                    {saving ? 'Saving...' : `${editingZone ? 'Update' : 'Create'} Zone`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CarrierZoneDialog;
