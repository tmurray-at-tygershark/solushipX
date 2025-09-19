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
    const { searchCities, getCityByPostalCode, getLocationsByCity } = useGeographicData();

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
    const [bulkPostalInput, setBulkPostalInput] = useState('');
    const [processingBulk, setProcessingBulk] = useState(false);

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
                .replace(/\//g, '_') // Convert slashes to underscores
                .replace(/[^A-Z0-9_\s]/g, '') // Remove other special characters but keep underscores
                .replace(/\s+/g, '_') // Replace spaces with underscores
                .replace(/_+/g, '_') // Collapse multiple underscores
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
                .replace(/\//g, '_')
                .replace(/[^A-Z0-9_\s]/g, '')
                .replace(/\s+/g, '_')
                .replace(/_+/g, '_')
                .substring(0, 20);
        }
    }, [carrierId]);

    // Handle zone name change and auto-generate code
    // Debounced zone code generation (2s) to avoid running on every keystroke
    const codeGenTimerRef = useRef(null);
    const handleZoneNameChange = useCallback((name) => {
        setZoneForm(prev => ({ ...prev, zoneName: name }));

        if (codeGenTimerRef.current) {
            clearTimeout(codeGenTimerRef.current);
            codeGenTimerRef.current = null;
        }
        if (editingZone || !name.trim()) return;

        codeGenTimerRef.current = setTimeout(async () => {
            setGeneratingCode(true);
            try {
                const generatedCode = await generateZoneCode(name);
                setZoneForm(prev => ({ ...prev, zoneCode: generatedCode }));
            } catch (error) {
                console.error('Error generating zone code:', error);
            } finally {
                setGeneratingCode(false);
            }
        }, 2000);
    }, [editingZone, generateZoneCode]);

    // Handle zone coverage search
    const handleZoneCoverageSearch = useCallback(async (searchTerm = zoneCoverageSearch) => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setZoneCoverageSuggestions([]);
            return;
        }

        setCoverageSearchLoading(true);
        try {
            // Allow 3-character Canadian FSA (e.g., M5V) and 5-digit US ZIP
            const isPostalCode = /^[A-Za-z]\d[A-Za-z]$/.test(searchTerm.trim().slice(0, 3)) || /^\d{5}$/.test(searchTerm.trim());
            let results = [];

            if (isPostalCode) {
                const postalResults = await getCityByPostalCode(searchTerm.trim());
                if (postalResults) {
                    // For FSA, prefer showing the city; attach postalCodes array so user can add all codes
                    if (postalResults.fsa) {
                        const allInFsa = await getLocationsByCity(postalResults.city, postalResults.provinceState, postalResults.country);
                        const codes = Array.from(new Set(allInFsa.map(r => r.postalZipCode).filter(Boolean)));
                        results = [{
                            id: `${postalResults.city}-${postalResults.provinceState}-${postalResults.country}`.toLowerCase(),
                            city: postalResults.city,
                            provinceState: postalResults.provinceState,
                            country: postalResults.country,
                            postalCodes: codes
                        }];
                    } else {
                        // Exact ZIP: still return the city to keep city UX, but attach the single code
                        results = [{
                            id: `${postalResults.city}-${postalResults.provinceState}-${postalResults.country}`.toLowerCase(),
                            city: postalResults.city,
                            provinceState: postalResults.provinceState,
                            country: postalResults.country,
                            postalCodes: postalResults.postalZipCode ? [postalResults.postalZipCode] : []
                        }];
                    }
                } else {
                    results = [];
                }
            } else {
                results = await searchCities(searchTerm.trim());
            }

            // Format suggestions
            const suggestions = results.slice(0, 10).map(item => {
                const isCityLike = item.city && item.provinceState; // prefer city display when city data present
                if (isCityLike) {
                    return {
                        type: 'city',
                        id: item.searchKey || item.id,
                        displayText: `${item.city}, ${item.provinceState}`,
                        location: item.country === 'CA' ? '🇨🇦 Canada' : item.country === 'US' ? '🇺🇸 United States' : item.country,
                        data: item
                    };
                }
                const code = item.postalZipCode || item.postalCode || item.fsa || item.id;
                return {
                    type: 'postal',
                    id: code,
                    displayText: code,
                    location: item.country === 'CA' ? '🇨🇦 Canada' : item.country === 'US' ? '🇺🇸 United States' : item.country,
                    data: item
                };
            });

            setZoneCoverageSuggestions(suggestions);
        } catch (error) {
            console.error('Zone coverage search error:', error);
        } finally {
            setCoverageSearchLoading(false);
        }
    }, [zoneCoverageSearch, searchCities, getCityByPostalCode]);

    // Handle adding zone coverage
    const handleAddZoneCoverage = useCallback(async (suggestion) => {
        if (suggestion.type === 'city') {
            const cityExists = zoneForm.cities.some(city =>
                city.searchKey === suggestion.data.searchKey || city.id === suggestion.data.id
            );

            if (!cityExists) {
                // If city has postalCodes array, use it; otherwise fetch all codes for that city
                let postalCodes = Array.isArray(suggestion.data.postalCodes) ? suggestion.data.postalCodes : [];
                if (postalCodes.length === 0) {
                    try {
                        const locations = await getLocationsByCity(suggestion.data.city, suggestion.data.provinceState, suggestion.data.country);
                        postalCodes = Array.from(new Set((locations || []).map(r => (r.postalZipCode || '').toUpperCase()).filter(Boolean)));
                    } catch (e) {
                        // ignore; we can still add city without codes
                    }
                }
                setZoneForm(prev => {
                    const nextCities = [...prev.cities, { ...suggestion.data, postalCodes }];
                    const allCodes = Array.from(new Set(nextCities.flatMap(c => c.postalCodes || [])));
                    return { ...prev, cities: nextCities, postalCodes: allCodes };
                });
                enqueueSnackbar(`Added ${suggestion.data.city} to zone`, { variant: 'success' });
            } else {
                enqueueSnackbar(`${suggestion.data.city} is already in this zone`, { variant: 'warning' });
            }
        } else if (suggestion.type === 'postal') {
            // Add or attach a single postal code to the last selected city if present
            const code = suggestion.data.postalCode || suggestion.data.fsa || suggestion.id;
            setZoneForm(prev => {
                const updated = [...prev.cities];
                if (updated.length > 0) {
                    const last = { ...updated[updated.length - 1] };
                    const pcs = Array.isArray(last.postalCodes) ? [...last.postalCodes] : [];
                    if (!pcs.includes(code)) pcs.push(code);
                    last.postalCodes = pcs;
                    updated[updated.length - 1] = last;
                }
                const allCodes = Array.from(new Set(updated.flatMap(c => c.postalCodes || [])));
                return { ...prev, cities: updated, postalCodes: allCodes };
            });
            enqueueSnackbar(`Added postal code ${suggestion.displayText}`, { variant: 'success' });
        }

        setZoneCoverageSearch('');
        setZoneCoverageSuggestions([]);
    }, [zoneForm.cities, enqueueSnackbar]);

    // Bulk add by pasted postal codes/FSAs/ZIPs
    const handleBulkPostalAdd = useCallback(async () => {
        if (!bulkPostalInput.trim()) return;
        setProcessingBulk(true);
        try {
            const tokens = bulkPostalInput
                .toUpperCase()
                .replace(/[^A-Z0-9\s,\n]+/g, ' ')
                .split(/[,\s\n]+/)
                .filter(Boolean);

            const fsas = new Set();
            const zips = new Set();
            for (const t of tokens) {
                if (/^[A-Z][0-9][A-Z]/.test(t)) {
                    fsas.add(t.slice(0, 3));
                } else if (/^\d{5}$/.test(t)) {
                    zips.add(t);
                }
            }

            const additions = [];
            // Process FSAs → cities with codes
            for (const fsa of fsas) {
                const result = await getCityByPostalCode(fsa);
                if (result && result.city) {
                    additions.push({
                        city: result.city,
                        provinceState: result.provinceState,
                        country: result.country,
                        postalCodes: Array.isArray(result.postalCodes) ? result.postalCodes : []
                    });
                }
            }
            // Process exact ZIPs → treat as single-code city additions
            for (const zip of zips) {
                const r = await getCityByPostalCode(zip);
                if (r && r.city) {
                    additions.push({
                        city: r.city,
                        provinceState: r.provinceState,
                        country: r.country,
                        postalCodes: r.postalZipCode ? [r.postalZipCode] : []
                    });
                }
            }

            if (additions.length === 0) {
                enqueueSnackbar('No valid postal codes found', { variant: 'warning' });
                return;
            }

            setZoneForm(prev => {
                const existingKeys = new Set((prev.cities || []).map(c => `${c.city}|${c.provinceState}|${c.country}`));
                const nextCities = [...prev.cities];
                for (const add of additions) {
                    const key = `${add.city}|${add.provinceState}|${add.country}`;
                    const idx = nextCities.findIndex(c => `${c.city}|${c.provinceState}|${c.country}` === key);
                    if (idx === -1) {
                        nextCities.push({
                            id: key.toLowerCase(),
                            searchKey: key.toLowerCase(),
                            ...add
                        });
                    } else {
                        const merged = new Set([...(nextCities[idx].postalCodes || []), ...(add.postalCodes || [])]);
                        nextCities[idx] = { ...nextCities[idx], postalCodes: Array.from(merged) };
                    }
                }
                const allCodes = Array.from(new Set(nextCities.flatMap(c => c.postalCodes || [])));
                return { ...prev, cities: nextCities, postalCodes: allCodes };
            });
            enqueueSnackbar('Added cities from postal codes', { variant: 'success' });
            setBulkPostalInput('');
        } catch (e) {
            enqueueSnackbar('Failed to process postal codes', { variant: 'error' });
        } finally {
            setProcessingBulk(false);
        }
    }, [bulkPostalInput, getCityByPostalCode, enqueueSnackbar]);

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

                        {/* Bulk postal paste */}
                        <Box sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: '#374151' }}>
                                Paste Postal/ZIP Codes (FSA or 5‑digit ZIP)
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    size="small"
                                    placeholder="e.g. M5V, M4C, L1S, 90210, 10001..."
                                    value={bulkPostalInput}
                                    onChange={(e) => setBulkPostalInput(e.target.value)}
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                                <Button
                                    onClick={handleBulkPostalAdd}
                                    variant="outlined"
                                    size="small"
                                    disabled={processingBulk || !bulkPostalInput.trim()}
                                    startIcon={processingBulk ? <CircularProgress size={14} /> : null}
                                    sx={{ fontSize: '12px', whiteSpace: 'nowrap', height: 40 }}
                                >
                                    {processingBulk ? 'Processing…' : 'Add from Codes'}
                                </Button>
                            </Box>
                        </Box>

                        {/* Postal Codes in Zone */}
                        {zoneForm.cities.some(c => Array.isArray(c.postalCodes) && c.postalCodes.length > 0) && (
                            <Box sx={{ mb: 2 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: '#374151' }}>
                                    Postal Codes in Zone
                                </Typography>
                                <Box sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 0.5,
                                    minHeight: '80px',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    p: 1,
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 1,
                                    bgcolor: '#f8fafc'
                                }}>
                                    {zoneForm.cities.flatMap((c) => (c.postalCodes || []).map((pc) => ({ city: c.city, code: pc }))).map((item) => (
                                        <Chip
                                            key={`${item.city}-${item.code}`}
                                            label={`${item.code} (${item.city})`
                                            }
                                            size="small"
                                            onDelete={() => {
                                                setZoneForm(prev => ({
                                                    ...prev,
                                                    cities: prev.cities.map(c =>
                                                        c.postalCodes?.includes(item.code)
                                                            ? { ...c, postalCodes: c.postalCodes.filter(code => code !== item.code) }
                                                            : c
                                                    )
                                                }));
                                            }}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        )}

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
