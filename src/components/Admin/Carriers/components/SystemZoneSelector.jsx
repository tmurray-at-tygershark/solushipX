/**
 * System Zone Selector Component
 * Reusable component that provides the same powerful UI as Enterprise Zone Management > Zones tab
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    InputAdornment,
    TablePagination,
    Checkbox,
    Alert
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
    Edit as EditIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const SystemZoneSelector = ({
    onZoneSelection,
    selectedZoneIds = [],
    multiSelect = true,
    embedded = false,
    showActions = false,
    onEditZone,
    onDeleteZone,
    enabledZoneIds = null, // Filter to only show these zone IDs
    confirmButton = false // When true, don't auto-call onZoneSelection
}) => {
    const { enqueueSnackbar } = useSnackbar();

    // State
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedZones, setSelectedZones] = useState([]);

    // Search and filters
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDisplay, setSearchDisplay] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
    const [provinceFilter, setProvinceFilter] = useState('');

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(embedded ? 50 : 100); // Faster loading in embedded mode
    const [totalZones, setTotalZones] = useState(0);

    // Available filter options with flags
    const availableCountries = [
        { code: 'CA', name: 'Canada', flag: '🇨🇦' },
        { code: 'US', name: 'United States', flag: '🇺🇸' }
    ];

    // All provinces/states with full names - always available regardless of filter results  
    const allProvinces = {
        'CA': [
            { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' },
            { code: 'MB', name: 'Manitoba' }, { code: 'NB', name: 'New Brunswick' },
            { code: 'NL', name: 'Newfoundland and Labrador' }, { code: 'NS', name: 'Nova Scotia' },
            { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' },
            { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' },
            { code: 'QC', name: 'Quebec' }, { code: 'SK', name: 'Saskatchewan' },
            { code: 'YT', name: 'Yukon' }
        ],
        'US': [
            { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
            { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
            { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
            { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
            { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
            { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
            { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
            { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
            { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
            { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
            { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
            { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
            { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
            { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
            { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
            { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
            { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' }
        ]
    };

    // Load zones
    const loadZones = useCallback(async (pageNum = 0, limitNum = 50, search = '', country = '', province = '') => {
        setLoading(true);
        try {
            const getZones = httpsCallable(functions, 'getZones');

            // If there's a search term, fetch ALL results to search through them
            // Otherwise use pagination for performance
            const shouldFetchAll = search || province; // Search or province filter needs all results

            const queryData = {
                page: shouldFetchAll ? 0 : pageNum,
                limit: shouldFetchAll ? 1000 : limitNum, // Fetch more when searching
                enabled: true
            };

            // Add filters if provided
            if (country) {
                // Country filter is already in the correct format (CA/US)
                queryData.country = country;
            }

            const result = await getZones(queryData);

            if (result.data.success) {
                let zonesData = result.data.zones || [];

                // Client-side filtering for search and province (since cloud function doesn't support all filters)
                if (search) {
                    const searchLower = search.toLowerCase();
                    zonesData = zonesData.filter(zone =>
                        (zone.zoneCode || '').toLowerCase().includes(searchLower) ||
                        (zone.zoneName || '').toLowerCase().includes(searchLower) ||
                        (zone.description || '').toLowerCase().includes(searchLower)
                    );
                }

                if (province) {
                    zonesData = zonesData.filter(zone =>
                        zone.provinces?.includes(province) ||
                        zone.stateProvince === province ||
                        zone.provinceState === province
                    );
                }

                // When searching, show ALL results without pagination
                // Filter zones if enabledZoneIds is provided
                let filteredZones = zonesData;
                if (enabledZoneIds && Array.isArray(enabledZoneIds)) {
                    filteredZones = zonesData.filter(zone => enabledZoneIds.includes(zone.id));
                    console.log('🔍 Filtered zones for carrier:', {
                        totalZones: zonesData.length,
                        enabledZoneIds: enabledZoneIds.length,
                        filteredZones: filteredZones.length
                    });
                }

                // When not searching, use normal pagination
                if (search) {
                    // Show all search results
                    setZones(filteredZones);
                    setTotalZones(filteredZones.length);
                } else if (province) {
                    // Show all province filter results
                    setZones(filteredZones);
                    setTotalZones(filteredZones.length);
                } else {
                    // Normal pagination for browsing
                    setZones(filteredZones);
                    setTotalZones(result.data.totalCount || filteredZones.length);
                }
            }
        } catch (error) {
            console.error('Error loading zones:', error);
            enqueueSnackbar('Failed to load zones', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [embedded, enqueueSnackbar]);

    // Load zones on component mount and when filters change
    useEffect(() => {
        loadZones(page, rowsPerPage, searchTerm, countryFilter, provinceFilter);
    }, [page, rowsPerPage, searchTerm, countryFilter, provinceFilter, loadZones]);

    // Handle zone selection
    const handleZoneToggle = useCallback((zone) => {
        if (multiSelect) {
            const isSelected = selectedZones.some(z => z.id === zone.id);
            let newSelection;

            if (isSelected) {
                newSelection = selectedZones.filter(z => z.id !== zone.id);
            } else {
                newSelection = [...selectedZones, zone];
            }

            setSelectedZones(newSelection);
            if (!confirmButton) {
                onZoneSelection(newSelection);
            }
        } else {
            setSelectedZones([zone]);
            if (!confirmButton) {
                onZoneSelection([zone]);
            }
        }
    }, [selectedZones, multiSelect, onZoneSelection, confirmButton]);

    // Handle search
    const handleSearch = useCallback(() => {
        setSearchTerm(searchDisplay);
        setPage(0); // Reset to first page when searching
    }, [searchDisplay]);

    // Handle confirm selection (when confirmButton is true)
    const handleConfirmSelection = useCallback(() => {
        onZoneSelection(selectedZones);
    }, [selectedZones, onZoneSelection]);

    // Auto-search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchDisplay !== searchTerm) {
                handleSearch();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchDisplay, searchTerm, handleSearch]);

    return (
        <Box>

            {/* Search and Filters */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search zones by code, name, or description..."
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
                <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                        <Select
                            value={countryFilter}
                            onChange={(e) => {
                                const newCountry = e.target.value;
                                setCountryFilter(newCountry);
                                setProvinceFilter(''); // Clear province when country changes
                                setPage(0);
                            }}
                            label="Country"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                            {availableCountries.map(country => (
                                <MenuItem key={country.code} value={country.code} sx={{ fontSize: '12px' }}>
                                    {country.flag} {country.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Province/State</InputLabel>
                        <Select
                            value={countryFilter ? provinceFilter : ''}
                            onChange={(e) => {
                                setProvinceFilter(e.target.value);
                                setPage(0);
                            }}
                            label="Province/State"
                            sx={{
                                fontSize: '12px',
                                opacity: !countryFilter ? 0.6 : 1
                            }}
                            disabled={!countryFilter}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Provinces/States</MenuItem>
                            {countryFilter && allProvinces[countryFilter] &&
                                allProvinces[countryFilter].map(province => (
                                    <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                        {province.name} - {province.code}
                                    </MenuItem>
                                ))
                            }
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            {/* Results Summary */}
            {(searchTerm || countryFilter || provinceFilter) ? (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Showing {zones.length} zones
                        {searchTerm && ` matching "${searchTerm}"`}
                        {countryFilter && ` in ${countryFilter}`}
                        {provinceFilter && ` - ${provinceFilter}`}
                        {multiSelect && selectedZones.length > 0 && ` • ${selectedZones.length} selected`}
                    </Typography>
                </Box>
            ) : (
                totalZones > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Showing {zones.length} zones of {totalZones} total
                            {multiSelect && selectedZones.length > 0 && ` • ${selectedZones.length} selected`}
                        </Typography>
                    </Box>
                )
            )}

            {/* Zones Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', maxHeight: embedded ? 500 : 700 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            {multiSelect && (
                                <TableCell padding="checkbox" sx={{ bgcolor: '#f8fafc' }}>
                                    <Checkbox
                                        indeterminate={selectedZones.length > 0 && selectedZones.length < zones.length}
                                        checked={zones.length > 0 && selectedZones.length === zones.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedZones(zones);
                                                onZoneSelection(zones);
                                            } else {
                                                setSelectedZones([]);
                                                onZoneSelection([]);
                                            }
                                        }}
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Zone Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Zone Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Cities</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Postal Codes</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Country</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>Status</TableCell>
                            {showActions && (
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center' }}>Actions</TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? (showActions ? 8 : 7) : (showActions ? 7 : 6)} sx={{ textAlign: 'center', py: 4 }}>
                                    <CircularProgress size={24} />
                                    <Typography sx={{ mt: 1, fontSize: '12px', color: '#6b7280' }}>
                                        Loading zones...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : zones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={multiSelect ? (showActions ? 8 : 7) : (showActions ? 7 : 6)} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                    No zones found. Try adjusting your search criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            zones.map((zone) => {
                                const isSelected = selectedZones.some(z => z.id === zone.id);
                                return (
                                    <TableRow
                                        key={zone.id}
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
                                        <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500 }}>
                                            {zone.zoneCode || zone.zoneId || zone.id}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box>
                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {zone.zoneName}
                                                </Typography>
                                                {zone.description && (
                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {zone.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zone.metadata?.totalCities || zone.cities?.length || 0}
                                                size="small"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zone.metadata?.totalPostalCodes || zone.postalCodes?.length || 0}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {zone.country === 'CA' ? '🇨🇦 Canada' :
                                                zone.country === 'US' ? '🇺🇸 United States' :
                                                    zone.country || 'N/A'}
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
                                                        // TODO: Show actions menu
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
            {totalZones > rowsPerPage && (
                <TablePagination
                    component="div"
                    count={totalZones}
                    page={page}
                    onPageChange={(event, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={embedded ? [25, 50, 100] : [25, 50, 100, 200]}
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                            Selected Zones ({selectedZones.length}):
                        </Typography>
                        {confirmButton && (
                            <Button
                                variant="contained"
                                size="small"
                                onClick={handleConfirmSelection}
                                sx={{ fontSize: '11px', minWidth: 'auto', px: 2 }}
                            >
                                Add Selected Zones
                            </Button>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedZones.map(zone => (
                            <Chip
                                key={zone.id}
                                label={`${zone.zoneCode || zone.id}: ${zone.zoneName}`}
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

export default SystemZoneSelector;
