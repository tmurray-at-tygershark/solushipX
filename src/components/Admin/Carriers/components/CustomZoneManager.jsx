/**
 * Custom Zone Manager Component
 * Handles CRUD operations for carrier-specific custom zones and zone sets
 */

import React, { useState, useCallback } from 'react';
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Chip,
    Card,
    CardContent,
    CardHeader,
    Grid,
    Divider,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    LocationCity as CityIcon,
    Map as MapIcon,
    Check as CheckIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import useGeographicData from '../../../../hooks/useGeographicData';

const CustomZoneManager = ({
    open,
    onClose,
    carrierId,
    carrierName,
    onZoneSetCreated
}) => {
    const { searchCities } = useGeographicData();
    const { enqueueSnackbar } = useSnackbar();

    // Stepper state
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Zone set form data
    const [zoneSetForm, setZoneSetForm] = useState({
        name: '',
        description: '',
        zones: []
    });

    // Current zone being edited
    const [currentZone, setCurrentZone] = useState({
        name: '',
        cities: []
    });

    // City search state
    const [citySearchTerm, setCitySearchTerm] = useState('');
    const [citySearchResults, setCitySearchResults] = useState([]);
    const [citySearchLoading, setCitySearchLoading] = useState(false);

    // Steps
    const steps = [
        'Zone Set Information',
        'Define Zones',
        'Add Cities to Zones',
        'Review & Create'
    ];

    // Handle city search
    const handleCitySearch = useCallback(async (searchTerm) => {
        if (!searchTerm.trim()) {
            setCitySearchResults([]);
            return;
        }

        setCitySearchLoading(true);
        try {
            const results = await searchCities(searchTerm.trim());
            setCitySearchResults(results.slice(0, 20)); // Limit results
        } catch (error) {
            console.error('City search error:', error);
            enqueueSnackbar('City search failed', { variant: 'error' });
        } finally {
            setCitySearchLoading(false);
        }
    }, [searchCities, enqueueSnackbar]);

    // Auto-search when city search term changes
    React.useEffect(() => {
        const timer = setTimeout(() => handleCitySearch(citySearchTerm), 300);
        return () => clearTimeout(timer);
    }, [citySearchTerm, handleCitySearch]);

    // Add city to current zone
    const handleAddCityToZone = useCallback((city) => {
        const cityExists = currentZone.cities.some(c =>
            (c.searchKey || c.id) === (city.searchKey || city.id)
        );

        if (!cityExists) {
            setCurrentZone(prev => ({
                ...prev,
                cities: [...prev.cities, {
                    id: city.searchKey || city.id,
                    searchKey: city.searchKey || city.id,
                    city: city.city,
                    provinceState: city.provinceState,
                    country: city.country,
                    countryName: city.countryName,
                    postalZipCode: city.postalZipCode
                }]
            }));
            enqueueSnackbar(`Added ${city.city} to zone`, { variant: 'success' });
        } else {
            enqueueSnackbar(`${city.city} is already in this zone`, { variant: 'warning' });
        }
    }, [currentZone.cities, enqueueSnackbar]);

    // Remove city from current zone
    const handleRemoveCityFromZone = useCallback((cityId) => {
        setCurrentZone(prev => ({
            ...prev,
            cities: prev.cities.filter(c => (c.searchKey || c.id) !== cityId)
        }));
    }, []);

    // Add zone to zone set
    const handleAddZoneToSet = useCallback(() => {
        if (!currentZone.name.trim()) {
            enqueueSnackbar('Zone name is required', { variant: 'error' });
            return;
        }

        if (currentZone.cities.length === 0) {
            enqueueSnackbar('Zone must have at least one city', { variant: 'error' });
            return;
        }

        const zoneExists = zoneSetForm.zones.some(z =>
            z.name.toLowerCase() === currentZone.name.toLowerCase()
        );

        if (zoneExists) {
            enqueueSnackbar('Zone name already exists', { variant: 'error' });
            return;
        }

        const newZone = {
            ...currentZone,
            zoneId: `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        setZoneSetForm(prev => ({
            ...prev,
            zones: [...prev.zones, newZone]
        }));

        // Reset current zone
        setCurrentZone({
            name: '',
            cities: []
        });

        enqueueSnackbar(`Added zone "${newZone.name}" with ${newZone.cities.length} cities`, {
            variant: 'success'
        });
    }, [currentZone, zoneSetForm.zones, enqueueSnackbar]);

    // Remove zone from zone set
    const handleRemoveZoneFromSet = useCallback((zoneId) => {
        setZoneSetForm(prev => ({
            ...prev,
            zones: prev.zones.filter(z => z.zoneId !== zoneId)
        }));
    }, []);

    // Create zone set
    const handleCreateZoneSet = useCallback(async () => {
        if (!zoneSetForm.name.trim()) {
            enqueueSnackbar('Zone set name is required', { variant: 'error' });
            return;
        }

        if (zoneSetForm.zones.length === 0) {
            enqueueSnackbar('Zone set must have at least one zone', { variant: 'error' });
            return;
        }

        setLoading(true);
        try {
            const createCustomZoneSet = httpsCallable(functions, 'createCarrierCustomZoneSet');
            const result = await createCustomZoneSet({
                carrierId,
                carrierName,
                zoneSetName: zoneSetForm.name,
                description: zoneSetForm.description,
                zones: zoneSetForm.zones
            });

            if (result.data.success) {
                enqueueSnackbar('Custom zone set created successfully', { variant: 'success' });

                // Notify parent component
                if (onZoneSetCreated) {
                    onZoneSetCreated(result.data.zoneSetId);
                }

                handleClose();
            } else {
                enqueueSnackbar('Failed to create zone set', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error creating zone set:', error);
            enqueueSnackbar('Error creating zone set', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [zoneSetForm, carrierId, carrierName, enqueueSnackbar, onZoneSetCreated]);

    // Handle dialog close
    const handleClose = useCallback(() => {
        // Reset all state
        setActiveStep(0);
        setZoneSetForm({ name: '', description: '', zones: [] });
        setCurrentZone({ name: '', cities: [] });
        setCitySearchTerm('');
        setCitySearchResults([]);
        onClose();
    }, [onClose]);

    // Handle next step
    const handleNext = () => {
        setActiveStep(prev => prev + 1);
    };

    // Handle back step
    const handleBack = () => {
        setActiveStep(prev => prev - 1);
    };

    // Get total cities count
    const getTotalCitiesCount = () => {
        return zoneSetForm.zones.reduce((sum, zone) => sum + zone.cities.length, 0);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            sx={{ '& .MuiDialog-paper': { height: '90vh' } }}
        >
            <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <MapIcon sx={{ mr: 1, color: '#7c3aed' }} />
                    Create Custom Zone Set for {carrierName}
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ p: 3 }}>
                    <Stepper activeStep={activeStep} orientation="vertical">
                        {/* Step 1: Zone Set Information */}
                        <Step>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '14px', fontWeight: 500 } }}>
                                Zone Set Information
                            </StepLabel>
                            <StepContent>
                                <Box sx={{ mt: 2, mb: 2 }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Zone Set Name"
                                        value={zoneSetForm.name}
                                        onChange={(e) => setZoneSetForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., ABC Express Service Zones"
                                        sx={{ mb: 2 }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{ sx: { fontSize: '12px' } }}
                                    />
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Description (Optional)"
                                        value={zoneSetForm.description}
                                        onChange={(e) => setZoneSetForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Describe the purpose of this zone set..."
                                        multiline
                                        rows={2}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{ sx: { fontSize: '12px' } }}
                                    />
                                </Box>
                                <Box sx={{ mb: 1 }}>
                                    <Button
                                        variant="contained"
                                        onClick={handleNext}
                                        disabled={!zoneSetForm.name.trim()}
                                        sx={{ fontSize: '12px', mr: 1 }}
                                    >
                                        Continue
                                    </Button>
                                </Box>
                            </StepContent>
                        </Step>

                        {/* Step 2: Define Zones */}
                        <Step>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '14px', fontWeight: 500 } }}>
                                Define Zones
                            </StepLabel>
                            <StepContent>
                                <Box sx={{ mt: 2, mb: 2 }}>
                                    <Alert severity="info" sx={{ mb: 2, fontSize: '12px' }}>
                                        Create zones to organize cities into logical groups (e.g., "Zone A - Ontario", "Zone B - Quebec").
                                    </Alert>

                                    {/* Current Zone Form */}
                                    <Paper sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                            Create New Zone
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Zone Name"
                                            value={currentZone.name}
                                            onChange={(e) => setCurrentZone(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g., Zone A - Ontario"
                                            sx={{ mb: 2 }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />

                                        {/* City Search */}
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Search Cities"
                                            value={citySearchTerm}
                                            onChange={(e) => setCitySearchTerm(e.target.value)}
                                            placeholder="Search for cities to add to this zone..."
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                        />

                                        {/* City Search Results */}
                                        {citySearchLoading && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                                <CircularProgress size={16} />
                                                <Typography sx={{ ml: 1, fontSize: '12px' }}>Searching...</Typography>
                                            </Box>
                                        )}

                                        {citySearchResults.length > 0 && (
                                            <Paper sx={{ mt: 1, maxHeight: 200, overflow: 'auto', border: '1px solid #e5e7eb' }}>
                                                <List dense>
                                                    {citySearchResults.map((city) => (
                                                        <ListItem
                                                            key={city.searchKey || city.id}
                                                            button
                                                            onClick={() => handleAddCityToZone(city)}
                                                        >
                                                            <ListItemText
                                                                primary={
                                                                    <Typography sx={{ fontSize: '12px' }}>
                                                                        {city.city}, {city.provinceState}
                                                                    </Typography>
                                                                }
                                                                secondary={
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {city.country === 'CA' ? '🇨🇦 Canada' : city.country === 'US' ? '🇺🇸 United States' : city.country}
                                                                    </Typography>
                                                                }
                                                            />
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </Paper>
                                        )}

                                        {/* Current Zone Cities */}
                                        {currentZone.cities.length > 0 && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1 }}>
                                                    Cities in this zone ({currentZone.cities.length}):
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                    {currentZone.cities.map((city) => (
                                                        <Chip
                                                            key={city.searchKey || city.id}
                                                            label={`${city.city}, ${city.provinceState}`}
                                                            size="small"
                                                            onDelete={() => handleRemoveCityFromZone(city.searchKey || city.id)}
                                                            sx={{ fontSize: '11px' }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        <Box sx={{ mt: 2 }}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={handleAddZoneToSet}
                                                disabled={!currentZone.name.trim() || currentZone.cities.length === 0}
                                                sx={{ fontSize: '12px' }}
                                            >
                                                Add Zone to Set
                                            </Button>
                                        </Box>
                                    </Paper>

                                    {/* Created Zones */}
                                    {zoneSetForm.zones.length > 0 && (
                                        <Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                                Zones in Set ({zoneSetForm.zones.length})
                                            </Typography>
                                            <Grid container spacing={2}>
                                                {zoneSetForm.zones.map((zone) => (
                                                    <Grid item xs={12} md={6} key={zone.zoneId}>
                                                        <Card sx={{ border: '1px solid #e5e7eb' }}>
                                                            <CardHeader
                                                                title={
                                                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                                        {zone.name}
                                                                    </Typography>
                                                                }
                                                                subheader={
                                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                        {zone.cities.length} cities
                                                                    </Typography>
                                                                }
                                                                action={
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleRemoveZoneFromSet(zone.zoneId)}
                                                                    >
                                                                        <DeleteIcon sx={{ fontSize: '16px' }} />
                                                                    </IconButton>
                                                                }
                                                                sx={{ pb: 1 }}
                                                            />
                                                        </Card>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </Box>
                                    )}
                                </Box>

                                <Box sx={{ mb: 1 }}>
                                    <Button
                                        disabled={activeStep === 0}
                                        onClick={handleBack}
                                        sx={{ fontSize: '12px', mr: 1 }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleNext}
                                        disabled={zoneSetForm.zones.length === 0}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Continue
                                    </Button>
                                </Box>
                            </StepContent>
                        </Step>

                        {/* Step 3: Review & Create */}
                        <Step>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '14px', fontWeight: 500 } }}>
                                Review & Create
                            </StepLabel>
                            <StepContent>
                                <Box sx={{ mt: 2, mb: 2 }}>
                                    <Alert severity="success" sx={{ mb: 2, fontSize: '12px' }}>
                                        Review your custom zone set before creating it.
                                    </Alert>

                                    <Paper sx={{ p: 2, border: '1px solid #e5e7eb' }}>
                                        <Typography sx={{ fontSize: '16px', fontWeight: 600, mb: 1 }}>
                                            {zoneSetForm.name}
                                        </Typography>
                                        {zoneSetForm.description && (
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                                {zoneSetForm.description}
                                            </Typography>
                                        )}

                                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                            <Chip
                                                label={`${zoneSetForm.zones.length} zones`}
                                                color="primary"
                                                size="small"
                                                sx={{ fontSize: '11px' }}
                                            />
                                            <Chip
                                                label={`${getTotalCitiesCount()} total cities`}
                                                color="secondary"
                                                size="small"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </Box>

                                        <Divider sx={{ mb: 2 }} />

                                        <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                            Zone Details:
                                        </Typography>

                                        {zoneSetForm.zones.map((zone) => (
                                            <Box key={zone.zoneId} sx={{ mb: 2 }}>
                                                <Typography sx={{ fontSize: '13px', fontWeight: 500, mb: 1 }}>
                                                    {zone.name} ({zone.cities.length} cities)
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 2 }}>
                                                    {zone.cities.slice(0, 10).map((city) => (
                                                        <Typography
                                                            key={city.searchKey || city.id}
                                                            sx={{ fontSize: '11px', color: '#6b7280' }}
                                                        >
                                                            {city.city}, {city.provinceState}
                                                            {zone.cities.indexOf(city) < zone.cities.length - 1 ? ' •' : ''}
                                                        </Typography>
                                                    ))}
                                                    {zone.cities.length > 10 && (
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            ... and {zone.cities.length - 10} more
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Paper>
                                </Box>

                                <Box sx={{ mb: 1 }}>
                                    <Button
                                        disabled={activeStep === 0}
                                        onClick={handleBack}
                                        sx={{ fontSize: '12px', mr: 1 }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleCreateZoneSet}
                                        disabled={loading}
                                        startIcon={loading ? <CircularProgress size={16} /> : <CheckIcon />}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {loading ? 'Creating...' : 'Create Zone Set'}
                                    </Button>
                                </Box>
                            </StepContent>
                        </Step>
                    </Stepper>
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e5e7eb' }}>
                <Button
                    onClick={handleClose}
                    sx={{ fontSize: '12px' }}
                    disabled={loading}
                >
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CustomZoneManager;
