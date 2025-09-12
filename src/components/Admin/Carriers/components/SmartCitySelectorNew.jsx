/**
 * SmartCitySelector Component - REFACTORED FOR CITY MANAGEMENT
 * 
 * New approach: Manage existing activated cities with separate add flow
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import {
    Box, Paper, Typography, Button, Grid, Tabs, Tab,
    TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TablePagination, Checkbox, Chip, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, IconButton, Menu, MenuItem as MenuItemComponent,
    Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, TableSortLabel
} from '@mui/material';
import {
    Search as SearchIcon, Add as AddIcon, MoreVert as MoreVertIcon,
    Visibility as EnableIcon, VisibilityOff as DisableIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import useGeographicData from '../../../../hooks/useGeographicData';
import { useSnackbar } from 'notistack';

// Lazy load MapCitySelector to prevent any map initialization until needed
const MapCitySelector = lazy(() => import('./MapCitySelector'));

const SmartCitySelector = ({
    isOpen,
    onClose,
    onSelectionComplete,
    zoneCategory = 'pickupZones',
    selectedCities = [],
    title = 'Smart City Selection',
    embedded = false,
    onMapAreaSave,
    savedAreas = [],
    carrierId
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const { searchCities } = useGeographicData();

    // UI State
    const [activeTab, setActiveTab] = useState(0); // 0 = Manage Cities, 1 = Map View
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
    const [provinceStateFilter, setProvinceStateFilter] = useState('');
    const [sortBy, setSortBy] = useState('city');
    const [sortDirection, setSortDirection] = useState('asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(1000);

    // Data State
    const [activatedCities, setActivatedCities] = useState([]); // Cities already added to this zone
    const [filteredCities, setFilteredCities] = useState([]);
    const [selectedCityIds, setSelectedCityIds] = useState(new Set()); // For bulk actions

    // Dialog State
    const [addCityDialogOpen, setAddCityDialogOpen] = useState(false);
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [actionMenuCity, setActionMenuCity] = useState(null);

    // Load activated cities from props
    const loadActivatedCities = useCallback(() => {
        setLoading(true);
        try {
            if (selectedCities && selectedCities.length > 0) {
                // Add status field to each city and remove duplicates
                const seenIds = new Set();
                const citiesWithStatus = selectedCities
                    .filter(city => {
                        const cityId = city.searchKey || city.id;
                        if (seenIds.has(cityId)) {
                            console.warn(`🚨 [SmartCitySelector] Removing duplicate on load: ${city.city} (${cityId})`);
                            return false;
                        }
                        seenIds.add(cityId);
                        return true;
                    })
                    .map(city => ({
                        ...city,
                        status: city.status || 'enabled',
                        id: city.searchKey || city.id
                    }));

                setActivatedCities(citiesWithStatus);
                setFilteredCities(citiesWithStatus);
                setSelectedCityIds(new Set());

                console.log('🏙️ [SmartCitySelector] Loaded', citiesWithStatus.length, 'activated cities for', zoneCategory);
            } else {
                setActivatedCities([]);
                setFilteredCities([]);
                setSelectedCityIds(new Set());
                console.log('📋 [SmartCitySelector] No cities activated yet for', zoneCategory);
            }
        } catch (error) {
            console.error('❌ Error loading activated cities:', error);
            enqueueSnackbar('Failed to load cities', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [selectedCities, zoneCategory, enqueueSnackbar]);

    // Load cities on mount and when selectedCities changes
    useEffect(() => {
        loadActivatedCities();
    }, [loadActivatedCities]);

    // Filter and search activated cities
    const applyFilters = useCallback(() => {
        let filtered = [...activatedCities];

        // Apply search filter (search within activated cities only)
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(city =>
                city.city?.toLowerCase().includes(term) ||
                city.provinceState?.toLowerCase().includes(term) ||
                city.country?.toLowerCase().includes(term)
            );
        }

        // Apply country filter
        if (countryFilter) {
            filtered = filtered.filter(city => city.country === countryFilter);
        }

        // Apply province/state filter
        if (provinceStateFilter) {
            filtered = filtered.filter(city => city.provinceState === provinceStateFilter);
        }

        // Apply sorting
        if (sortBy) {
            filtered.sort((a, b) => {
                const aVal = a[sortBy] || '';
                const bVal = b[sortBy] || '';
                const comparison = aVal.localeCompare(bVal);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        setFilteredCities(filtered);
        setPage(0); // Reset to first page when filters change
    }, [activatedCities, searchTerm, countryFilter, provinceStateFilter, sortBy, sortDirection]);

    // Apply filters when dependencies change
    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    // All possible countries and provinces (not just from activated cities)
    const availableCountries = useMemo(() => {
        // Always include CA and US, plus any from activated cities
        const citiesCountries = [...new Set(activatedCities.map(city => city.country))].filter(Boolean);
        const allCountries = ['CA', 'US'];
        return [...new Set([...citiesCountries, ...allCountries])].sort();
    }, [activatedCities]);

    const availableProvinces = useMemo(() => {
        // Always show all provinces for selected country with full names
        const allProvincesByCountry = {
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

        if (countryFilter && allProvincesByCountry[countryFilter]) {
            return allProvincesByCountry[countryFilter];
        }

        // Fallback to activated cities provinces if no country filter
        return [...new Set(activatedCities.map(city => city.provinceState))].filter(Boolean).sort().map(code => ({
            code,
            name: code // Fallback to code if no name mapping available
        }));
    }, [countryFilter, activatedCities]);

    // Handle city status toggle
    const handleCityStatusToggle = useCallback((city) => {
        const newStatus = city.status === 'enabled' ? 'disabled' : 'enabled';
        const updatedCities = activatedCities.map(c =>
            c.id === city.id ? { ...c, status: newStatus } : c
        );

        setActivatedCities(updatedCities);
        onSelectionComplete(updatedCities);

        enqueueSnackbar(`${city.city} ${newStatus}`, { variant: 'info' });
        setActionMenuAnchor(null);
    }, [activatedCities, onSelectionComplete, enqueueSnackbar]);

    // Handle city deletion
    const handleDeleteCity = useCallback((city) => {
        const updatedCities = activatedCities.filter(c => c.id !== city.id);
        setActivatedCities(updatedCities);
        onSelectionComplete(updatedCities);

        enqueueSnackbar(`Removed ${city.city}`, { variant: 'success' });
        setActionMenuAnchor(null);
    }, [activatedCities, onSelectionComplete, enqueueSnackbar]);

    // Handle bulk actions
    const handleBulkDelete = useCallback(() => {
        const updatedCities = activatedCities.filter(city => !selectedCityIds.has(city.id));
        setActivatedCities(updatedCities);
        onSelectionComplete(updatedCities);
        setSelectedCityIds(new Set());

        enqueueSnackbar(`Deleted ${selectedCityIds.size} cities`, { variant: 'success' });
    }, [activatedCities, selectedCityIds, onSelectionComplete, enqueueSnackbar]);

    const handleBulkStatusChange = useCallback((newStatus) => {
        const updatedCities = activatedCities.map(city =>
            selectedCityIds.has(city.id) ? { ...city, status: newStatus } : city
        );
        setActivatedCities(updatedCities);
        onSelectionComplete(updatedCities);
        setSelectedCityIds(new Set());

        enqueueSnackbar(`${newStatus === 'enabled' ? 'Enabled' : 'Disabled'} ${selectedCityIds.size} cities`, { variant: 'success' });
    }, [activatedCities, selectedCityIds, onSelectionComplete, enqueueSnackbar]);

    // Handle checkbox selection
    const handleCitySelect = useCallback((cityId, checked) => {
        setSelectedCityIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(cityId);
            } else {
                newSet.delete(cityId);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback((checked) => {
        if (checked) {
            const allIds = new Set(filteredCities.map(city => city.id));
            setSelectedCityIds(allIds);
        } else {
            setSelectedCityIds(new Set());
        }
    }, [filteredCities]);

    // Handle sorting
    const handleSort = useCallback((field) => {
        if (sortBy === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDirection('asc');
        }
    }, [sortBy]);

    // Handle map selection completion - FIXED to handle both addition and deletion
    const handleMapSelectionComplete = useCallback((incomingCities) => {
        console.log(`🗺️ [SmartCitySelector] Map selection complete:`, {
            currentActivated: activatedCities.length,
            incomingCities: incomingCities.length,
            incomingCityNames: incomingCities.map(c => c.city).slice(0, 5)
        });

        // FIXED: Replace entire activated cities list with incoming cities
        // This handles both addition (more cities) and deletion (fewer cities)
        // DUPLICATE PREVENTION: Remove duplicates by searchKey/id
        const seenIds = new Set();
        const citiesWithStatus = incomingCities
            .filter(city => {
                const cityId = city.searchKey || city.id;
                if (seenIds.has(cityId)) {
                    console.warn(`🚨 [SmartCitySelector] Duplicate city detected: ${city.city} (${cityId})`);
                    return false;
                }
                seenIds.add(cityId);
                return true;
            })
            .map(city => ({
                ...city,
                status: 'enabled',
                id: city.searchKey || city.id
            }));

        console.log(`🔄 [SmartCitySelector] Replacing ${activatedCities.length} cities with ${citiesWithStatus.length} cities`);

        setActivatedCities(citiesWithStatus);
        onSelectionComplete(citiesWithStatus);

        const changeType = citiesWithStatus.length > activatedCities.length ? 'Added' :
            citiesWithStatus.length < activatedCities.length ? 'Removed' : 'Updated';
        const changeCount = Math.abs(citiesWithStatus.length - activatedCities.length);

        if (changeCount > 0) {
            enqueueSnackbar(`✅ ${changeType} ${changeCount} cities from map`, { variant: 'success' });
        }

        setActiveTab(0); // Switch back to manage cities tab
    }, [activatedCities, onSelectionComplete, enqueueSnackbar]);

    // Pagination
    const paginatedCities = useMemo(() => {
        const startIndex = page * rowsPerPage;
        return filteredCities.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredCities, page, rowsPerPage]);

    // Tab names based on zone category
    const tabName = zoneCategory === 'pickupZones' ? 'Pickup Cities' : 'Delivery Cities';

    // Render filters section
    const renderFilters = () => (
        <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder={`Search activated ${tabName.toLowerCase()}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ color: '#9ca3af', mr: 1 }} />,
                        sx: { fontSize: '12px' }
                    }}
                    InputLabelProps={{
                        sx: { fontSize: '12px' }
                    }}
                    sx={{
                        fontSize: '12px',
                        '& input::placeholder': {
                            fontSize: '12px',
                            opacity: 0.7
                        }
                    }}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                    <Select
                        value={countryFilter}
                        onChange={(e) => {
                            setCountryFilter(e.target.value);
                            setProvinceStateFilter(''); // Clear province when country changes
                        }}
                        label="Country"
                        sx={{ fontSize: '12px' }}
                    >
                        <MenuItem value="" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                        {['CA', 'US'].map(countryCode => (
                            <MenuItem key={countryCode} value={countryCode} sx={{ fontSize: '12px' }}>
                                {countryCode === 'CA' ? '🇨🇦 Canada' : '🇺🇸 United States'}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
                <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: '12px' }}>Province/State</InputLabel>
                    <Select
                        value={countryFilter ? provinceStateFilter : ''}
                        onChange={(e) => setProvinceStateFilter(e.target.value)}
                        label="Province/State"
                        disabled={!countryFilter}
                        sx={{
                            fontSize: '12px',
                            opacity: !countryFilter ? 0.6 : 1
                        }}
                    >
                        <MenuItem value="" sx={{ fontSize: '12px' }}>All Provinces/States</MenuItem>
                        {availableProvinces.map(province => (
                            <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                {province.name} - {province.code}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
                <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setAddCityDialogOpen(true)}
                    sx={{ fontSize: '12px', height: '40px' }}
                >
                    Add City
                </Button>
            </Grid>
        </Grid>
    );

    // Render bulk actions
    const renderBulkActions = () => {
        if (selectedCityIds.size === 0) return null;

        return (
            <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    {selectedCityIds.size} selected
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EnableIcon />}
                    onClick={() => handleBulkStatusChange('enabled')}
                    sx={{ fontSize: '11px' }}
                >
                    Enable
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DisableIcon />}
                    onClick={() => handleBulkStatusChange('disabled')}
                    sx={{ fontSize: '11px' }}
                >
                    Disable
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleBulkDelete}
                    sx={{ fontSize: '11px' }}
                >
                    Delete
                </Button>
            </Box>
        );
    };

    // Render activated cities table
    const renderActivatedCitiesTable = () => {
        const allSelected = filteredCities.length > 0 && selectedCityIds.size === filteredCities.length;
        const someSelected = selectedCityIds.size > 0 && selectedCityIds.size < filteredCities.length;

        return (
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    indeterminate={someSelected}
                                    checked={allSelected}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                    size="small"
                                />
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                <TableSortLabel
                                    active={sortBy === 'city'}
                                    direction={sortBy === 'city' ? sortDirection : 'asc'}
                                    onClick={() => handleSort('city')}
                                    sx={{ fontSize: '12px' }}
                                >
                                    City
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                <TableSortLabel
                                    active={sortBy === 'provinceState'}
                                    direction={sortBy === 'provinceState' ? sortDirection : 'asc'}
                                    onClick={() => handleSort('provinceState')}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Province/State
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                <TableSortLabel
                                    active={sortBy === 'country'}
                                    direction={sortBy === 'country' ? sortDirection : 'asc'}
                                    onClick={() => handleSort('country')}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Country
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Status
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedCities.map((city) => (
                            <TableRow key={city.id} hover>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={selectedCityIds.has(city.id)}
                                        onChange={(e) => handleCitySelect(city.id, e.target.checked)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {city.city}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {city.provinceState}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {city.country === 'CA' ? '🇨🇦 Canada' : city.country === 'US' ? '🇺🇸 United States' : city.country}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={city.status || 'enabled'}
                                        size="small"
                                        color={city.status === 'enabled' ? 'success' : 'default'}
                                        sx={{ fontSize: '11px' }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            setActionMenuAnchor(e.currentTarget);
                                            setActionMenuCity(city);
                                        }}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {paginatedCities.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                                        {searchTerm || countryFilter || provinceStateFilter
                                            ? 'No cities match your filters'
                                            : 'No cities activated yet. Click "Add City" to get started.'
                                        }
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={filteredCities.length}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[25, 50, 100, 500, 1000]}
                    sx={{
                        '& .MuiTablePagination-toolbar': { fontSize: '12px' },
                        '& .MuiTablePagination-selectLabel': { fontSize: '12px' },
                        '& .MuiTablePagination-displayedRows': { fontSize: '12px' }
                    }}
                />
            </TableContainer>
        );
    };

    // Render manage cities tab
    const renderManageCitiesTab = () => (
        <Box>
            {renderFilters()}
            {renderBulkActions()}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading cities...</Typography>
                </Box>
            ) : (
                renderActivatedCitiesTable()
            )}
        </Box>
    );

    // Render map view tab - Always mounted for real-time marker updates
    const renderMapViewTab = () => {
        return (
            <Box sx={{ display: activeTab === 1 ? 'block' : 'none' }}>
                <Suspense fallback={
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2, fontSize: '14px' }}>Loading Map Tools...</Typography>
                    </Box>
                }>
                    <MapCitySelector
                        selectedCities={activatedCities}
                        onSelectionComplete={handleMapSelectionComplete}
                        zoneCategory={zoneCategory}
                        embedded={true}
                        onMapAreaSave={onMapAreaSave}
                        onDone={() => setActiveTab(0)}
                        initialAreas={savedAreas.filter(a => a.zoneCategory === zoneCategory)}
                        carrierId={carrierId}
                    />
                </Suspense>
            </Box>
        );
    };

    // Main render
    const content = (
        <Box sx={{
            height: embedded ? 'auto' : '80vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
        }}>
            {/* Header */}
            <Box sx={{
                p: 3,
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Box>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                        {title}
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Manage activated cities for {zoneCategory === 'pickupZones' ? 'pickup' : 'delivery'} locations
                    </Typography>
                </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: '1px solid #e5e7eb' }}>
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    sx={{
                        '& .MuiTab-root': {
                            fontSize: '12px',
                            textTransform: 'none',
                            minHeight: 40
                        }
                    }}
                >
                    <Tab label={`Manage ${tabName}`} />
                    <Tab label="Map View" />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {activeTab === 0 && renderManageCitiesTab()}
                {activeTab === 1 && renderMapViewTab()}
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={() => setActionMenuAnchor(null)}
            >
                <MenuItemComponent onClick={() => handleCityStatusToggle(actionMenuCity)}>
                    {actionMenuCity?.status === 'enabled' ? <DisableIcon sx={{ mr: 1 }} /> : <EnableIcon sx={{ mr: 1 }} />}
                    <Typography sx={{ fontSize: '12px' }}>
                        {actionMenuCity?.status === 'enabled' ? 'Disable' : 'Enable'}
                    </Typography>
                </MenuItemComponent>
                <MenuItemComponent onClick={() => handleDeleteCity(actionMenuCity)} sx={{ color: '#ef4444' }}>
                    <DeleteIcon sx={{ mr: 1, color: '#ef4444' }} />
                    <Typography sx={{ fontSize: '12px' }}>Delete</Typography>
                </MenuItemComponent>
            </Menu>

            {/* Add City Dialog */}
            <AddCityDialog
                open={addCityDialogOpen}
                onClose={() => setAddCityDialogOpen(false)}
                onCityAdd={(newCities) => {
                    console.log('🏙️ [SmartCitySelector] Adding cities:', newCities.map(c => c.city));

                    const citiesWithStatus = newCities.map(city => ({
                        ...city,
                        status: 'enabled',
                        id: city.searchKey || city.id
                    }));

                    // DUPLICATE PREVENTION: Combine and remove duplicates
                    const allCities = [...activatedCities, ...citiesWithStatus];
                    const seenIds = new Set();
                    const deduplicatedCities = allCities.filter(city => {
                        const cityId = city.searchKey || city.id;
                        if (seenIds.has(cityId)) {
                            console.warn(`🚨 [SmartCitySelector] Duplicate city filtered: ${city.city} (${cityId})`);
                            return false;
                        }
                        seenIds.add(cityId);
                        return true;
                    });

                    console.log('🏙️ [SmartCitySelector] Updated cities count:', deduplicatedCities.length);

                    setActivatedCities(deduplicatedCities);
                    onSelectionComplete(deduplicatedCities);

                    // Clear search filters to ensure newly added cities are visible
                    setSearchTerm('');
                    setCountryFilter('');
                    setProvinceStateFilter('');

                    enqueueSnackbar(`✅ Added ${newCities.length} cities to ${zoneCategory === 'pickupZones' ? 'pickup' : 'delivery'} locations (map updated)`, { variant: 'success' });
                    setAddCityDialogOpen(false);
                }}
                zoneCategory={zoneCategory}
                existingCityIds={new Set(activatedCities.map(c => c.id))}
            />
        </Box>
    );

    if (embedded) {
        return content;
    }

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            sx={{ '& .MuiDialog-paper': { height: '90vh' } }}
        >
            {content}
        </Dialog>
    );
};

// Add City Dialog Component
const AddCityDialog = ({ open, onClose, onCityAdd, zoneCategory, existingCityIds }) => {
    const { searchCities, getCityByPostalCode } = useGeographicData();
    const { enqueueSnackbar } = useSnackbar();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedCities, setSelectedCities] = useState([]);

    // Enhanced search for cities including postal/zip codes
    const handleSearch = useCallback(async () => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        try {
            let results = [];

            // Check if search term looks like a postal/zip code (more specific patterns)
            const trimmedTerm = searchTerm.trim();
            const isCanadianPostal = /^[A-Za-z]\d[A-Za-z](\s?\d[A-Za-z]\d)?$/i.test(trimmedTerm); // K1A 0A6 or K1A
            const isUSZip = /^\d{5}(-?\d{4})?$/.test(trimmedTerm); // 12345 or 12345-6789
            const isPostalCode = isCanadianPostal || isUSZip;

            if (isPostalCode) {
                // Search by postal/zip code first
                console.log(`🔍 [AddCityDialog] Searching postal code: "${trimmedTerm}" (Canadian: ${isCanadianPostal}, US: ${isUSZip})`);
                const postalResult = await getCityByPostalCode(trimmedTerm);
                console.log(`🔍 [AddCityDialog] Postal code result:`, postalResult);
                if (postalResult) {
                    results = [postalResult];
                }
            }

            // Also search by city name (always do this for comprehensive results)
            const cityResults = await searchCities(searchTerm);

            // Combine results and remove duplicates
            const allResults = [...results, ...cityResults];
            const uniqueResults = allResults.filter((city, index, self) =>
                index === self.findIndex(c => (c.searchKey || c.id) === (city.searchKey || city.id))
            );

            // Filter out cities that are already activated
            const newCities = uniqueResults.filter(city =>
                !existingCityIds.has(city.searchKey || city.id)
            );

            setSearchResults(newCities);

            console.log(`🔍 [AddCityDialog] Search results for "${searchTerm}":`, {
                isPostalCode,
                totalResults: uniqueResults.length,
                availableResults: newCities.length,
                searchType: isPostalCode ? 'postal/zip + city' : 'city only'
            });

        } catch (error) {
            console.error('Search error:', error);
            enqueueSnackbar('Search failed', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [searchTerm, searchCities, getCityByPostalCode, existingCityIds, enqueueSnackbar]);

    // Auto-search when term changes
    useEffect(() => {
        const timer = setTimeout(handleSearch, 300);
        return () => clearTimeout(timer);
    }, [handleSearch]);

    const handleCitySelect = useCallback((city) => {
        setSelectedCities(prev => {
            const exists = prev.find(c => (c.searchKey || c.id) === (city.searchKey || city.id));
            if (exists) {
                return prev.filter(c => (c.searchKey || c.id) !== (city.searchKey || city.id));
            } else {
                return [...prev, city];
            }
        });
    }, []);

    // Handle select all / deselect all
    const handleSelectAll = useCallback(() => {
        const allSelected = selectedCities.length === searchResults.length;
        if (allSelected) {
            // Deselect all
            setSelectedCities([]);
        } else {
            // Select all
            setSelectedCities(searchResults);
        }
    }, [selectedCities.length, searchResults]);

    const handleAddSelectedCities = useCallback(() => {
        if (selectedCities.length === 0) {
            enqueueSnackbar('No cities selected', { variant: 'warning' });
            return;
        }

        onCityAdd(selectedCities);
        setSelectedCities([]);
        setSearchTerm('');
        setSearchResults([]);
    }, [selectedCities, onCityAdd, enqueueSnackbar]);

    const handleClose = useCallback(() => {
        setSelectedCities([]);
        setSearchTerm('');
        setSearchResults([]);
        onClose();
    }, [onClose]);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                Add Cities to {zoneCategory === 'pickupZones' ? 'Pickup' : 'Delivery'} Locations
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2 }}>
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
                        InputLabelProps={{
                            sx: { fontSize: '12px' }
                        }}
                        sx={{
                            fontSize: '12px',
                            '& input::placeholder': {
                                fontSize: '12px',
                                opacity: 0.7
                            }
                        }}
                    />
                </Box>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={20} />
                        <Typography sx={{ ml: 1, fontSize: '12px' }}>Searching...</Typography>
                    </Box>
                )}

                {searchResults.length > 0 && (
                    <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid #e5e7eb' }}>
                        <Table size="small">
                            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell padding="checkbox" />
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>City</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Province/State</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Country</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {searchResults.slice(0, 50).map((city) => {
                                    const isSelected = selectedCities.find(c => (c.searchKey || c.id) === (city.searchKey || city.id));
                                    return (
                                        <TableRow
                                            key={city.searchKey || city.id}
                                            hover
                                            onClick={() => handleCitySelect(city)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={!!isSelected}
                                                    onChange={(e) => {
                                                        e.stopPropagation(); // Prevent row click
                                                        handleCitySelect(city);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()} // Prevent row click
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{city.city}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>{city.provinceState}</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {city.country === 'CA' ? '🇨🇦 Canada' : city.country === 'US' ? '🇺🇸 United States' : city.country}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {selectedCities.length > 0 && (
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1 }}>
                            Selected Cities ({selectedCities.length}):
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {selectedCities.map(city => (
                                <Chip
                                    key={city.searchKey || city.id}
                                    label={`${city.city}, ${city.provinceState}`}
                                    size="small"
                                    onDelete={() => handleCitySelect(city)}
                                    sx={{ fontSize: '11px' }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} sx={{ fontSize: '12px' }}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleAddSelectedCities}
                    disabled={selectedCities.length === 0}
                    sx={{ fontSize: '12px' }}
                >
                    Add {selectedCities.length} Cities
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SmartCitySelector;
