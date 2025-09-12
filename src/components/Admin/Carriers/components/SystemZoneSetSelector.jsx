/**
 * System Zone Set Selector Component
 * Reusable component that provides the same powerful UI as Enterprise Zone Management > Zone Sets tab
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    CircularProgress,
    TextField,
    Grid,
    InputAdornment,
    TablePagination,
    Checkbox,
    Alert,
    IconButton
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    Visibility as ViewIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const SystemZoneSetSelector = ({
    onZoneSetSelection,
    selectedZoneSetIds = [],
    multiSelect = true,
    embedded = false,
    confirmButton = false,
    enabledZoneSetIds = null // Filter to only show these zone set IDs
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

    // Load zone sets
    const loadZoneSets = useCallback(async () => {
        setLoading(true);
        try {
            const zoneSetsQuery = query(
                collection(db, 'zoneSets'),
                where('enabled', '==', true),
                orderBy('name')
            );
            const snapshot = await getDocs(zoneSetsQuery);
            let zoneSetsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                type: 'system'
            }));

            // Client-side search filtering
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                zoneSetsData = zoneSetsData.filter(zoneSet =>
                    (zoneSet.name || '').toLowerCase().includes(searchLower) ||
                    (zoneSet.description || '').toLowerCase().includes(searchLower) ||
                    (zoneSet.geography || '').toLowerCase().includes(searchLower)
                );
            }

            // Filter zone sets if enabledZoneSetIds is provided
            let filteredZoneSets = zoneSetsData;
            if (enabledZoneSetIds && Array.isArray(enabledZoneSetIds)) {
                filteredZoneSets = zoneSetsData.filter(zoneSet => enabledZoneSetIds.includes(zoneSet.id));
                console.log('🔍 Filtered zone sets for carrier:', {
                    totalZoneSets: zoneSetsData.length,
                    enabledZoneSetIds: enabledZoneSetIds.length,
                    filteredZoneSets: filteredZoneSets.length
                });
            }

            setZoneSets(filteredZoneSets);
        } catch (error) {
            console.error('Error loading zone sets:', error);
            enqueueSnackbar('Failed to load zone sets', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [searchTerm, enqueueSnackbar]);

    // Load zone sets on component mount and when search changes
    useEffect(() => {
        loadZoneSets();
    }, [loadZoneSets]);

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
            if (!confirmButton) {
                onZoneSetSelection(newSelection);
            }
        } else {
            setSelectedZoneSets([zoneSet]);
            if (!confirmButton) {
                onZoneSetSelection([zoneSet]);
            }
        }
    }, [selectedZoneSets, multiSelect, onZoneSetSelection, confirmButton]);

    // Handle search
    const handleSearch = useCallback(() => {
        setSearchTerm(searchDisplay);
    }, [searchDisplay]);

    // Handle confirm selection (when confirmButton is true)
    const handleConfirmSelection = useCallback(() => {
        onZoneSetSelection(selectedZoneSets);
    }, [selectedZoneSets, onZoneSetSelection]);

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

            {/* Search */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search zone sets by name, description, or geography..."
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
                    Showing {paginatedZoneSets.length} zone sets
                    {searchTerm && ` matching "${searchTerm}"`}
                    {multiSelect && selectedZoneSets.length > 0 && ` • ${selectedZoneSets.length} selected`}
                </Typography>
            </Box>

            {/* Zone Sets Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', maxHeight: embedded ? 500 : 700 }}>
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
                                                if (!confirmButton) {
                                                    onZoneSetSelection(paginatedZoneSets);
                                                }
                                            } else {
                                                setSelectedZoneSets([]);
                                                if (!confirmButton) {
                                                    onZoneSetSelection([]);
                                                }
                                            }
                                        }}
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Zones</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Coverage</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Service Types</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? 7 : 6} sx={{ textAlign: 'center', py: 4 }}>
                                    <CircularProgress size={24} />
                                    <Typography sx={{ mt: 1, fontSize: '12px', color: '#6b7280' }}>
                                        Loading zone sets...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : paginatedZoneSets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? 7 : 6} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                    No zone sets found. Try adjusting your search criteria.
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
                                                label={`${zoneSet.zoneCount || zoneSet.selectedZones?.length || 0} zones`}
                                                size="small"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zoneSet.coverage || 'Unknown'}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {zoneSet.serviceTypes?.slice(0, 2).map(service => (
                                                    <Chip
                                                        key={service}
                                                        label={service}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '10px' }}
                                                    />
                                                )) || (
                                                        <Typography sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                                            No services
                                                        </Typography>
                                                    )}
                                                {zoneSet.serviceTypes?.length > 2 && (
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        +{zoneSet.serviceTypes.length - 2} more
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zoneSet.enabled !== false ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={zoneSet.enabled !== false ? 'success' : 'default'}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
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
                    rowsPerPageOptions={[10, 25, 50]}
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
                        Selected Zone Sets ({selectedZoneSets.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedZoneSets.map(zoneSet => (
                            <Chip
                                key={zoneSet.id}
                                label={`${zoneSet.name} (${zoneSet.zoneCount || 0} zones)`}
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

export default SystemZoneSetSelector;
