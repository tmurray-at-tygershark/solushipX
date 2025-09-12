/**
 * Carrier Zone Selector Component
 * Reusable component for carrier-specific zones using the same UI as Enterprise Zone Management
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
    CircularProgress,
    TextField,
    Grid,
    InputAdornment,
    TablePagination,
    Checkbox,
    Alert
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const CarrierZoneSelector = ({
    carrierId,
    carrierName,
    onZoneSelection,
    selectedZoneIds = [],
    multiSelect = true,
    embedded = false,
    showActions = true,
    onCreateZone
}) => {
    const { enqueueSnackbar } = useSnackbar();

    // State
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedZones, setSelectedZones] = useState([]);

    // Search and filters
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDisplay, setSearchDisplay] = useState('');

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(embedded ? 50 : 25);

    // Load carrier zones
    const loadCarrierZones = useCallback(async () => {
        if (!carrierId) {
            // If no carrierId, still show empty table
            setZones([]);
            setLoading(false);
            return;
        }

        setLoading(true);
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
                                type: 'custom'
                            });
                        });
                    }
                });

                // Client-side search filtering
                let filteredZones = allZones;
                if (searchTerm) {
                    const searchLower = searchTerm.toLowerCase();
                    filteredZones = allZones.filter(zone =>
                        (zone.name || '').toLowerCase().includes(searchLower) ||
                        (zone.zoneId || '').toLowerCase().includes(searchLower) ||
                        (zone.zoneSetName || '').toLowerCase().includes(searchLower)
                    );
                }

                setZones(filteredZones);
            }
        } catch (error) {
            console.error('Error loading carrier zones:', error);
            enqueueSnackbar('Failed to load carrier zones', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, searchTerm, enqueueSnackbar]);

    // Load zones on component mount and when search changes
    useEffect(() => {
        loadCarrierZones();
    }, [loadCarrierZones]);

    // Ensure table renders on mount even if no carrierId
    useEffect(() => {
        if (!loading && zones.length === 0) {
            setLoading(false); // Ensure we're not stuck in loading state
        }
    }, [loading, zones.length]);

    // Handle zone selection
    const handleZoneToggle = useCallback((zone) => {
        if (multiSelect) {
            const isSelected = selectedZones.some(z => z.zoneId === zone.zoneId);
            let newSelection;

            if (isSelected) {
                newSelection = selectedZones.filter(z => z.zoneId !== zone.zoneId);
            } else {
                newSelection = [...selectedZones, zone];
            }

            setSelectedZones(newSelection);
            onZoneSelection(newSelection);
        } else {
            setSelectedZones([zone]);
            onZoneSelection([zone]);
        }
    }, [selectedZones, multiSelect, onZoneSelection]);

    // Handle search
    const handleSearch = useCallback(() => {
        setSearchTerm(searchDisplay);
        setPage(0); // Reset to first page when searching
    }, [searchDisplay]);

    // Auto-search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchDisplay !== searchTerm) {
                handleSearch();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchDisplay, searchTerm, handleSearch]);

    // Get paginated zones
    const paginatedZones = zones.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

    return (
        <Box>
            {/* Debug info - remove after testing */}
            {process.env.NODE_ENV === 'development' && (
                <Typography sx={{ fontSize: '10px', color: '#ef4444', mb: 1 }}>
                    Debug: carrierId={carrierId}, zones.length={zones.length}, loading={loading.toString()}
                </Typography>
            )}

            {/* Header with Create Button */}
            {showActions && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Custom zones for {carrierName}
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onCreateZone}
                        sx={{ fontSize: '12px' }}
                    >
                        Create Zone
                    </Button>
                </Box>
            )}

            {/* Search */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search custom zones by name, zone ID, or zone set..."
                        value={searchDisplay}
                        onChange={(e) => setSearchDisplay(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch();
                            } else if (e.key === 'Escape') {
                                setSearchDisplay('');
                                setSearchTerm('');
                            }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: '16px' }} />
                                </InputAdornment>
                            ),
                            endAdornment: searchDisplay && (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            setSearchDisplay('');
                                            setSearchTerm('');
                                        }}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                            sx: { fontSize: '12px' }
                        }}
                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                    />
                </Grid>
            </Grid>

            {/* Results Summary */}
            <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Showing {paginatedZones.length} custom zones
                    {searchTerm && ` matching "${searchTerm}"`}
                    {multiSelect && selectedZones.length > 0 && ` • ${selectedZones.length} selected`}
                </Typography>
            </Box>

            {/* Zones Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', maxHeight: embedded ? 400 : 600 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            {multiSelect && (
                                <TableCell padding="checkbox" sx={{ bgcolor: '#f8fafc' }}>
                                    <Checkbox
                                        indeterminate={selectedZones.length > 0 && selectedZones.length < paginatedZones.length}
                                        checked={paginatedZones.length > 0 && selectedZones.length === paginatedZones.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedZones(paginatedZones);
                                                onZoneSelection(paginatedZones);
                                            } else {
                                                setSelectedZones([]);
                                                onZoneSelection([]);
                                            }
                                        }}
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Zone Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Zone Set</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Cities</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Status</TableCell>
                            {showActions && (
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center' }}>Actions</TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? (showActions ? 6 : 5) : (showActions ? 5 : 4)} sx={{ textAlign: 'center', py: 4 }}>
                                    <CircularProgress size={24} />
                                    <Typography sx={{ mt: 1, fontSize: '12px', color: '#6b7280' }}>
                                        Loading custom zones...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : paginatedZones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? (showActions ? 6 : 5) : (showActions ? 5 : 4)} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                    No custom zones created yet
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedZones.map((zone) => {
                                const isSelected = selectedZones.some(z => z.zoneId === zone.zoneId);
                                return (
                                    <TableRow
                                        key={zone.zoneId}
                                        hover
                                        onClick={() => handleZoneToggle(zone)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        {multiSelect && (
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        handleZoneToggle(zone);
                                                    }}
                                                    size="small"
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {zone.name}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            {zone.zoneSetName}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zone.cities?.length || 0}
                                                size="small"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zone.enabled !== false ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={zone.enabled !== false ? 'success' : 'default'}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        {showActions && (
                                            <TableCell sx={{ textAlign: 'center' }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // TODO: Implement zone actions
                                                    }}
                                                >
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Pagination */}
            {!embedded && zones.length > rowsPerPage && (
                <TablePagination
                    component="div"
                    count={zones.length}
                    page={page}
                    onPageChange={(event, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={embedded ? [25, 50, 100] : [10, 25, 50]}
                    sx={{
                        '& .MuiTablePagination-toolbar': { fontSize: '12px' },
                        '& .MuiTablePagination-selectLabel': { fontSize: '12px' },
                        '& .MuiTablePagination-displayedRows': { fontSize: '12px' }
                    }}
                />
            )}

            {/* Selection Summary */}
            {multiSelect && selectedZones.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1 }}>
                        Selected Custom Zones ({selectedZones.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedZones.map(zone => (
                            <Chip
                                key={zone.zoneId}
                                label={`${zone.name} (${zone.cities?.length || 0} cities)`}
                                size="small"
                                onDelete={() => handleZoneToggle(zone)}
                                sx={{ fontSize: '11px' }}
                            />
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default CarrierZoneSelector;
