/**
 * Smart City Selector Component
 * 
 * Advanced city selection with intelligent filters, bulk operations,
 * and scalable UI for handling thousands of cities
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import {
    Box, Paper, Typography, Button, Grid, Tabs, Tab,
    FormControl, InputLabel, Select, MenuItem, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TablePagination, Checkbox, Chip, IconButton, Collapse,
    Card, CardContent, CardHeader, List, ListItem, ListItemText,
    ListItemIcon, ListItemSecondaryAction, Divider, Switch,
    FormControlLabel, Autocomplete, Alert, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions,
    TableSortLabel
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
    SelectAll as SelectAllIcon,
    Map as MapIcon,
    Business as BusinessIcon,
    LocationCity as CityIcon,
    Public as PublicIcon,
    Timeline as TimelineIcon,
    LocalShipping as ShippingIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Check as CheckIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import useGeographicData from '../../../../hooks/useGeographicData';
import { useSnackbar } from 'notistack';
// Lazy load MapCitySelector to prevent any map initialization until needed
const MapCitySelector = lazy(() => import('./MapCitySelector'));

// Geographic Intelligence Smart Filters
const GEOGRAPHIC_FILTERS = [
    {
        key: 'majorCities',
        label: 'Major Cities by Region',
        description: 'Cities with population > 50,000',
        icon: <CityIcon />,
        requires: ['country', 'region']
    },
    {
        key: 'proximity',
        label: 'Proximity-Based Selection',
        description: 'Cities within X miles of a center location',
        icon: <MapIcon />,
        requires: ['centerCity', 'radius']
    },
    {
        key: 'corridors',
        label: 'Trade & Shipping Corridors',
        description: 'Cities along major transportation routes',
        icon: <TimelineIcon />,
        requires: ['corridor']
    },
    {
        key: 'borderCities',
        label: 'Border Crossing Cities',
        description: 'Cities at international border crossings',
        icon: <PublicIcon />,
        requires: ['borderType']
    },
    {
        key: 'freightHubs',
        label: 'Transportation Hubs',
        description: 'Cities with major airports, ports, rail terminals',
        icon: <ShippingIcon />,
        requires: ['country', 'hubType']
    },
    {
        key: 'capitals',
        label: 'Capital Cities',
        description: 'State/provincial/territorial capitals',
        icon: <BusinessIcon />,
        requires: ['country', 'capitalType']
    }
];

// Geographic Quick Selections with Zone Types
const QUICK_SELECTIONS = [
    // ===== PRIMARY GEOGRAPHIC ZONES =====
    {
        name: 'Domestic Canada (All CA)',
        description: 'All Canadian provinces and territories',
        type: 'domesticCountry',
        params: { country: 'CA' },
        icon: '🇨🇦',
        category: 'Geographic Zones'
    },
    {
        name: 'Domestic US (All US)',
        description: 'All US states and territories',
        type: 'domesticCountry',
        params: { country: 'US' },
        icon: '🇺🇸',
        category: 'Geographic Zones'
    },
    {
        name: 'Specific Provinces (CA)',
        description: 'Select individual Canadian provinces',
        type: 'specificProvinces',
        params: { country: 'CA' },
        icon: '🍁',
        category: 'Geographic Zones'
    },
    {
        name: 'Specific States (US)',
        description: 'Select individual US states',
        type: 'specificStates',
        params: { country: 'US' },
        icon: '⭐',
        category: 'Geographic Zones'
    },
    {
        name: 'Cross-Border (CA ↔ US)',
        description: 'Canada/US cross-border zones',
        type: 'crossBorder',
        params: { countries: ['CA', 'US'] },
        icon: '🌐',
        category: 'Geographic Zones'
    },

    // ===== SMART CITY SELECTIONS =====
    {
        name: 'Major Canadian Cities',
        description: 'Top 24 Canadian cities by population',
        type: 'majorCities',
        params: { country: 'CA', populationTier: 'major' },
        icon: '🇨🇦'
    },
    {
        name: 'Major US Cities',
        description: 'Top 40 US cities by population',
        type: 'majorCities',
        params: { country: 'US', populationTier: 'major' },
        icon: '🇺🇸'
    },
    {
        name: 'Great Lakes Corridor',
        description: 'Cities along the Great Lakes shipping corridor',
        type: 'corridors',
        params: { corridor: 'greatLakes' },
        icon: '🚢'
    },
    {
        name: 'Eastern Seaboard',
        description: 'Major cities along US East Coast trade route',
        type: 'corridors',
        params: { corridor: 'easternSeaboard' },
        icon: '🌊'
    },
    {
        name: 'Highway 401 Corridor',
        description: 'Ontario\'s main transportation corridor',
        type: 'corridors',
        params: { corridor: 'highway401' },
        icon: '🛣️'
    },
    {
        name: 'Interstate 5 Corridor',
        description: 'West Coast shipping route (CA, OR, WA)',
        type: 'corridors',
        params: { corridor: 'i5' },
        icon: '🌲'
    },
    {
        name: 'Border Crossing Cities',
        description: 'Major US-Canada border crossing points',
        type: 'borderCities',
        params: { borderType: 'US-CA' },
        icon: '🌉'
    },
    {
        name: 'Canadian Transportation Hubs',
        description: 'Major Canadian airports, ports & rail terminals',
        type: 'freightHubs',
        params: { country: 'CA', hubType: 'all' },
        icon: '🚛'
    },
    {
        name: 'US Transportation Hubs',
        description: 'Major US airports, ports & rail terminals',
        type: 'freightHubs',
        params: { country: 'US', hubType: 'all' },
        icon: '✈️'
    },
    {
        name: 'Canadian Capitals',
        description: 'Provincial and territorial capitals',
        type: 'capitals',
        params: { country: 'CA', capitalType: 'all' },
        icon: '🏛️'
    },
    {
        name: 'US State Capitals',
        description: 'All 50 US state capitals',
        type: 'capitals',
        params: { country: 'US', capitalType: 'state' },
        icon: '⭐'
    },
    {
        name: 'Cities Near Toronto',
        description: 'Cities within the Greater Toronto Area region',
        type: 'proximity',
        params: { centerCity: 'Toronto', radiusMiles: 100, country: 'CA' },
        icon: '🌆'
    }
];

const SmartCitySelector = ({
    isOpen,
    onClose,
    onSelectionComplete,
    zoneCategory = 'pickupZones',
    selectedCities = [],
    title = 'Smart City Selection',
    embedded = false, // New prop for embedded mode
    onMapAreaSave,
    savedAreas = [],
    carrierId
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const {
        searchCities,
        loadCitiesByCountry,
        loading: geoLoading,
        getMajorCitiesByRegion,
        getBorderCities,
        getFreightHubs,
        getCapitalCities,
        getCitiesByProximity,
        getCorridorCities
    } = useGeographicData();

    // UI State - Default to Search & Browse tab (now index 0)
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [showFilters, setShowFilters] = useState(false);

    // Data State - Refactored for "manage existing cities" approach
    const [activatedCities, setActivatedCities] = useState([]); // Cities already added to this zone
    const [filteredCities, setFilteredCities] = useState([]);
    const [selectedCityIds, setSelectedCityIds] = useState(new Set()); // For bulk delete/enable/disable
    const [countryFilter, setCountryFilter] = useState('');
    const [provinceStateFilter, setProvinceStateFilter] = useState('');
    const [addCityDialogOpen, setAddCityDialogOpen] = useState(false);
    const [updatingFromMap, setUpdatingFromMap] = useState(false);
    const [loadingSelection, setLoadingSelection] = useState(null);

    // Preview functionality
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState({ cities: [], selection: null });
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Store all selected cities data to preserve across searches (already declared above)

    // Search-specific state (searchTerm already declared above)
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const debounceTimeoutRef = useRef(null);

    // Helper function to get state/province code
    const getStateProvinceCode = useCallback((stateProvince) => {
        const stateCodeMapping = {
            'Ontario': 'ON',
            'Quebec': 'QC',
            'British Columbia': 'BC',
            'Alberta': 'AB',
            'Manitoba': 'MB',
            'Saskatchewan': 'SK',
            'Nova Scotia': 'NS',
            'New Brunswick': 'NB',
            'Newfoundland and Labrador': 'NL',
            'Prince Edward Island': 'PE',
            'Northwest Territories': 'NT',
            'Nunavut': 'NU',
            'Yukon': 'YT'
        };

        return stateCodeMapping[stateProvince] ||
            (stateProvince?.length > 2 ? stateProvince.substring(0, 2).toUpperCase() : stateProvince);
    }, []);

    // Helper function to get country flag
    const getCountryFlag = useCallback((country) => {
        const flagMapping = {
            'CA': '🇨🇦',
            'US': '🇺🇸',
            'MX': '🇲🇽'
        };
        return flagMapping[country] || '🌍';
    }, []);

    // Add sorting state
    const [orderBy, setOrderBy] = useState('');
    const [orderDirection, setOrderDirection] = useState('asc');

    const getSortingValue = useCallback((city, key) => {
        if (key === 'country') {
            // Normalize country full names for display sort but keep code fallback
            const countryName = city.countryName || (city.country === 'CA' ? 'Canada' : city.country === 'US' ? 'United States' : city.country || '');
            return (countryName || '').toString().toLowerCase();
        }
        if (key === 'provinceState') {
            const stateName = city.provinceStateName || city.provinceState || '';
            return stateName.toString().toLowerCase();
        }
        return '';
    }, []);

    const handleRequestSort = useCallback((property) => {
        setOrderBy((prev) => {
            const isSame = prev === property;
            setOrderDirection((oldDir) => (isSame && oldDir === 'asc') ? 'desc' : 'asc');
            return property;
        });
    }, []);

    // Apply sorting to filteredCities before pagination
    const sortedCities = useMemo(() => {
        if (!orderBy) return filteredCities;
        const dir = orderDirection === 'desc' ? -1 : 1;
        return [...filteredCities].sort((a, b) => {
            const av = getSortingValue(a, orderBy);
            const bv = getSortingValue(b, orderBy);
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });
    }, [filteredCities, orderBy, orderDirection, getSortingValue]);

    const paginatedCities = useMemo(() => {
        return sortedCities.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    }, [sortedCities, page, rowsPerPage]);

    // Track if this is initial load to avoid false map update notifications
    const isInitialLoadRef = useRef(true);

    const loadInitialCities = useCallback(async () => {
        setLoading(true);
        try {
            // If there are already selected cities, show them
            if (selectedCities && selectedCities.length > 0) {
                // Only detect map updates after initial load is complete
                const previousCount = selectedCitiesData.length;
                const newCount = selectedCities.length;
                const isMapUpdate = !isInitialLoadRef.current && newCount > previousCount + 5;

                if (isMapUpdate) {
                    setUpdatingFromMap(true);

                    // Show map update notification
                    enqueueSnackbar(`🗺️ Processing ${newCount - previousCount} cities from map selection...`, {
                        variant: 'info',
                        autoHideDuration: 3000
                    });

                    // Brief loading state for visual feedback
                    setTimeout(() => {
                        setUpdatingFromMap(false);
                    }, 1500);
                }

                setAllCities(selectedCities);
                setFilteredCities(selectedCities);
                setSelectedCitiesData(selectedCities);

                // Don't auto-check cities - they're just loaded for display
                // selectedCityIds remains empty until user explicitly checks boxes
                setSelectedCityIds(new Set());

                console.log(`🏙️ [SmartCitySelector] Loaded ${selectedCities.length} cities for ${zoneCategory}`);
            } else {
                // If no cities configured yet, start with empty state
                setAllCities([]);
                setFilteredCities([]);
                setSelectedCityIds(new Set());
                setSelectedCitiesData([]);
                console.log(`📋 [SmartCitySelector] No cities configured yet for ${zoneCategory}`);
            }

            // Mark initial load as complete
            isInitialLoadRef.current = false;
        } catch (error) {
            console.error('❌ [SmartCitySelector] Error loading cities:', error);
            setAllCities([]);
            setFilteredCities([]);
            setSelectedCitiesData([]);
        } finally {
            setLoading(false);
        }
    }, [selectedCities, selectedCitiesData.length, zoneCategory, enqueueSnackbar]);

    // Load initial cities when dialog opens or selectedCities prop changes
    useEffect(() => {
        if (isOpen) {
            loadInitialCities();
        }
    }, [isOpen, selectedCities]);

    // Sync internal state with prop changes
    useEffect(() => {
        if (selectedCities && selectedCities.length > 0) {
            setSelectedCitiesData(selectedCities);
            // Don't auto-check all cities - user must explicitly select them
            setSelectedCityIds(new Set());

            // If we have cities but no filtered cities, show the selected ones
            if (filteredCities.length === 0) {
                setFilteredCities(selectedCities);
                setAllCities(selectedCities);
            }
        } else {
            setSelectedCitiesData([]);
            setSelectedCityIds(new Set());
        }
    }, [selectedCities, filteredCities.length]);

    // Debounced search for autocomplete suggestions
    const debouncedSearchSuggestions = useCallback((searchValue) => {
        // Clear any existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // Set new timeout
        debounceTimeoutRef.current = setTimeout(async () => {
            if (!searchValue || searchValue.length < 2) {
                setSearchSuggestions([]);
                setLoadingSuggestions(false);
                return;
            }

            setLoadingSuggestions(true);
            try {
                const suggestions = await searchCities(searchValue, null);
                // Limit to top 10 suggestions for performance
                setSearchSuggestions(suggestions.slice(0, 10));
            } catch (error) {
                // // console.error('Search suggestions error:', error);
                setSearchSuggestions([]);
            } finally {
                setLoadingSuggestions(false);
            }
        }, 300); // 300ms debounce
    }, [searchCities]);

    // Handle search input changes
    const handleSearchInputChange = useCallback((event, newValue) => {
        setSearchTerm(newValue);
        if (newValue) {
            setLoadingSuggestions(true);
            debouncedSearchSuggestions(newValue);
        } else {
            setSearchSuggestions([]);
            setLoadingSuggestions(false);
        }
    }, [debouncedSearchSuggestions]);

    // Handle autocomplete selection
    const handleAutocompleteSelect = useCallback((event, selectedCity) => {
        if (selectedCity) {
            // Add the city to the table for viewing (but don't auto-select it)
            const cityKey = selectedCity.searchKey || selectedCity.id;

            // Clear search after selection
            setSearchTerm('');
            setSearchSuggestions([]);

            // Add to filtered cities if not already there (for viewing)
            const exists = filteredCities.find(city => (city.searchKey || city.id) === cityKey);
            if (!exists) {
                setFilteredCities(prev => [...prev, selectedCity]);
            }

            // Add to all cities if not already there
            const existsInAll = allCities.find(city => (city.searchKey || city.id) === cityKey);
            if (!existsInAll) {
                setAllCities(prev => [...prev, selectedCity]);
            }

            // AUTO-SAVE the city immediately when selected from autocomplete
            // Check if city is not already selected
            if (!selectedCityIds.has(cityKey)) {
                const newSelectedCityIds = new Set([...selectedCityIds, cityKey]);
                setSelectedCityIds(newSelectedCityIds);

                // Add to selected cities data
                const updatedSelectedCities = [...selectedCitiesData, selectedCity];
                setSelectedCitiesData(updatedSelectedCities);

                // In embedded mode, immediately save to database
                if (embedded) {
                    // console.log('💾 AUTOCOMPLETE - Auto-saving city:', selectedCity.city);
                    onSelectionComplete(updatedSelectedCities);
                }
            }
        }
    }, [filteredCities, allCities]);

    const applySmartFilters = useCallback((cities) => {
        let filtered = [...cities];

        // Apply each active smart filter
        Object.entries(smartFilters).forEach(([filterKey, filterConfig]) => {
            if (!filterConfig.active) return;

            switch (filterKey) {
                case 'majorCities':
                    if (filterConfig.country) {
                        filtered = filtered.filter(city =>
                            city.country === filterConfig.country &&
                            (filterConfig.region ? city.provinceState === filterConfig.region : true)
                        );
                    }
                    break;

                case 'populationTier':
                    // This would require population data in the database
                    // For now, we'll use a simple heuristic based on major known cities
                    if (filterConfig.tier === 'major') {
                        const majorCities = ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton',
                            'Quebec City', 'Winnipeg', 'Hamilton', 'New York', 'Los Angeles',
                            'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio',
                            'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville'];
                        filtered = filtered.filter(city => majorCities.includes(city.city));
                    }
                    break;

                default:
                    break;
            }
        });

        return filtered;
    }, [smartFilters]);

    // Apply filters to cities (removed live search to prevent performance issues)
    useEffect(() => {
        // Simply apply smart filters to cached cities
        let filtered = [...allCities];

        // Apply smart filters
        filtered = applySmartFilters(filtered);

        setFilteredCities(filtered);
        setPage(0); // Reset to first page
    }, [allCities, applySmartFilters]);


    const handleGeographicFilter = async (filter) => {

        // For now, show a simple implementation
        // In a full implementation, you'd show parameter dialogs
        switch (filter.key) {
            case 'majorCities':
                // For demo, load all major Canadian cities
                await handleQuickSelection({
                    name: 'Major Canadian Cities (Demo)',
                    type: 'majorCities',
                    params: { country: 'CA', populationTier: 'major' }
                });
                break;

            case 'corridors':
                // For demo, load Great Lakes corridor
                await handleQuickSelection({
                    name: 'Great Lakes Corridor (Demo)',
                    type: 'corridors',
                    params: { corridor: 'greatLakes' }
                });
                break;

            case 'borderCities':
                await handleQuickSelection({
                    name: 'Border Cities (Demo)',
                    type: 'borderCities',
                    params: { borderType: 'US-CA' }
                });
                break;

            case 'freightHubs':
                // For demo, load Canadian freight hubs
                await handleQuickSelection({
                    name: 'Canadian Transportation Hubs (Demo)',
                    type: 'freightHubs',
                    params: { country: 'CA', hubType: 'all' }
                });
                break;

            case 'capitals':
                // For demo, load Canadian capitals
                await handleQuickSelection({
                    name: 'Canadian Capitals (Demo)',
                    type: 'capitals',
                    params: { country: 'CA', capitalType: 'all' }
                });
                break;

            case 'proximity':
                // For demo, cities near Toronto
                await handleQuickSelection({
                    name: 'Cities Near Toronto (Demo)',
                    type: 'proximity',
                    params: { centerCity: 'Toronto', radiusMiles: 100, country: 'CA' }
                });
                break;

            default:
                break;
        }
    };

    // Handle bulk delete of all selected cities
    const handleBulkDelete = () => {
        if (selectedCityIds.size === 0) return;

        const cityCount = selectedCityIds.size;

        // Clear all selections
        setSelectedCityIds(new Set());
        setSelectedCitiesData([]);

        // In embedded mode, notify parent of the cleared selection
        if (embedded) {
            onSelectionComplete([]);
        }

        // Show success message
        enqueueSnackbar(`🗑️ Cleared ${cityCount} selected cities`, {
            variant: 'success'
        });
    };

    // Handle preview of Quick Selection cities
    const handlePreviewSelection = async (quickSelection) => {
        // console.log('👀 PREVIEW - Starting preview for:', quickSelection.name);
        setLoadingPreview(true);
        try {

            let cities = [];

            switch (quickSelection.type) {
                // ===== GEOGRAPHIC ZONE TYPES =====
                case 'domesticCountry':
                    cities = await loadCitiesByCountry(quickSelection.params.country);
                    break;

                case 'specificProvinces':
                    cities = await loadCitiesByCountry('CA');
                    break;

                case 'specificStates':
                    cities = await loadCitiesByCountry('US');
                    break;

                case 'crossBorder':
                    const caCities = await loadCitiesByCountry('CA');
                    const usCities = await loadCitiesByCountry('US');
                    cities = [...caCities, ...usCities];
                    break;

                // ===== SMART CITY SELECTIONS =====
                case 'majorCities':
                    cities = await getMajorCitiesByRegion(
                        quickSelection.params.country,
                        quickSelection.params.region,
                        quickSelection.params.populationTier
                    );
                    break;

                case 'borderCities':
                    cities = await getBorderCities(quickSelection.params.borderType);
                    break;

                case 'freightHubs':
                    cities = await getFreightHubs(
                        quickSelection.params.country,
                        quickSelection.params.hubType
                    );
                    break;

                case 'capitals':
                    cities = await getCapitalCities(
                        quickSelection.params.country,
                        quickSelection.params.capitalType
                    );
                    break;

                case 'proximity':
                    cities = await getCitiesByProximity(
                        quickSelection.params.centerCity,
                        quickSelection.params.radiusMiles,
                        quickSelection.params.country
                    );
                    break;

                case 'corridors':
                    cities = await getCorridorCities(quickSelection.params.corridor);
                    break;

                default:
                    // // console.warn('Unknown quick selection type:', quickSelection.type);
                    break;
            }

            // console.log('👀 PREVIEW - Loaded', cities.length, 'cities for preview');

            setPreviewData({ cities, selection: quickSelection });
            setPreviewOpen(true);

        } catch (error) {
            // console.error('❌ PREVIEW ERROR:', error);
            enqueueSnackbar('Failed to load city preview', { variant: 'error' });
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleQuickSelection = async (quickSelection) => {
        // console.log('➕ ADD - Starting add for:', quickSelection.name);
        setLoadingSelection(quickSelection.name); // Set specific loading state
        try {

            let cities = [];

            switch (quickSelection.type) {
                // ===== GEOGRAPHIC ZONE TYPES =====
                case 'domesticCountry':
                    // Load all cities from the specified country
                    cities = await loadCitiesByCountry(quickSelection.params.country);
                    break;

                case 'specificProvinces':
                    // For now, show all Canadian cities - user will refine selection
                    // // console.log('🍁 Loading Canadian cities for province selection');
                    cities = await loadCitiesByCountry('CA');
                    // // console.log('✅ Loaded', cities.length, 'Canadian cities');
                    break;

                case 'specificStates':
                    // For now, show all US cities - user will refine selection  
                    // // console.log('⭐ Loading US cities for state selection');
                    cities = await loadCitiesByCountry('US');
                    // // console.log('✅ Loaded', cities.length, 'US cities');
                    break;

                case 'crossBorder':
                    // Load cities from both countries
                    // // console.log('🌐 Loading cross-border cities');
                    const caCities = await loadCitiesByCountry('CA');
                    const usCities = await loadCitiesByCountry('US');
                    cities = [...caCities, ...usCities];
                    // // console.log('✅ Loaded', cities.length, 'cross-border cities (CA:', caCities.length, 'US:', usCities.length, ')');
                    break;

                // ===== SMART CITY SELECTIONS =====
                case 'majorCities':
                    // // console.log('🏙️ Loading major cities with params:', quickSelection.params);
                    cities = await getMajorCitiesByRegion(
                        quickSelection.params.country,
                        quickSelection.params.region,
                        quickSelection.params.populationTier
                    );
                    // // console.log('🏙️ getMajorCitiesByRegion returned:', cities.length, 'cities');
                    break;

                case 'borderCities':
                    cities = await getBorderCities(quickSelection.params.borderType);
                    break;

                case 'freightHubs':
                    cities = await getFreightHubs(
                        quickSelection.params.country,
                        quickSelection.params.hubType
                    );
                    break;

                case 'capitals':
                    cities = await getCapitalCities(
                        quickSelection.params.country,
                        quickSelection.params.capitalType
                    );
                    break;

                case 'proximity':
                    cities = await getCitiesByProximity(
                        quickSelection.params.centerCity,
                        quickSelection.params.radiusMiles,
                        quickSelection.params.country
                    );
                    break;

                case 'corridors':
                    cities = await getCorridorCities(quickSelection.params.corridor);
                    break;

                default:
                    // // console.warn('Unknown quick selection type:', quickSelection.type);
                    break;
            }

            // Add cities to selection (don't replace existing ones)
            if (cities && cities.length > 0) {
                // // console.log('✅ Quick selection loaded:', cities.length, 'cities');

                // Add new cities to existing filtered cities (avoiding duplicates)
                const existingCityKeys = new Set(filteredCities.map(city => city.searchKey || city.id));
                const newCities = cities.filter(city => !existingCityKeys.has(city.searchKey || city.id));

                if (newCities.length > 0) {
                    // Update filtered cities with new cities
                    const updatedFilteredCities = [...filteredCities, ...newCities];
                    setFilteredCities(updatedFilteredCities);

                    // Update all cities if needed
                    const existingAllCityKeys = new Set(allCities.map(city => city.searchKey || city.id));
                    const newCitiesForAll = cities.filter(city => !existingAllCityKeys.has(city.searchKey || city.id));
                    if (newCitiesForAll.length > 0) {
                        setAllCities(prev => [...prev, ...newCitiesForAll]);
                    }

                    // Select all the new cities
                    const newCityKeys = newCities.map(city => city.searchKey || city.id);
                    setSelectedCityIds(prev => {
                        const newSet = new Set(prev);
                        newCityKeys.forEach(key => newSet.add(key));
                        return newSet;
                    });

                    // Update selected cities data
                    const updatedSelectedCities = [...selectedCitiesData, ...newCities];
                    setSelectedCitiesData(updatedSelectedCities);

                    // In embedded mode, notify parent of the updated selection
                    if (embedded) {
                        // console.log('➕ ADD - Notifying parent with', updatedSelectedCities.length, 'total cities');
                        onSelectionComplete(updatedSelectedCities);
                    }

                    // Navigate back to cities tab with success message
                    setActiveTab(0); // Go back to cities tab
                    setPage(0); // Reset to first page

                    // Show toast notification
                    enqueueSnackbar(`✅ Added ${newCities.length} cities from "${quickSelection.name}"`, {
                        variant: 'success'
                    });

                    // // console.log(`✅ Added ${newCities.length} new cities from "${quickSelection.name}"`);
                } else {
                    // // console.log('ℹ️ All cities from this selection were already selected');
                    // Show info message for no new cities
                    enqueueSnackbar(`ℹ️ All cities from "${quickSelection.name}" were already selected`, {
                        variant: 'info'
                    });
                    // Still navigate back to cities tab
                    setActiveTab(0);
                }
            } else {
                // // console.warn('⚠️ Quick selection returned no cities for:', quickSelection.name);
            }

        } catch (error) {
            // // console.error('❌ Error applying quick selection:', error);
            // // console.error('Quick selection that failed:', quickSelection);
        } finally {
            setLoadingSelection(null); // Clear loading state
        }
    };

    const handleCitySelection = (city, selected) => {
        const cityKey = city.searchKey || city.id;

        // Only handle DELETION (unchecking) - cities are auto-saved when selected from autocomplete
        if (!selected) {
            // console.log('🗑️ DELETING - Removing city:', city.city);

            // Remove from selected IDs
            setSelectedCityIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(cityKey);
                return newSet;
            });

            // Remove from selected cities data
            setSelectedCitiesData(prev => {
                const newSelectedCities = prev.filter(c => (c.searchKey || c.id) !== cityKey);

                // In embedded mode, immediately save the deletion
                if (embedded) {
                    // console.log('🗑️ DELETING - Saving updated list:', newSelectedCities.length);
                    onSelectionComplete(newSelectedCities);
                }

                return newSelectedCities;
            });
        }
        // If selected=true, ignore it - cities are auto-saved from autocomplete selection
    };

    const handleSelectAll = () => {
        const currentPageCities = filteredCities.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
        const allSelected = currentPageCities.every(city => selectedCityIds.has(city.searchKey || city.id));

        setSelectedCityIds(prev => {
            const newSet = new Set(prev);
            currentPageCities.forEach(city => {
                const cityKey = city.searchKey || city.id;
                if (allSelected) {
                    newSet.delete(cityKey);
                } else {
                    newSet.add(cityKey);
                }
            });
            return newSet;
        });
    };

    const handleComplete = () => {
        const selectedCitiesData = allCities.filter(city =>
            selectedCityIds.has(city.searchKey || city.id)
        );
        onSelectionComplete(selectedCitiesData);
        onClose();
    };

    const tabs = [
        {
            label: zoneCategory === 'pickupZones' ? 'Pickup Cities' : 'Delivery Cities',
            icon: <SearchIcon />
        },
        { label: 'Map View', icon: <MapIcon /> }
    ];

    // Render functions for embedded mode
    const renderSearchTab = () => (
        <Box>

            {/* Search Controls */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Autocomplete
                    freeSolo
                    options={searchSuggestions}
                    value={null}
                    inputValue={searchTerm}
                    onInputChange={handleSearchInputChange}
                    onChange={handleAutocompleteSelect}
                    loading={loadingSuggestions}
                    getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        const stateCode = getStateProvinceCode(option.provinceStateName || option.provinceState);
                        return `${option.city}, ${stateCode}, ${option.country}`;
                    }}
                    renderOption={(props, option) => {
                        const stateCode = getStateProvinceCode(option.provinceStateName || option.provinceState);
                        const countryFlag = getCountryFlag(option.country);
                        return (
                            <Box component="li" {...props} sx={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ fontSize: '16px' }}>{countryFlag}</Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                        {option.city}, {stateCode}, {option.country}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="Search and add cities..."
                            size="small"
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: <SearchIcon sx={{ mr: 1, color: '#6b7280' }} />,
                                endAdornment: (
                                    <>
                                        {loadingSuggestions ? <CircularProgress size={16} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                ),
                            }}
                        />
                    )}
                    sx={{ flex: 1 }}
                />

                {/* Bulk Actions */}
                {selectedCityIds.size > 0 && (
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={handleBulkDelete}
                        startIcon={<ClearIcon />}
                        sx={{
                            fontSize: '11px',
                            textTransform: 'none',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Clear All ({selectedCityIds.size})
                    </Button>
                )}
            </Box>

            {/* Data Table */}
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox" sx={{ width: 50 }}>
                                <Checkbox
                                    size="small"
                                    indeterminate={paginatedCities.some(city => selectedCityIds.has(city.searchKey || city.id)) &&
                                        !paginatedCities.every(city => selectedCityIds.has(city.searchKey || city.id))}
                                    checked={paginatedCities.length > 0 &&
                                        paginatedCities.every(city => selectedCityIds.has(city.searchKey || city.id))}
                                    onChange={handleSelectAll}
                                />
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>City</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                <TableSortLabel
                                    active={orderBy === 'provinceState'}
                                    direction={orderBy === 'provinceState' ? orderDirection : 'asc'}
                                    onClick={() => handleRequestSort('provinceState')}
                                >
                                    Province/State
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                <TableSortLabel
                                    active={orderBy === 'country'}
                                    direction={orderBy === 'country' ? orderDirection : 'asc'}
                                    onClick={() => handleRequestSort('country')}
                                >
                                    Country
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Postal Code</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedCities.map((city) => {
                            const isSelected = selectedCityIds.has(city.searchKey || city.id);
                            return (
                                <TableRow
                                    key={city.searchKey || city.id}
                                    hover
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            size="small"
                                            checked={isSelected}
                                            onChange={(e) => handleCitySelection(city, e.target.checked)}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ fontSize: '14px' }}>{getCountryFlag(city.country)}</Box>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {city.city}, {getStateProvinceCode(city.provinceStateName || city.provinceState)}, {city.country}
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    {city.postalCode}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {city.provinceStateName || city.provinceState}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {city.country === 'CA' ? 'Canada' : city.country === 'US' ? 'United States' : city.country}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{city.postalCode}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {filteredCities.length > rowsPerPage && (
                <TablePagination
                    component="div"
                    count={filteredCities.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    sx={{ borderTop: '1px solid #e5e7eb' }}
                />
            )}
        </Box>
    );

    // Removed Quick Selections tab - using Map View instead
    const renderQuickSelectionsTab = () => (
        <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                Quick Selections have been moved to the Map View tab for better visual selection.
            </Typography>
        </Box>
    );

    // Removed Geographic Filters tab - using Map View instead

    // Render Map View tab
    const handleMapSelectionComplete = useCallback((incomingCities) => {
        // Merge with current local selections for immediate in-tab consistency
        const byKey = new Map();
        [...selectedCitiesData, ...incomingCities].forEach((c) => {
            const key = c.searchKey || c.id;
            if (!key) return;
            if (!byKey.has(key)) byKey.set(key, c);
        });
        const merged = Array.from(byKey.values());

        setSelectedCitiesData(merged);
        setSelectedCityIds(new Set(merged.map(c => c.searchKey || c.id)));
        setAllCities(merged);
        setFilteredCities(merged);

        if (embedded) {
            onSelectionComplete(merged);
        }
    }, [embedded, onSelectionComplete, selectedCitiesData]);

    // Remove renderMapViewTab function since we're inlining it

    // For embedded mode, render without Dialog wrapper
    if (embedded) {
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px' }}>
                                {title}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                                Advanced city selection with smart filters and bulk operations
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                                label={`${selectedCityIds.size} cities selected`}
                                color="primary"
                                size="small"
                                sx={{ fontSize: '11px' }}
                            />
                            {updatingFromMap && (
                                <Chip
                                    label="🗺️ Updating from map"
                                    color="secondary"
                                    size="small"
                                    icon={<CircularProgress size={12} />}
                                    sx={{ fontSize: '10px' }}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>

                {/* Tabs */}
                <Box sx={{ borderBottom: '1px solid #e5e7eb' }}>
                    <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ minHeight: 40 }}>
                        {tabs.map((tab, index) => (
                            <Tab
                                key={index}
                                label={tab.label}
                                icon={tab.icon}
                                iconPosition="start"
                                sx={{
                                    fontSize: '12px',
                                    minHeight: 40,
                                    textTransform: 'none',
                                    '& .MuiTab-iconWrapper': { mr: 1 }
                                }}
                            />
                        ))}
                    </Tabs>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 3, position: 'relative' }}>
                    {activeTab === 0 && renderSearchTab()}
                    {activeTab === 1 && (
                        <Suspense fallback={
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <CircularProgress />
                                <Typography sx={{ ml: 2, fontSize: '14px' }}>Loading Map Tools...</Typography>
                            </Box>
                        }>
                            <MapCitySelector
                                selectedCities={selectedCities}
                                onSelectionComplete={handleMapSelectionComplete}
                                zoneCategory={zoneCategory}
                                embedded={true}
                                onMapAreaSave={onMapAreaSave}
                                onDone={() => setActiveTab(0)}
                                initialAreas={savedAreas.filter(a => a.zoneCategory === zoneCategory)}
                                carrierId={carrierId}
                            />
                        </Suspense>
                    )}

                    {/* Map Update Loading Overlay */}
                    {updatingFromMap && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                bgcolor: 'rgba(255, 255, 255, 0.8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000,
                                backdropFilter: 'blur(2px)'
                            }}
                        >
                            <Card sx={{ p: 3, textAlign: 'center', boxShadow: 3 }}>
                                <CircularProgress sx={{ mb: 2 }} />
                                <Typography sx={{ fontSize: '16px', fontWeight: 500, color: '#374151', mb: 1 }}>
                                    🗺️ Processing Map Selection
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Adding cities to {zoneCategory === 'pickupZones' ? 'pickup' : 'delivery'} locations...
                                </Typography>
                            </Card>
                        </Box>
                    )}
                </Box>
            </Box>
        );
    }

    // Original Dialog mode for non-embedded use
    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{ sx: { height: '90vh' } }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
                            {title}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                            Advanced city selection with smart filters and bulk operations
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip
                            label={`${selectedCityIds.size} cities selected`}
                            color="primary"
                            size="small"
                            sx={{ fontSize: '11px' }}
                        />
                        <Button
                            variant="outlined"
                            onClick={onClose}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleComplete}
                            disabled={selectedCityIds.size === 0}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Add {selectedCityIds.size} Cities
                        </Button>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={activeTab}
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        sx={{
                            px: 3,
                            '& .MuiTab-root': {
                                fontSize: '12px',
                                textTransform: 'none',
                                minHeight: 48
                            }
                        }}
                    >
                        {tabs.map((tab, index) => (
                            <Tab
                                key={index}
                                label={tab.label}
                                icon={tab.icon}
                                iconPosition="start"
                            />
                        ))}
                    </Tabs>
                </Box>

                <Box sx={{ p: 3, height: 'calc(90vh - 200px)', overflow: 'auto' }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            {/* Search & Browse Tab */}
                            {activeTab === 0 && (
                                <Box>

                                    {/* Search Controls */}
                                    <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <Autocomplete
                                            freeSolo
                                            options={searchSuggestions}
                                            value={null}
                                            inputValue={searchTerm}
                                            onInputChange={handleSearchInputChange}
                                            onChange={handleAutocompleteSelect}
                                            loading={loadingSuggestions}
                                            getOptionLabel={(option) => {
                                                if (typeof option === 'string') return option;
                                                // Enhanced format: "Toronto, ON, CA"
                                                const stateCode = getStateProvinceCode(option.provinceStateName || option.provinceState);
                                                return `${option.city}, ${stateCode}, ${option.country}`;
                                            }}
                                            renderOption={(props, option) => {
                                                const stateCode = getStateProvinceCode(option.provinceStateName || option.provinceState);
                                                const countryFlag = getCountryFlag(option.country);

                                                return (
                                                    <Box component="li" {...props} sx={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box sx={{ fontSize: '16px' }}>{countryFlag}</Box>
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                                                {option.city}, {stateCode}, {option.country}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    placeholder="Search and add cities..."
                                                    size="small"
                                                    InputProps={{
                                                        ...params.InputProps,
                                                        startAdornment: <SearchIcon sx={{ mr: 1, color: '#6b7280' }} />,
                                                        endAdornment: (
                                                            <>
                                                                {loadingSuggestions ? <CircularProgress size={16} /> : null}
                                                                {params.InputProps.endAdornment}
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            )}
                                            sx={{ flex: 1 }}
                                        />
                                        <Button
                                            variant="outlined"
                                            startIcon={<SelectAllIcon />}
                                            onClick={handleSelectAll}
                                            size="small"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Toggle Page
                                        </Button>
                                    </Box>

                                    {/* Cities Table */}
                                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                    <TableCell padding="checkbox">
                                                        <Checkbox size="small" />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>City</TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'provinceState'}
                                                            direction={orderBy === 'provinceState' ? orderDirection : 'asc'}
                                                            onClick={() => handleRequestSort('provinceState')}
                                                        >
                                                            Province/State
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'country'}
                                                            direction={orderBy === 'country' ? orderDirection : 'asc'}
                                                            onClick={() => handleRequestSort('country')}
                                                        >
                                                            Country
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {paginatedCities.map((city) => {
                                                    const isSelected = selectedCityIds.has(city.searchKey || city.id);
                                                    return (
                                                        <TableRow
                                                            key={city.searchKey || city.id}
                                                            sx={{
                                                                '&:hover': { bgcolor: '#f8fafc' },
                                                                bgcolor: isSelected ? '#f0f9ff' : 'inherit'
                                                            }}
                                                        >
                                                            <TableCell padding="checkbox">
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={isSelected}
                                                                    onChange={(e) => handleCitySelection(city, e.target.checked)}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Box sx={{ fontSize: '14px' }}>{getCountryFlag(city.country)}</Box>
                                                                    <Box>
                                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                            {city.city}, {getStateProvinceCode(city.provinceStateName || city.provinceState)}, {city.country}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                            {city.postalCode}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                {city.provinceStateName || city.provinceState}
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                {city.country === 'CA' ? 'Canada' : city.country === 'US' ? 'United States' : city.country}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Chip
                                                                    label="Available"
                                                                    size="small"
                                                                    color="success"
                                                                    variant="outlined"
                                                                    sx={{ fontSize: '10px', height: 20 }}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    {/* Pagination */}
                                    <TablePagination
                                        component="div"
                                        count={filteredCities.length}
                                        page={page}
                                        onPageChange={(e, newPage) => setPage(newPage)}
                                        rowsPerPage={rowsPerPage}
                                        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
                                        rowsPerPageOptions={[25, 50, 100]}
                                        sx={{ fontSize: '12px' }}
                                    />
                                </Box>
                            )}

                            {/* Quick Selections Tab */}
                            {activeTab === 1 && (
                                <Box>
                                    {/* Geographic Zones Section */}
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px', color: '#374151', display: 'flex', alignItems: 'center' }}>
                                        🗺️ Geographic Zones
                                        <Chip
                                            label="Primary Options"
                                            size="small"
                                            sx={{ ml: 2, bgcolor: '#7c3aed', color: 'white', fontSize: '10px' }}
                                        />
                                    </Typography>
                                    <Grid container spacing={2} sx={{ mb: 4 }}>
                                        {QUICK_SELECTIONS.filter(s => s.category === 'Geographic Zones').map((selection, index) => (
                                            <Grid item xs={12} sm={6} md={4} key={`geo-${index}`}>
                                                <Card
                                                    sx={{
                                                        cursor: 'pointer',
                                                        border: '2px solid #7c3aed',
                                                        borderRadius: 2,
                                                        bgcolor: '#faf5ff',
                                                        transition: 'all 0.2s ease',
                                                        '&:hover': {
                                                            borderColor: '#6d28d9',
                                                            boxShadow: '0 8px 25px rgba(124,58,237,0.15)',
                                                            transform: 'translateY(-3px)',
                                                            bgcolor: '#f3e8ff'
                                                        }
                                                    }}
                                                    onClick={() => handleQuickSelection(selection)}
                                                >
                                                    <CardContent sx={{ p: 2.5 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                                            {loadingSelection === selection.name ? (
                                                                <CircularProgress size={20} sx={{ color: '#6d28d9', mr: 1.5 }} />
                                                            ) : (
                                                                <Typography sx={{ fontSize: '28px', mr: 1.5 }}>
                                                                    {selection.icon}
                                                                </Typography>
                                                            )}
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#6d28d9' }}>
                                                                {selection.name}
                                                            </Typography>
                                                        </Box>
                                                        <Typography sx={{ fontSize: '12px', color: '#7c2d92', lineHeight: 1.4 }}>
                                                            {loadingSelection === selection.name ? 'Loading cities...' : selection.description}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>

                                    {/* Smart Selections Section */}
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px', color: '#374151', display: 'flex', alignItems: 'center' }}>
                                        🧠 Smart Selections
                                        <Chip
                                            label="Advanced Options"
                                            size="small"
                                            sx={{ ml: 2, bgcolor: '#3b82f6', color: 'white', fontSize: '10px' }}
                                        />
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {QUICK_SELECTIONS.filter(s => s.category === 'Smart Selections' || !s.category).map((selection, index) => (
                                            <Grid item xs={12} sm={6} md={4} key={`smart-${index}`}>
                                                <Card
                                                    sx={{
                                                        cursor: 'pointer',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: 2,
                                                        transition: 'all 0.2s ease',
                                                        '&:hover': {
                                                            borderColor: '#3b82f6',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                            transform: 'translateY(-2px)'
                                                        }
                                                    }}
                                                    onClick={() => handleQuickSelection(selection)}
                                                >
                                                    <CardContent sx={{ p: 2.5 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                                            {loadingSelection === selection.name ? (
                                                                <CircularProgress size={20} sx={{ color: '#3b82f6', mr: 1.5 }} />
                                                            ) : (
                                                                <Typography sx={{ fontSize: '24px', mr: 1.5 }}>
                                                                    {selection.icon}
                                                                </Typography>
                                                            )}
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                                                                {selection.name}
                                                            </Typography>
                                                        </Box>
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.4 }}>
                                                            {loadingSelection === selection.name ? 'Loading cities...' : selection.description}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            )}

                            {/* Geographic Filters Tab */}
                            {activeTab === 2 && (
                                <Box>
                                    <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                        Detailed Geographic Zone Configuration
                                    </Typography>
                                    <Typography sx={{ mb: 3, fontSize: '14px', color: '#6b7280' }}>
                                        Configure specific geographic capabilities using checkboxes and detailed selection controls.
                                    </Typography>

                                    <Grid container spacing={3}>
                                        {/* Domestic Canada */}
                                        <Grid item xs={12}>
                                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={false} // Will be connected to zone config later
                                                                onChange={() => { }} // Will be connected to handlers later
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                                Domestic Canada (All CA)
                                                            </Typography>
                                                        }
                                                    />
                                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', color: '#0369a1' }}>
                                                            ✅ All Canadian provinces and territories are covered
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>

                                        {/* Domestic US */}
                                        <Grid item xs={12}>
                                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={false}
                                                                onChange={() => { }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                                Domestic US (All US)
                                                            </Typography>
                                                        }
                                                    />
                                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', color: '#0369a1' }}>
                                                            ✅ All US states and territories are covered
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>

                                        {/* Specific Provinces (CA) */}
                                        <Grid item xs={12}>
                                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={false}
                                                                onChange={() => { }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                                Specific Provinces (CA)
                                                            </Typography>
                                                        }
                                                    />
                                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', color: '#92400e' }}>
                                                            🚧 Province selection controls coming soon
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>

                                        {/* Specific States (US) */}
                                        <Grid item xs={12}>
                                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={false}
                                                                onChange={() => { }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                                Specific States (US)
                                                            </Typography>
                                                        }
                                                    />
                                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', color: '#92400e' }}>
                                                            🚧 State selection controls coming soon
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>

                                        {/* Cross-Border (CA ↔ US) */}
                                        <Grid item xs={12}>
                                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={false}
                                                                onChange={() => { }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                                Cross-Border (CA ↔ US)
                                                            </Typography>
                                                        }
                                                    />
                                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', color: '#92400e' }}>
                                                            🚧 Cross-border zone configuration coming soon
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>

                                        {/* Country-to-Country */}
                                        <Grid item xs={12}>
                                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={false}
                                                                onChange={() => { }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                                Country-to-Country
                                                            </Typography>
                                                        }
                                                    />
                                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', color: '#92400e' }}>
                                                            🚧 International route configuration coming soon
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>

                                        {/* Specific Cities */}
                                        <Grid item xs={12}>
                                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                                <CardContent sx={{ p: 2 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={true} // Always enabled since this is the main function
                                                                onChange={() => { }}
                                                                disabled
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                                Specific Cities (Active)
                                                            </Typography>
                                                        }
                                                    />
                                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#dcfce7', borderRadius: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', color: '#166534', mb: 1 }}>
                                                            ✅ City selection is active through this Smart City Selector
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#059669' }}>
                                                            Use the "Search & Browse" and "Quick Selections" tabs to select specific cities for your zone configuration.
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {/* Duplicate content removed - Search & Browse is activeTab === 0 */}
                            {false && (
                                <Box>
                                    {/* Search Controls */}
                                    <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <TextField
                                            placeholder="Search cities..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            size="small"
                                            sx={{ flex: 1 }}
                                            InputProps={{
                                                startAdornment: <SearchIcon sx={{ mr: 1, color: '#6b7280' }} />
                                            }}
                                        />
                                        <Button
                                            variant="outlined"
                                            startIcon={<SelectAllIcon />}
                                            onClick={handleSelectAll}
                                            size="small"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Toggle Page
                                        </Button>
                                    </Box>

                                    {/* Cities Table */}
                                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                    <TableCell padding="checkbox">
                                                        <Checkbox size="small" />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>City</TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Province/State</TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Country</TableCell>
                                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {paginatedCities.map((city) => {
                                                    const isSelected = selectedCityIds.has(city.searchKey || city.id);
                                                    return (
                                                        <TableRow
                                                            key={city.searchKey || city.id}
                                                            sx={{
                                                                '&:hover': { bgcolor: '#f8fafc' },
                                                                bgcolor: isSelected ? '#f0f9ff' : 'inherit'
                                                            }}
                                                        >
                                                            <TableCell padding="checkbox">
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={isSelected}
                                                                    onChange={(e) => handleCitySelection(city, e.target.checked)}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Box sx={{ fontSize: '14px' }}>{getCountryFlag(city.country)}</Box>
                                                                    <Box>
                                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                            {city.city}, {getStateProvinceCode(city.provinceStateName || city.provinceState)}, {city.country}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                            {city.postalCode}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                {city.provinceStateName || city.provinceState}
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                {city.countryName || city.country}
                                                            </TableCell>
                                                            <TableCell>
                                                                {isSelected && (
                                                                    <Chip
                                                                        label="Selected"
                                                                        size="small"
                                                                        color="primary"
                                                                        variant="outlined"
                                                                        sx={{ fontSize: '10px' }}
                                                                    />
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    {/* Pagination */}
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
                                        rowsPerPageOptions={[25, 50, 100]}
                                        sx={{
                                            '& .MuiTablePagination-toolbar': {
                                                fontSize: '12px'
                                            }
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );

    // Preview Modal
    const renderPreviewModal = () => {
        // console.log('🎭 MODAL RENDER - Preview modal rendering, open:', previewOpen, 'cities:', previewData.cities.length);
        return (
            <Dialog
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        height: '70vh',
                        zIndex: 10000
                    }
                }}
                sx={{
                    zIndex: 10000,
                    '& .MuiBackdrop-root': {
                        zIndex: 9999
                    }
                }}
                disablePortal={false}
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px' }}>
                                Preview: {previewData.selection?.name}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                                {previewData.cities.length} cities will be added to your selection
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                onClick={() => setPreviewOpen(false)}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    handleQuickSelection(previewData.selection);
                                    setPreviewOpen(false);
                                }}
                                disabled={loadingSelection}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                {loadingSelection ? <CircularProgress size={16} sx={{ mr: 0.5 }} /> : null}
                                +ADD {previewData.cities.length} Cities
                            </Button>
                        </Box>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    <TableContainer sx={{ height: 'calc(70vh - 120px)' }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, bgcolor: '#f8fafc' }}>City</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, bgcolor: '#f8fafc' }}>Province/State</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, bgcolor: '#f8fafc' }}>Country</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, bgcolor: '#f8fafc' }}>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {previewData.cities.map((city, index) => {
                                    const isAlreadySelected = selectedCityIds.has(city.searchKey || city.id);
                                    return (
                                        <TableRow key={city.searchKey || city.id || index}>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box sx={{ fontSize: '14px' }}>{getCountryFlag(city.country)}</Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {city.city}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {city.provinceStateName || city.provinceState}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {city.country === 'CA' ? 'Canada' : city.country === 'US' ? 'United States' : city.country}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {isAlreadySelected ? (
                                                    <Chip label="Already Selected" size="small" color="default" sx={{ fontSize: '10px' }} />
                                                ) : (
                                                    <Chip label="Will Add" size="small" color="primary" sx={{ fontSize: '10px' }} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
            </Dialog>
        );
    };

    // Return the appropriate component based on embedded mode
    if (embedded) {
        return (
            <>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px' }}>
                                    {title}
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                                    Advanced city selection with smart filters and bulk operations
                                </Typography>
                            </Box>
                            <Chip
                                label={`${selectedCityIds.size} cities selected`}
                                color="primary"
                                size="small"
                                sx={{ fontSize: '11px' }}
                            />
                        </Box>
                    </Box>

                    {/* Tabs */}
                    <Box sx={{ borderBottom: '1px solid #e5e7eb' }}>
                        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ minHeight: 40 }}>
                            {tabs.map((tab, index) => (
                                <Tab
                                    key={index}
                                    label={tab.label}
                                    icon={tab.icon}
                                    iconPosition="start"
                                    sx={{
                                        fontSize: '12px',
                                        minHeight: 40,
                                        textTransform: 'none',
                                        '& .MuiTab-iconWrapper': { mr: 1 }
                                    }}
                                />
                            ))}
                        </Tabs>
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                        {activeTab === 0 && renderSearchTab()}
                        {activeTab === 1 && (
                            <Suspense fallback={
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                    <CircularProgress />
                                    <Typography sx={{ ml: 2, fontSize: '14px' }}>Loading Map Tools...</Typography>
                                </Box>
                            }>
                                <MapCitySelector
                                    selectedCities={selectedCities}
                                    onSelectionComplete={handleMapSelectionComplete}
                                    zoneCategory={zoneCategory}
                                    embedded={true}
                                    onMapAreaSave={onMapAreaSave}
                                    onDone={() => setActiveTab(0)}
                                    initialAreas={savedAreas.filter(a => a.zoneCategory === zoneCategory)}
                                />
                            </Suspense>
                        )}
                    </Box>
                </Box>

                {/* Simple Preview Modal */}
                <Dialog
                    open={previewOpen}
                    onClose={() => setPreviewOpen(false)}
                    maxWidth="md"
                    fullWidth
                    sx={{ zIndex: 9999 }}
                >
                    <DialogTitle>
                        Preview: {previewData.selection?.name}
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            {previewData.cities.length} cities will be added
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                            {previewData.cities.slice(0, 50).map((city, index) => (
                                <Typography key={index} sx={{ fontSize: '12px', py: 0.5 }}>
                                    {getCountryFlag(city.country)} {city.city}, {getStateProvinceCode(city.provinceStateName || city.provinceState)}, {city.country}
                                </Typography>
                            ))}
                            {previewData.cities.length > 50 && (
                                <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 1 }}>
                                    ... and {previewData.cities.length - 50} more cities
                                </Typography>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setPreviewOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                setPreviewOpen(false);
                                handleQuickSelection(previewData.selection);
                            }}
                        >
                            Add All {previewData.cities.length} Cities
                        </Button>
                    </DialogActions>
                </Dialog>
            </>
        );
    }

    // Original Dialog mode
    return (
        <>
            <Dialog
                open={isOpen}
                onClose={onClose}
                maxWidth="xl"
                fullWidth
                PaperProps={{ sx: { height: '90vh' } }}
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
                                {title}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                                Advanced city selection with smart filters and bulk operations
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip
                                label={`${selectedCityIds.size} cities selected`}
                                color="primary"
                                size="small"
                                sx={{ fontSize: '11px' }}
                            />
                            <Button
                                variant="outlined"
                                onClick={onClose}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleComplete}
                                disabled={selectedCityIds.size === 0}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Add {selectedCityIds.size} Cities
                            </Button>
                        </Box>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs
                            value={activeTab}
                            onChange={(e, newValue) => setActiveTab(newValue)}
                            sx={{
                                px: 3,
                                '& .MuiTab-root': {
                                    fontSize: '12px',
                                    textTransform: 'none',
                                    minHeight: 48
                                }
                            }}
                        >
                            {tabs.map((tab, index) => (
                                <Tab
                                    key={index}
                                    label={tab.label}
                                    icon={tab.icon}
                                    iconPosition="start"
                                />
                            ))}
                        </Tabs>
                    </Box>

                    <Box sx={{ p: 3, height: 'calc(90vh - 200px)', overflow: 'auto' }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <>
                                {activeTab === 0 && renderSearchTab()}
                                {activeTab === 1 && (
                                    <Suspense fallback={
                                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                            <CircularProgress />
                                            <Typography sx={{ ml: 2, fontSize: '14px' }}>Loading Map Tools...</Typography>
                                        </Box>
                                    }>
                                        <MapCitySelector
                                            selectedCities={selectedCities}
                                            onSelectionComplete={handleMapSelectionComplete}
                                            zoneCategory={zoneCategory}
                                            embedded={true}
                                            onMapAreaSave={onMapAreaSave}
                                            onDone={() => setActiveTab(0)}
                                            initialAreas={savedAreas.filter(a => a.zoneCategory === zoneCategory)}
                                        />
                                    </Suspense>
                                )}
                            </>
                        )}
                    </Box>
                </DialogContent>
            </Dialog>

        </>
    );
};

export default SmartCitySelector;
