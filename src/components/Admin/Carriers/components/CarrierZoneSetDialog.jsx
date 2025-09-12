/**
 * Carrier Zone Set Dialog Component
 * Replicates the exact same UI as Enterprise Zone Management > Add Zone Set dialog
 * but for carrier-specific zone set creation
 */

import React, { useState, useCallback, useEffect } from 'react';
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
    Autocomplete,
    Chip
} from '@mui/material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const CarrierZoneSetDialog = ({
    open,
    onClose,
    carrierId,
    carrierName,
    editingZoneSet = null,
    onZoneSetCreated
}) => {
    const { enqueueSnackbar } = useSnackbar();

    // Form state
    const [zoneSetForm, setZoneSetForm] = useState({
        name: '',
        description: '',
        selectedZones: [], // Array of zone objects
        enabled: true
    });

    // Available zones for this carrier
    const [availableZones, setAvailableZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(false);

    // Load available carrier zones
    const loadCarrierZones = useCallback(async () => {
        if (!carrierId) return;

        setLoadingZones(true);
        try {
            const getCarrierZoneSets = httpsCallable(functions, 'getCarrierCustomZoneSets');
            const result = await getCarrierZoneSets({ carrierId });

            if (result.data.success) {
                const zoneSets = result.data.zoneSets || [];

                // Extract individual zones from zone sets
                const allZones = [];
                zoneSets.forEach(zoneSet => {
                    if (zoneSet.zones && Array.isArray(zoneSet.zones)) {
                        zoneSet.zones.forEach(zone => {
                            allZones.push({
                                ...zone,
                                zoneSetId: zoneSet.id,
                                zoneSetName: zoneSet.name,
                                displayName: `${zone.name} (${zone.cities?.length || 0} cities)`
                            });
                        });
                    }
                });

                setAvailableZones(allZones);
            }
        } catch (error) {
            console.error('Error loading carrier zones:', error);
            enqueueSnackbar('Failed to load carrier zones', { variant: 'error' });
        } finally {
            setLoadingZones(false);
        }
    }, [carrierId, enqueueSnackbar]);

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            loadCarrierZones();

            if (editingZoneSet) {
                setZoneSetForm({
                    name: editingZoneSet.name || '',
                    description: editingZoneSet.description || '',
                    selectedZones: editingZoneSet.zones || [],
                    enabled: editingZoneSet.enabled !== false
                });
            } else {
                setZoneSetForm({
                    name: '',
                    description: '',
                    selectedZones: [],
                    enabled: true
                });
            }
        }
    }, [open, editingZoneSet, loadCarrierZones]);

    // Handle save zone set
    const handleSaveZoneSet = useCallback(async () => {
        if (!zoneSetForm.name.trim()) {
            enqueueSnackbar('Zone set name is required', { variant: 'error' });
            return;
        }

        if (zoneSetForm.selectedZones.length === 0) {
            enqueueSnackbar('At least one zone must be selected', { variant: 'error' });
            return;
        }

        try {
            if (editingZoneSet) {
                // Update existing zone set
                const updateCustomZoneSet = httpsCallable(functions, 'updateCarrierCustomZoneSet');
                const result = await updateCustomZoneSet({
                    carrierId,
                    zoneSetId: editingZoneSet.id,
                    updates: {
                        name: zoneSetForm.name,
                        description: zoneSetForm.description,
                        zones: zoneSetForm.selectedZones,
                        enabled: zoneSetForm.enabled
                    }
                });

                if (result.data.success) {
                    enqueueSnackbar('Zone set updated successfully', { variant: 'success' });
                    onZoneSetCreated && onZoneSetCreated(editingZoneSet.id);
                    onClose();
                } else {
                    enqueueSnackbar('Failed to update zone set', { variant: 'error' });
                }
            } else {
                // Create new zone set
                const createCustomZoneSet = httpsCallable(functions, 'createCarrierCustomZoneSet');
                const result = await createCustomZoneSet({
                    carrierId,
                    carrierName,
                    zoneSetName: zoneSetForm.name,
                    description: zoneSetForm.description,
                    zones: zoneSetForm.selectedZones
                });

                if (result.data.success) {
                    enqueueSnackbar('Zone set created successfully', { variant: 'success' });
                    onZoneSetCreated && onZoneSetCreated(result.data.zoneSetId);
                    onClose();
                } else {
                    enqueueSnackbar('Failed to create zone set', { variant: 'error' });
                }
            }
        } catch (error) {
            console.error('Error saving zone set:', error);
            enqueueSnackbar(error.message || 'Failed to save zone set', { variant: 'error' });
        }
    }, [zoneSetForm, carrierId, carrierName, editingZoneSet, onZoneSetCreated, onClose, enqueueSnackbar]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                {editingZoneSet ? 'Edit Custom Zone Set' : 'Create Custom Zone Set'} for {carrierName}
            </DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Zone Set Name"
                            value={zoneSetForm.name}
                            onChange={(e) => setZoneSetForm(prev => ({ ...prev, name: e.target.value }))}
                            size="small"
                            required
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            placeholder="e.g., ABC Express Service Zones, Primary Delivery Areas"
                        />
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
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Select Zones to Include
                        </Typography>

                        <Autocomplete
                            multiple
                            options={availableZones}
                            getOptionLabel={(zone) => zone.displayName || zone.name || zone.zoneId}
                            value={zoneSetForm.selectedZones}
                            onChange={(event, newValue) => {
                                setZoneSetForm(prev => ({
                                    ...prev,
                                    selectedZones: newValue
                                }));
                            }}
                            loading={loadingZones}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Search and Select Zones"
                                    placeholder="Type to search zones by name, code, location..."
                                    size="small"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            )}
                            renderTags={(value, getTagProps) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {value.map((zone, index) => {
                                        const tagProps = getTagProps({ index });
                                        return (
                                            <Chip
                                                {...tagProps}
                                                key={zone.zoneId}
                                                label={`${zone.name} (${zone.cities?.length || 0} cities)`}
                                                size="small"
                                                onDelete={() => {
                                                    // Remove this zone from selection
                                                    setZoneSetForm(prev => ({
                                                        ...prev,
                                                        selectedZones: prev.selectedZones.filter(z => z.zoneId !== zone.zoneId)
                                                    }));
                                                }}
                                                color={zone.enabled !== false ? 'primary' : 'default'}
                                                sx={{
                                                    fontSize: '10px',
                                                    '& .MuiChip-deleteIcon': {
                                                        fontSize: '14px',
                                                        '&:hover': {
                                                            color: '#d32f2f'
                                                        }
                                                    }
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            )}
                            renderOption={(props, zone) => (
                                <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {zone.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            {zone.cities?.length || 0} cities • From: {zone.zoneSetName}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            noOptionsText={
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', p: 2 }}>
                                    No custom zones available. Create individual zones first.
                                </Typography>
                            }
                            sx={{
                                '& .MuiAutocomplete-inputRoot': {
                                    fontSize: '12px'
                                },
                                '& .MuiAutocomplete-option': {
                                    fontSize: '12px'
                                }
                            }}
                        />

                        {zoneSetForm.selectedZones.length > 0 && (
                            <Alert severity="success" sx={{ fontSize: '12px', mt: 2 }}>
                                Selected {zoneSetForm.selectedZones.length} zones with {' '}
                                {zoneSetForm.selectedZones.reduce((sum, zone) => sum + (zone.cities?.length || 0), 0)} total cities
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
                    onClick={handleSaveZoneSet}
                    variant="contained"
                    size="small"
                    sx={{ fontSize: '12px' }}
                    disabled={!zoneSetForm.name.trim() || zoneSetForm.selectedZones.length === 0}
                >
                    {editingZoneSet ? 'Update' : 'Create'} Zone Set
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CarrierZoneSetDialog;
