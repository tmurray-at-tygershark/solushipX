/**
 * Carrier Zone Set Selector Component
 * Reusable component for carrier-specific zone sets using the same UI as Enterprise Zone Management
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

const CarrierZoneSetSelector = ({
    carrierId,
    carrierName,
    onZoneSetSelection,
    selectedZoneSetIds = [],
    multiSelect = true,
    embedded = false,
    showActions = true,
    onCreateZoneSet
}) => {
    const { enqueueSnackbar } = useSnackbar();

    // State
    const [zoneSets, setZoneSets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedZoneSets, setSelectedZoneSets] = useState([]);

    // Search and filters
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDisplay, setSearchDisplay] = useState('');

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(embedded ? 50 : 25);

    // Load carrier zone sets
    const loadCarrierZoneSets = useCallback(async () => {
        if (!carrierId) {
            // If no carrierId, still show empty table
            setZoneSets([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const getCarrierZoneSets = httpsCallable(functions, 'getCarrierCustomZoneSets');
            const result = await getCarrierZoneSets({ carrierId });

            if (result.data.success) {
                let zoneSetsData = result.data.zoneSets || [];

                // Client-side search filtering
                if (searchTerm) {
                    const searchLower = searchTerm.toLowerCase();
                    zoneSetsData = zoneSetsData.filter(zoneSet =>
                        (zoneSet.name || '').toLowerCase().includes(searchLower) ||
                        (zoneSet.description || '').toLowerCase().includes(searchLower)
                    );
                }

                setZoneSets(zoneSetsData);
            }
        } catch (error) {
            console.error('Error loading carrier zone sets:', error);
            enqueueSnackbar('Failed to load carrier zone sets', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [carrierId, searchTerm, enqueueSnackbar]);

    // Load zone sets on component mount and when search changes
    useEffect(() => {
        loadCarrierZoneSets();
    }, [loadCarrierZoneSets]);

    // Ensure table renders on mount even if no carrierId
    useEffect(() => {
        if (!loading && zoneSets.length === 0) {
            setLoading(false); // Ensure we're not stuck in loading state
        }
    }, [loading, zoneSets.length]);

    // Handle zone set selection
    const handleZoneSetToggle = useCallback((zoneSet) => {
        if (multiSelect) {
            const isSelected = selectedZoneSets.some(z => z.id === zoneSet.id);
            let newSelection;

            if (isSelected) {
                newSelection = selectedZoneSets.filter(z => z.id !== zoneSet.id);
            } else {
                newSelection = [...selectedZoneSets, zoneSet];
            }

            setSelectedZoneSets(newSelection);
            onZoneSetSelection(newSelection);
        } else {
            setSelectedZoneSets([zoneSet]);
            onZoneSetSelection([zoneSet]);
        }
    }, [selectedZoneSets, multiSelect, onZoneSetSelection]);

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

    // Get paginated zone sets
    const paginatedZoneSets = zoneSets.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

    return (
        <Box>
            {/* Debug info - remove after testing */}
            {process.env.NODE_ENV === 'development' && (
                <Typography sx={{ fontSize: '10px', color: '#ef4444', mb: 1 }}>
                    Debug: carrierId={carrierId}, zoneSets.length={zoneSets.length}, loading={loading.toString()}
                </Typography>
            )}

            {/* Header with Create Button */}
            {showActions && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Custom zone sets for {carrierName}
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onCreateZoneSet}
                        sx={{ fontSize: '12px' }}
                    >
                        Create Zone Set
                    </Button>
                </Box>
            )}

            {/* Search */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search custom zone sets by name or description..."
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
                    Showing {paginatedZoneSets.length} custom zone sets
                    {searchTerm && ` matching "${searchTerm}"`}
                    {multiSelect && selectedZoneSets.length > 0 && ` • ${selectedZoneSets.length} selected`}
                </Typography>
            </Box>

            {/* Zone Sets Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', maxHeight: embedded ? 400 : 600 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            {multiSelect && (
                                <TableCell padding="checkbox" sx={{ bgcolor: '#f8fafc' }}>
                                    <Checkbox
                                        indeterminate={selectedZoneSets.length > 0 && selectedZoneSets.length < paginatedZoneSets.length}
                                        checked={paginatedZoneSets.length > 0 && selectedZoneSets.length === paginatedZoneSets.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedZoneSets(paginatedZoneSets);
                                                onZoneSetSelection(paginatedZoneSets);
                                            } else {
                                                setSelectedZoneSets([]);
                                                onZoneSetSelection([]);
                                            }
                                        }}
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Zones</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Total Cities</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Status</TableCell>
                            {showActions && (
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center' }}>Actions</TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? (showActions ? 7 : 6) : (showActions ? 6 : 5)} sx={{ textAlign: 'center', py: 4 }}>
                                    <CircularProgress size={24} />
                                    <Typography sx={{ mt: 1, fontSize: '12px', color: '#6b7280' }}>
                                        Loading custom zone sets...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : paginatedZoneSets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? (showActions ? 7 : 6) : (showActions ? 6 : 5)} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                    No custom zone sets created yet
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedZoneSets.map((zoneSet) => {
                                const isSelected = selectedZoneSets.some(z => z.id === zoneSet.id);
                                return (
                                    <TableRow
                                        key={zoneSet.id}
                                        hover
                                        onClick={() => handleZoneSetToggle(zoneSet)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        {multiSelect && (
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        handleZoneSetToggle(zoneSet);
                                                    }}
                                                    size="small"
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {zoneSet.name}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            {zoneSet.description || 'No description'}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={`${zoneSet.zones?.length || 0} zones`}
                                                size="small"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zoneSet.totalCities || 0}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zoneSet.enabled !== false ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={zoneSet.enabled !== false ? 'success' : 'default'}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        {showActions && (
                                            <TableCell sx={{ textAlign: 'center' }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // TODO: Implement zone set actions
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
            {!embedded && zoneSets.length > rowsPerPage && (
                <TablePagination
                    component="div"
                    count={zoneSets.length}
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
            {multiSelect && selectedZoneSets.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1 }}>
                        Selected Custom Zone Sets ({selectedZoneSets.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedZoneSets.map(zoneSet => (
                            <Chip
                                key={zoneSet.id}
                                label={`${zoneSet.name} (${zoneSet.zones?.length || 0} zones)`}
                                size="small"
                                onDelete={() => handleZoneSetToggle(zoneSet)}
                                sx={{ fontSize: '11px' }}
                            />
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default CarrierZoneSetSelector;
